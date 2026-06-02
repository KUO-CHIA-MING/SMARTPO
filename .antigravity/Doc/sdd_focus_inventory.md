# 重點庫存查詢模組 - 系統設計規格書 (SDD)

## 一、 功能範圍與使用者故事 (Scope & User Stories)

本模組旨在提供採購人員快速監控「企業最關鍵之成品與半成品（重點品項）」的即時庫存狀況。相較於全域儀表板，本功能支援高度的客製化管理，採購人員能依據特定專案或高周轉率品項，自行維護一份「重點庫存監控清單」，並透過 Excel 整批匯入或單筆輸入進行實時動態追蹤。

### 1. 使用者故事 (User Stories)
* **1.1 快速導覽入口**：採購人員登入系統後，能在首頁「採購與庫存水位監控儀表板」醒目處看到 `[重點庫存狀態]` 功能按鈕，點擊後能以極致流暢的微動畫跳轉至重點庫存監控介面。
* **1.2 後台自主維護**：採購人員可在後台管理區，透過拖曳 Excel 檔案整批匯入重點料號、單筆手動新增料號，並對已納入清單的品項進行「顯示/隱藏狀態切換（Toggle）」或「永久刪除」操作。
* **1.3 前台即時告警與搜尋**：採購人員在前台清單中，能即時查看已維護品項由 **SAP B1 實體資料庫** 加總彙總出的最新庫存水位。系統應以鮮明的警示色或**呼吸閃爍特效**對異常品項（如安全庫存不足）進行告警，並支援即時輸入搜尋及各欄位（如庫存量、安全水位）的正反序點擊排序。

---

## 二、 UI/UX 介面與圖表規格 (UI Layout & Spec)

本介面維持「高級莫蘭迪莫蘭迪 HSL 莫蘭迪配色系統」，融入精緻的微互動與狀態回饋，帶來 Wow 級的前端使用體驗。

### 1. 介面版面設計
系統將分為兩個主要視圖，採無刷新無縫切換（Tab / View Switch）：
1. **主監控面板 (List View)**：前台展示，供日常快速搜尋、排序與庫存預警查看。
2. **後台維護面板 (Admin Panel)**：提供 Excel 匯入、手動輸入與已維護品項狀態管理的控制台。

---

### 2. 主監控面板：重點庫存清單規格

#### 2.1 列表呈現欄位
前台列表預設以 **「告警狀態」** 由上至下排序（紅 🔴 > 橘黃 🟠 > 黃 🟡 > 綠 🟢），亦支援點擊任何欄位標題進行動態正反序排序：
1. `料號 (ItemCode)`
2. `品名 (ItemName)`
3. `現在庫存量 (OnHand)`
4. `已承約量 (IsCommited)`（來自 SAP B1 的 `OITW.IsCommited` 全倉加總，代表已接單但尚未出貨的承諾量）
5. `已訂貨量 (OnOrder)`
6. `需求庫存量 (MinOrder)`
7. `最小安全庫存 (MinStock)`
8. `最大庫存量 (MaxStock)`
9. `水位狀態 (Status)`（以徽章狀態與呼吸閃爍呈現）

#### 2.2 告警邏輯與視覺規格 (比照首頁監控邏輯)

| 告警狀態 | 觸發條件公式 | 前台視覺表現 (莫蘭迪 HSL 配色) | 微互動效果 |
| :--- | :--- | :--- | :--- |
| **安全庫存不足** 🔴 | $(OnHand + OnOrder) < MinStock$ | 背景 `#FEF2F2` (紅)<br>文字 `#EF4444` | **紅色呼吸燈閃爍**<br>提示採購人員此為「最高危急」狀態 |
| **需求庫存不足** 🟠 | $(OnHand + OnOrder) < MinOrder$<br>且 $\ge MinStock$ | 背景 `#FFFBEB` (橘黃)<br>文字 `#F59E0B` | 穩定橘黃色發光外框 |
| **最大庫存超標** 🟡 | $OnHand > MaxStock$ | 背景 `#FEF3C7` (黃)<br>文字 `#D97706` | 黃色微發光狀態標記，警示積壓資金 |
| **充足健康** 🟢 | 其餘安全健康情況 | 背景 `#ECFDF5` (綠)<br>文字 `#10B981` | 穩定淺綠色徽章，代表無採購壓力 |

---

### 3. 後台維護面板：清單維護與 Excel 匯入規格

#### 3.1 Excel 批次匯入元件與比對成果回饋
* **UI 設計**：採用「拖曳上傳區域 (Drag & Drop Zone)」，以虛線 HSL 邊框與雲端下載微動畫呈現。
* **上傳格式**：嚴格限制為 `.xlsx` 或 `.xls`。工作表首行必須包含 `ItemCode` 標題列，系統會自動解析下方的 18 碼料號。
* **前端驗證**：上傳時若料號長度不符 18 碼，前端將直接過濾並列入失敗計數。
* **比對成果高級回饋 Modal**：匯入完成後，前端會主動彈出一個高質感的數據回饋 Modal，明確顯示 **「成功查詢比對到 X 筆」** 與 **「失敗 Y 筆」**。Modal 中會提供比對失敗的料號清單（如：ERP 未建檔或格式不符），讓採購人員一目了然，確保匯入的數據皆為 ERP 系統中的有效產品。

