import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得目前模組的路徑以正確定位位於根目錄的 .env 檔案
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// MS SQL Server 連線設定配置
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: true, // 針對雲端或實體 SQL Server 的安全傳輸協定加密
    trustServerCertificate: true, // 允許自簽署憑證以避免本地測試失敗
  },
  pool: {
    max: 15, // 連線池最大連線數
    min: 0,  // 連線池最小連線數
    idleTimeoutMillis: 30000 // 閒置連線釋放時間 (30秒)
  }
};

let poolPromise;

/**
 * 獲取並維持單一資料庫連線池 (Singleton Connection Pool)
 * @returns {Promise<sql.ConnectionPool>}
 */
export const getPool = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then(pool => {
        console.log('成功建立實體 MS SQL Server 連線池！');
        return pool;
      })
      .catch(err => {
        console.error('資料庫連線池建立失敗，請檢查 .env 配置或網路連線。錯誤細節：', err);
        poolPromise = null; // 失敗時重設，使下次呼叫能重新試圖連線
        throw err;
      });
  }
  return poolPromise;
};

/**
 * 執行安全的唯讀 SQL 參數化查詢 (防範 SQL 注入與非法寫入)
 * @param {string} queryText - SQL 查詢語句 (僅限 SELECT 等唯讀操作)
 * @param {Array<{name: string, type: sql.Type, value: any}>} params - 參數化查詢的參數列表
 * @returns {Promise<Array>} - 查詢結果資料列 (Recordset)
 */
export const query = async (queryText, params = []) => {
  // 1. 唯讀架構檢查：嚴禁執行任何資料變更操作 (Database & Security 規範)
  const forbiddenKeywords = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i;
  if (forbiddenKeywords.test(queryText)) {
    const errMsg = '安全性拒絕：本系統為純唯讀架構，嚴禁執行任何資料寫入、修改或結構變更指令。';
    console.error(`${errMsg}\n違規語句: "${queryText}"`);
    throw new Error(errMsg);
  }

  try {
    // 2. 獲取連線池實例
    const pool = await getPool();

    // 3. 建立連線請求
    const request = pool.request();

    // 4. 綁定傳入的參數，進行「參數化查詢 (Parameterized Queries)」以防範 SQL 注入
    params.forEach(param => {
      // 確保參數結構正確且包含必要的屬性
      if (param && param.name && param.value !== undefined) {
        // param.type 若未提供，mssql 會自動進行型態推斷，但建議明確給予 (如 sql.VarChar, sql.Int 等)
        if (param.type) {
          request.input(param.name, param.type, param.value);
        } else {
          request.input(param.name, param.value);
        }
      }
    });

    // 5. 執行安全查詢
    const result = await request.query(queryText);
    
    // 6. 回傳資料集結果
    return result.recordset;
  } catch (err) {
    // 7. 錯誤處理：詳細的系統底層錯誤記錄在後端日誌中
    console.error('資料庫查詢出錯：', err.message, err.stack);
    
    // 8. 為了安全性，回傳給前端或外部的錯誤訊息必須是安全的通用提示，防止敏感資料庫結構外洩
    throw new Error('無法取得庫存數據，請聯絡系統管理員。');
  }
};

// 匯出 mssql 原生模組，以便需要原生型態 (如 sql.Int, sql.VarChar) 時使用
export { sql };
