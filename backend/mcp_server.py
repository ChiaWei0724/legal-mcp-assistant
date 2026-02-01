"""
Legal MCP Server
================
透過 Model Context Protocol 暴露法律檢索工具，
讓任何 MCP 相容的 AI 客戶端（Claude Desktop、Cursor 等）
都能呼叫台灣法律語意搜尋。

啟動方式：
    python mcp_server.py          # stdio 模式（Claude Desktop 用）
    python mcp_server.py --sse    # SSE 模式（HTTP 用）
"""

import json
import os
import re
import sqlite3
import sys
from pathlib import Path

import chromadb
import jieba
from dotenv import load_dotenv
from mcp.server import FastMCP
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

# ── 路徑設定 ──────────────────────────────────────────────
CURRENT_DIR = Path(__file__).parent
DB_PATH = CURRENT_DIR / "chroma_db"
LAWS_JSON = CURRENT_DIR / "data" / "laws.json"
EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

# ── 載入模型與資料庫 ──────────────────────────────────────
print(f"[MCP] 載入 embedding 模型: {EMBED_MODEL_NAME}")
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

print(f"[MCP] 連線 ChromaDB: {DB_PATH}")
chroma_client = chromadb.PersistentClient(path=str(DB_PATH))
try:
    collection = chroma_client.get_collection(name="legal_knowledge")
    print(f"[MCP] 向量資料庫就緒，共 {collection.count()} 條法規")
except Exception as e:
    print(f"[MCP] ⚠️ 資料庫連線失敗: {e}")
    collection = chroma_client.get_or_create_collection(name="legal_knowledge")

# ── 載入 BM25 索引 ────────────────────────────────────────
ALL_LAWS_JSON = CURRENT_DIR / "data" / "all_laws.json"
all_laws: list[dict] = []
bm25: BM25Okapi | None = None

# 優先使用完整法規資料，否則 fallback 到精選版
if ALL_LAWS_JSON.exists():
    print(f"[MCP] 載入完整法規: {ALL_LAWS_JSON}")
    with open(ALL_LAWS_JSON, "r", encoding="utf-8") as f:
        raw = json.load(f)
    all_laws = [{"id": d["id"], "text": d["content"], "category": d.get("category", "")} for d in raw]
elif LAWS_JSON.exists():
    print(f"[MCP] 載入精選法規: {LAWS_JSON}")
    with open(LAWS_JSON, "r", encoding="utf-8") as f:
        all_laws = json.load(f)
else:
    print("[MCP] ⚠️ 無法規資料，BM25 搜尋將被停用")

if all_laws:
    tokenized_corpus = [list(jieba.cut(doc["text"])) for doc in all_laws]
    bm25 = BM25Okapi(tokenized_corpus)
    print(f"[MCP] BM25 索引就緒，共 {len(all_laws)} 條")

# ── 同義詞擴展 ────────────────────────────────────────────
SYNONYMS = {
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
    "裸奔": "公然猥褻 妨害風化",
    "脫褲子": "公然猥褻",
    "捲走": "業務侵占 普通侵占 背信 詐欺",
    "捲款": "業務侵占 背信",
    "合夥": "合夥財產 背信 侵占",
}


def expand_synonyms(query: str) -> str:
    expanded = query
    for key, value in SYNONYMS.items():
        if key in query:
            expanded += f" {value}"
    return expanded


