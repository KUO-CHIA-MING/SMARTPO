import express from 'express';
import cors from 'cors';
import { query, sql } from './config/db.js';
import { initSqliteDb } from './database/sqlite_db.js';
import focusInventoryRouter from './routes/focusInventory.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 啟用 CORS 跨來源資源共享，允許前端（預設為 5173）存取
app.use(cors());
app.use(express.json());

// ==========================================
// 1. 庫存水位監控 API
// ==========================================
app.get('/api/inventory/level-monitor', async (req, res) => {
  try {
    // 高效 SQL 聚合查詢：直接從 V_SMARTPO_InventoryLevel 中計算各水位的筆數與佔比
    const sqlQuery = `
      SELECT 
          COUNT(*) AS totalActiveItems,
          SUM(CASE WHEN (OnHand + OnOrder) < MinOrder AND (OnHand + OnOrder) >= MinStock THEN 1 ELSE 0 END) AS underTargetCount,
          SUM(CASE WHEN (OnHand + OnOrder) < MinStock THEN 1 ELSE 0 END) AS underSafetyCount,
          SUM(CASE WHEN OnHand > MaxStock THEN 1 ELSE 0 END) AS overMaxCount
      FROM V_SMARTPO_InventoryLevel;
    `;
    
    const recordset = await query(sqlQuery);
    const row = recordset[0] || { totalActiveItems: 0, underTargetCount: 0, underSafetyCount: 0, overMaxCount: 0 };
    const total = row.totalActiveItems || 0;

    res.json({
      success: true,
      totalActiveItems: total,
      underTarget: {
        count: row.underTargetCount || 0,
        percentage: total > 0 ? parseFloat(((row.underTargetCount / total) * 100).toFixed(1)) : 0
      },
      underSafety: {
        count: row.underSafetyCount || 0,
        percentage: total > 0 ? parseFloat(((row.underSafetyCount / total) * 100).toFixed(1)) : 0
      },
      overMax: {
        count: row.overMaxCount || 0,
        percentage: total > 0 ? parseFloat(((row.overMaxCount / total) * 100).toFixed(1)) : 0
      }
    });
  } catch (error) {
    console.error('level-monitor 實體資料庫連線或查詢出錯：', error);
    // 安全性防護：隱蔽底層資料庫錯誤細節，回傳通用錯誤訊息
    res.status(500).json({ success: false, message: '無法取得庫存水位數據，請聯絡系統管理員。' });
  }
});

// ==========================================
// 2. 採購到達率與逾期監控 API
// ==========================================
app.get('/api/po/delivery-rate', async (req, res) => {
  try {
    // 利用高雅的 SQL UNION ALL 聯合查詢，一次性撈出本月、上月、今年度達交率
    const sqlQuery = `
      SELECT 'thisMonth' AS Period,
             ISNULL(SUM(CASE WHEN DocStatus = 'C' THEN 1.0 ELSE 0.0 END), 0) AS ClosedCount,
             COUNT(*) AS TotalCount
      FROM OPOR
      WHERE DocDate >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) -- 本月第一天
        AND DocDate <= GETDATE()
      UNION ALL
      SELECT 'lastMonth' AS Period,
             ISNULL(SUM(CASE WHEN DocStatus = 'C' THEN 1.0 ELSE 0.0 END), 0) AS ClosedCount,
             COUNT(*) AS TotalCount
      FROM OPOR
      WHERE DocDate >= DATEADD(month, DATEDIFF(month, 0, GETDATE()) - 1, 0) -- 上月第一天
        AND DocDate < DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) -- 本月第一天
      UNION ALL
      SELECT 'thisYear' AS Period,
             ISNULL(SUM(CASE WHEN DocStatus = 'C' THEN 1.0 ELSE 0.0 END), 0) AS ClosedCount,
             COUNT(*) AS TotalCount
      FROM OPOR
      WHERE DocDate >= DATEADD(year, DATEDIFF(year, 0, GETDATE()), 0) -- 今年第一天
        AND DocDate <= GETDATE();
    `;

    const recordset = await query(sqlQuery);
    
    const periods = {
      thisMonth: { rate: 100.0, status: 'green' },
      lastMonth: { rate: 100.0, status: 'green' },
      thisYear: { rate: 100.0, status: 'green' }
    };
    
    recordset.forEach(row => {
      const total = row.TotalCount || 0;
      const closed = row.ClosedCount || 0;
      // 達交率計算公式：已結案 / (已結案 + 未結案) * 100%，並四捨五入至小數點後第一位
      const rate = total > 0 ? parseFloat(((closed / total) * 100).toFixed(1)) : 100.0;
      
      // 依據達交率健康區間決定綠/黃/紅狀態燈號
      let status = 'green';
      if (rate < 80.0) status = 'red';
      else if (rate < 90.0) status = 'yellow';
      
      periods[row.Period] = { rate, status };
    });

    res.json({
      success: true,
      ...periods
    });
  } catch (error) {
    console.error('delivery-rate 實體資料庫連線或查詢出錯：', error);
    res.status(500).json({ success: false, message: '無法取得採購達交率數據，請聯絡系統管理員。' });
  }
});

