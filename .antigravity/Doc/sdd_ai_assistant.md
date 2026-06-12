# SDD - 智慧 AI 採購助理 (Smart AI Purchasing Assistant)

## 1. 業務故事 (Business Story)
**背景**：
採購人員日常需要頻繁查詢 SAP B1 系統中的庫存量、採購單狀態、逾期達交率及共用料資訊。傳統 ERP 介面繁複，且無法靈活進行跨資料表關聯的即時查詢。
**目標**：
建置一個具備自然語言理解能力的 AI 助理，讓採購人員能用直覺的中文（例如：「幫我查 2 月份向某供應商採購的總金額」）直接查詢 ERP 實體資料庫，並以簡潔的文字和表格快速回覆，提升決策效率。

---

## 2. 系統架構與模型 (System Architecture)
- **大語言模型 (LLM)**：採用 **Google Gemini API** 的 `gemini-flash-latest` 模型，提供快速且穩定的語意生成與 Text-to-SQL 翻譯能力。
- **單次 API 同步架構 (Single-Phase API Architecture)**：為了簡化架構並將 API 額度消耗降至最低，系統將「意圖翻譯 (Text-to-SQL)」與「數據解讀 (Data-to-Text)」在後端整合為單次 `/api/ai/query` 同步請求。
- **非串流同步回傳 (Non-streaming Synchronous Response)**：取消 SSE 串流打字機效果。後端在同步完成兩階段的 AI 調用與資料庫查詢後，一次性將最終的 Markdown 解說文字回傳給前端，減少前端重複連線與解析的負荷。
- **流量限制與費用防護 (Rate Limiting)**：後端實作 Rate Limiter（單一 IP 每日上限 100 次），當超過配額時，會從伺服器端物理阻斷 API 呼叫，達到預算絕對可控。
- **無狀態對話 (Stateless)**：系統不儲存歷史對話紀錄，每次查詢皆為獨立請求，確保機敏數據不因對話歷史外洩。

---

## 3. 資料庫查詢範圍 (Context Boundary)
為確保資料庫安全與防範越權查詢，系統在 RAG 流程中定義了嚴格的查詢範圍邊界（僅限採購與庫存相關）：

- **允許查詢之白名單資料表 (White-listed Tables)**：
  1. **存貨模組**：`OITM` (品項主檔), `OITW` (倉庫庫存), `OITB` (品項群組), `OIGE`/`IGE1` (發料), `OIGN`/`IGN1` (收料), `OWTR`/`WTR1` (庫存轉儲), `OINM` (庫存過帳日記帳)。
  2. **採購模組**：`OPRQ`/`PRQ1` (採購申請), `OPOR`/`POR1` (採購訂單), `OPDN`/`PDN1` (收貨採購單 GRPO), `ORPD`/`RPD1` (採購退貨), `OPCH`/`PCH1` (AP 發票), `ODPO`/`DPO1` (AP 預付款)。
  3. **銷售模組**：`OQUT`/`QUT1` (報價單), `ORDR`/`RDR1` (銷售訂單), `ODLN`/`DLN1` (交貨), `ORDN`/`RDN1` (退貨), `OINV`/`INV1` (AR 發票)。
  4. **生產模組**：`OITT`/`ITT1` (BOM 物料清單), `OWOR`/`WOR1` (生產訂單)。
  5. **基本資料**：`OCRD` (業務夥伴主檔)。

- **禁止查詢之黑名單資料表 (Strictly Excluded Modules)**：
  - **財務、銀行、總帳與系統管理模組**（如 `OACT` 會計科目、`OJDT` 日記帳分錄、`ORCT` 收款、`OVPM` 付款）。此防護在提示詞邊界與實體權限層面雙重阻斷，確保機敏財務資訊絕不外流。

---

## 4. 安全與防幻覺架構 (Security & Zero-Hallucination)

