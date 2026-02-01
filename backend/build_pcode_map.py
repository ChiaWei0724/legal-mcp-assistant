"""
build_pcode_map.py
從全國法規資料庫 API 下載法規名稱與 PCode 對照表。
"""

import io
import json
import re
import zipfile
from pathlib import Path

import requests

CURRENT_DIR = Path(__file__).parent
DATA_DIR = CURRENT_DIR / "data"
OUTPUT_FILE = DATA_DIR / "pcode_map.json"

# 全國法規資料庫 — 法規清單 JSON API (returns a ZIP containing ChLaw.json)
API_URL = "https://law.moj.gov.tw/api/Ch/Law/JSON"


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"正在從 {API_URL} 下載法規清單...")
    resp = requests.get(API_URL, timeout=120)
    resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        with zf.open("ChLaw.json") as jf:
            data = json.load(jf)

    laws = data.get("Laws", [])
    print(f"取得 {len(laws)} 部法規")

    pcode_map = {}
    for law in laws:
        name = law.get("LawName", "").strip()
        url = law.get("LawURL", "")
        m = re.search(r"pcode=([A-Z0-9]+)", url)
        if name and m:
            pcode = m.group(1)
            pcode_map[name] = pcode
            no_space = name.replace(" ", "")
            if no_space != name:
                pcode_map[no_space] = pcode

    print(f"建立 {len(pcode_map)} 筆名稱對照")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(pcode_map, f, ensure_ascii=False, indent=2)

    print(f"已儲存至 {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
