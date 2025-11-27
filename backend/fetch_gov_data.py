import requests
from bs4 import BeautifulSoup
import json
import os
from pathlib import Path
import time

# 設定要抓取的法規 PCODE
TARGET_LAWS = {
    "C0000001": "中華民國刑法",
    "K0040012": "道路交通管理處罰條例",
    "B0000001": "民法"
}

# 改用網頁版連結 (這是人類看的頁面，非常穩定)
BASE_URL = "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode={}"

# 設定輸出路徑 (跟 ingest.py 對接)
current_dir = Path(__file__).parent
DATA_DIR = current_dir / "data"
OUTPUT_FILE = DATA_DIR / "laws.json"

def fetch_and_save_laws():
    if not DATA_DIR.exists():
        os.makedirs(DATA_DIR)
        print(f"📁 建立資料夾: {DATA_DIR}")

    all_law_articles = []

    print("🚀 開始從全國法規資料庫抓取資料...")

    for pcode, law_name in TARGET_LAWS.items():
        url = BASE_URL.format(pcode)
        print(f"📡 正在讀取: {law_name}...")
        
        try:
            # 偽裝成瀏覽器 (避免被檔)
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            # 使用 BeautifulSoup 解析網頁
            soup = BeautifulSoup(response.text, "html.parser")
            
            # 找到所有的條文區塊 (在網頁中通常是 tr 或 div)
            # 全國法規資料庫的結構：條號在 .col-no，內容在 .col-data
            articles = soup.find_all("div", class_="row")
            
            count = 0
            for row in articles:
                # 找條號
                col_no = row.find("div", class_="col-no")
                # 找內容
                col_data = row.find("div", class_="col-data")
                
                if col_no and col_data:
                    article_no = col_no.get_text(strip=True)
                    content = col_data.get_text(strip=True)
                    
                    # 過濾掉廢止或刪除的條文
                    if "刪除" in content or "廢止" in content:
                        continue
                        
                    # 整理資料
                    law_data = {
                        "id": f"{pcode}_{article_no}", 
                        "text": f"{law_name} {article_no}：{content}",
                        "category": law_name
                    }
                    all_law_articles.append(law_data)
                    count += 1
            
            print(f"   ✅ 成功抓取 {count} 條條文")
            
            # 禮貌性暫停一下，不要請求太快
            time.sleep(1)

        except Exception as e:
            print(f"   ❌ 失敗: {e}")

    # 存檔
    print(f"💾 正在儲存 {len(all_law_articles)} 條資料到 {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_law_articles, f, ensure_ascii=False, indent=2)

    print("🎉 完成！laws.json 已生成，現在請執行 ingest.py 來建立大腦！")

if __name__ == "__main__":
    fetch_and_save_laws()
