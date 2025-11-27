# 今日張三又犯法了嗎？ (NextWave 2025 AI 法創黑客松)

![Project Banner](https://via.placeholder.com/1200x300?text=NextWave+2025+AI+Legal+Hackathon)

> 一個結合生成式 AI、RAG 與 MCP 技術的智慧法律顧問，讓法律不再艱澀難懂。

## 📖 專案簡介 (About)

**「今日張三又犯法了嗎？」** 是一個專為台灣民眾設計的 **AI 法律諮詢輔助系統**。我們觀察到許多民眾（如租屋族、車禍當事人）在面臨法律糾紛時，常因法條艱澀或資訊不對稱而感到無助。

本系統利用 **LLM (大型語言模型)** 的自然語言理解能力，結合 **RAG (檢索增強生成)** 技術讀取最新的台灣法規（刑法、民法、道交條例），並透過 **MCP (Model Context Protocol)** 標準化介面，提供即時、有憑有據且白話的法律分析。

### 核心價值
* **白話轉譯**：將複雜的法條轉換為一般人聽得懂的建議。
* **有憑有據**：每一條回答都會精準引用法規出處，避免 AI 幻覺。
* **情境分析**：針對交通事故、租屋糾紛、網路誹謗等常見場景特別優化。

---

## 👥 團隊成員 (Team "張三")

我們是來自 **龍華科技大學** 的跨領域開發團隊：

| 姓名 | 角色 | 負責項目 |
| :--- | :--- | :--- |
| **龍禹丞** | 隊長 / 雲端架構 | 雲端伺服器部署、系統穩定性與安全性維護。 |
| **陳嘉維** | AI 提示工程師 | 上下文工程 (Context Engineering)、Prompt 優化、提升回答準確度。 |
| **胡允豪** | 後端開發 | Python 程式撰寫、API 整合、MCP Server 串接與對話邏輯。 |
| **彭冠綸** | 領域專家 | 法律資料庫整合、法規內容驗證、交通與民事流程顧問。 |
| **呂育昇** | 技術支援 | 網路爬蟲開發、資料蒐集自動化、系統測試。 |

---

## 🛠️ 技術架構 (Tech Stack)

本專案採用現代化的 **前後端分離** 與 **AI 雙軌檢索** 架構：

### Frontend (前端)
* **Framework**: Next.js 15 (React)
* **Styling**: Tailwind CSS + shadcn/ui
* **Features**: 
    * RWD 響應式設計
    * Dark/Light Mode 日夜切換
    * 字體大小調整 (無障礙設計)
    * Markdown 渲染 (React-Markdown)

### Backend (後端)
* **Framework**: Python FastAPI
* **Protocol**: Model Context Protocol (MCP)
* **Server**: Uvicorn

### AI & Data (人工智慧與資料)
* **LLM**: Google Gemini 2.0 Flash (Reasoning & Generation)
* **Vector DB**: ChromaDB (Semantic Search)
* **Keyword Search**: BM25 (Keyword Matching)
* **Hybrid Search**: 結合向量檢索與關鍵字檢索，解決「安全帽」、「結婚年齡」等檢索難題。
* **Query Rewriting**: 使用 AI 預處理使用者問題（如修正錯字、補全主詞）。

---

## ✨ 功能亮點 (Features)

1.  **雙軌制混合搜尋 (Hybrid Search)**
    * 結合 **Vector Search** (語意理解) 與 **BM25** (關鍵字精準匹配)，大幅提升法條召回率。
    * 範例：問「幾歲可以結婚？」，系統能精準抓到《民法》第 980 條。

2.  **AI 查詢重寫 (Query Rewriting)**
    * 自動修正使用者錯字（如「拒絕九策」→「拒絕酒測」）。
    * 自動補全省略主詞（如「未禮讓行人」→「汽機車駕駛未禮讓行人」）。

3.  **動態關鍵字權重 (Dynamic Re-ranking)**
    * 針對使用者輸入的關鍵字，在搜尋結果中進行加權，確保最相關的法條排在最前面。

4.  **友善的使用者介面**
    * 支援 **Markdown 排版**：重點金額（如 **1800元**）亮色粗體顯示。
    * **無障礙設計**：提供字體放大功能，友善長輩使用。

---

## 🚀 快速開始 (Getting Started)

### 前置需求
* Node.js 18+
* Python 3.10+
* Google Gemini API Key

### 1. 下載專案
```bash
git clone [https://github.com/ChiaWei0724/legal-mcp-assistant.git](https://github.com/ChiaWei0724/legal-mcp-assistant.git)
cd legal-mcp-

2. 設定環境變數
在根目錄建立 .env 檔案：

GOOGLE_API_KEY=你的_Gemini_API_Key
NEXT_PUBLIC_API_URL=http://localhost:8000

3. 啟動後端 (Backend)
# 建立虛擬環境 (選用)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r backend/requirements.txt

# 初始化資料庫 (首次執行)
python backend/fetch_gov_data.py  # 下載最新法規
python backend/ingest.py          # 建立向量索引

# 啟動伺服器
python backend/main.py

4. 啟動前端 (Frontend)
開啟新的終端機視窗：
cd frontend
npm install
npm run dev

📂 專案結構 (Project Structure)
legal-mcp-assistant/
├── backend/
│   ├── data/               # 存放 laws.json 法規原始檔
│   ├── chroma_db/          # 向量資料庫檔案
│   ├── main.py             # FastAPI 主程式 (含 RAG 邏輯)
│   ├── ingest.py           # 資料庫寫入腳本
│   ├── fetch_gov_data.py   # 政府資料爬蟲
│   └── requirements.txt    # Python 套件清單
├── frontend/
│   ├── src/app/            # Next.js 頁面邏輯
│   ├── public/             # 靜態資源
│   └── package.json        # 前端套件清單
└── README.md               # 專案說明文件

⚠️ 免責聲明 (Disclaimer)
本系統為 NextWave 2025 黑客松參賽作品，所提供之法律資訊僅供參考，不構成正式法律意見。

系統回答基於《中華民國刑法》、《民法》、《道路交通管理處罰條例》等公開法規資料庫進行檢索與生成，實際個案判決可能因證據、法官心證及最新修法而異。若有具體法律問題，請諮詢專業律師。

Designed with ❤️ by Team 張三