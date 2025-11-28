import os
import json
import jieba
from rank_bm25 import BM25Okapi
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# --- 1. 環境設定 ---
base_path = Path(__file__).parent.parent
load_dotenv(base_path / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("❌ 找不到 GOOGLE_API_KEY")

genai.configure(api_key=GOOGLE_API_KEY)

# --- 2. 初始化 ChromaDB ---
current_dir = Path(__file__).parent
DB_PATH = current_dir / "chroma_db"
client = chromadb.PersistentClient(path=str(DB_PATH))

google_ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
    api_key=GOOGLE_API_KEY,
    model_name="models/text-embedding-004",
    task_type="retrieval_query"
)

try:
    collection = client.get_collection(
        name="legal_knowledge",
        embedding_function=google_ef
    )
    print(f"✅ 向量資料庫連線成功，包含 {collection.count()} 條法規")
except Exception as e:
    print(f"❌ 資料庫連線失敗: {e}")
    collection = client.get_or_create_collection(name="legal_knowledge", embedding_function=google_ef)

# --- 3. 初始化 BM25 ---
print("⏳ 正在載入 BM25 索引...")
DATA_PATH = current_dir / "data" / "laws.json"
all_laws = []
bm25 = None

if DATA_PATH.exists():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        all_laws = json.load(f)
    tokenized_corpus = [list(jieba.cut(doc['text'])) for doc in all_laws]
    bm25 = BM25Okapi(tokenized_corpus)
    print(f"✅ BM25 索引建立完成！")
else:
    print("⚠️ 警告：找不到 laws.json")

