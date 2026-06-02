# SAP B1 資料庫視圖與規格說明書 (Database Views Spec)

本規格說明書作為「採購與庫存水位儀表板 (SmartPO)」資料庫整合層的「唯一真理來源 (Single Source of Truth)」，詳細記錄系統與實體 **SAP B1 MS SQL Server** 介接時所使用的 3 個核心資料庫視圖 (Views)。

這 3 個視圖封裝了繁瑣的跨表 `JOIN`、分倉庫存與安全水位加總、庫齡天數插值計算等核心業務邏輯，從底層實踐效能優化，並嚴格遵循唯讀架構規範。

---

## 📌 一、 庫存水位監控視圖 (`V_SMARTPO_InventoryLevel`)

### 1. 功能場景與業務故事
* **對應 API**：`/api/inventory/level-monitor` (首頁水位監控圖表) 及部分 `/api/inventory/drilldown` (水位向下鑽研明細)。
* **業務故事**：抓取所有**啟用中**且**有設定補貨水位**的成品，進行公司整體的庫存水位健康診斷（充足、安全庫存不足、最大庫存超標）。
* **實務設計 (方案 C)**：考慮到企業在 SAP B1 中常依據不同倉庫分立水位限制，本視圖採用 **「全公司跨倉總庫存與水位加總彙總型」**，並精確使用 `OITW` 表的 `MinStock` 與 `MaxStock` 欄位進行加總。

### 2. 實體 SQL 語句
```sql
CREATE VIEW V_SMARTPO_InventoryLevel AS
SELECT 
    T0.ItemCode,
    T0.ItemName,
    SUM(T1.OnHand) AS OnHand,       -- 全公司跨倉總實體庫存量
    SUM(T1.OnOrder) AS OnOrder,     -- 全公司跨倉總已訂貨量 (採購在途)
    SUM(T1.MinOrder) AS MinOrder,   -- 所有倉庫設定「需求庫存量」的總和
    SUM(T1.MinStock) AS MinStock,   -- 所有倉庫設定「最小安全庫存量」的總和
    SUM(T1.MaxStock) AS MaxStock    -- 所有倉庫設定「最大庫存量」的總和
FROM OITM T0
INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
WHERE T0.ItmsGrpCod = 101 -- 限制僅抓取成品組 (ItmsGrpCod = 101)
  AND T0.FrozenFor = 'N'  -- 必須為未凍結/啟用中物料
  AND LEN(T0.ItemCode) = 18 -- 僅篩選成品長度為 18 碼之料號，排除測試或特殊雜料
GROUP BY T0.ItemCode, T0.ItemName
HAVING SUM(T1.MinOrder) > 0; -- 僅統計全倉需求水位大於 0 之成品
```

### 3. 資料對照表 (Data Mapping)

| 系統欄位 | 原始資料表/欄位 | 資料型態 | 業務說明與邏輯 |
| :--- | :--- | :--- | :--- |
| **ItemCode** | `OITM.ItemCode` | `NVARCHAR(20)` | 物料料號（主鍵，嚴格限制 18 碼成品） |
| **ItemName** | `OITM.ItemName` | `NVARCHAR(100)`| 物料品名規格描述 |
| **OnHand** | `SUM(OITW.OnHand)` | `NUMERIC(19,6)` | 全公司所有倉庫目前的實體在庫量總和 |
| **OnOrder** | `SUM(OITW.OnOrder)` | `NUMERIC(19,6)` | 全公司所有倉庫目前的已訂貨量（採購單在途）總和 |
| **MinOrder** | `SUM(OITW.MinOrder)` | `NUMERIC(19,6)` | 補貨閥值。全倉「需求庫存量」總和 |
| **MinStock** | `SUM(OITW.MinStock)` | `NUMERIC(19,6)` | 警戒閥值。全倉「最小安全庫存量」總和 |
| **MaxStock** | `SUM(OITW.MaxStock)` | `NUMERIC(19,6)` | 超標閥值。全倉「最大庫存量」總和 |

### 4. 業務指標判定公式 (後端與前端使用)
* **需求庫存不足 (Under Target Level)**：
  $$\text{OnHand} + \text{OnOrder} < \text{MinOrder} \quad \text{且} \quad \text{OnHand} + \text{OnOrder} \ge \text{MinStock}$$
* **最小安全庫存不足 (Under Safety Stock) 🔴**：
  $$\text{OnHand} + \text{OnOrder} < \text{MinStock}$$
* **最大庫存超標 (Over Maximum Level) 🟡**：
  $$\text{OnHand} > \text{MaxStock}$$

---

## 📌 二、 採購達交明細視圖 (`V_SMARTPO_PODeliveryDetail`)

