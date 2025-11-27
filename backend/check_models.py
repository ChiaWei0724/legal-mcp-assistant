import google.generativeai as genai
import os
from dotenv import load_dotenv
from pathlib import Path

# 讀取 .env
current_dir = Path(__file__).parent 
root_dir = current_dir.parent
load_dotenv(root_dir / ".env")

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("❌ 找不到 API Key")
else:
    genai.configure(api_key=api_key)
    print("🔍 你的 API Key 可以使用的模型列表：")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f" - {m.name}")
    except Exception as e:
        print(f"❌ 查詢失敗: {e}")