// ==========================================
// 3. 庫存週轉與庫齡監控 API
// ==========================================
app.get('/api/inventory/turnover-age', async (req, res) => {
  try {
    // 對 V_SMARTPO_InventoryAge 進行庫齡天數區間的高效分類統計
    const sqlQuery = `
      SELECT 
          COUNT(*) AS totalItems,
          SUM(CASE WHEN AgeDays < 180 THEN 1 ELSE 0 END) AS freshCount,
          SUM(CASE WHEN AgeDays >= 180 AND AgeDays <= 360 THEN 1 ELSE 0 END) AS mildCount,
          SUM(CASE WHEN AgeDays >= 361 AND AgeDays <= 720 THEN 1 ELSE 0 END) AS moderateCount,
          SUM(CASE WHEN AgeDays >= 721 AND AgeDays <= 1080 THEN 1 ELSE 0 END) AS severeCount,
          SUM(CASE WHEN AgeDays > 1080 THEN 1 ELSE 0 END) AS stagnantCount
      FROM V_SMARTPO_InventoryAge;
    `;

    const recordset = await query(sqlQuery);
    const row = recordset[0] || { totalItems: 0, freshCount: 0, mildCount: 0, moderateCount: 0, severeCount: 0, stagnantCount: 0 };
    const total = row.totalItems || 0;

    const ranges = [
      { name: '半年以下 (新鮮)', days: '< 180', count: row.freshCount || 0, percentage: total > 0 ? parseFloat(((row.freshCount / total) * 100).toFixed(1)) : 0, color: '#10B981' },
      { name: '半年至 1 年 (輕度積壓)', days: '180-360', count: row.mildCount || 0, percentage: total > 0 ? parseFloat(((row.mildCount / total) * 100).toFixed(1)) : 0, color: '#3B82F6' },
      { name: '1 年至 2 年 (中度積壓)', days: '361-720', count: row.moderateCount || 0, percentage: total > 0 ? parseFloat(((row.moderateCount / total) * 100).toFixed(1)) : 0, color: '#F59E0B' },
      { name: '2 年至 3 年 (重度積壓)', days: '721-1080', count: row.severeCount || 0, percentage: total > 0 ? parseFloat(((row.severeCount / total) * 100).toFixed(1)) : 0, color: '#EF4444' },
      { name: '3 年以上 (呆滯料)', days: '> 1080', count: row.stagnantCount || 0, percentage: total > 0 ? parseFloat(((row.stagnantCount / total) * 100).toFixed(1)) : 0, color: '#7C3AED' }
    ];

    res.json({
      success: true,
      totalItems: total,
      ranges
    });
  } catch (error) {
    console.error('turnover-age 實體資料庫連線或查詢出錯：', error);
    res.status(500).json({ success: false, message: '無法取得庫齡分析數據，請聯絡系統管理員。' });
  }
});