### 1. 功能場景與業務故事
* **對應 API**：部分 `/api/po/delivery-rate` (達交率計算) 及 `/api/inventory/drilldown` (採購逾期向下鑽研明細)。
* **業務故事**：追蹤企業所有採購單明細的交貨狀態。前端點擊採購達交圖表後，展示詳細的採購單號、料號、採購量、未交量以及負責的採購員，藉此掌握供應商交期。
* **安全防護設計**：**基於資訊安全與核心技術保密原則，本視圖雖含有供應商名稱 `CardName`，但在 Express API 輸出明細時，會明確排除或遮蔽此欄位，以保障企業供應鏈核心機密。**

### 2. 實體 SQL 語句
```sql
CREATE VIEW V_SMARTPO_PODeliveryDetail AS
SELECT 
    T0.DocEntry,
    T0.DocNum,
    T0.CardCode,
    T0.CardName, -- 注意：此為機敏資訊，API 傳輸至前端明細時須進行排除
    T0.DocDate,
    T0.DocStatus,
    T1.LineNum,
    T1.ItemCode,
    T1.Dscription,
    T1.Quantity,
    T1.OpenQty,
    T2.SlpName AS BuyerName -- 關聯業務員主表帶出採購員姓名
FROM OPOR T0
INNER JOIN POR1 T1 ON T0.DocEntry = T1.DocEntry
LEFT JOIN OSLP T2 ON T0.SlpCode = T2.SlpCode;
```

### 3. 資料對照表 (Data Mapping)

| 系統欄位 | 原始資料表/欄位 | 資料型態 | 業務說明與邏輯 |
| :--- | :--- | :--- | :--- |
| **DocEntry** | `OPOR.DocEntry` | `INT` | 採購單系統內部唯一編號 (主鍵) |
| **DocNum** | `OPOR.DocNum` | `INT` | 採購單號 (對外單號，用於 Drill-down) |
| **CardCode** | `OPOR.CardCode` | `NVARCHAR(15)` | 供應商代碼 |
| **CardName** | `OPOR.CardName` | `NVARCHAR(100)`| 供應商名稱 (安全機敏欄位，API 輸出時會過濾) |
| **DocDate** | `OPOR.DocDate` | `DATETIME` | 採購單過帳日期 (Posting Date) |
| **DocStatus** | `OPOR.DocStatus` | `CHAR(1)` | 採購單狀態：`O` 代表未結案，`C` 代表已結案 |
| **LineNum** | `POR1.LineNum` | `INT` | 採購單明細行號 (0-indexed) |
| **ItemCode** | `POR1.ItemCode` | `NVARCHAR(20)` | 採購料號 |
| **Dscription** | `POR1.Dscription`| `NVARCHAR(100)`| 採購項目名稱規格描述 |
| **Quantity** | `POR1.Quantity` | `NUMERIC(19,6)` | 採購總數量 |
| **OpenQty** | `POR1.OpenQty` | `NUMERIC(19,6)` | 未交貨數量。`OpenQty = 0` 代表該品項已全數送達並結案 |
| **BuyerName** | `OSLP.SlpName` | `NVARCHAR(150)`| 負責該張採購單的採購員/業務員姓名 |

### 4. 達交率核心計算公式 (後端 SQL 實時聚合)
本系統之「採購到達率」以**單據結案比率**為基準計算：
$$\text{採購達交率 (\%)} = \frac{\text{已結案採購單數 (DocStatus = 'C')}}{\text{已結案採購單數} + \text{未結案採購單數}} \times 100\%$$
* **本月達交率時間範圍**：過帳日期在當月起迄日內。
* **上月達交率時間範圍**：過帳日期在上月整月起迄日內。
* **今年達交率時間範圍**：過帳日期在今年 1 月 1 日至今日。

---

## 📌 三、 庫存週轉與庫齡監控視圖 (`V_SMARTPO_InventoryAge`)

### 1. 功能場景與業務故事
* **對應 API**：`/api/inventory/turnover-age` (首頁庫齡統計條形圖) 及部分 `/api/inventory/drilldown` (庫齡區間明細)。
* **業務故事**：分析企業成品與半成品的週轉健康狀況，針對在庫時間過長（如超過 1 年甚至 3 年呆滯）的物料進行預警。
* **庫齡天數 (AgeDays) 計算機制**：
  在 SAP B1 實務中，我們透過 **`OINM` (庫存交易日誌)** 提取該物料最後一次 **「實體進貨」** 的日期。
  進貨判定標準為：交易數量 `InQty > 0` 且交易類型為進貨相關（20-採購收貨、59-收貨/期初、18-A/P發票、16-銷售退貨）。
  * 若有進貨記錄：最後進貨日 = `MAX(OINM.DocDate)`。
  * 若無進貨記錄：以該物料於 SAP B1 的建立日期 `OITM.CreateDate` 作為起算點。
  * 庫齡天數計算公式：`DATEDIFF(day, ISNULL(最後進貨日, 建立日期), GETDATE())`。

