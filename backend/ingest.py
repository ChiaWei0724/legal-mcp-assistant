import json
import chromadb
from chromadb.utils import embedding_functions
import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
import time
from tqdm import tqdm

# 1. 設定精準的路徑
current_dir = Path(__file__).parent 
root_dir = current_dir.parent
load_dotenv(root_dir / ".env")

DATA_PATH = current_dir / "data" / "laws.json"
DB_PATH = current_dir / "chroma_db"

def ingest_data():
    if not os.getenv("GOOGLE_API_KEY"):
        raise ValueError("❌ 找不到 GOOGLE_API_KEY")
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"❌ 找不到法律資料檔：{DATA_PATH}")

    print(f"📂 正在讀取資料：{DATA_PATH}")

    # 初始化 ChromaDB
    client = chromadb.PersistentClient(path=str(DB_PATH))
    
    # 設定 Gemini Embedding
    # ⚠️ 改用 text-embedding-004 模型，並明確指定 model_name
    google_ef = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
        api_key=os.getenv("GOOGLE_API_KEY"),
        task_type="retrieval_document",
        model_name="models/text-embedding-004" 
    )

    collection = client.get_or_create_collection(
        name="legal_knowledge",
        embedding_function=google_ef
    )

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        laws = json.load(f)

    print(f"🔄 準備處理 {len(laws)} 條法規...")

    # --- ⚙️ 調整參數區 ---
    # 每次只處理 10 條 (非常保守，確保不超過 Token 限制)
    # 雖然慢，但保證能跑完
    BATCH_SIZE = 10 
    
    # 總共需要跑幾批
    total_batches = (len(laws) + BATCH_SIZE - 1) // BATCH_SIZE

    # 使用 tqdm 顯示進度
    with tqdm(total=len(laws), desc="寫入資料庫") as pbar:
        i = 0
        while i < len(laws):
            batch = laws[i : i + BATCH_SIZE]
            
            documents = []
            ids = []
            metadatas = []

            for law in batch:
                documents.append(law["text"])
                ids.append(law["id"])
                metadatas.append({
                    "source": "law_db", 
                    "category": law.get("category", "unknown")
                })

            if not documents:
                break

            # --- 🛡️ 無限重試機制 ---
            while True:
                try:
                    collection.upsert(
                        documents=documents,
                        ids=ids,
                        metadatas=metadatas
                    )
                    # 成功了！
                    # 每次成功後休息 1 秒
                    time.sleep(1) 
                    
                    # 更新進度條並跳出重試迴圈
                    pbar.update(len(batch))
                    break 

                except Exception as e:
                    error_msg = str(e)
                    if "429" in error_msg or "Quota exceeded" in error_msg:
                        print(f"\n⚠️ 觸發速率限制 (Rate Limit)，暫停 60 秒冷卻中...")
                        # 遇到 429 錯誤，強制休息 60 秒
                        for _ in range(60):
                            time.sleep(1)
                        print("♻️ 恢復執行，正在重試...")
                        # 這裡不 break，會回到 while True 開頭重試
                    else:
                        print(f"\n❌ 發生未知錯誤 (跳過此批): {e}")
                        # 如果是其他錯誤，就跳過這一批，避免卡死
                        break 
            
            # 移動到下一批
            i += BATCH_SIZE

    print(f"\n✅ 成功將所有法規寫入向量資料庫！")
    print(f"💾 資料庫儲存位置：{DB_PATH}")

if __name__ == "__main__":
    # 自動安裝 tqdm
    try:
        from tqdm import tqdm
    except ImportError:
        os.system("pip install tqdm")
        from tqdm import tqdm

    ingest_data()