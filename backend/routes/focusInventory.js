import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { getSqliteDb } from '../database/sqlite_db.js';
import { sql, getPool } from '../config/db.js'; // 從您的 db.js 匯入實體 B1 連線池

const router = express.Router();

// 設定 Multer (使用記憶體儲存，不寫入實體硬碟)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/focus-inventory/admin-list
 * 取得後台維護清單 (僅讀取 SQLite)
 */
router.get('/admin-list', async (req, res) => {
    try {
        const sqliteDb = getSqliteDb();
        const items = await sqliteDb.all(`
            SELECT item_code as ItemCode, is_visible as IsVisible, created_at as CreatedAt 
            FROM focus_items 
            ORDER BY created_at DESC
        `);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('[FocusInventory] admin-list 錯誤:', error);
        res.status(500).json({ success: false, message: '讀取維護清單失敗' });
    }
});

/**
 * PUT /api/focus-inventory/toggle
 * 切換前台顯示狀態
 */
router.put('/toggle', async (req, res) => {
    try {
        const { itemCode, isVisible } = req.body;
        if (!itemCode || isVisible === undefined) {
            return res.status(400).json({ success: false, message: '缺少必要參數' });
        }

        const sqliteDb = getSqliteDb();
        await sqliteDb.run(
            `UPDATE focus_items SET is_visible = ? WHERE item_code = ?`,
            [isVisible, itemCode]
        );
        res.json({ success: true, message: '狀態更新成功' });
    } catch (error) {
        console.error('[FocusInventory] toggle 錯誤:', error);
        res.status(500).json({ success: false, message: '狀態更新失敗' });
    }
});

/**
 * DELETE /api/focus-inventory/delete
 * 刪除品項
 */
router.delete('/delete', async (req, res) => {
    try {
        const { itemCode } = req.body;
        if (!itemCode) {
            return res.status(400).json({ success: false, message: '缺少必要參數' });
        }

        const sqliteDb = getSqliteDb();
        await sqliteDb.run(
            `DELETE FROM focus_items WHERE item_code = ?`,
            [itemCode]
        );
        res.json({ success: true, message: '已成功移除' });
    } catch (error) {
        console.error('[FocusInventory] delete 錯誤:', error);
        res.status(500).json({ success: false, message: '刪除失敗' });
    }
});

/**
 * POST /api/focus-inventory/add
 * 單筆新增驗證並寫入
 */
router.post('/add', async (req, res) => {
    try {
        const { itemCode } = req.body;
        if (!itemCode || typeof itemCode !== 'string' || itemCode.trim().length !== 18) {
            return res.status(400).json({ success: false, successCount: 0, failCount: 1, message: '料號長度不符 (必須為 18 碼)' });
        }

        const cleanedCode = itemCode.trim();

        // 向 SAP B1 發送唯讀查詢，確認存在性
        const pool = await getPool();
        const b1Result = await pool.request()
            .input('itemCode', sql.VarChar, cleanedCode)
            .query(`SELECT TOP 1 ItemCode FROM OITM WHERE ItemCode = @itemCode AND FrozenFor = 'N'`);

        if (b1Result.recordset.length === 0) {
            return res.json({ success: false, successCount: 0, failCount: 1, message: '此料號在 SAP B1 系統中不存在或已凍結' });
        }

        const sqliteDb = getSqliteDb();

        // 檢查是否已在 SQLite 重點清單中
        const existing = await sqliteDb.get(`SELECT item_code FROM focus_items WHERE item_code = ?`, [cleanedCode]);
        if (existing) {
            return res.json({ success: false, successCount: 0, failCount: 0, duplicateCount: 1, message: '此料號已存在於重點清單中，無須重複新增' });
        }

        // 存在且未重複，寫入 SQLite
        await sqliteDb.run(
            `INSERT INTO focus_items (item_code, is_visible) VALUES (?, 1)`,
            [cleanedCode]
        );

        res.json({ success: true, successCount: 1, failCount: 0, message: '新增成功' });
    } catch (error) {
        console.error('[FocusInventory] add 錯誤:', error);
        res.status(500).json({ success: false, message: '單筆新增失敗' });
    }
});

