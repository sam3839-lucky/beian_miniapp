#!/usr/bin/env python3
"""
重建数据库 — 双表切换，备份旧表
用法:
    python3 rebuild_db.py              # 标准重建
    python3 rebuild_db.py --target DB  # 输出到指定文件（用于上传服务器）

策略:
    1. 备份旧 housing_units → housing_units_backup
    2. housing_units_new → 验证行数 > 阈值
    3. housing_units_new → RENAME TO housing_units
    4. 重建索引
    5. 确认无误后删除 backup
"""

import sqlite3, sys, os, shutil
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "property_new.db")
MIN_ROWS = 300000  # 最少记录数门槛


def main():
    target = None
    for i, a in enumerate(sys.argv):
        if a == "--target" and i + 1 < len(sys.argv):
            target = sys.argv[i + 1]

    src = DB_PATH
    if target:
        print(f"══ 输出到目标文件 ══")
        print(f"  源: {src}")
        print(f"  目标: {target}")
    else:
        print("══ 双表切换重建 ══")

    conn = sqlite3.connect(src)

    # 检查新表数据量
    cur = conn.execute("SELECT COUNT(*) FROM housing_units_new")
    count = cur.fetchone()[0]
    print(f"\n[1/6] 新表记录数: {count:,}")

    if count < MIN_ROWS:
        print(f"❌ 记录数 {count:,} 低于阈值 {MIN_ROWS:,}，拒绝重建！")
        print(f"   请先确认 sync_units.py 爬取是否完整。")
        sys.exit(1)

    # 统计
    cur = conn.execute("""
        SELECT house_usage, status, COUNT(*) FROM housing_units_new
        GROUP BY house_usage, status ORDER BY COUNT(*) DESC
    """)
    print("  数据类型:")
    for row in cur.fetchall():
        print(f"    {row[0]} | {row[1]}: {row[2]:,}")

    cur = conn.execute("SELECT COUNT(DISTINCT project_name) FROM housing_units_new WHERE project_name IS NOT NULL")
    print(f"  已匹配项目: {cur.fetchone()[0]}")

    cur = conn.execute("SELECT COUNT(*) FROM housing_units_new WHERE project_name IS NULL")
    unmatched = cur.fetchone()[0]
    print(f"  未匹配: {unmatched}")
    if unmatched > count * 0.1:
        print(f"  ⚠️ 未匹配比例 {(unmatched/count*100):.1f}% > 10%，建议先排查匹配问题")

    if target:
        # 直接输出模式：复制到目标文件
        print(f"\n[2/6] 复制数据库到 {target}...")
        shutil.copy2(src, target)
        print(f"✅ 完成！目标文件: {target}")
        conn.close()
        return

    # 双表切换模式
    bak_name = f"housing_units_backup_{datetime.now().strftime('%Y%m%d')}"

    print(f"\n[2/6] 检查旧表...")
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='housing_units'")
    has_old = cur.fetchone() is not None
    if has_old:
        cur = conn.execute("SELECT COUNT(*) FROM housing_units")
        old_count = cur.fetchone()[0]
        print(f"  旧表: {old_count:,} 条 → 备份为 {bak_name}")

    print(f"\n[3/6] 执行切换...")
    conn.execute("BEGIN")
    if has_old:
        # 删除旧备份
        conn.execute("DROP TABLE IF EXISTS housing_units_backup")
        conn.execute(f"ALTER TABLE housing_units RENAME TO {bak_name}")

    # 新表改名
    conn.execute("ALTER TABLE housing_units_new RENAME TO housing_units")

    print(f"[4/6] 重建索引...")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_project ON housing_units(project_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_building ON housing_units(building_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_status ON housing_units(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_usage ON housing_units(house_usage)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_zone ON housing_units(zone)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_units_check_date ON housing_units(check_date)")

    print(f"[5/6] 处理预售证...")
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='presale_permits'")
    if cur.fetchone():
        conn.execute("DROP TABLE IF EXISTS presale_permits_backup")
        conn.execute("ALTER TABLE presale_permits RENAME TO presale_permits_backup")
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='presale_permits_new'")
    if cur.fetchone():
        conn.execute("ALTER TABLE presale_permits_new RENAME TO presale_permits")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_permits_project ON presale_permits(project_name)")

    conn.commit()

    # 验证
    print(f"[6/6] 验证...")
    cur = conn.execute("SELECT COUNT(*) FROM housing_units")
    final = cur.fetchone()[0]
    print(f"  housing_units: {final:,} 条")
    cur = conn.execute("SELECT COUNT(*) FROM presale_permits")
    print(f"  presale_permits: {cur.fetchone()[0]} 条")
    cur = conn.execute("""
        SELECT project_name, COUNT(*) FROM housing_units
        WHERE house_usage='住宅' AND status='未售'
        GROUP BY project_name ORDER BY COUNT(*) DESC LIMIT 10
    """)
    print("\n  Top 10 可售住宅:")
    for row in cur.fetchall():
        print(f"    {row[0]:30s} {row[1]:5d} 套")

    conn.close()

    if has_old:
        print(f"\n✅ 双表切换完成！旧表已备份为 {bak_name}")
        print(f"   确认无误后删除: DROP TABLE {bak_name};")
    else:
        print(f"\n✅ 完成！")


if __name__ == "__main__":
    main()
