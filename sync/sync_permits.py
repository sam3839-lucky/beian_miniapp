#!/usr/bin/env python3
"""
全量同步预售证列表
用法: python3 sync_permits.py
输出: presale_permits_new 表写入 property_new.db
"""

import json, sqlite3, subprocess, sys, time, os
from datetime import datetime

API_URL = "https://fdc.zjj.sz.gov.cn/szfdcscjy/ysf/publicity/getYsfYsPublicity"
PAGE_SIZE = 100
DB_PATH = os.path.join(os.path.dirname(__file__), "property_new.db")


def fetch_permits_page(page):
    body = json.dumps({
        "pageIndex": page, "pageSize": PAGE_SIZE,
        "zone": "", "project": "", "organName": "", "siteaddress": ""
    }, ensure_ascii=False)
    try:
        resp = subprocess.run(
            ["curl", "-s", "--max-time", "15", "-X", "POST", API_URL,
             "-H", "Content-Type: application/json", "-d", body],
            capture_output=True, text=True, timeout=20
        )
        if not resp.stdout.strip():
            return None
        data = json.loads(resp.stdout)
        return data["data"]
    except Exception as e:
        print(f"  ⚠️ 页 {page} 错误: {e}")
        return None


def main():
    print("══ 预售证全量同步 ══")

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS presale_permits_new (
            id INTEGER PRIMARY KEY,
            syp_id TEXT,
            sype_id TEXT,
            zone TEXT,
            permit_no TEXT,
            project_name TEXT,
            developer TEXT,
            site_address TEXT,
            pass_date TEXT,
            image_path TEXT
        )
    """)
    conn.execute("DELETE FROM presale_permits_new")

    # 获取总数
    first = fetch_permits_page(1)
    if not first:
        print("❌ 无法连接 API")
        sys.exit(1)

    total = first["total"]
    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"  总预售证: {total:,}  页数: {total_pages}")

    count = 0
    for page in range(1, total_pages + 1):
        data = fetch_permits_page(page) if page > 1 else first
        if not data:
            continue
        for item in data["list"]:
            conn.execute(
                """INSERT INTO presale_permits_new
                   (id, syp_id, sype_id, zone, permit_no, project_name,
                    developer, site_address, pass_date, image_path)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    int(item.get("id", 0)),
                    item.get("sypId", ""),
                    item.get("sypeId", ""),
                    item.get("zone", ""),
                    item.get("strpreprojectid", ""),
                    item.get("project", ""),
                    item.get("name", ""),
                    item.get("siteaddress", ""),
                    item.get("passdate", ""),
                    item.get("imagePath", "")
                )
            )
            count += 1

        if page % 20 == 0:
            print(f"  📄 页 {page}/{total_pages} | {count} 条")
            conn.commit()
        time.sleep(0.2)

    conn.commit()

    # 统计
    cur = conn.execute("SELECT zone, COUNT(*) FROM presale_permits_new GROUP BY zone ORDER BY COUNT(*) DESC")
    print(f"\n  区域分布 ({count} 条):")
    for row in cur.fetchall():
        print(f"    {row[0]}: {row[1]}")

    # 项目去重数量
    cur = conn.execute("SELECT COUNT(DISTINCT project_name) FROM presale_permits_new")
    print(f"  独立项目: {cur.fetchone()[0]}")

    conn.close()
    print(f"\n✅ 完成！下一步: python3 match_projects.py")


if __name__ == "__main__":
    main()