為了根除 AI 虛構數據（幻覺）的風險，並保護企業資料鏈路，系統採用 **Text-to-SQL 防幻覺核心管道**，並搭配 **五層資安防護機制**。

### 4.1 零幻覺核心管道 (Zero-Hallucination Pipeline)
一次對話在後端整合為單次同步的 Agentic Pipeline，運作流程如下：
- **第一階段：Text-to-SQL 翻譯與沙盒執行**：
  - **Step 1.1 (意圖翻譯)**：後端接收到使用者的提問，使用 Gemini API 搭配專屬資料表 Schema 提示詞，將提問翻譯為「唯讀 (SELECT)」的 SQL 查詢語句。
  - **Step 1.2 (沙盒執行)**：後端執行此安全 SQL，從實體資料庫取得真實的 JSON 數據。若執行失敗或查無資料，則物理阻斷，直接回傳友好的查無資料提示，不允許進行後續生成。
- **第二階段：Data-to-Text 數據解讀**：
  - **Step 2.1 (自然語言說明)**：將 Step 1.2 取得的 JSON 數據作為 Context，於後端再次調用 Gemini API。AI 被強烈限制**只能且必須依據此 JSON 數據**進行解讀，防止憑空捏造任何不在 JSON 內的數據。
  - **Step 2.2 (同步 Markdown 回傳)**：限制生成字數在 150-200 字以內，避免冗長並切入重點。後端將最終的解說文字一次性回傳給前端渲染。

### 4.2 五層安全防護 (5-Layer Security)
1. **DB 唯讀限縮 (Least Privilege)**：資料庫專為 AI 助理配置 `ai_readonly_user` 帳號，物理層面僅限 `SELECT` 白名單資料表，從根本封鎖寫入權限。
2. **後端正則攔截 (RegEx Sanitization)**：後端攔截器使用 Regex 檢查生成的 SQL 語法，若包含 `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `EXEC` 或 `--` 等危險關鍵字，立即物理中斷請求。
3. **提示詞邊界防禦 (Jailbreak Prevention)**：在 System Prompt 注入最高指導原則，無視 any 試圖繞過安全限制或索取敏感資訊的惡意 Prompt，直接輸出 "REJECTED"。
4. **機敏欄位過濾 (Column-Level Masking)**：後端執行完 SQL 後，在資料回傳前進行欄位脫敏，將 `CardName` (供應商名稱) 與 `CardCode` 自動屏蔽並替換為 `***`。
5. **前端輸出消毒 (XSS Prevention)**：前端在渲染 AI 的 Markdown 回覆時，嚴格防範 `<script>` 等 HTML 標籤注入，避免跨站腳本攻擊。

---

## 5. 前端介面與體驗 (UI/UX)
- **快捷入口**：於全域導覽列配置強烈視覺質感的 `[✨ 智慧 AI 助理]` 入口按鈕。
- **對話視窗**：採用 ChatGPT 風格的 Slide-over 側邊欄，支援 Markdown 語法呈現與程式碼區塊高亮。
- **載入狀態 (Loading indicator)**：於後端執行雙階段同步查詢時，前端顯示高質感的進度條與「正在查詢資料庫並進行數據分析...」動畫，提升等待耐受度。

---

## 6. API 規格 (API Specifications)

### 6.1 智慧查詢 API (POST /api/ai/query)
- **Endpoint**: `POST /api/ai/query`
- **Request Body**:
  ```json
  {
    "prompt": "幫我查 2 月份向供應商採購的總金額"
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "根據您的查詢，2 月份共有 1 筆採購訂單，總計金額為 15,000 元。詳細資訊如下：\n\n| 採購單號 | 供應商代碼 | 日期 | 總金額 |\n| :--- | :--- | :--- | :--- |\n| 10001 | V***1 | 2026-02-15 | 15,000.00 |"
  }
  ```
- **Response (Security Block / Danger Check)**:
  ```json
  {
    "success": false,
    "message": "基於資安原則，我僅能協助您查詢採購與庫存相關數據。"
  }
  ```