/**
 * POST /api/focus-inventory/import
 * Excel 批次整批匯入與比對
 */
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未上傳檔案' });
        }

        // 解析 Excel
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // 轉為 JSON，強制標題列映射
        const rawData = xlsx.utils.sheet_to_json(worksheet);
        
        let validLengthItems = [];
        let failedItems = [];

        rawData.forEach(row => {
            // 自動尋找可能包含 'ItemCode' 或類似字眼的屬性，或者直接取第一個屬性
            // 這裡我們假設首行就是 'ItemCode'
            let code = row['ItemCode'] || row['itemcode'] || row['Item Code'] || Object.values(row)[0];
            
            if (code) {
                code = String(code).trim();
                if (code.length === 18) {
                    if (!validLengthItems.includes(code)) {
                        validLengthItems.push(code);
                    }
                } else {
                    failedItems.push(code); // 格式不符
                }
            }
        });

        if (validLengthItems.length === 0) {
            return res.json({ 
                success: true, 
                successCount: 0, 
                failCount: failedItems.length, 
                failedItems,
                message: '無有效的 18 碼料號可比對' 
            });
        }

        // 向 SAP B1 比對 (因 in 數量不確定，使用動態生成參數)
        const pool = await getPool();
        const request = pool.request();
        
        const params = [];
        validLengthItems.forEach((item, index) => {
            const paramName = `item${index}`;
            request.input(paramName, sql.VarChar, item);
            params.push(`@${paramName}`);
        });

        const query = `SELECT ItemCode FROM OITM WHERE ItemCode IN (${params.join(', ')}) AND FrozenFor = 'N'`;
        const b1Result = await request.query(query);

        // 提取 B1 存在的料號
        const existingInB1 = b1Result.recordset.map(row => row.ItemCode);

        const sqliteDb = getSqliteDb();
        
        // 提取 SQLite 已經存在的料號
        const existingInSqliteRows = await sqliteDb.all(
            `SELECT item_code FROM focus_items WHERE item_code IN (${validLengthItems.map(() => '?').join(', ')})`, 
            validLengthItems
        );
        const existingInSqlite = existingInSqliteRows.map(row => row.item_code);

        let successCount = 0;
        let duplicateCount = 0;
        let duplicateItems = [];

        for (const code of validLengthItems) {
            if (existingInB1.includes(code)) {
                if (existingInSqlite.includes(code)) {
                    duplicateCount++;
                    duplicateItems.push(code); // SQLite 已存在
                } else {
                    // 寫入 SQLite
                    await sqliteDb.run(
                        `INSERT INTO focus_items (item_code, is_visible) VALUES (?, 1)`,
                        [code]
                    );
                    successCount++;
                }
            } else {
                failedItems.push(code); // B1 不存在
            }
        }

        res.json({
            success: true,
            successCount,
            failCount: failedItems.length,
            failedItems,
            duplicateCount,
            duplicateItems
        });
    } catch (error) {
        console.error('[FocusInventory] import 錯誤:', error);
        res.status(500).json({ success: false, message: '匯入解析與比對失敗' });
    }
});

/**
 * GET /api/focus-inventory/list
 * 取得前台重點庫存列表 (SQLite + SAP B1 即時彙總)
 */
router.get('/list', async (req, res) => {
    try {
        const sqliteDb = getSqliteDb();
        
        // 1. 撈取設定為顯示的重點料號
        const visibleItems = await sqliteDb.all(`SELECT item_code FROM focus_items WHERE is_visible = 1`);
        
        if (visibleItems.length === 0) {
            return res.json({ success: true, total: 0, data: [] });
        }

        const itemCodes = visibleItems.map(row => row.item_code);

        // 2. 向 SAP B1 發送 SQL 查詢
        const pool = await getPool();
        const request = pool.request();
        
        const params = [];
        itemCodes.forEach((item, index) => {
            const paramName = `focusItem${index}`;
            request.input(paramName, sql.VarChar, item);
            params.push(`@${paramName}`);
        });

        const query = `
            SELECT 
                T0.ItemCode,
                T0.ItemName,
                SUM(T1.OnHand) AS OnHand,
                SUM(T1.IsCommited) AS IsCommited,
                SUM(T1.OnOrder) AS OnOrder,
                SUM(T1.MinOrder) AS MinOrder,
                SUM(T1.MinStock) AS MinStock,
                SUM(T1.MaxStock) AS MaxStock
            FROM OITM T0
            INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
            WHERE T0.ItemCode IN (${params.join(', ')})
              AND T0.FrozenFor = 'N'
            GROUP BY T0.ItemCode, T0.ItemName
        `;

        const b1Result = await request.query(query);
        
        const data = b1Result.recordset;

        res.json({ success: true, total: data.length, data });
    } catch (error) {
        console.error('[FocusInventory] list 錯誤:', error);
        res.status(500).json({ success: false, message: '讀取即時重點庫存失敗' });
    }
});

export default router;
