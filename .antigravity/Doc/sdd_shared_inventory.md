# SDD - 共用料智慧查詢模組 (Shared Inventory Module)

## 1. 業務故事 (Business Story)
**背景**：
在傳統 ERP 系統中，查詢料號庫存通常僅能列出單一料號在各倉庫的數量。然而，在製造業中，許多料件具有可替代性或共用性 (例如外骨骼護踝的不同尺寸綁帶、或透過 BOM 表定義的共用組件)。當單一料號缺料時，生管或採購人員需要花費大量時間交叉比對相關料號的庫存，這容易導致重複採購或生產停滯。

**目標**：
建立一個「共用料智慧查詢」模組。當使用者輸入單一料號，或上傳包含多筆料號的 Excel 檔案時，系統不僅查詢該本尊料號，還會透過智慧判讀邏輯，自動找出所有具備共用性質的料號，並將它們在相同廠區的庫存數量進行加總與匯整，讓使用者一眼就能掌握「整個廠區的真實可用料況」。

---

## 2. UI 視覺與互動規格 (UI/UX Specification)
- **版面配置**：
  - 高度壓縮的頂部搜尋控制面板，最大化下方數據列表的可視空間。
  - 支援單筆料號搜尋、內部訂單搜尋 (未來擴充)、以及 Excel 批次匯入功能。
- **Excel 匯入體驗**：
  - 支援拖曳 (Drag & Drop) 匯入。
  - 匯入完成後自動彈出「高質感滿版 Modal」，分為三大色塊報告：
    - 🟢 綠色：成功查詢料號 (筆)
    - 🔴 紅色：不存在或無效料號 (筆)
    - 🟡 黃色：Excel 重複料號 (筆)
  - 錯誤與重複料號採用等寬字體 (Monospace) 獨立標籤條列，確保 18 碼料號絕不換行截斷。
- **資料列表展示 (DataGrid)**：
  - **主列 (廠區匯總)**：以「廠區 (Plant Prefix)」為主單位，一列顯示一個品項在單一廠區的「本尊實體庫存」與「智慧庫存判讀量 (共用料加總)」。
  - **下展子列 (Dark Mode)**：點擊箭頭可展開深色系 (Slate-800/900) 的子列表，顯示該廠區內所有子倉庫、所有共用料的實體庫存明細。深色系能提供極強的層級對比，大幅提升判讀性。

---

## 3. API 端點與資料流規格 (API Specification)

### 3.1 單筆查詢 `/api/shared-inventory/search`
- **Method**: GET
- **Query Params**: `itemCode` (單筆料號)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "queriedItem": "EL-MAND170-JUO0BKC",
        "queriedItemName": "綁帶式支撐護踝(ANO170)",
        "isInvalid": false,
        "plants": [
          {
            "plantPrefix": "A01",
            "targetOnHand": 12,
            "smartQty": 45,
            "sharedDetails": [
              {
                "whsCode": "A0101",
                "itemCode": "EL-MAND170-JUO0BKC",
                "itemName": "綁帶式支撐護踝(ANO170)",
                "onHand": 12,
                "isCommited": 2,
                "onOrder": 0,
                "available": 10
              },
              ...
            ]
          }
        ]
      }
    ]
  }
  ```

### 3.2 Excel 批次匯入 `/api/shared-inventory/import`
- **Method**: POST
- **Body**: `multipart/form-data` (檔案上傳)
- **Response**:
  ```json
  {
    "success": true,
    "data": [ /* 結構同上，但已過濾掉 isInvalid 的無效料號 */ ],
    "summary": {
      "successCount": 15,
      "failCount": 4,
      "failedItems": ["EL-MAFCB03-BLO0BKQ", "XXX..."],
      "duplicateCount": 1,
      "duplicateItems": ["EL-MANK201-BUO0BGZ"]
    }
  }
  ```

---

## 4. 業務計算邏輯與 SQL 查詢 (Business Logic & SQL)

### 4.1 共用料智慧判讀邏輯
當查詢目標料號 `@targetItem` 時，系統會透過 SQL CTE (Common Table Expression) 尋找滿足以下任一條件的「共用料」：
1. **本尊料號**：與目標料號完全一致 (`ItemCode = @targetItem`)。
2. **中段 14 碼一致 (Middle-14)**：料號長度大於等於 17 碼，且從第 4 碼開始的 14 碼與目標料號的對應區段完全相同 (`SUBSTRING(ItemCode, 4, 14) = @Mid14`)。
3. **BOM 的 Z 件一致**：若目標料號的 BOM 表 (ITT1) 中包含字尾為 'Z' 的子件，則尋找所有同樣將該 'Z' 件作為子件的父代料號 (`ItemCode IN (SELECT Father FROM ITT1 WHERE Code = @Z_Comp)`)。

### 4.2 廠區群組與庫存加總
- **過濾條件**：僅抓取「在線庫存 (`OnHand`) > 0」、「已承諾 (`IsCommited`) > 0」或「已訂購 (`OnOrder`) > 0」的明細。
- **廠區分類**：擷取倉庫代號 (`WhsCode`) 的前 3 碼作為「廠區代號 (`PlantPrefix`)」。
- **可用量計算公式**：`可用量 (Available) = 在線實體 (OnHand) - 已承諾 (IsCommited) + 在途訂購 (OnOrder)`
- **智慧判讀量**：將同一廠區下，所有共用料的 `Available` 進行加總，即為該廠區的「智慧庫存判讀量 (廠區整體可用)」。

### 4.3 無效料號防護 (Invalidation)
- API 在執行複雜的共用料 SQL 之前，會先精準比對 `OITM`，確保目標料號**真實存在**且**未被停用** (`FrozenFor = 'N'`)。
- 遇無效料號，即中斷查詢，打上 `isInvalid: true` 標籤，並於前端介面透過錯誤回饋或紅色統計區塊提示使用者，確保垃圾資料不進入資料列表。