// ==========================================
// 4. 向下鑽研 (Drill-down) 明細 API (落實安全性與參數化查詢)
// ==========================================
app.get('/api/inventory/drilldown', async (req, res) => {
  try {
    const { type, range, search } = req.query;
    
    let sqlQuery = '';
    const params = [];

    // A. 處理庫存水位向下鑽研明細
    if (type === 'under-target') {
      sqlQuery = `
        SELECT ItemCode, ItemName, OnHand, OnOrder, MinOrder, MinStock, MaxStock 
        FROM V_SMARTPO_InventoryLevel
        WHERE (OnHand + OnOrder) < MinOrder AND (OnHand + OnOrder) >= MinStock
      `;
    } else if (type === 'under-safety') {
      sqlQuery = `
        SELECT ItemCode, ItemName, OnHand, OnOrder, MinOrder, MinStock, MaxStock 
        FROM V_SMARTPO_InventoryLevel
        WHERE (OnHand + OnOrder) < MinStock
      `;
    } else if (type === 'over-max') {
      sqlQuery = `
        SELECT ItemCode, ItemName, OnHand, OnOrder, MinOrder, MinStock, MaxStock 
        FROM V_SMARTPO_InventoryLevel
        WHERE OnHand > MaxStock
      `;
    } 
    // B. 處理庫齡區間向下鑽研明細
    else if (type === 'age-range' && range) {
      sqlQuery = `
        SELECT ItemCode, ItemName, OnHand, OnOrder, MinOrder, MinStock, MaxStock, AgeDays 
        FROM V_SMARTPO_InventoryAge
        WHERE 1 = 1
      `;
      if (range === '< 180') sqlQuery += ' AND AgeDays < 180';
      else if (range === '180-360') sqlQuery += ' AND AgeDays >= 180 AND AgeDays <= 360';
      else if (range === '361-720') sqlQuery += ' AND AgeDays >= 361 AND AgeDays <= 720';
      else if (range === '721-1080') sqlQuery += ' AND AgeDays >= 721 AND AgeDays <= 1080';
      else if (range === '> 1080') sqlQuery += ' AND AgeDays > 1080';
    } 
    // C. 處理採購達交向下鑽研明細 (安全關鍵：排除供應商名稱 CardName)
    else if (type === 'po-delivery') {
      sqlQuery = `
        SELECT 
            DocNum, 
            CardCode, 
            -- 基於機敏供應鏈資訊安全規範，CardName (主要供應商名稱) 予以屏蔽，直接不 SELECT 出來
            DocDate, 
            ItemCode, 
            Dscription, 
            Quantity, 
            OpenQty, 
            BuyerName
        FROM V_SMARTPO_PODeliveryDetail
        WHERE 1 = 1
      `;
      
      // 篩選：green 綠色為已達交結案，yellow/red 為有未交項目
      if (range === 'green') {
        sqlQuery += ' AND OpenQty = 0';
      } else if (range === 'yellow' || range === 'red') {
        sqlQuery += ' AND OpenQty > 0';
      }
      
      // 採購明細專用搜尋欄位參數化
      if (search) {
        sqlQuery += ' AND (ItemCode LIKE @search OR Dscription LIKE @search OR CAST(DocNum AS VARCHAR) LIKE @search)';
        params.push({ name: 'search', type: sql.VarChar, value: `%${search}%` });
      }
      
      const recordset = await query(sqlQuery, params);
      return res.json({
        success: true,
        total: recordset.length,
        data: recordset
      });
    } else {
      // 預設撈取水位資料
      sqlQuery = `SELECT ItemCode, ItemName, OnHand, OnOrder, MinOrder, MinStock, MaxStock FROM V_SMARTPO_InventoryLevel`;
    }

    // 非採購明細的通用物料料號與品名參數化搜尋
    if (search) {
      sqlQuery += ' AND (ItemCode LIKE @search OR ItemName LIKE @search)';
      params.push({ name: 'search', type: sql.VarChar, value: `%${search}%` });
    }

    const recordset = await query(sqlQuery, params);

    res.json({
      success: true,
      total: recordset.length,
      data: recordset
    });
  } catch (error) {
    console.error('drilldown 實體資料庫連線或查詢出錯：', error);
    res.status(500).json({ success: false, message: '無法取得向下鑽研明細數據，請聯絡系統管理員。' });
  }
});

// ==========================================
// 5. 註冊重點庫存查詢路由
// ==========================================
app.use('/api/focus-inventory', focusInventoryRouter);

// 初始化 SQLite 資料庫後再啟動伺服器
initSqliteDb().then(() => {
  app.listen(PORT, () => {
    console.log(`SmartPO 實體資料庫 API 服務已成功啟動！監聽 Port: ${PORT}`);
  });
}).catch(err => {
  console.error('SQLite 資料庫初始化失敗，伺服器無法啟動:', err);
});