### 2. 實體 SQL 語句
```sql
CREATE VIEW V_SMARTPO_InventoryAge AS
WITH LastInDateCTE AS (
    SELECT 
        ItemCode, 
        MAX(DocDate) AS LastInDate
    FROM OINM
    WHERE InQty > 0 
      AND TransType IN (20, 59, 18, 16) -- 20=採購收貨, 59=庫存收貨, 18=AP發票, 16=銷售退貨
    GROUP BY ItemCode
)
SELECT 
    T0.ItemCode,
    T0.ItemName,
    SUM(T1.OnHand) AS OnHand,       -- 全公司總在庫量
    SUM(T1.OnOrder) AS OnOrder,     -- 全公司總採購在途量
    SUM(T1.MinOrder) AS MinOrder,   -- 水位加總
    SUM(T1.MinStock) AS MinStock,   -- 安全庫存加總
    SUM(T1.MaxStock) AS MaxStock,   -- 最大水位加總
    MAX(DATEDIFF(day, ISNULL(T2.LastInDate, T0.CreateDate), GETDATE())) AS AgeDays -- 跨倉中最大庫齡天數
FROM OITM T0
INNER JOIN OITW T1 ON T0.ItemCode = T1.ItemCode
LEFT JOIN LastInDateCTE T2 ON T0.ItemCode = T2.ItemCode
WHERE T0.ItmsGrpCod IN (101, 103) -- 成品(101)與半成品(103)
  AND T0.FrozenFor = 'N'          -- 啟用中物料
  AND LEN(T0.ItemCode) = 18       -- 限制成品/半成品長度為 18 碼之料號
GROUP BY T0.ItemCode, T0.ItemName
HAVING SUM(T1.OnHand) > 0; -- 僅針對實體在庫量大於 0 的物料進行分析
```

### 3. 資料對照表 (Data Mapping)

| 系統欄位 | 原始資料表/欄位 | 資料型態 | 業務說明與邏輯 |
| :--- | :--- | :--- | :--- |
| **ItemCode** | `OITM.ItemCode` | `NVARCHAR(20)` | 物料料號（嚴格限制 18 碼成品與半成品） |
| **ItemName** | `OITM.ItemName` | `NVARCHAR(100)`| 物料品名規格描述 |
| **OnHand** | `SUM(OITW.OnHand)` | `NUMERIC(19,6)` | 跨倉之總實體庫存量 |
| **OnOrder** | `SUM(OITW.OnOrder)` | `NUMERIC(19,6)` | 跨倉之總已訂貨量 |
| **MinOrder** | `SUM(OITW.MinOrder)` | `NUMERIC(19,6)` | 所有倉庫設定「需求庫存量」總和 |
| **MinStock** | `SUM(OITW.MinStock)` | `NUMERIC(19,6)` | 所有倉庫設定「最小安全庫存量」總和 |
| **MaxStock** | `SUM(OITW.MaxStock)` | `NUMERIC(19,6)` | 所有倉庫設定「最大庫存量」總和 |
| **AgeDays** | 計算欄位 | `INT` | 庫齡（天數）。由最後進貨日或建立日與今日之天數差 |

### 4. 庫齡分析區間定義
後端 API 會依據 View 中產生的 `AgeDays` 天數，將在庫品項分類統計，並輸出至前端長條圖：
1. **半年以下 (新鮮)**：`AgeDays < 180` 天
2. **半年至 1 年 (輕度積壓)**：`180 <= AgeDays <= 360` 天
3. **1 年至 2 年 (中度積壓)**：`361 <= AgeDays <= 720` 天
4. **2 年至 3 年 (重度積壓)**：`721 <= AgeDays <= 1080` 天
5. **3 年以上 (呆滯料)**：`AgeDays > 1080` 天

---

## 📌 備註：第二模組 (重點庫存查詢) 的資料庫架構說明

第二模組「重點庫存查詢 (Focus Inventory)」為了確保 **絕對的唯讀安全性與無副作用**，並未在 SAP B1 中建立新的 View，而是採用了 **混合式資料庫架構**：
1. **寫入層**：採用本地輕量級 SQLite (`focus_inventory.db`) 負責儲存採購人員關注的 `ItemCode` 清單與顯示狀態，徹底隔離寫入風險。
2. **查詢層**：透過 Express API 動態組裝 SQL 查詢，以 `WHERE T0.ItemCode IN (...)` 的方式直接與 SAP B1 的 `OITM` / `OITW` 進行參數化聯集查詢。此架構具備極高的安全性，同時免去了在 B1 端建立客製 View 的維護成本。
