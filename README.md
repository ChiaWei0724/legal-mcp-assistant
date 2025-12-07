# 今日張三又犯法了嗎？ (NextWave 2025 AI 法創黑客松)

![Project Banner](https://via.placeholder.com/1200x300?text=NextWave+2025+AI+Legal+Hackathon)

> 一個結合生成式 AI 與 RAG 技術的智慧法律顧問，讓法律不再艱澀難懂。

## 📖 專案簡介 (About)

**「今日張三又犯法了嗎？」** 是一個專為台灣民眾設計的 **AI 法律諮詢輔助系統**。我們觀察到許多民眾（如租屋族、車禍當事人）在面臨法律糾紛時，常因法條艱澀或資訊不對稱而感到無助。

本系統採用 **Google Gemini 2.5 Flash** 作為核心大腦，結合 **RAG (檢索增強生成)** 技術讀取最新的台灣法規（刑法、民法、道交條例）。有別於傳統聊天機器人，我們打造了 **Gemini 風格的沉浸式介面**，並提供 **即時語音輸入** 與 **視覺化分析儀表板**，提供即時、有憑有據且白話的法律分析。

### 核心價值
* **白話轉譯**：將複雜的法條轉換為一般人聽得懂的建議。
* **有憑有據**：每一條回答都會精準引用法規出處，並提供原文連結 Tooltip。
* **風險可視**：自動分析案件的「法律領域」與「風險等級」，讓使用者一目了然。

---

## 👥 團隊成員 (Team "張三")

我們是來自 **龍華科技大學** 的跨領域開發團隊：

| 姓名 | 角色 | 負責項目 |
| :--- | :--- | :--- |
| **龍禹丞** | 隊長 / 雲端架構 | 雲端伺服器部署、系統穩定性與安全性維護。 |
| **陳嘉維** | AI 提示工程師 | 上下文工程 (Context Engineering)、Prompt 優化、提升回答準確度。 |
| **胡允豪** | 後端開發 | Python 程式撰寫、API 整合、RAG 檢索邏輯與資料庫串接。 |
| **彭冠綸** | 領域專家 | 法律資料庫整合、法規內容驗證、交通與民事流程顧問。 |
| **呂育昇** | 技術支援 | 網路爬蟲開發、資料蒐集自動化、系統測試。 |

---

## 🛠️ 技術架構 (Tech Stack)

本專案採用現代化的 **前後端分離** 架構，並移除傳統 MCP Server 改採 **Direct RAG** 模式以提升回應速度：

### Frontend (前端)
* **Framework**: Next.js 15 (React 19)
* **Styling**: Tailwind CSS + Lucide Icons
* **Interaction**:
    * **Web Speech API**: 原生瀏覽器語音識別 (無須額外依賴)。
    * **View Transitions API**: 實作 Dark/Light Mode 圓形擴散轉場動畫。
    * **Streaming UI**: 模擬打字機效果與即時語音上屏。

### Backend (後端)
* **Framework**: Python FastAPI
* **Database**: SQLite (對話紀錄), ChromaDB (向量資料庫)
* **Search Engine**: Hybrid Search (BM25 + Vector)

### AI Core (人工智慧核心)
* **Model**: Google Gemini 2.5 Flash
* **Technique**: RAG (Retrieval-Augmented Generation)
* **Capabilities**: Query Rewriting (查詢改寫)、Context Awareness (多輪對話記憶)。

---

## ✨ 全新功能亮點 (New Features)

### 1. 沉浸式互動體驗 (Immersive UI/UX)
* **Gemini 風格介面**：簡約大氣的對話框設計，整合模式切換與輸入工具。
* **即時語音輸入**：按住麥克風即可說話，支援 **Real-time Streaming** 文字即時上屏，無需等待整句講完。
* **圓形擴散轉場**：切換日夜模式時，採用如水波紋般的擴散動畫 (Circular Reveal)。

### 2. AI 智慧判讀儀表板 (Analysis Dashboard)
* **領域識別**：AI 自動判斷案件屬於「刑事」、「民事」或「行政」領域。
* **風險評估**：根據案情嚴重程度，自動標示「高/中/低」風險等級。
* **知識圖譜標籤**：自動提取案件關鍵字（如：#車禍、#肇逃、#賠償），建立知識關聯。

### 3. 雙軌制混合搜尋 (Hybrid Search)
* 結合 **Vector Search** (語意理解) 與 **BM25** (關鍵字精準匹配)。
* **同義詞擴充**：系統內建字典，自動將「吵死人」關聯至「噪音、喧囂」，解決法條用語與口語不一致的問題。

### 4. 智慧法條工具箱 (Smart Tooltip)
* **防呆連結**：AI 回答中的法條連結（如 `[民法第184條]`）滑鼠移入即顯示完整條文。
* **智慧邊界檢測**：Tooltip 會自動偵測視窗位置，避免內容被切掉，並支援一鍵複製條文。

---

## 🚀 快速開始 (Getting Started)

### 前置需求
* Node.js 18+
* Python 3.10+
* Google Gemini API Key


```bash
1. 下載專案
git clone [https://github.com/ChiaWei0724/legal-mcp-assistant.git](https://github.com/ChiaWei0724/legal-mcp-assistant.git)
cd legal-mcp-assistant

2. 設定環境變數
在專案根目錄建立 .env 檔案：
GOOGLE_API_KEY=你的_Gemini_API_Key
NEXT_PUBLIC_API_URL=http://localhost:8000

3. 啟動後端 (Backend)

# 建立虛擬環境 (建議)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 安裝依賴
pip install -r backend/requirements.txt

# 初始化資料庫 (首次執行需下載法規)
python backend/fetch_gov_data.py
python backend/ingest.py

# 啟動 FastAPI 伺服器
python backend/main.py

4. 啟動前端 (Frontend)
開啟新的終端機視窗：
cd frontend
npm install
npm run dev

⚠️ 免責聲明 (Disclaimer)
本系統為 NextWave 2025 黑客松 參賽作品，所提供之法律資訊僅供參考，不構成正式法律意見。

系統回答基於《中華民國刑法》、《民法》、《道路交通管理處罰條例》等公開法規資料庫進行檢索與生成，實際個案判決可能因證據、法官心證及最新修法而異。若有具體法律問題，請務必諮詢專業律師。

Designed with ❤️ by Team 張三