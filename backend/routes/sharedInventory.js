import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { sql, getPool } from '../config/db.js';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Shared Inventory Query Engine
async function getSharedInventoryData(itemCodes, pool) {
    if (!itemCodes || itemCodes.length === 0) return [];
    
    const results = [];
    
    // 使用 Promise.all 並發查詢，提升多料號查詢效率
    const promises = itemCodes.map(async (targetItem) => {
        try {
            // 檢查本尊是否存在且未凍結
            const targetNameRes = await pool.request()
                .input('target', sql.NVarChar, targetItem)
                .query(`SELECT ItemName FROM OITM WHERE ItemCode = @target AND FrozenFor = 'N'`);
            
            if (targetNameRes.recordset.length === 0) {
                // 料號不存在或已停用
                results.push({
                    queriedItem: targetItem,
                    queriedItemName: '未知或已停用料號',
                    plants: [],
                    isInvalid: true
                });
                return;
            }
            const targetItemName = targetNameRes.recordset[0].ItemName;

            const request = pool.request();
            request.input('targetItem', sql.NVarChar, targetItem);
            
            // 實作共用料智慧判讀邏輯：
            // 1. 本尊
            // 2. Middle-14 一致
            // 3. BOM 的 Z 件一致
            const query = `
                DECLARE @Mid14 NVARCHAR(14) = SUBSTRING(@targetItem, 4, 14);
                DECLARE @Z_Comp NVARCHAR(50) = (SELECT TOP 1 Code FROM ITT1 WHERE Father = @targetItem AND Code LIKE '%Z');

                WITH ShareableItems AS (
                    SELECT ItemCode, ItemName 
                    FROM OITM 
                    WHERE (LEN(ItemCode) >= 17 AND SUBSTRING(ItemCode, 4, 14) = @Mid14)
                       OR (@Z_Comp IS NOT NULL AND ItemCode IN (SELECT Father FROM ITT1 WHERE Code = @Z_Comp))
                       OR ItemCode = @targetItem
                ),
                InventoryData AS (
                    SELECT 
                        T0.ItemCode,
                        T0.ItemName,
                        T1.WhsCode,
                        T1.OnHand,
                        T1.IsCommited,
                        T1.OnOrder,
                        (T1.OnHand - T1.IsCommited + T1.OnOrder) AS Available,
                        SUBSTRING(T1.WhsCode, 1, 3) AS PlantPrefix
                    FROM ShareableItems T0
                    INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
                    WHERE T1.OnHand > 0 OR T1.OnOrder > 0 OR T1.IsCommited > 0
                )
                SELECT * FROM InventoryData;
            `;
            
            const result = await request.query(query);
            const invData = result.recordset;

            const plantMap = new Map();
            
            // 處理各倉明細，改以廠區 (PlantPrefix) 為主單位進行分組
            invData.forEach(row => {
                // Initialize plant in plantMap
                if (!plantMap.has(row.PlantPrefix)) {
                    plantMap.set(row.PlantPrefix, {
                        plantPrefix: row.PlantPrefix,
                        targetOnHand: 0,
                        smartQty: 0,
                        sharedDetails: []
                    });
                }
                
                const plantObj = plantMap.get(row.PlantPrefix);
                if (row.ItemCode === targetItem) {
                    plantObj.targetOnHand += row.OnHand; // 累加同廠區各倉庫的本尊庫存
                }

                // Gather details at the plant level
                plantObj.sharedDetails.push({
                    whsCode: row.WhsCode,
                    itemCode: row.ItemCode,
                    itemName: row.ItemName,
                    onHand: row.OnHand,
                    isCommited: row.IsCommited,
                    onOrder: row.OnOrder,
                    available: row.Available
                });
            });
            
            // 計算廠區級別的「智慧庫存判讀量」
            const plantTotals = {};
            invData.forEach(row => {
                plantTotals[row.PlantPrefix] = (plantTotals[row.PlantPrefix] || 0) + row.Available;
            });
            
            const plants = Array.from(plantMap.values()).map(plant => {
                plant.smartQty = plantTotals[plant.plantPrefix] || 0;
                return plant;
            });
            
            results.push({
                queriedItem: targetItem,
                queriedItemName: targetItemName,
                plants: plants
            });
            
        } catch (err) {
            console.error(`Error processing item ${targetItem}:`, err);
            results.push({
                queriedItem: targetItem,
                queriedItemName: '查詢錯誤',
                warehouses: [],
                error: err.message
            });
        }
    });
    
    await Promise.all(promises);
    return results;
}

// 1. 單筆/訂單查詢
router.get('/search', async (req, res) => {
    try {
        const { itemCode, orderNum } = req.query;
        const pool = await getPool();
        
        let targetItems = [];
        
        if (itemCode) {
            targetItems.push(itemCode);
        } else if (orderNum) {
            // 透過 ORDR 與 RDR1 找出該訂單所有的料號
            const orderRes = await pool.request()
                .input('orderNum', sql.NVarChar, orderNum)
                .query(`
                    SELECT DISTINCT T1.ItemCode 
                    FROM ORDR T0 
                    INNER JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry 
                    WHERE T0.U_ITNM = @orderNum
                `);
            targetItems = orderRes.recordset.map(r => r.ItemCode);
            if (targetItems.length === 0) {
                return res.json({ success: false, message: '找不到該訂單內部號碼，或該訂單無明細' });
            }
        } else {
            return res.status(400).json({ success: false, message: '請提供 itemCode 或 orderNum' });
        }
        
        const data = await getSharedInventoryData(targetItems, pool);
        res.json({ success: true, data });
        
    } catch (error) {
        console.error('Search API Error:', error);
        res.status(500).json({ success: false, message: '伺服器錯誤' });
    }
});

// 2. Excel 批次匯入多筆料號
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '無上傳檔案' });
        }
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        let itemCodes = [];
        let duplicateItems = [];
        let failedItems = [];
        
        data.forEach(row => {
            if (row && row[0]) {
                const code = String(row[0]).trim();
                if (code && code.toLowerCase() !== 'itemcode' && code !== '料號') {
                    if (itemCodes.includes(code)) {
                        if (!duplicateItems.includes(code)) {
                            duplicateItems.push(code);
                        }
                    } else {
                        itemCodes.push(code);
                    }
                }
            }
        });
        
        if (itemCodes.length === 0) {
            return res.json({ success: false, message: 'Excel 中找不到有效的料號清單' });
        }
        
        const pool = await getPool();
        const results = await getSharedInventoryData(itemCodes, pool);
        
        let successCount = 0;
        let filteredResults = [];
        results.forEach(result => {
            if (result.error || result.isInvalid) {
                failedItems.push(result.queriedItem);
            } else {
                successCount++;
                filteredResults.push(result);
            }
        });
        
        res.json({ 
            success: true, 
            data: filteredResults,
            summary: {
                successCount,
                failCount: failedItems.length,
                failedItems,
                duplicateCount: duplicateItems.length,
                duplicateItems
            }
        });
    } catch (error) {
        console.error('Import API Error:', error);
        res.status(500).json({ success: false, message: '伺服器匯入錯誤' });
    }
});

export default router;