def hybrid_search(query: str, top_k: int = 20) -> list[dict]:
    """
    混合搜尋：BM25 關鍵字 + ChromaDB 向量語意。
    回傳排序後的法條清單，每筆含 text, id, score。
    """
    expanded_query = expand_synonyms(query)

    final_docs: list[dict] = []
    seen_ids: set[str] = set()

    # BM25 關鍵字搜尋
    if bm25:
        tokenized_query = list(jieba.cut(expanded_query))
        bm25_results = bm25.get_top_n(tokenized_query, all_laws, n=50)
        for doc in bm25_results:
            if doc["id"] not in seen_ids:
                final_docs.append({"text": doc["text"], "id": doc["id"], "score": 0.8})
                seen_ids.add(doc["id"])

    # 向量語意搜尋（使用與 ingestion 相同的 embedding 模型）
    query_embedding = embed_model.encode([expanded_query]).tolist()
    vector_results = collection.query(query_embeddings=query_embedding, n_results=50)

    if vector_results["documents"] and vector_results["documents"][0]:
        for i, doc_text in enumerate(vector_results["documents"][0]):
            doc_id = vector_results["ids"][0][i]
            if doc_id not in seen_ids:
                final_docs.append({"text": doc_text, "id": doc_id, "score": 0.7})
                seen_ids.add(doc_id)
            else:
                for item in final_docs:
                    if item["id"] == doc_id:
                        item["score"] += 0.5

    # 關鍵字加分
    keywords = [kw for kw in jieba.cut(query) if len(kw) > 1]
    for item in final_docs:
        for kw in keywords:
            if kw in item["text"]:
                item["score"] += 0.3

    final_docs.sort(key=lambda x: x["score"], reverse=True)
    return final_docs[:top_k]


# ── Gemini for document generation ────────────────────────
base_path = Path(__file__).parent.parent
load_dotenv(base_path / ".env")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
_genai = None
if GOOGLE_API_KEY:
    try:
        import google.generativeai as genai_module
        genai_module.configure(api_key=GOOGLE_API_KEY)
        _genai = genai_module
        print("[MCP] Gemini API 已設定，文書生成功能啟用")
    except ImportError:
        print("[MCP] google-generativeai 未安裝，文書生成功能停用")

DB_FILE = Path(__file__).parent / "chat_history.db"

# ── MCP Server ────────────────────────────────────────────
server = FastMCP(
    "legal-mcp-server",
    instructions="台灣法律 AI 檢索工具 — 提供語意搜尋與風險分析",
    host="0.0.0.0",
    port=8001,
)


@server.tool()
def search_laws(query: str, top_k: int = 10) -> str:
    """
    搜尋台灣法律條文。

    使用混合搜尋（BM25 關鍵字 + 向量語意），從 28 萬條法規中找出最相關的法條。
    支援口語化查詢，例如「打人會怎樣」「酒駕罰多少」。

    Args:
        query: 使用者的法律問題或關鍵字（中文）
        top_k: 回傳筆數，預設 10

    Returns:
        相關法條列表（含法規名稱、條號、條文內容、相關度分數）
    """
    results = hybrid_search(query, top_k=top_k)

    if not results:
        return json.dumps(
            {"found": 0, "message": "未找到相關法條，請嘗試換個關鍵字。"},
            ensure_ascii=False,
        )

    output = []
    for r in results:
        # 從 id 解析法規名稱與條號
        parts = r["id"].rsplit("_", 1)
        law_name = parts[0] if len(parts) == 2 else ""
        article_no = parts[1] if len(parts) == 2 else r["id"]

        output.append({
            "law_name": law_name,
            "article_no": article_no,
            "content": r["text"],
            "relevance_score": round(r["score"], 2),
        })

    return json.dumps(
        {"found": len(output), "results": output},
        ensure_ascii=False,
        indent=2,
    )


