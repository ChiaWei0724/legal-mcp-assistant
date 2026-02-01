import json
import chromadb
import os
from dotenv import load_dotenv
from pathlib import Path
import time
from tqdm import tqdm
from sentence_transformers import SentenceTransformer

# 路徑設定
current_dir = Path(__file__).parent
root_dir = current_dir.parent
load_dotenv(root_dir / ".env")

DATA_PATH = current_dir / "data" / "all_laws.json"
DB_PATH = current_dir / "chroma_db"

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
BATCH_SIZE = 500


def ingest_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"找不到法律資料檔：{DATA_PATH}")

    print(f"正在讀取資料：{DATA_PATH}")

    # 載入本地 embedding 模型
    print(f"正在載入模型：{MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    # 初始化 ChromaDB
    client = chromadb.PersistentClient(path=str(DB_PATH))

    # 清除舊資料，確保乾淨重建
    try:
        client.delete_collection("legal_knowledge")
        print("已刪除舊的 collection，重新建立...")
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name="legal_knowledge",
        metadata={"hnsw:space": "cosine"},
    )

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        laws = json.load(f)

    print(f"準備處理 {len(laws)} 條條文 (batch_size={BATCH_SIZE})...")

    with tqdm(total=len(laws), desc="寫入資料庫") as pbar:
        for i in range(0, len(laws), BATCH_SIZE):
            batch = laws[i : i + BATCH_SIZE]

            documents = []
            ids = []
            metadatas = []

            for law in batch:
                documents.append(law["content"])
                ids.append(law["id"])
                metadatas.append({
                    "source": "law_db",
                    "category": law.get("category", "unknown"),
                    "article_no": law.get("article_no", ""),
                })

            if not documents:
                break

            # 用本地模型產生 embeddings
            embeddings = model.encode(documents, show_progress_bar=False).tolist()

            collection.upsert(
                documents=documents,
                ids=ids,
                metadatas=metadatas,
                embeddings=embeddings,
            )
            pbar.update(len(batch))

    print(f"\n成功將 {collection.count()} 條法規寫入向量資料庫！")
    print(f"資料庫位置：{DB_PATH}")


if __name__ == "__main__":
    ingest_data()