#### 3.2 手動單筆新增元件
* **UI 設計**：包含一個 ItemCode 輸入框與一個「驗證並加入」按鈕。
* **後端驗證機制**：點擊加入時，後端會即時向 SAP B1 發送唯讀查詢，確認該料號在資料庫中是否存在並比對成功。
* **即時回饋提示**：比對成功時，跳出綠色 Toast 提示：**「成功查詢比對 1 筆，已加入重點清單！」**；比對失敗時，跳出黃色/紅色 HSL 警示：**「比對失敗 1 筆（此料號在 SAP B1 系統中不存在），不予加入」**。

#### 3.3 重點品項管理列表
以輕量化表格呈現目前所有被納入重點清單的物料，並提供以下操作按鈕：
* **顯示/隱藏切換 (Toggle Switch)**：點擊開關後，此品項在前台「主監控面板」中會立即顯示或隱藏，方便進行專案分類監控。
* **刪除項目 (Delete Action)**：點擊後彈出二次確認 Modal，確認後將徹底移出重點清單。

---

## 三、 後端安全架構與資料庫設計 (Backend & Security Spec)

### ⚠️ 核心挑戰與資安唯讀安全防禦
* **技術衝突**：根據專案核心開發規範 `rules.md`，**本系統為純唯讀架構，嚴禁對實體 SAP B1 生產資料庫進行任何 INSERT/UPDATE/DELETE 寫入操作**，保障企業 ERP 生產系統的絕對安全。
* **精妙解決方案 (SQLite 本地隔離儲存)**：
  * 為了在「100% 遵守唯讀禁令」的前提下，實現重點清單的維護（包含匯入、刪除與切換顯示狀態等寫入操作）：
  * 後端將建立一個**輕量級的本機 SQLite 資料庫**（`database/focus_inventory.db`），用以**獨立存儲**「重點料號清單（僅含 `ItemCode`, `IsVisible` 狀態）」等後台維護資訊。
  * **零侵入性**：對重點清單的增刪改查，100% 在本機 SQLite 中進行，**絕不寫入 SAP B1 一字一標點**。
  * **內存關聯查詢 (In-Memory Join / In-Query)**：
    當採購人員查看前台「重點庫存狀態」時，後端 API 會先從 SQLite 中撈取目前設定為「顯示 (`IsVisible = 1`)」的 `ItemCode` 清單。接著，利用參數化查詢，在實體 SAP B1 資料庫 View 執行 `IN` 查詢或關聯：
    ```sql
    -- 後端透過連線池向 SAP B1 發送安全的唯讀查詢，僅拉取重點料號的實時跨倉加總數據
    SELECT 
        T0.ItemCode,
        T0.ItemName,
        SUM(T1.OnHand) AS OnHand,
        SUM(T1.IsCommited) AS IsCommited, -- 新增已承約量
        SUM(T1.OnOrder) AS OnOrder,
        SUM(T1.MinOrder) AS MinOrder,
        SUM(T1.MinStock) AS MinStock,
        SUM(T1.MaxStock) AS MaxStock
    FROM OITM T0
    INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
    WHERE T0.ItemCode IN (@focusItem1, @focusItem2, ...) -- 帶入 SQLite 撈出的重點料號
      AND T0.FrozenFor = 'N'
    GROUP BY T0.ItemCode, T0.ItemName;
    ```
    此舉完美結合了「本地自主維護（可寫入）」與「ERP 資料連線（唯讀）」，安全性高達 100%！

---

### 1. 本地 SQLite 資料表結構 (`focus_items`)

