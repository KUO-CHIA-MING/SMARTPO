import { query, sql } from './config/db.js';

console.log('================================================');
console.log('   開始執行 MS SQL 資料庫安全與連線規範測試');
console.log('================================================\n');

/**
 * 測試 1：驗證是否能成功攔截寫入指令 (INSERT/UPDATE/DELETE/DROP/ALTER)
 */
async function testReadOnlyGuard() {
  console.log('【測試項目 1】唯讀架構安全防護 (寫入禁令測試)');
  const dirtyQueries = [
    "INSERT INTO Inventory (ItemNo, Qty) VALUES ('A001', 100)",
    "UPDATE PurchaseOrder SET Status = 'Closed' WHERE Id = 10",
    "DELETE FROM Users WHERE Id = 1",
    "DROP TABLE Inventory",
    "ALTER TABLE Inventory ADD Column_Test VARCHAR(50)"
  ];

  let allPassed = true;

  for (const q of dirtyQueries) {
    try {
      await query(q);
      console.log(`❌ 測試失敗：寫入型 SQL 語句未被攔截！指令: "${q}"`);
      allPassed = false;
    } catch (err) {
      if (err.message.includes('安全性拒絕')) {
        console.log(`✅ 成功攔截："${q.split(' ')[0]}" 指令被安全阻攔。`);
      } else {
        console.log(`❌ 測試失敗：未被預期安全阻攔，但發生其他錯誤：${err.message}`);
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log('>> 測試結果：【通過】所有變更型 SQL 指令均被安全機制阻攔！\n');
  } else {
    console.log('>> 測試結果：【失敗】有部分變更型 SQL 指令成功繞過防護！\n');
  }
}

/**
 * 測試 2：驗證在連線失敗或資料庫異常時，是否會隱藏詳細系統錯誤並拋出安全的通用錯誤提示
 */
async function testErrorHandling() {
  console.log('【測試項目 2】連線出錯與安全性錯誤處理測試');
  const safeQuery = "SELECT * FROM Inventory WHERE ItemNo = @itemNo";
  const params = [
    { name: 'itemNo', type: sql.VarChar, value: 'A001' }
  ];

  try {
    console.log('正試圖連接資料庫（預期因未設定真實 .env 而失敗）...');
    await query(safeQuery, params);
    console.log('❌ 測試失敗：在無效設定下居然成功連線並查詢？');
  } catch (err) {
    // 預期拋出的錯誤應該是被包裝過的安全錯誤提示，而非詳細連線失敗原因
    if (err.message === '無法取得庫存數據，請聯絡系統管理員。') {
      console.log('✅ 成功包裝：底層連線錯誤已安全隱藏！');
      console.log(`回傳給呼叫端/前端的錯誤訊息: "${err.message}"`);
      console.log('>> 測試結果：【通過】成功落實錯誤安全過濾防範！\n');
    } else {
      console.log(`❌ 測試失敗：回傳了未經過濾的安全底層錯誤資訊！錯誤訊息: "${err.message}"\n`);
    }
  }
}

async function runTests() {
  try {
    await testReadOnlyGuard();
    await testErrorHandling();
  } catch (error) {
    console.error('測試執行中發生未預期錯誤：', error);
  } finally {
    console.log('================================================');
    console.log('   測試流程執行完畢，即將結束程序。');
    console.log('================================================');
    // 強制結束行程，避免未連線成功的連線池異步事件殘留導致行程未結束
    process.exit(0);
  }
}

runTests();
