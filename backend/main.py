import os
import json
import jieba
import sqlite3
import uuid
import re
import urllib.parse
from datetime import datetime
from rank_bm25 import BM25Okapi
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Optional, Dict, Any

# --- 1. 環境設定 ---
base_path = Path(__file__).parent.parent
load_dotenv(base_path / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("❌ 找不到 GOOGLE_API_KEY")

genai.configure(api_key=GOOGLE_API_KEY)

# --- 2. 初始化 SQLite 資料庫 ---
DB_FILE = base_path / "backend" / "chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS sessions
                 (id TEXT PRIMARY KEY, client_id TEXT, title TEXT, created_at TIMESTAMP, last_analysis TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, created_at TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# --- 3. 初始化 ChromaDB ---
current_dir = Path(__file__).parent
DB_PATH = current_dir / "chroma_db"
client = chromadb.PersistentClient(path=str(DB_PATH))

google_ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
    api_key=GOOGLE_API_KEY,
    model_name="models/text-embedding-004",
    task_type="retrieval_query"
)

try:
    collection = client.get_collection(name="legal_knowledge", embedding_function=google_ef)
    print(f"✅ 向量資料庫連線成功，包含 {collection.count()} 條法規")
except Exception as e:
    print(f"❌ 資料庫連線失敗: {e}")
    collection = client.get_or_create_collection(name="legal_knowledge", embedding_function=google_ef)

# --- 4. 初始化 BM25 ---
print("⏳ 正在載入 BM25 索引...")
DATA_PATH = current_dir / "data" / "laws.json"
all_laws = []
bm25 = None

if DATA_PATH.exists():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        all_laws = json.load(f)
    tokenized_corpus = [list(jieba.cut(doc['text'])) for doc in all_laws]
    bm25 = BM25Okapi(tokenized_corpus)
else:
    print("⚠️ 警告：找不到 laws.json")

# --- 5. FastAPI 設定 ---
app = FastAPI(title="Legal AI Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    style: str = "general"
    session_id: Optional[str] = None
    client_id: str

class CreateSessionRequest(BaseModel):
    client_id: str

# --- 核心功能 ---
def expand_synonyms(query: str) -> str:
    synonyms = {
        "酒測": "酒精濃度 測試 檢定 拒絕",
        "九策": "酒精濃度 測試 檢定 拒絕",
        "闖紅燈": "號誌 管制 闖越 交岔路口",
        "紅燈": "號誌 管制",
        "超速": "行車速度 超過 最高時速",
        "無照": "未領有 駕駛執照",
        "未禮讓": "暫停 讓 行人 先行",
        "安全帽": "未依規定 戴安全帽",
        "肇逃": "發生交通事故 致人傷害 逃逸",
        "車禍": "交通事故 損害賠償",
        "撞死": "過失致死",
        "撞傷": "過失傷害",
        "偷拿": "竊盜 竊取 動產",
        "偷東西": "竊盜 竊取",
        "搶": "搶奪 強盜",
        "打人": "傷害罪 身體 健康",
        "罵人": "公然侮辱 誹謗 名譽",
        "恐嚇": "加害 生命 身體 自由",
        "騙錢": "詐欺 意圖 不法所有",
        "殺": "殺人 生命 傷害 致死",
        "殺人": "刑法第271條 生命",
        "欠錢": "債務 清償 借貸",
        "賴帳": "債務不履行",
        "賠錢": "損害賠償",
        "噪音": "喧囂 振動 妨害安寧",
        "吵": "喧囂 妨害安寧",
        "樓上": "近鄰 土地所有人",
        "總統": "公務員 國家元首 內亂 外患",
        "名人": "公眾人物 名譽",
        "歌手": "公眾人物",
        "演員": "公眾人物",
    }
    expanded = query
    for key, value in synonyms.items():
        if key in query:
            expanded += f" {value}"
    return expanded

def hybrid_search(query: str):
    expanded_query = expand_synonyms(query)
    print(f"🔍 擴展後搜尋詞: {expanded_query}")
    
    final_docs = []
    seen_ids = set()
    
    # 1. BM25 關鍵字搜尋 (範圍擴大至 50)
    if bm25:
        tokenized_query = list(jieba.cut(expanded_query))
        bm25_results = bm25.get_top_n(tokenized_query, all_laws, n=50)
        for doc in bm25_results:
            if doc['id'] not in seen_ids:
                final_docs.append({"text": doc['text'], "id": doc['id'], "score": 0.8})
                seen_ids.add(doc['id'])

    # 2. 向量語意搜尋 (範圍擴大至 50)
    vector_results = collection.query(query_texts=[expanded_query], n_results=50)
    
    if vector_results['documents'] and vector_results['documents'][0]:
        for i, doc_text in enumerate(vector_results['documents'][0]):
            doc_id = vector_results['ids'][0][i]
            if doc_id not in seen_ids:
                final_docs.append({"text": doc_text, "id": doc_id, "score": 0.7})
                seen_ids.add(doc_id)
            else:
                for item in final_docs:
                    if item['id'] == doc_id:
                        item['score'] += 0.5

    # 3. 關鍵字加權
    keywords = list(jieba.cut(query))
    for item in final_docs:
        for kw in keywords:
            if len(kw) > 1 and kw in item['text']:
                item['score'] += 0.3

    final_docs.sort(key=lambda x: x['score'], reverse=True)
    return "\n\n".join([item['text'] for item in final_docs[:30]])

def query_gemini_rag(
    user_question: str,
    style: str,
    history: Optional[List[Dict[str, Any]]] = None,
):
    print(f"👤 使用者: {user_question} | 模式: {style}")

    # 1. 整理歷史紀錄
    history = history or []
    recent_history = history[-10:]
    history_lines = []
    for msg in recent_history:
        role_name = "使用者" if msg['role'] == 'user' else "AI助手"
        history_lines.append(f"{role_name}: {msg['content']}")
    history_text = "\n".join(history_lines) if history_lines else "（無可參考的歷史訊息）"

    # 2. 搜尋 RAG
    rewrite_model = genai.GenerativeModel('gemini-2.0-flash')
    try:
        rewrite_prompt = f"請參考歷史，將使用者問題改寫為精準法律搜尋字串。歷史:{history_text} 問題:{user_question} 只輸出字串。"
        rewritten_query = rewrite_model.generate_content(rewrite_prompt).text.strip()
    except:
        rewritten_query = user_question

    context_text = hybrid_search(rewritten_query)
    if not context_text: context_text = "（資料庫中未找到直接相關法條）"
    
    system_role = "你是一位台灣法律 AI 顧問。你的職責是僅回答與【台灣法律】相關的問題。如果使用者的問題完全與法律無關（例如：早餐吃什麼、旅遊推薦、心情閒聊），請禮貌拒絕回答，並引導使用者詢問法律相關問題。"
    
    reference_section_title = "【參考資料】"

    # 3. 設定模式與語氣
    tone_instruction = ""
    case_instruction = ""  
    advice_instruction = "" 
    
    if style == "professional":
        tone_instruction = "語氣嚴肅、客觀、精準，使用法律專用術語，稱呼使用者為『當事人』。"
        case_instruction = "請引用一個【類似的實務判決案例】（需虛構案號如：臺北地院112年度訴字第X號），簡述案情與法官判決邏輯。"
        advice_instruction = "請列出 3 點【訴訟攻防建議】，例如證據保全重點、主張法條依據。"
    elif style == "humorous":
        tone_instruction = "語氣非常幽默、充滿鄉民梗、使用誇張的比喻（如：比悲傷更悲傷的故事）。"
        case_instruction = "請編寫一個【荒謬好笑的模擬情境】（例如：小明騎山豬撞到外星人...），用這個故事來帶出法律後果。"
        advice_instruction = "請列出 3 點【不想被抓去關的實務建議】，雖然語氣好笑但內容必須實用。"
    else: 
        tone_instruction = "語氣親切白話，像鄰居大哥哥/大姊姊，完全不用艱深術語。"
        case_instruction = "請舉一個【生活常見例子】（例如：在巷口擦撞機車...）來說明。"
        advice_instruction = "請列出 3 點【當下SOP】，教使用者第一時間該做什麼。"

    # 4. 組合最終 Prompt
    final_prompt = f"""
    {system_role}
    語氣要求：{tone_instruction}
    
    {reference_section_title}（請嚴格基於此內容回答，若無相關內容請勿編造）：
    {context_text}
    
    【歷史對話參考】：
    {history_text}
    
    【使用者問題】：
    {user_question} (AI理解: {rewritten_query})
    
    【回答格式要求 (請嚴格遵守章節順序)】：
    1. **結論先行**：第一句話直接回答核心結果（罰多少錢？刑責為何？）。
    2. **情境案例**：{case_instruction}
    3. **詳細分析**：依據法條進行分析。
       - 若使用者詢問特定身分，請明確指出法律之前人人平等，直接引用一般法條進行說明。
    4. **實務建議**：{advice_instruction} (這是最重要的部分，請務必列點說明)。
    5. **法律依據**：
       - 引用法條格式： `[**法規名稱第X條**](law://content/條文內容)`
       - **絕對禁止**：禁止 AI 自行編造連結內的條文內容。
       - **強制規則**：小括號內的 `law://content/` 後面，**必須** 是來自上述 {reference_section_title} 中該法條的完整原文。
       - **缺漏處理**：若參考資料中沒有該條文完整內容，請填寫 `law://content/無完整條文內容`，但**中括號內仍須寫出正確的條號**。

    【強制要求：最末行輸出 JSON 區塊】
    - 回覆的最後一段必須完全符合以下格式：
      ---JSON_START---
      {{
          "domain": "涉及法律領域",
          "risk_level": "風險等級",
          "keywords": ["關鍵字1", "關鍵字2"]
      }}
      ---JSON_END---
    """

    answer_model = genai.GenerativeModel('gemini-2.0-flash')
    response_text = answer_model.generate_content(final_prompt).text

    # 5. 解析 JSON 與內容
    reply_content = response_text
    analysis_data = {"domain": "分析中", "risk_level": "未知", "keywords": []}

    json_match = re.search(r"---JSON_START---(.*?)---JSON_END---", response_text, re.DOTALL)
    if json_match:
        json_block = json_match.group(1).strip()
        try:
            analysis_data = json.loads(json_block)
        except json.JSONDecodeError:
            pass
        # 移除 JSON 區塊
        reply_content = response_text[:json_match.start()].strip()
            
    # 6. 法條連結處理 (★關鍵：使用 quote 編碼解決 Markdown 空格問題★)
    law_pattern = re.compile(r'\[(?P<text>[^\]]+)\]\s*\((?P<link>law://content/[^)]+)\)')

    def encode_law(match: re.Match) -> str:
        text = match.group("text")
        link = match.group("link")
        
        raw_content = link.replace("law://content/", "", 1)
        
        try:
            decoded_first = urllib.parse.unquote(raw_content)
        except:
            decoded_first = raw_content

        if decoded_first == "無完整條文內容":
            return f"[{text}](law://content/暫無此條文的完整內容，請點擊連結前往全國法規資料庫查詢。)"

        # 移除換行符號
        safe_content = decoded_first.replace("\n", "").replace("\r", "")
        
        # ★ 關鍵：強制 URL Encode，這樣空格會變成 %20，括號變成 %28，Markdown 就會乖乖解析成連結
        final_encoded = urllib.parse.quote(safe_content)
        
        return f"[{text}](law://content/{final_encoded})"

    reply_content = law_pattern.sub(encode_law, reply_content)

    # 7. 最終處理：強制統一免責聲明
    reply_content = reply_content.replace("> 本回覆僅供參考，不代表正式法律意見。實際個案請諮詢專業律師。", "")
    reply_content = reply_content.replace("本回覆僅供參考，不代表正式法律意見。實際個案請諮詢專業律師。", "")
    reply_content = reply_content.strip()

    disclaimer = "\n\n> 本回覆僅供參考，不代表正式法律意見。實際個案請諮詢專業律師。"
    reply_content += disclaimer

    return {"reply": reply_content, "analysis": analysis_data}

# --- API 路由 ---
@app.get("/")
def read_root(): return {"message": "Legal AI Backend Running"}

@app.get("/sessions")
def get_sessions(client_id: str = Query(..., description="使用者的唯一 ID")):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, title, created_at FROM sessions WHERE client_id = ? ORDER BY created_at DESC", (client_id,))
    sessions = [{"id": row[0], "title": row[1], "created_at": row[2]} for row in c.fetchall()]
    conn.close()
    return sessions

@app.post("/sessions")
def create_session(request: CreateSessionRequest):
    session_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO sessions (id, client_id, title, created_at, last_analysis) VALUES (?, ?, ?, ?, ?)", 
              (session_id, request.client_id, "新對話", created_at, "{}"))
    conn.commit()
    conn.close()
    return {"id": session_id, "title": "新對話"}

@app.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    c.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": session_id}

@app.get("/sessions/{session_id}")
def get_session_messages(session_id: str):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC", (session_id,))
    messages = [{"role": row[0], "content": row[1]} for row in c.fetchall()]
    c.execute("SELECT last_analysis FROM sessions WHERE id = ?", (session_id,))
    row = c.fetchone()
    analysis = json.loads(row[0]) if row and row[0] else None
    conn.close()
    return {"messages": messages, "analysis": analysis}

@app.post("/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    if not session_id:
        session_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        title = request.message[:10]
        c.execute("INSERT INTO sessions (id, client_id, title, created_at, last_analysis) VALUES (?, ?, ?, ?, ?)", 
                  (session_id, request.client_id, title, created_at, "{}"))
    
    # 讀取最近 10 則歷史紀錄
    c.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 10",
        (session_id,)
    )
    rows = c.fetchall()
    history = [{"role": row[0], "content": row[1]} for row in reversed(rows)]
    
    try:
        # 呼叫 query_gemini_rag
        result = query_gemini_rag(request.message, request.style, history)
        
        ai_reply = result["reply"]
        analysis_data = result["analysis"]
        
        # 寫入訊息
        now = datetime.now().isoformat()
        c.execute("INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)", (session_id, "user", request.message, now))
        c.execute("INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)", (session_id, "assistant", ai_reply, now))
        
        # 更新最後分析結果
        c.execute("UPDATE sessions SET last_analysis = ? WHERE id = ?", (json.dumps(analysis_data), session_id))
        
        conn.commit()
        
        return {"reply": ai_reply, "session_id": session_id, "analysis": analysis_data}
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            "reply": "❌ 系統發生錯誤，請稍後再試。",
            "session_id": session_id,
            "analysis": None
        }
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)