@server.tool()
def get_risk_analysis(query: str) -> str:
    """
    分析法律問題的風險等級與涉及領域。

    根據搜尋到的法條內容，判斷：
    - 涉及的法律領域（刑法 / 民法 / 行政法 等）
    - 風險等級（高 / 中 / 低）
    - 相關關鍵字標籤

    Args:
        query: 使用者的法律問題（中文）

    Returns:
        JSON 格式的風險分析結果
    """
    results = hybrid_search(query, top_k=10)

    if not results:
        return json.dumps(
            {
                "domain": "未知",
                "risk_level": "未知",
                "keywords": [],
                "message": "找不到相關法條，無法進行分析。",
            },
            ensure_ascii=False,
        )

    # 根據法條內容判斷領域
    all_text = " ".join(r["text"] for r in results)

    domain_keywords = {
        "刑法": ["刑法", "罪", "處", "有期徒刑", "拘役", "罰金", "死刑", "無期徒刑"],
        "民法": ["民法", "損害賠償", "債", "契約", "物權", "繼承", "婚姻"],
        "行政法": ["處罰條例", "罰鍰", "吊扣", "吊銷", "道路交通", "行政"],
        "勞動法": ["勞動基準法", "勞工", "工資", "工時", "資遣"],
        "智慧財產": ["著作權", "商標", "專利", "智慧財產"],
    }

    detected_domains: list[str] = []
    for domain, kws in domain_keywords.items():
        if any(kw in all_text for kw in kws):
            detected_domains.append(domain)

    domain = "、".join(detected_domains) if detected_domains else "一般法律"

    # 根據刑罰嚴重程度判斷風險
    risk_level = "低"
    high_risk = ["死刑", "無期徒刑", "殺人", "強盜", "擄人勒贖", "致死"]
    medium_risk = ["有期徒刑", "拘役", "傷害", "竊盜", "詐欺", "侵占"]

    if any(kw in all_text for kw in high_risk):
        risk_level = "高"
    elif any(kw in all_text for kw in medium_risk):
        risk_level = "中"

    # 提取關鍵字
    keywords = list({
        kw for kw in jieba.cut(query) if len(kw) > 1
    })[:8]

    return json.dumps(
        {
            "domain": domain,
            "risk_level": risk_level,
            "keywords": keywords,
            "matched_articles": len(results),
            "top_article": results[0]["text"][:200] if results else "",
        },
        ensure_ascii=False,
        indent=2,
    )


@server.tool()
def generate_legal_document(session_id: str, doc_type: str = "存證信函") -> str:
    """
    根據對話歷史生成法律文書。

    支援的文書類型：
    - 存證信函：正式通知對方法律權益主張
    - 和解協議書：雙方和解的正式文書
    - 行政申訴書：對行政處分提出申訴

    Args:
        session_id: 對話的 session ID（從聊天記錄取得上下文）
        doc_type: 文書類型，可選「存證信函」「和解協議書」「行政申訴書」

    Returns:
        生成的法律文書全文
    """
    if not _genai:
        return json.dumps({"error": "未設定 Gemini API Key 或未安裝套件，無法生成文書"}, ensure_ascii=False)

    if not DB_FILE.exists():
        return json.dumps({"error": "找不到對話資料庫"}, ensure_ascii=False)

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,)
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        return json.dumps({"error": "找不到對話紀錄"}, ensure_ascii=False)

    history_text = "\n".join([
        f"{'使用者' if r[0] == 'user' else 'AI助手'}: {r[1][:500]}"
        for r in rows
    ])

    prompt = f"""你是台灣法律文書撰寫專家。請根據以下對話紀錄生成一份【{doc_type}】。

【對話紀錄】：
{history_text}

重要注意事項：
- 內容必須符合台灣法律格式
- 所有法條引用必須正確
- 個人資訊處以「OOO」或「XXX」代替
- 金額、日期等如果不明確，用「___」代替
- 最後加上免責聲明：此文書由 AI 輔助生成，建議正式使用前請律師審閱。

請直接輸出文書內容。"""

    try:
        model = _genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return json.dumps({
            "doc_type": doc_type,
            "document": response.text
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": f"文書生成失敗: {str(e)}"}, ensure_ascii=False)


# ── 啟動 ──────────────────────────────────────────────────
if __name__ == "__main__":
    if "--sse" in sys.argv:
        print("[MCP] 以 SSE 模式啟動 (http://0.0.0.0:8001/sse)")
        server.run(transport="sse")
    else:
        print("[MCP] 以 stdio 模式啟動")
        server.run()
