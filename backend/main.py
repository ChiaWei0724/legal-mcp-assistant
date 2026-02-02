import os
import json
import jieba
import sqlite3
import uuid
import re
import urllib.parse
import base64
from datetime import datetime
from rank_bm25 import BM25Okapi
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Optional, Dict, Any
from sentence_transformers import SentenceTransformer

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
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, analysis TEXT, created_at TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# --- 3. 初始化 ChromaDB (本地 Embedding) ---
current_dir = Path(__file__).parent
DB_PATH = current_dir / "chroma_db"
client = chromadb.PersistentClient(path=str(DB_PATH))

EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
print(f"正在載入 embedding 模型：{EMBED_MODEL_NAME}")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

try:
    collection = client.get_collection(name="legal_knowledge")
    print(f"向量資料庫連線成功，包含 {collection.count()} 條法規")
except Exception as e:
    print(f"資料庫連線失敗: {e}")
    collection = client.get_or_create_collection(name="legal_knowledge")

# --- 4. 初始化 BM25 ---
print("⏳ 正在載入 BM25 索引...")
ALL_LAWS_PATH = current_dir / "data" / "all_laws.json"
LEGACY_LAWS_PATH = current_dir / "data" / "laws.json"
all_laws = []
bm25 = None

# 優先使用完整法規資料，否則 fallback 到精選版
if ALL_LAWS_PATH.exists():
    with open(ALL_LAWS_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # all_laws.json 使用 "content" 欄位，統一轉為 "text"
    all_laws = [{"id": d["id"], "text": d["content"], "category": d.get("category", "")} for d in raw]
    print(f"✅ 已載入完整法規: {len(all_laws)} 條")
elif LEGACY_LAWS_PATH.exists():
    with open(LEGACY_LAWS_PATH, "r", encoding="utf-8") as f:
        all_laws = json.load(f)
    print(f"✅ 已載入精選法規: {len(all_laws)} 條")
else:
    print("⚠️ 警告：找不到任何法規資料")

if all_laws:
    tokenized_corpus = [list(jieba.cut(doc['text'])) for doc in all_laws]
    bm25 = BM25Okapi(tokenized_corpus)

# --- 5. FastAPI 設定 ---
app = FastAPI(title="Legal AI Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",             # 本機開發用
        "https://legal-mcp-assistant-weld.vercel.app",  # ⚠️ 請換成你 Vercel 實際的網址
        # 如果有其他網域也加上去
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    style: str = "general"
    session_id: Optional[str] = None
    client_id: str
    image: Optional[str] = None
    image_type: Optional[str] = None

class CreateSessionRequest(BaseModel):
    client_id: str

class DocumentRequest(BaseModel):
    doc_type: str
    session_id: str
    client_id: str
    additional_info: Optional[str] = None

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
        "裸奔": "公然猥褻 妨害風化",
        "脫褲子": "公然猥褻",
        "捲走": "業務侵占 普通侵占 背信 詐欺",
        "捲款": "業務侵占 背信",
        "合夥": "合夥財產 背信 侵占",
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
    
    if bm25:
        tokenized_query = list(jieba.cut(expanded_query))
        bm25_results = bm25.get_top_n(tokenized_query, all_laws, n=50)
        for doc in bm25_results:
            if doc['id'] not in seen_ids:
                final_docs.append({"text": doc['text'], "id": doc['id'], "score": 0.8})
                seen_ids.add(doc['id'])

    query_embedding = embed_model.encode([expanded_query]).tolist()
    vector_results = collection.query(query_embeddings=query_embedding, n_results=50)
    
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

    keywords = list(jieba.cut(query))
    for item in final_docs:
        for kw in keywords:
            if len(kw) > 1 and kw in item['text']:
                item['score'] += 0.3

    final_docs.sort(key=lambda x: x['score'], reverse=True)
    return "\n\n".join([item['text'] for item in final_docs[:30]])

# --- 建立法規名稱與 PCode 對照表 ---
PCODE_MAP_PATH = current_dir / "data" / "pcode_map.json"
LAW_NAME_TO_PCODE = {}
if PCODE_MAP_PATH.exists():
    with open(PCODE_MAP_PATH, "r", encoding="utf-8") as f:
        LAW_NAME_TO_PCODE = json.load(f)
    print(f"✅ 已載入 PCode 對照表: {len(LAW_NAME_TO_PCODE)} 筆")
else:
    print("⚠️ 找不到 pcode_map.json，法條連結可能無法正確產生")

def analyze_image_with_gemini(image_base64: str, image_type: str = "image/jpeg", user_context: str = "") -> str:
    """Use Gemini 2.5 Flash vision to analyze a legal document image."""
    import base64 as b64_module
    image_data = b64_module.b64decode(image_base64)
    image_part = {"mime_type": image_type, "data": image_data}
    analysis_prompt = f"""你是台灣法律文件分析專家。請仔細閱讀這張圖片，識別並提取以下資訊：
1. 文件類型（罰單、合約、判決書、存證信函等）
2. 所有關鍵法律資訊（日期、金額、違規事項、條文引用、當事人等）
3. 重要條款或條文編號

使用者補充說明：{user_context if user_context else '無'}

請以結構化方式輸出提取的內容，方便後續法律分析。"""
    vision_model = genai.GenerativeModel('gemini-2.5-flash')
    response = vision_model.generate_content([analysis_prompt, image_part])
    return response.text


def query_gemini_rag(
    user_question: str,
    style: str,
    history: Optional[List[Dict[str, Any]]] = None,
    image_analysis: Optional[str] = None,
):
    print(f"👤 使用者: {user_question} | 模式: {style}")

    history = history or []
    recent_history = history[-10:]
    history_lines = []
    for msg in recent_history:
        role_name = "使用者" if msg['role'] == 'user' else "AI助手"
        history_lines.append(f"{role_name}: {msg['content']}")
    history_text = "\n".join(history_lines) if history_lines else "（無可參考的歷史訊息）"

    rewrite_model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        rewrite_prompt = f"請參考歷史，將使用者問題改寫為精準法律搜尋字串。歷史:{history_text} 問題:{user_question} 只輸出字串。"
        rewritten_query = rewrite_model.generate_content(rewrite_prompt).text.strip()
    except:
        rewritten_query = user_question

    search_query = rewritten_query
    if image_analysis:
        search_query = f"{rewritten_query} {image_analysis[:200]}"

    context_text = hybrid_search(search_query)
    if not context_text: context_text = "（資料庫中未找到直接相關法條）"
    
    system_role = "你是一位台灣法律 AI 顧問。你的職責是僅回答與【台灣法律】相關的問題。如果使用者的問題完全與法律無關（例如：早餐吃什麼、旅遊推薦、心情閒聊），請禮貌拒絕回答，並引導使用者詢問法律相關問題。"
    
    reference_section_title = "【參考資料】"

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

    image_section = ""
    if image_analysis:
        image_section = f"""
    【圖片分析結果】：
    使用者上傳了一張法律文件圖片，AI 視覺分析結果如下：
    {image_analysis}
    請結合此圖片分析結果與使用者問題進行回答。
    """

    # Prompt
    final_prompt = f"""
    {system_role}
    語氣要求：{tone_instruction}

    【思維鏈分析 (Chain-of-Thought)】：
    在回答之前，請先內部評估使用者問題的完整性：
    - 如果使用者的描述缺少關鍵細節（例如：時間、地點、金額、傷亡情況、是否有和解等），
      請在回答的「結論先行」之前，先列出你需要釐清的問題。
    - 使用 ---FOLLOWUP_START--- 和 ---FOLLOWUP_END--- 標記包裹追問問題。
    - 格式範例：
      ---FOLLOWUP_START---
      ["事故發生的確切時間和地點？", "對方是否有受傷？", "是否已經報警處理？"]
      ---FOLLOWUP_END---
    - 即使有追問，仍然要基於目前已知資訊給出初步分析。
    - 如果使用者的問題已經足夠清楚，則不需要輸出追問區塊。

    {reference_section_title}（請嚴格基於此內容回答，若無相關內容請勿編造）：
    {context_text}

    【歷史對話參考】：
    {history_text}
    {image_section}
    【使用者問題】：
    {user_question} (AI理解: {rewritten_query})
    
    【回答格式要求 (請嚴格遵守章節順序)】：
    1. **結論先行**：第一句話直接回答核心結果。
    2. **情境案例**：{case_instruction}
    3. **詳細分析**：依據法條進行分析。
    4. **實務建議**：{advice_instruction}
    5. **法律依據** (★重要★)：
       - 請列出參考法條，格式請**務必**使用以下 XML 標籤：
       - <ref title="法規名稱+條號" content="條文完整內容" />
       - 範例：`<ref title="民法第184條" content="因故意或過失..." />`
       - **絕對禁止**使用 Markdown 連結格式。
       - 若無完整內容，content 請填寫「無完整條文內容」。

    【強制要求：最末行輸出 JSON 區塊】
    - 回覆的最後一段必須完全符合以下格式，不要在後面加字：
      ---JSON_START---
      {{
          "domain": "涉及法律領域",
          "risk_level": "風險等級",
          "keywords": ["關鍵字1", "關鍵字2"]
      }}
      ---JSON_END---
    """

    answer_model = genai.GenerativeModel('gemini-2.5-flash')
    response_text = answer_model.generate_content(final_prompt).text

    reply_content = response_text
    analysis_data = {"domain": "分析中", "risk_level": "未知", "keywords": []}

    # JSON 提取
    json_match = re.search(r"---JSON_START---(.*?)---JSON_END---", response_text, re.DOTALL)
    if not json_match:
        json_match = re.search(r"(\{[\s\S]*\"domain\"[\s\S]*\"risk_level\"[\s\S]*\})", response_text)

    if json_match:
        json_block = json_match.group(1).strip()
        try:
            analysis_data = json.loads(json_block)
        except:
            pass
        
        if "---JSON_START---" in response_text:
             reply_content = response_text.split("---JSON_START---")[0].strip()
        else:
             reply_content = response_text.replace(json_match.group(0), "").strip()

    reply_content = reply_content.replace("---JSON_START---", "").replace("---JSON_END---", "").strip()

    # 提取追問問題 (CoT Follow-up)
    follow_up_questions = []
    followup_match = re.search(r"---FOLLOWUP_START---(.*?)---FOLLOWUP_END---", reply_content, re.DOTALL)
    if followup_match:
        try:
            follow_up_questions = json.loads(followup_match.group(1).strip())
        except:
            pass
        reply_content = reply_content.replace(followup_match.group(0), "").strip()

    # ★ 核心修正：美化版連結產生器 (無黑點，強制垂直排列) ★
    def create_clean_link(title, content):
        # 1. 清理標題：移除粗體、移除所有空格 (解決全形半形排版問題)
        # "民 法 第 1 條" -> "民法第1條"
        title = title.replace("**", "").replace(" ", "").strip()
        
        if content == "無完整條文內容":
             content = "暫無此條文的完整內容，請點擊連結前往全國法規資料庫查詢。"

        # 2. 清理內容
        safe_content = content.replace("\n", "").replace("\r", "").strip()
        
        # 3. Base64 編碼 (URL-safe: 用 - 和 _ 取代 + 和 /)
        b64_bytes = base64.urlsafe_b64encode(safe_content.encode('utf-8'))
        b64_str = b64_bytes.decode('utf-8')

        # 4. 解析 PCode 與 條號（支援 第24條之3 → flno=24-3）
        pcode = ""
        flno = ""
        match = re.match(r"(.+?)第([\d-]+)條(?:之(\d+))?", title)
        if match:
            law_name = match.group(1)
            flno = match.group(2)
            if match.group(3):
                flno = f"{flno}-{match.group(3)}"
            pcode = LAW_NAME_TO_PCODE.get(law_name, "")
            # 如果完全匹配找不到，嘗試模糊搜尋
            if not pcode:
                 for known_name, known_pcode in LAW_NAME_TO_PCODE.items():
                     if len(known_name) > 2 and (known_name in law_name or law_name in known_name):
                         pcode = known_pcode
                         break
        
        # 5. ★ 關鍵：使用 \n\n (雙換行) 強制分段，不用列表符號 ★
        return f"\n\n[**{title}**](https://law.ai/view?pcode={pcode}&flno={flno}&data={b64_str})"

    # 處理 <ref> 標籤
    # 允許前面有 Markdown 條列符號 (*、-、+) 一起被吃掉，避免畫面殘留米字號
    ref_pattern = re.compile(
        r'[ \t]*[-*+]?\s*<ref\s+title="([^"]+)"\s+content="([^"]+)"\s*/>'
    )
    reply_content = ref_pattern.sub(
        lambda m: create_clean_link(m.group(1), m.group(2)),
        reply_content,
    )

    # 把只剩一個 * 或 - 的空行也清掉（避免舊紀錄或特殊情況）
    reply_content = re.sub(
        r'^\s*[\*\-]\s*$',
        '',
        reply_content,
        flags=re.MULTILINE,
    )
    
    # 處理舊 Markdown 格式 (備用)
    legacy_pattern = re.compile(r'\[(?P<text>[^\]]+)\]\s*\((?P<link>law://[^)]+)\)')
    def fix_legacy_link(match: re.Match) -> str:
        text = match.group("text")
        link = match.group("link")
        raw_content = link.replace("law://content/", "").replace("law://base64/", "")
        try: raw_content = urllib.parse.unquote(raw_content)
        except: pass
        return create_clean_link(text, raw_content)

    reply_content = legacy_pattern.sub(fix_legacy_link, reply_content)

    # 強制統一免責聲明
    reply_content = re.sub(r">?\s*本回覆僅供參考.*", "", reply_content).strip()
    disclaimer = "\n\n\n> 本回覆僅供參考，不代表正式法律意見。實際個案請諮詢專業律師。"
    reply_content += disclaimer

    return {"reply": reply_content, "analysis": analysis_data, "follow_up_questions": follow_up_questions}

# --- API 路由 ---
@app.get("/")
def read_root():
    return {
        "message": "Legal AI Backend Running",
        "law_count": len(all_laws),
        "pcode_count": len(LAW_NAME_TO_PCODE),
    }

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
    c.execute("SELECT role, content, analysis FROM messages WHERE session_id = ? ORDER BY id ASC", (session_id,))
    messages = []
    for row in c.fetchall():
        msg = {"role": row[0], "content": row[1]}
        if row[2]:
            try:
                msg["analysis"] = json.loads(row[2])
            except:
                pass
        messages.append(msg)
    
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
    
    c.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 10",
        (session_id,)
    )
    rows = c.fetchall()
    history = [{"role": row[0], "content": row[1]} for row in reversed(rows)]
    
    try:
        # Analyze image if provided
        image_analysis = None
        if request.image:
            try:
                image_analysis = analyze_image_with_gemini(
                    request.image,
                    request.image_type or "image/jpeg",
                    request.message
                )
            except Exception as img_err:
                print(f"Image analysis error: {img_err}")

        result = query_gemini_rag(request.message, request.style, history, image_analysis=image_analysis)

        ai_reply = result["reply"]
        analysis_data = result["analysis"]
        follow_up_questions = result.get("follow_up_questions", [])

        now = datetime.now().isoformat()
        user_content = f"[圖片已上傳] {request.message}" if request.image else request.message
        c.execute("INSERT INTO messages (session_id, role, content, analysis, created_at) VALUES (?, ?, ?, ?, ?)", (session_id, "user", user_content, None, now))
        c.execute("INSERT INTO messages (session_id, role, content, analysis, created_at) VALUES (?, ?, ?, ?, ?)", (session_id, "assistant", ai_reply, json.dumps(analysis_data), now))

        c.execute("UPDATE sessions SET last_analysis = ? WHERE id = ?", (json.dumps(analysis_data), session_id))

        conn.commit()

        return {"reply": ai_reply, "session_id": session_id, "analysis": analysis_data, "follow_up_questions": follow_up_questions}
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            "reply": "❌ 系統發生錯誤，請稍後再試。",
            "session_id": session_id,
            "analysis": None
        }
    finally:
        conn.close()

