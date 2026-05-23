#!/usr/bin/env python3
"""
全量同步 — 从深圳房地产信息平台爬取全部预售房源
用法:
    python3 sync_units.py              # 从头开始
    python3 sync_units.py --resume     # 断点续传（从 DB 推断进度）
    python3 sync_units.py --sample N   # 小样本验证（只爬前N页）

核心设计:
    - 每页爬完立即 COMMIT，崩了最多丢 1 页（200条）
    - --resume 不从 JSON 文件读，直接查 DB 算进度
    - 无外部断点文件，DB 是唯一状态源
"""

import json, sqlite3, subprocess, sys, time, os
from datetime import datetime

API_URL = "https://fdc.zjj.sz.gov.cn/szfdcscjy/ysf/publicity/getYsfXsPublicity"
PAGE_SIZE = 200
PROGRESS_INTERVAL = 10   # 每 N 页打印一次进度
WAIT_BETWEEN = 0.3        # 页间等待秒数
DB_PATH = os.path.join(os.path.dirname(__file__), "property_new.db")

# ── 工具函数 ──────────────────────────────────────────────

def fetch_page(page):
    """用 curl 拉一页数据，返回 records 列表"""
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
            return None, "empty_response"
        data = json.loads(resp.stdout)
        if data.get("status") != 200:
            return None, data.get("msg", "unknown_error")
        return data["data"]["list"], None
    except subprocess.TimeoutExpired:
        return None, "timeout"
    except json.JSONDecodeError:
        return None, "json_decode_error"
    except Exception as e:
        return None, str(e)


def db_resume_point(conn, batch_id):
    """从 DB 推断中断点：返回已完成的页数"""
    cur = conn.execute(
        "SELECT COUNT(*) FROM housing_units_new WHERE sync_batch=?", (batch_id,)
    )
    committed = cur.fetchone()[0]
    pages_done = committed // PAGE_SIZE
    return pages_done


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS housing_units_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_name TEXT,
            unit_no TEXT,
            owner_name TEXT,
            parcel_no TEXT,
            house_attr TEXT,
            built_area REAL,
            unit_price REAL,
            total_price REAL,
            house_usage TEXT,
            status TEXT,
            check_date TEXT,
            permit_no TEXT,
            project_name TEXT,
            zone TEXT,
            date_listed TEXT,
            sync_batch TEXT
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_units_new_batch
        ON housing_units_new(sync_batch)
    """)
    return conn


def insert_records(conn, records, batch_id):
    """批量插入并立即提交"""
    for r in records:
        price_each = None
        price_total = None
        if r.get("askpriceeachB") and r["askpriceeachB"] != "--":
            try: price_each = float(r["askpriceeachB"])
            except ValueError: pass
        if r.get("askpricetotalB") and r["askpricetotalB"] != "--":
            try: price_total = float(r["askpricetotalB"])
            except ValueError: pass

        conn.execute(
            """INSERT INTO housing_units_new
               (building_name, unit_no, owner_name, parcel_no, house_attr,
                built_area, unit_price, total_price, house_usage, status,
                check_date, sync_batch)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (r.get("bldgNameNo", ""), r.get("unitNo", ""),
             r.get("ownerName", ""), r.get("parcelNo", ""),
             r.get("houseAttr", ""), r.get("builtInArea"),
             price_each, price_total, r.get("houseUsage", ""),
             r.get("status", ""), r.get("checkDate", ""), batch_id)
        )
    conn.commit()  # 每页提交，崩了最多丢 1 页


# ── 主流程 ─────────────────────────────────────────────────

