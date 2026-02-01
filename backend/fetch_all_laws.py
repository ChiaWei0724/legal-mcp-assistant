"""
fetch_all_laws.py
從全國法規資料庫 Open API 下載完整法律 XML，解析所有條文並存為 JSON。

資料來源：https://law.moj.gov.tw/api/Ch/Law/XML
"""

import json
import os
import re
import tempfile
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

# 路徑設定
CURRENT_DIR = Path(__file__).parent
DATA_DIR = CURRENT_DIR / "data"
OUTPUT_FILE = DATA_DIR / "all_laws.json"

# 全國法規資料庫 Open API — 中文法律 XML 下載
DOWNLOAD_URL = "https://law.moj.gov.tw/api/Ch/Law/XML"


def download_zip(url: str, dest: Path) -> Path:
    """下載 ZIP 檔案，回傳儲存路徑。"""
    print(f"正在下載: {url}")
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    with open(dest, "wb") as f, tqdm(
        total=total, unit="B", unit_scale=True, desc="下載進度"
    ) as bar:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            bar.update(len(chunk))

    print(f"下載完成: {dest} ({dest.stat().st_size / (1024*1024):.1f} MB)")
    return dest


def clean_text(text: str) -> str:
    """清理條文內容：移除 HTML 標籤、合併多餘空白。"""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.strip()
    text = re.sub(r"[ \t]+", " ", text)
    return text


def parse_laws_xml(xml_path: Path) -> list[dict]:
    """
    解析 ChLaw.xml，提取所有法律的個別條文。

    使用 iterparse 逐步解析以節省記憶體。
    """
    import xml.etree.ElementTree as ET

    articles = []
    current_law_name = ""
    current_category = ""
    current_pcode = ""
    in_article = False
    article_type = ""
    article_no = ""
    article_content = ""

    print(f"正在解析: {xml_path}")
    # 先計算 <Law> 數量以顯示進度
    law_count = 0
    for event, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag == "Law":
            law_count += 1
            elem.clear()

    print(f"共 {law_count} 部法規，開始提取條文...")

    # 正式解析
    context = ET.iterparse(xml_path, events=("start", "end"))
    pbar = tqdm(total=law_count, desc="解析法規")

    for event, elem in context:
        if event == "end" and elem.tag == "PCode":
            current_pcode = (elem.text or "").strip()

        elif event == "end" and elem.tag == "LawName":
            current_law_name = (elem.text or "").strip()

        elif event == "end" and elem.tag == "LawCategory":
            current_category = (elem.text or "").strip()

        elif event == "start" and elem.tag == "Article":
            in_article = True
            article_type = ""
            article_no = ""
            article_content = ""

        elif event == "end" and in_article:
            if elem.tag == "ArticleType":
                article_type = (elem.text or "").strip()
            elif elem.tag == "ArticleNo":
                article_no = (elem.text or "").strip()
            elif elem.tag == "ArticleConctent":
                article_content = clean_text(elem.text or "")
            elif elem.tag == "Article":
                in_article = False
                # 只保留正式條文 (A)，跳過章節標題 (C)
                if article_type == "A" and article_no and article_content:
                    pcode_prefix = current_pcode if current_pcode else current_law_name
                    uid = f"{pcode_prefix}_{article_no}"
                    articles.append({
                        "id": uid,
                        "pcode": current_pcode,
                        "category": current_law_name,
                        "article_no": article_no,
                        "content": f"{current_law_name} {article_no}：{article_content}",
                    })

        if event == "end" and elem.tag == "Law":
            pbar.update(1)
            elem.clear()

    pbar.close()
    return articles


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        zip_path = tmp / "ChLaw.zip"

        # 1. 下載
        download_zip(DOWNLOAD_URL, zip_path)

        # 2. 解壓縮
        print("正在解壓縮...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)
        xml_path = tmp / "ChLaw.xml"
        if not xml_path.exists():
            # 如果檔名不同，找第一個 .xml
            xml_files = list(tmp.glob("*.xml"))
            if not xml_files:
                raise FileNotFoundError("ZIP 中找不到任何 XML 檔案")
            xml_path = xml_files[0]
            print(f"使用 XML 檔案: {xml_path.name}")

        # 3. 解析
        articles = parse_laws_xml(xml_path)

    # 4. 儲存
    print(f"正在儲存 {len(articles)} 條條文至 {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"完成！已儲存 {len(articles)} 條條文 ({size_mb:.1f} MB)")
    print(f"檔案位置: {OUTPUT_FILE}")

    # 統計摘要
    law_names = set(a["category"] for a in articles)
    print(f"涵蓋 {len(law_names)} 部法規")


if __name__ == "__main__":
    main()