```sql
CREATE TABLE IF NOT EXISTS focus_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code VARCHAR(20) UNIQUE NOT NULL, -- 18 碼重點料號 (唯一約束)
    is_visible INTEGER DEFAULT 1,          -- 顯示/隱藏狀態 (1: 顯示, 0: 隱藏)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. 前後端 API 路由與交換協議 (API Spec)

#### 2.1 取得前台重點庫存列表
* **端點**：`GET /api/focus-inventory/list`
* **說明**：取得當前在前台設定為「顯示」的重點物料，並結合 SAP B1 的最新實時庫存數據。
* **回應 JSON 格式**：
  ```json
  {
    "success": true,
    "total": 3,
    "data": [
      {
        "ItemCode": "FG-10000000000001",
        "ItemName": "高精密伺服馬達驅動器 A1",
        "OnHand": 12.0,
        "IsCommited": 5.0,
        "OnOrder": 20.0,
        "MinOrder": 50.0,
        "MinStock": 30.0,
        "MaxStock": 150.0
      }
    ]
  }
  ```

#### 2.2 取得後台管理列表
* **端點**：`GET /api/focus-inventory/admin-list`
* **說明**：從 SQLite 取得目前所有維護的料號、顯示狀態與建立時間，用於後台控制台渲染。

#### 2.3 Excel 批次整批匯入與比對
* **端點**：`POST /api/focus-inventory/import`
* **格式**：`multipart/form-data` (欄位 `file` 接收 Excel)
* **後端邏輯**：
  1. 解析 Excel 表格，提取 `ItemCode` 陣列清單並去重。
  2. 將料號過濾出符合 18 碼者，不符 18 碼者直接歸入「失敗清單（格式不符）」。
  3. 對於符合 18 碼的料號，後端使用連線池向 **SAP B1 實體資料庫** 發送唯讀查詢（如 `SELECT ItemCode FROM OITM WHERE ItemCode IN (...)`）進行即時存在性比對。
  4. **成功比對**：存在於 SAP B1 的料號，會進一步向 SQLite 比對是否已存在。若不存在則 `INSERT INTO` 寫入本地 SQLite `focus_items`；若已存在則歸類為「重複跳過」。
  5. **比對失敗**：不存在於 SAP B1 的料號，與先前格式不符者，一併歸入「失敗清單（B1不存在）」。
  6. 回傳比對成功筆數、重複筆數、失敗筆數與詳細的料號清單。
* **回應 JSON 格式**：
  ```json
  {
    "success": true,
    "successCount": 8,
    "failCount": 2,
    "failedItems": ["FG-99999999999999", "FG-88888888888888"],
    "duplicateCount": 1,
    "duplicateItems": ["FG-10000000000001"]
  }
  ```

#### 2.4 單筆新增驗證並寫入
* **端點**：`POST /api/focus-inventory/add`
* **要求 JSON**：`{ "itemCode": "FG-10000000000001" }`
* **後端邏輯**：
  1. 向 SAP B1 發送唯讀查詢：`SELECT 1 FROM OITM WHERE ItemCode = @itemCode AND FrozenFor = 'N'` 進行存在性比對。
  2. 若比對失敗（無此料號），回傳以下 JSON 並拒絕加入 SQLite：
     ```json
     { 
       "success": false, 
       "successCount": 0, 
       "failCount": 1, 
       "message": "此料號在 SAP B1 系統中不存在或已凍結" 
     }
     ```
  3. 若比對成功，再查詢 SQLite 是否已存在。若已存在，則回傳：
     ```json
     { 
       "success": false, 
       "successCount": 0, 
       "failCount": 0,
       "duplicateCount": 1,
       "message": "此料號已存在於重點清單中，無須重複新增" 
     }
     ```
  4. 若皆通過驗證，寫入 SQLite `focus_items`，並回傳：
     ```json
     {
       "success": true,
       "successCount": 1,
       "failCount": 0,
       "message": "新增成功"
     }
     ```

#### 2.5 顯示/隱藏狀態切換
* **端點**：`PUT /api/focus-inventory/toggle`
* **要求 JSON**：`{ "itemCode": "FG-10000000000001", "isVisible": 0 }`

#### 2.6 永久刪除重點項目
* **端點**：`DELETE /api/focus-inventory/delete`
* **要求 JSON**：`{ "itemCode": "FG-10000000000001" }`

---

## 📌 三、 前端介面與防呆優化 (Front-End & UX Enhancements)

#### 3.1 主監控面板 (FocusInventoryList)
* **狀態排序與次要排序**：系統預設優先依照「狀態燈號」權重 (紅 > 橘 > 黃 > 綠) 進行降冪排序，確保最危險的品項排在最前面。若多筆料號燈號相同（如同為綠燈），系統會自動啟動次要排序，依照料號 (`ItemCode`) 升冪排列，使畫面保持高度整潔。
* **凍結表頭 (Sticky Headers)**：針對可能達數百筆的長型清單，實作了內部滾動範圍 (`max-h-[calc(100vh-240px)]`) 並將所有表頭設定為固定吸頂 (`sticky top-0`)，避免向下捲動時遺失欄位對應參考。
* **雙軸固定 (Z-Index 管理)**：為了解決寬螢幕下的跑版問題，在表格寬度超過容器時啟動水平捲動 (`overflow-auto`)，同時將最右側的「狀態」欄位固定 (`sticky right-0`)，並精心處理 `z-index` 以確保與固定表頭在右上角交會時能完美層疊與呈現陰影。

#### 3.2 後台維護面板 (FocusInventoryAdmin)
* **直覺的防呆反饋**：Excel 拖曳匯入後，系統將比對結果分為「成功加入(綠)」、「重複跳過(黃)」與「比對失敗(紅)」三區塊，並明確列出重複與失敗的料號明細。
* **已納入清單之即時搜尋**：針對後台維護區域，加入了無刷新的 Client-side 即時搜尋功能，採購人員只需輸入料號片段，系統即時過濾顯示結果，大幅提升清單維護的便利性。
