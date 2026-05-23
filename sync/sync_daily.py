#!/usr/bin/env python3
"""
每日增量同步 — 拉取当天更新的房源，更新数据库
用法:
    python3 sync_daily.py                    # 增量同步
    python3 sync_daily.py --db /path/to/db   # 指定数据库
部署为 Cron: 0 6 * * * cd /opt/beian_query && python3 sync/sync_daily.py
"""

import json, sqlite3, subprocess, sys, os, time
from datetime import datetime, timedelta

API_URL = "https://fdc.zjj.sz.gov.cn/szfdcscjy/ysf/publicity/getYsfXsPublicity"
PAGE_SIZE = 200
TODAY = datetime.now().strftime("%Y-%m-%d")
BATCH_ID = datetime.now().strftime("%Y%m%d-%H%M")


def get_db_path():
    for i, a in enumerate(sys.argv):
        if a == "--db" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    # 默认路径
    candidates = [
        os.path.join(os.path.dirname(__file__), "property_new.db"),
        "/opt/beian_query/property.db",
        os.path.expanduser("~/beian/property.db"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]


def fetch_page(page):
    body = json.dumps({
        "pageIndex": page, "pageSize": PAGE_SIZE,
        "zone": "", "project": "", "organName": "", "siteaddress": ""
    }, ensure_ascii=False)
    try:
        resp = subprocess.run(
            ["curl", "-s", "--max-time", "20", "-X", "POST", API_URL,
             "-H", "Content-Type: application/json", "-d", body],
            capture_output=True, text=True, timeout=25
        )
        if not resp.stdout.strip():
            return None
        return json.loads(resp.stdout)["data"]["list"]
    except Exception:
        return None


def match_project(conn, building_name, owner_name):
    """快速匹配（用已缓存的映射表）"""
    cur = conn.execute(
        "SELECT project_name FROM housing_units WHERE building_name=? LIMIT 1",
        (building_name,)
    )
    row = cur.fetchone()
    if row and row[0]:
        return row[0]

    # 从预售证表匹配
    cur = conn.execute(
        "SELECT project_name FROM presale_permits WHERE developer=? LIMIT 1",
        (owner_name,)
    )
    row = cur.fetchone()
    return row[0] if row else None


def main():
    db_path = get_db_path()
    print(f"══ 每日增量同步 ══")
    print(f"  日期: {TODAY}  批次: {BATCH_ID}")
    print(f"  数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")

    # 获取总数
    records = fetch_page(1)
    if not records:
        print("❌ 无法连接 API")
        sys.exit(1)

    body = json.dumps({"pageIndex": 1, "pageSize": 1, "zone": "", "project": "", "organName": "", "siteaddress": ""})
    try:
        resp = subprocess.run(
            ["curl", "-s", "--max-time", "10", "-X", "POST", API_URL,
             "-H", "Content-Type: application/json", "-d", body],
            capture_output=True, text=True, timeout=15
        )
        total = json.loads(resp.stdout)["data"]["total"]
    except (json.JSONDecodeError, KeyError, subprocess.TimeoutExpired) as e:
        print(f"❌ 获取数据总量失败: {e}")
        sys.exit(1)
    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"  API 总量: {total:,}  页数: {total_pages}")

    # 增量策略：只处理 check_date = 今天 或 最近2天的记录
    # 因为 API 不支持按日期筛选，需要全扫。但可以先扫几页看最新 check_date
    today_pages = set()
    recent_dates = set()
    for d in range(3):
        recent_dates.add((datetime.now() - timedelta(days=d)).strftime("%Y-%m-%d"))

    new_count = 0
    update_count = 0
    scanned_pages = 0

    print(f"  扫描范围: {recent_dates}")
    print(f"  策略: 扫描全部 {total_pages} 页，只处理 {TODAY} 的数据")

    for page in range(1, total_pages + 1):
        records = fetch_page(page)
        if not records:
            continue
        scanned_pages += 1

        # 检查是否有今天的记录
        has_today = any(r.get("checkDate", "") in recent_dates for r in records)
        if not has_today and page > 1:
            # 快速跳过无新数据的页（仅检查第一条）
            continue

        for r in records:
            check_date = r.get("checkDate", "")
            if check_date not in recent_dates:
                continue

            bldg = r.get("bldgNameNo", "")
            unit = r.get("unitNo", "")
            status = r.get("status", "")

            # 检查是否已存在
            cur = conn.execute(
                "SELECT id, status, check_date FROM housing_units WHERE building_name=? AND unit_no=?",
                (bldg, unit)
            )
            existing = cur.fetchone()

            price_each = None
            price_total = None
            if r.get("askpriceeachB") and r["askpriceeachB"] != "--":
                try:
                    price_each = float(r["askpriceeachB"])
                except ValueError:
                    pass
            if r.get("askpricetotalB") and r["askpricetotalB"] != "--":
                try:
                    price_total = float(r["askpricetotalB"])
                except ValueError:
                    pass

            owner = r.get("ownerName", "")
            project = match_project(conn, bldg, owner)

            if existing:
                # 更新状态
                if existing[1] != status or existing[2] != check_date:
                    conn.execute(
                        """UPDATE housing_units SET status=?, check_date=?,
                           unit_price=?, total_price=?, date_listed=?
                           WHERE id=?""",
                        (status, check_date, price_each, price_total, TODAY, existing[0])
                    )
                    update_count += 1
            else:
                # 新增
                conn.execute(
                    """INSERT INTO housing_units
                       (building_name, unit_no, owner_name, parcel_no, house_attr,
                        built_area, unit_price, total_price, house_usage, status,
                        check_date, project_name, sync_batch, date_listed)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        bldg, unit, owner, r.get("parcelNo", ""),
                        r.get("houseAttr", ""), r.get("builtInArea"),
                        price_each, price_total, r.get("houseUsage", ""),
                        status, check_date, project, BATCH_ID, TODAY
                    )
                )
                new_count += 1

        if page % 200 == 0:
            conn.commit()
            print(f"  📄 页 {page}/{total_pages} | 新增 {new_count} | 更新 {update_count}")

        if has_today and page not in today_pages:
            today_pages.add(page)

    conn.commit()

    print(f"\n  扫描页数: {scanned_pages}")
    print(f"  新增: {new_count}  更新: {update_count}")
    print(f"  数据库: {db_path}")

    # 统计变化
    cur = conn.execute("""
        SELECT status, COUNT(*) FROM housing_units
        WHERE check_date=? GROUP BY status
    """, (TODAY,))
    print(f"  今日状态分布 ({TODAY}):")
    for row in cur.fetchall():
        print(f"    {row[0]}: {row[1]}")

    conn.close()
    print(f"\n✅ 增量同步完成！")


if __name__ == "__main__":
    main()