def main():
    resume = "--resume" in sys.argv
    sample_only = None
    for i, a in enumerate(sys.argv):
        if a == "--sample" and i + 1 < len(sys.argv):
            sample_only = int(sys.argv[i + 1])

    print("══ 备案价全量同步 ══")
    print("[0/4] 获取数据总量...")
    records, err = fetch_page(1)
    if err:
        print(f"❌ 无法连接 API: {err}")
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
    batch_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    print(f"  总记录: {total:,}  总页数: {total_pages}  批次: {batch_id}")

    if sample_only:
        print(f"  ⚠️ 小样本模式: 只爬 {sample_only} 页")
        total_pages = min(total_pages, sample_only)

    conn = init_db()

    # 断点续传：从 DB 推断
    start_page = 1
    total_records = 0
    if resume:
        pages_done = db_resume_point(conn, batch_id)
        if pages_done > 0:
            start_page = pages_done + 1
            total_records = pages_done * PAGE_SIZE
            print(f"  ⤵ 断点续传: DB 已有 {total_records:,} 条 → 从第 {start_page} 页继续")
        else:
            # 没有当前批次的数据，尝试找最近批次
            cur = conn.execute(
                "SELECT sync_batch, COUNT(*) FROM housing_units_new "
                "GROUP BY sync_batch ORDER BY sync_batch DESC LIMIT 1"
            )
            row = cur.fetchone()
            if row:
                batch_id = row[0]
                total_records = row[1]
                start_page = (total_records // PAGE_SIZE) + 1
                print(f"  ⤵ 断点续传: 复用批次 {batch_id}，{total_records:,} 条 → 第 {start_page} 页")
            else:
                print("  ⚠️ DB 中无数据，从头开始")

    print(f"\n[1/4] 开始爬取（每页即提交，崩了最多丢 1 页）...")
    start_time = time.time()
    errors = 0
    max_consecutive_errors = 0

    for page in range(start_page, total_pages + 1):
        records, err = fetch_page(page)

        if err:
            errors += 1
            max_consecutive_errors += 1
            if max_consecutive_errors >= 5:
                page_done = total_records // PAGE_SIZE
                print(f"\n❌ 连续 5 次失败 → 退出。已完成 {page_done}/{total_pages} 页")
                print(f"   重跑: python3 sync_units.py --resume")
                conn.close()
                sys.exit(1)
            time.sleep(2)
            continue

        max_consecutive_errors = 0
        insert_records(conn, records, batch_id)
        total_records += len(records)

        # 进度显示
        if page % PROGRESS_INTERVAL == 0:
            elapsed = time.time() - start_time
            rate = total_records / elapsed if elapsed > 0 else 0
            eta = (total_pages - page) * elapsed / page if page > 0 else 0
            print(f"\n  📄 页 {page}/{total_pages} | 记录 {total_records:,} | "
                  f"速率 {rate:.0f}条/s | 预计剩余 {eta:.0f}s | 错误 {errors}")
            sys.stdout.flush()

        time.sleep(WAIT_BETWEEN)

    # 最后清理：删掉非当前批次的残留数据
    conn.execute("DELETE FROM housing_units_new WHERE sync_batch != ?", (batch_id,))
    conn.commit()

    elapsed = time.time() - start_time
    print(f"\n[2/4] ✅ 爬取完成！")
    print(f"  总记录: {total_records:,}  耗时: {elapsed:.0f}s  错误: {errors}")

    # 统计
    cur = conn.execute("""
        SELECT house_usage, status, COUNT(*)
        FROM housing_units_new WHERE sync_batch=?
        GROUP BY house_usage, status ORDER BY COUNT(*) DESC LIMIT 20
    """, (batch_id,))
    print("\n  数据类型分布:")
    for row in cur.fetchall():
        print(f"    {row[0]} | {row[1]}: {row[2]:,}")

    # 去重
    print("\n[3/4] 去重...")
    conn.execute("""
        DELETE FROM housing_units_new
        WHERE id NOT IN (
            SELECT MIN(id) FROM housing_units_new
            WHERE sync_batch=? GROUP BY building_name, unit_no
        ) AND sync_batch=?
    """, (batch_id, batch_id))
    conn.commit()
    cur = conn.execute("SELECT COUNT(*) FROM housing_units_new WHERE sync_batch=?", (batch_id,))
    final_count = cur.fetchone()[0]
    print(f"  去重后: {final_count:,} 条（去除 {total_records - final_count} 条重复）")

    conn.close()
    print(f"\n[4/4] ✅ 完成！")
    print(f"  数据库: {DB_PATH}  批次: {batch_id}  记录: {final_count:,}")
    print(f"  下一步: python3 match_projects.py")


if __name__ == "__main__":
    main()