# --- 4. FastAPI ---
app = FastAPI(title="Legal MCP Assistant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

# --- 核心：同義詞擴展字典 (Synonym Expansion) ---
# 這是為了彌補「俗稱」與「法條原文」的差距
def expand_synonyms(query: str) -> str:
    synonyms = {
        "酒測": "酒精濃度 測試 檢定 拒絕",
        "九策": "酒精濃度 測試 檢定 拒絕", # 針對特定錯字直接處理
        "闖紅燈": "號誌 管制 闖越 交岔路口",
        "紅燈": "號誌 管制",
        "超速": "行車速度 超過 最高時速",
        "無照": "未領有 駕駛執照",
        "偷拿": "竊盜 竊取",
        "打人": "傷害罪 身體 健康",
        "罵人": "公然侮辱 誹謗",
        "未禮讓": "暫停 讓 行人 先行",
        "安全帽": "未依規定 戴安全帽",
    }
    
    expanded = query
    for key, value in synonyms.items():
        if key in query:
            expanded += f" {value}"
    
    return expanded

# --- 核心：雙軌搜尋 ---
def hybrid_search(query: str):
    # 1. 先做同義詞擴展
    expanded_query = expand_synonyms(query)
    print(f"🔍 擴展後搜尋詞: {expanded_query}")
    
    final_docs = []
    seen_ids = set()
    
    # 軌道 A: BM25 (抓關鍵字) - 提高到 30 筆
    if bm25:
        tokenized_query = list(jieba.cut(expanded_query))
        bm25_results = bm25.get_top_n(tokenized_query, all_laws, n=30)
        for doc in bm25_results:
            if doc['id'] not in seen_ids:
                final_docs.append({"text": doc['text'], "id": doc['id'], "score": 0.8})
                seen_ids.add(doc['id'])

    # 軌道 B: Vector (抓語意) - 提高到 30 筆
    vector_results = collection.query(
        query_texts=[expanded_query],
        n_results=30
    )
    
    if vector_results['documents'] and vector_results['documents'][0]:
        for i, doc_text in enumerate(vector_results['documents'][0]):
            doc_id = vector_results['ids'][0][i]
            if doc_id not in seen_ids:
                final_docs.append({"text": doc_text, "id": doc_id, "score": 0.7})
                seen_ids.add(doc_id)
            else:
                # 重疊加分
                for item in final_docs:
                    if item['id'] == doc_id:
                        item['score'] += 0.5

    # 軌道 C: 關鍵字暴力加權
    # 確保包含「使用者原始關鍵字」的法條排在最前面
    keywords = list(jieba.cut(query))
    for item in final_docs:
        for kw in keywords:
            if len(kw) > 1 and kw in item['text']:
                item['score'] += 0.3

    final_docs.sort(key=lambda x: x['score'], reverse=True)
    
    # 取前 15 條給 AI (Gemini Context Window 夠大，多給一點沒關係)
    print(f"🏆 最終前 3 名: {[item['id'] for item in final_docs[:3]]}")
    return "\n\n".join([item['text'] for item in final_docs[:15]])

# --- 修改 query_gemini_rag 函式 (幽默與案例版) ---
def query_gemini_rag(user_question: str):
    print(f"👤 使用者: {user_question}")

    # Step 1: AI 翻譯官 (保持不變)
    rewrite_model = genai.GenerativeModel('gemini-2.0-flash')
    rewrite_prompt = f"""
    請將使用者問題改寫為精準的法律搜尋字串。
    1. 修正錯字 (如: 拒絕九策 -> 拒絕酒測)。
    2. 補充主詞 (如: 未禮讓 -> 汽車機車駕駛未禮讓行人)。
    3. 只輸出改寫後的字串。
    問題: {user_question}
    """
    rewritten_query = rewrite_model.generate_content(rewrite_prompt).text.strip()
    print(f"✨ AI 改寫: {rewritten_query}")

    # Step 2: 搜尋 (保持不變)
    context_text = hybrid_search(rewritten_query)
    
    if not context_text:
        context_text = "目前資料庫中無相關法條。"

    # Step 3: 生成回答 (✨ 重點修改：加入幽默人設與案例要求)
    system_prompt = f"""
    你是一位**幽默風趣、說話直白，但專業度滿分**的台灣法律 AI 顧問。
    你的任務是將艱澀的法律條文，翻譯成連小學生都聽得懂的白話文，並且喜歡用**生活化的比喻**來解釋。
    
    【相關法規資料庫】：
    {context_text}
    
    【使用者問題】：
    {user_question}
    
    【回答規則 (請嚴格遵守 Markdown 格式)】：
    1. **結論先行 (重點高亮)**：第一行直接給出答案（金額、刑期），並用 **粗體** 標示重點。
    2. **白話文解釋 (神比喻)**：
       - 請用「**簡單來說**」開頭，解釋這條法律在幹嘛。
       - **必須使用一個「生活比喻」**（例如：把「簽契約」比喻成「訂外送」，把「侵權」比喻成「弄壞別人的玩具」）。讓使用者會心一笑。
    3. **情境模擬 (小劇場)**：
       - 請創造一個簡短的案例（例如：「假設張三今天...」），說明在這種情況下會發生什麼事，讓使用者更有帶入感。
    4. **引用法條**：列出依據的法條名稱與條號，並用 **粗體**。
    5. **條列式分析**：若有罰則細項（如機車/汽車），請條列清楚。
    6. **免責聲明**：最後加上引用區塊。
    
    語氣要求：專業中帶點幽默，溫暖且好懂，不要像機器人。
    """

    # generation_config 設定 temperature=0.7 讓它稍微有創意一點 (預設通常較低)
    answer_model = genai.GenerativeModel(
        'gemini-2.0-flash',
        generation_config=genai.GenerationConfig(temperature=0.7) 
    )
    response = answer_model.generate_content(system_prompt)
    return response.text

@app.get("/")
def read_root():
    return {"message": "Legal AI Backend is Running!"}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        ai_reply = query_gemini_rag(request.message)
        return {"reply": ai_reply}
    except Exception as e:
        print(f"Error: {e}")
        return {"reply": f"發生錯誤: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)