@app.post("/generate-document")
async def generate_document(request: DocumentRequest):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id FROM sessions WHERE id = ? AND client_id = ?",
              (request.session_id, request.client_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    c.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
        (request.session_id,)
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=400, detail="No conversation history found")

    history_text = "\n".join([
        f"{'使用者' if r[0] == 'user' else 'AI助手'}: {r[1][:500]}"
        for r in rows
    ])

    doc_templates = {
        "存證信函": """請根據以下對話內容，生成一份台灣法律格式的【存證信函】。
格式要求：
1. 收件人資訊（如果對話中有提及）
2. 發信人資訊（以「本人」代稱）
3. 主旨
4. 事實經過（按時間順序）
5. 法律依據（引用具體法條）
6. 訴求事項（具體要求）
7. 結尾警語（限期回覆、否則依法追訴等）
8. 發信日期""",
        "和解協議書": """請根據以下對話內容，生成一份台灣法律格式的【和解協議書】。
格式要求：
1. 協議書標題
2. 甲方、乙方資訊
3. 事實緣由
4. 和解條件（賠償金額、方式、期限）
5. 雙方權利義務
6. 違約條款
7. 管轄法院
8. 簽署欄""",
        "行政申訴書": """請根據以下對話內容，生成一份台灣法律格式的【行政申訴書】。
格式要求：
1. 受理機關
2. 申訴人資訊
3. 申訴事項（原處分內容）
4. 申訴理由（事實及法律依據）
5. 請求事項（撤銷或變更處分）
6. 證據清單
7. 附件說明
8. 申訴日期與簽名"""
    }

    template = doc_templates.get(request.doc_type, doc_templates["存證信函"])

    prompt = f"""你是台灣法律文書撰寫專家。

{template}

【對話紀錄參考】：
{history_text}

{'【使用者補充資訊】：' + request.additional_info if request.additional_info else ''}

重要注意事項：
- 內容必須符合台灣法律格式
- 所有法條引用必須正確
- 個人資訊處以「OOO」或「XXX」代替，提醒使用者自行填寫
- 金額、日期等如果不明確，用「___」代替
- 最後加上免責聲明：此文書由 AI 輔助生成，建議正式使用前請律師審閱。

請直接輸出文書內容，不需要額外解釋。"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return {
            "document": response.text,
            "doc_type": request.doc_type,
            "session_id": request.session_id
        }
    except Exception as e:
        print(f"Document generation error: {e}")
        raise HTTPException(status_code=500, detail="文書生成失敗，請稍後再試")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)