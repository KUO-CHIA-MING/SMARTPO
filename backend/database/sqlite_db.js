import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 資料庫檔案路徑
const dbPath = path.join(__dirname, 'focus_inventory.db');

// 全域資料庫實例
let dbInstance = null;

/**
 * 初始化並連接 SQLite 資料庫
 */
export async function initSqliteDb() {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log(`[SQLite] 已連接至本地重點庫存資料庫: ${dbPath}`);

        // 建立 focus_items 資料表（如果不存在）
        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS focus_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_code VARCHAR(20) UNIQUE NOT NULL, 
                is_visible INTEGER DEFAULT 1,          
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[SQLite] focus_items 資料表已確認/建立完畢');

        return dbInstance;
    } catch (error) {
        console.error('[SQLite] 資料庫初始化失敗:', error);
        throw error;
    }
}

/**
 * 取得 SQLite 資料庫實例
 */
export function getSqliteDb() {
    if (!dbInstance) {
        throw new Error('[SQLite] 資料庫尚未初始化，請先呼叫 initSqliteDb()');
    }
    return dbInstance;
}
