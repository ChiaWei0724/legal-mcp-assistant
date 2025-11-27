import json
from pathlib import Path

# 讀取 laws.json
current_dir = Path(__file__).parent
data_path = current_dir / "data" / "laws.json"

try:
    with open(data_path, "r", encoding="utf-8") as f:
        laws = json.load(f)
    
    print(f"📚 總共有 {len(laws)} 條法規")
    
    # 統計各類別數量
    categories = {}
    traffic_found = False
    
    for law in laws:
        # 簡單判斷類別
        cat = law.get("category", "未知")
        categories[cat] = categories.get(cat, 0) + 1
        
        if "道路交通" in law["text"]:
            traffic_found = True

    print("\n📊 法規分類統計：")
    for cat, count in categories.items():
        print(f" - {cat}: {count} 條")

    if traffic_found:
        print("\n✅ 確認：資料檔中包含「道路交通」相關法規！")
    else:
        print("\n❌ 警告：資料檔中【沒有】找到交通法規！請重新跑 fetch_gov_data.py")

except Exception as e:
    print(f"讀取失敗: {e}")