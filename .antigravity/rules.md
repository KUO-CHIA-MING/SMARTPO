# 採購與庫存水位儀表板 - 開發規範

## 1. 系統架構與技術棧 (Stack)

- **前端環境**：使用 React 搭配 Tailwind CSS 進行 UI 排版。
- **後端環境**：使用 Node.js (Express) 作為 API 伺服器。
- **資料庫**：連接實體 MS SQL Server。
- **圖表套件**：統一使用 `Recharts` 套件來實作動態圖表。

## 2. 資料庫與安全規範 (Database & Security)

- **資料庫寫入禁令（唯讀架構）**：
  - 本系統為純讀取（Read-Only）儀表板，嚴禁生成任何包含 `INSERT`、`UPDATE`、`DELETE` 或 `DROP` 的 SQL 陳述式或 ORM 寫入邏輯。
  - 所有數據撈取必須透過唯讀的 SQL 查詢、資料庫視圖 (Views) 或特定的預存程序 (Stored Procedures)。
- **敏感資訊與環境變數規範 (Environment Variables)**：
  - 嚴禁在任何程式碼中寫死（Hardcode）MS SQL 連線帳密、API Key、Token 或任何私密金鑰。
  - 所有敏感資訊必須統一存放於根目錄的 `.env` 檔案中。
  - 程式碼中一律必須透過環境變數（如後端的 `process.env.DB_PASS`）來讀取這些值。
  - 專案中必須建立並維護一個 `.env.example` 檔案（不含真實帳密），明確列出系統所需的所有環境變數名稱，以供團隊參照。
- **SQL 查詢安全性**：
  - 執行 SQL 查詢時，若涉及任何前端傳入的參數（如日期篩選、品號、採購員篩選），必須使用「參數化查詢（Parameterized Queries）」，絕對不允許直接使用字串拼接，以防止 SQL 注入（SQL Injection）。
  - 對於複雜的庫存計算，優先使用資料庫的預存程序（Stored Procedure）或視圖（View），並在註解中說明資料表結構。

## 3. 後端 API 與數據處理 (Backend API)

- **API 路由命名**：遵循 RESTful 風格，例如 `/api/inventory/water-level`。
- **數據聚合與運算**：
  - 「低於水位佔比 %」與「水位趨勢線數據」等複雜的聚合與百分比計算，應在後端（或 SQL 端）計算完成後，再將乾淨的 JSON 數據回傳給前端，避免讓前端瀏覽器進行大數據量的計算。
- **錯誤處理 (Error Handling)**：
  - 所有資料庫操作必須包裹在 `try-catch` 區塊中。
  - 發生連線或查詢失敗時，後端必須使用 `console.error` 記錄詳細錯誤，但回傳給前端的 API 回應只能顯示安全的錯誤提示（例如：`{ success: false, message: "無法取得庫存數據" }`）。

## 4. 前端 UI 與動態圖表規範 (Frontend & Charts)

- **圖表呈現**：
  - 「低於水位佔比 %」：使用 Recharts 的 **PieChart（圓餅圖）** 或 **RadialBarChart（環形圖）** 呈現。
  - 「水位趨勢線」：使用 Recharts 的 **LineChart（折線圖）** 或 **AreaChart（面積圖）** 呈現，且必須具備動態漸層或動態載入動畫。
- **資料驅動與重新整理**：
  - 圖表元件必須支援動態重新整理（例如：提供一個「重新整理」按鈕，或使用 React 的 `useEffect` 在元件載入時自動打 API 抓取最新數據）。
  - 當 API 還在載入數據時，UI 必須顯示 Loading 狀態（如 Skeleton 骨架屏或轉圈動畫），不可讓畫面留白。

## 5. 程式碼風格與註解 (Code Style)

- **語言偏好**：使用 JavaScript (ES6+)。
- **註解規範**：所有關鍵的業務邏輯、SQL 查詢邏輯、圖表數據轉換格式，都必須附上簡短的**繁體中文註解**。
