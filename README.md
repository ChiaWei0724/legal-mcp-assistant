# 我的AI溢出就像雨水 — AI台灣法律顧問

> 一個結合生成式 AI 與 RAG 技術的智慧法律顧問，讓法律不再艱澀難懂。

## 專案簡介

**「我的AI溢出就像雨水」** 是一個專為台灣民眾設計的 **AI 法律諮詢輔助系統**。我們觀察到許多民眾（如租屋族、車禍當事人）在面臨法律糾紛時，常因法條艱澀或資訊不對稱而感到無助。

本系統採用 **Google Gemini 2.5 Flash** 作為核心大腦，結合 **RAG (檢索增強生成)** 技術讀取全國法規資料庫共 47,000+ 條法規。有別於傳統聊天機器人，我們打造了沉浸式介面，並提供 **即時語音輸入**、**圖片分析**、**法律文書生成** 與 **視覺化分析儀表板**，提供即時、有憑有據且白話的法律分析。

### 核心價值
* **白話轉譯**：將複雜的法條轉換為一般人聽得懂的建議。
* **有憑有據**：每一條回答都會精準引用法規出處，並提供原文連結與法規快覽 Tooltip。
* **風險可視**：自動分析案件的「法律領域」與「風險等級」，讓使用者一目了然。

---

## 團隊成員

我們是來自 **龍華科技大學** 的跨領域開發團隊：

| 姓名 | 角色 | 負責項目 |
| :--- | :--- | :--- |
| **龍禹丞** | 隊長 / 雲端架構 | 雲端伺服器部署、系統穩定性與安全性維護。 |
| **陳嘉維** | AI 提示工程師 | 上下文工程 (Context Engineering)、Prompt 優化、提升回答準確度。 |
| **胡允豪** | 後端開發 | Python 程式撰寫、API 整合、RAG 檢索邏輯與資料庫串接。 |
| **彭冠綸** | 領域專家 | 法律資料庫整合、法規內容驗證、交通與民事流程顧問。 |
| **呂育昇** | 技術支援 | 網路爬蟲開發、資料蒐集自動化、系統測試。 |

---

## 技術架構

本專案採用現代化的 **前後端分離** 架構：

### Frontend
* **Framework**: Next.js 16 (React 19)
* **Styling**: Tailwind CSS 4 + Lucide Icons
* **Features**:
    * Web Speech API 語音輸入
    * Dark/Light Mode 切換
    * ReactMarkdown 即時渲染
    * 法規快覽 Portal Tooltip

### Backend
* **Framework**: Python FastAPI
* **Database**: SQLite (對話紀錄)、ChromaDB (向量資料庫)
* **Search**: Hybrid Search — BM25 (jieba 中文分詞) + Vector Semantic Search (sentence-transformers)
* **Data**: 全國法規資料庫 47,000+ 條法規 (透過 Open API 下載)

### AI Core
* **Model**: Google Gemini 2.5 Flash
* **Technique**: RAG (Retrieval-Augmented Generation)
* **Capabilities**: Query Rewriting、Chain-of-Thought 分析、多輪對話記憶、圖片法律文件分析

### MCP Server
* **Protocol**: Model Context Protocol (MCP)
* **Tools**: 法規搜尋、風險分析、法律文書生成

---

## 功能亮點

### 1. 三種對話模式
* **專業律師模式**：嚴謹用語，引用實務判決案例。
* **一般民眾模式**：白話易懂，用生活例子解釋。
* **幽默風趣模式**：用梗與比喻帶出法律知識。

### 2. AI 智慧判讀儀表板
* **領域識別**：AI 自動判斷案件屬於刑事、民事或行政領域。
* **風險評估**：根據案情嚴重程度，標示高/中/低風險等級。
* **知識圖譜標籤**：自動提取案件關鍵字，建立知識關聯。

### 3. 雙軌混合搜尋
* 結合 **Vector Search** (語意理解) 與 **BM25** (關鍵字精準匹配)。
* **同義詞擴充**：內建字典自動將口語對應至法律用語。

### 4. 法規快覽 Tooltip
* AI 回答中的法條連結滑鼠移入即顯示完整條文。
* 自動產生正確的全國法規資料庫連結，支援一鍵複製條文。

### 5. 圖片分析
* 上傳罰單、合約等法律文件圖片，AI 自動辨識並分析。

### 6. 法律文書生成
* 支援生成存證信函、和解協議書、行政申訴書。

---

## 快速開始

### 前置需求
* Node.js 18+
* Python 3.10+
* Google Gemini API Key

### 1. 下載專案

```bash
git clone https://github.com/ChiaWei0724/legal-mcp-assistant.git
cd legal-mcp-assistant
```

### 2. 設定環境變數

在專案根目錄建立 `.env` 檔案：

```env
GOOGLE_API_KEY=你的_Gemini_API_Key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 啟動後端

```bash
cd backend

# 建立虛擬環境
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 下載法規資料 (首次執行)
python fetch_all_laws.py
python build_pcode_map.py
python ingest.py

# 啟動伺服器
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 啟動前端

開啟新的終端機視窗：

```bash
cd frontend
npm install
npm run dev
```

瀏覽器開啟 `http://localhost:3000` 即可使用。

---

## 免責聲明

本系統所提供之法律資訊僅供參考，不構成正式法律意見。系統回答基於全國法規資料庫公開法規進行檢索與生成，實際個案判決可能因證據、法官心證及最新修法而異。若有具體法律問題，請務必諮詢專業律師。
