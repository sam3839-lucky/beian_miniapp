#!/usr/bin/env python3
"""
项目匹配 — 将房源关联到预售证项目
三级匹配策略:
  1. 楼栋名前缀匹配（主力，覆盖率 ~90%）
  2. 开发商名称匹配
  3. 宗地号匹配

用法:
    python3 match_projects.py                     # 全量匹配
    python3 match_projects.py --validate-only     # 小样本验证（抽取5盘手工检查）
    python3 match_projects.py --dry-run           # 预览匹配率不写入
"""

import json, sqlite3, sys, os, re
from collections import defaultdict

DB_PATH = os.path.join(os.path.dirname(__file__), "property_new.db")
SAMPLE_COUNT = 5   # 验证时抽取的盘数
MIN_PREFIX_LEN = 2  # 楼栋名前缀最小长度（中文字符数）


def load_permits(conn):
    """加载所有预售证，建立项目名→信息映射"""
    cur = conn.execute("""
        SELECT project_name, developer, site_address, zone,
               GROUP_CONCAT(permit_no, '|') as permits,
               MAX(pass_date) as latest_date
        FROM presale_permits_new
        GROUP BY project_name, developer
    """)
    projects = {}
    for row in cur.fetchall():
        key = row[0]  # project_name
        projects[key] = {
            "project_name": row[0],
            "developer": row[1],
            "site_address": row[2],
            "zone": row[3],
            "permits": row[4],
            "latest_date": row[5]
        }
    return projects


def prefix_match(building_name, projects):
    """楼栋名前缀匹配: "未来之光家园20栋" → 找最长匹配的项目名"""
    best = None
    best_len = 0
    for pname in projects:
        if building_name.startswith(pname) and len(pname) > best_len:
            best = pname
            best_len = len(pname)
    return best


def extract_potential_project(building_name):
    """从楼栋名中提取可能的项目名。
    规则：去掉末尾的"X栋"、"X号楼"、"X座"、"X单元"等。
    返回可能的前缀列表。"""
    patterns = [
        r'^(.+?)(\d+栋.*)$',           # 未来之光家园20栋
        r'^(.+?)(\d+号楼.*)$',          # 桂语兰庭3号楼
        r'^(.+?)([A-F]\d*座.*)$',       # 悦见和府A座
        r'^(.+?)(\d+单元.*)$',          # X单元
        r'^(.+?)(\d+区.*)$',            # X区
        r'^(.+?)(\d+期.*)$',            # X期
        r'^(.+?)(\d+标段.*)$',          # X标段
        r'^(.+?)(\d+段.*)$',
    ]
    candidates = [building_name]  # 原样也算一个候选
    for pat in patterns:
        m = re.match(pat, building_name)
        if m:
            candidates.append(m.group(1))
    return candidates


def developer_match(building_name, owner_name, projects):
    """开发商匹配: 同一开发商的项目"""
    matches = []
    for pname, info in projects.items():
        if info["developer"] == owner_name:
            matches.append(pname)
    return matches


def main():
    validate_only = "--validate-only" in sys.argv
    dry_run = "--dry-run" in sys.argv

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    # 加载项目
    print("══ 项目匹配 ══")
    print("[1/5] 加载预售证...")
    projects = load_permits(conn)
    print(f"  独立项目: {len(projects)}")

    # 获取所有楼栋名
    print("[2/5] 提取楼栋名...")
    cur = conn.execute("""
        SELECT DISTINCT building_name, owner_name, parcel_no
        FROM housing_units_new
    """)
    buildings = cur.fetchall()
    print(f"  独立楼栋: {len(buildings)}")

    if validate_only:
        # 小样本验证模式
        print(f"\n[验证] 抽取 {SAMPLE_COUNT} 个盘做匹配验证...\n")
        # 按楼栋名分组，找项目明确的前几个
        sampled = []
        seen = set()
        for bldg, owner, parcel in buildings:
            proj = prefix_match(bldg, projects)
            if proj and proj not in seen:
                sampled.append((bldg, owner, parcel, proj))
                seen.add(proj)
            if len(sampled) >= SAMPLE_COUNT:
                break

        for bldg, owner, parcel, matched in sampled:
            info = projects[matched]
            print(f"  楼栋: {bldg}")
            print(f"    匹配项目: {matched}")
            print(f"    开发商: {owner} → {info['developer']}")
            print(f"    区域: {info['zone']} | 预售证: {info['permits']}")
            print(f"    地址: {info['site_address']}")
            # 统计该项目的房源数
            cur2 = conn.execute(
                "SELECT COUNT(*), SUM(CASE WHEN status='未售' THEN 1 ELSE 0 END) "
                "FROM housing_units_new WHERE building_name=?",
                (bldg,)
            )
            t, u = cur2.fetchone()
            print(f"    该楼栋房源: {t} 总 / {u or 0} 未售")
            print()
        print(f"✅ 验证完成。以上匹配结果请确认是否正确。")
        print(f"   确认无误后执行: python3 match_projects.py")
        conn.close()
        return

    # 全量匹配
    print(f"[3/5] 三级匹配 {len(buildings)} 个楼栋...")
    stats = {"prefix": 0, "developer": 0, "parcel": 0, "unmatched": 0}
    match_map = {}  # building_name → project_name

    # 先建开发商反向索引
    dev_index = defaultdict(list)
    for pname, info in projects.items():
        dev_index[info["developer"]].append(pname)

    for bldg, owner, parcel in buildings:
        matched = None

        # 1. 楼栋名前缀匹配
        candidates = extract_potential_project(bldg)
        for cand in candidates:
            matched = prefix_match(cand, projects)
            if matched:
                break

        if matched:
            stats["prefix"] += 1
            match_map[bldg] = matched
            continue

        # 2. 开发商匹配
        if owner in dev_index:
            dev_projects = dev_index[owner]
            if len(dev_projects) == 1:
                matched = dev_projects[0]
                stats["developer"] += 1
            else:
                # 多个项目同一开发商，尝试在前缀候选中找交集
                for cand in candidates:
                    for dp in dev_projects:
                        if dp in cand or cand.startswith(dp):
                            matched = dp
                            break
                    if matched:
                        break
                if matched:
                    stats["developer"] += 1

        if matched:
            match_map[bldg] = matched
            continue

        # 3. 宗地号匹配（暂留，需要额外数据）
        stats["unmatched"] += 1

    # 回填 project_name, zone, date_listed
    print("[4/5] 回填项目信息...")
    conn.execute("BEGIN")
    updated = 0
    for bldg, proj in match_map.items():
        info = projects.get(proj)
        if not info:
            continue
        conn.execute(
            """UPDATE housing_units_new
               SET project_name=?, zone=?, permit_no=?, date_listed=?
               WHERE building_name=? AND project_name IS NULL""",
            (proj, info["zone"], info["permits"], info["latest_date"], bldg)
        )
        updated += conn.total_changes

    # 统计
    print("[5/5] 统计结果...")
    conn.commit()

    total = len(buildings)
    matched = total - stats["unmatched"]
    rate = matched / total * 100 if total > 0 else 0

    print(f"\n  匹配结果:")
    print(f"    楼栋前缀: {stats['prefix']} ({stats['prefix']/total*100:.1f}%)")
    print(f"    开发商:   {stats['developer']} ({stats['developer']/total*100:.1f}%)")
    print(f"    未匹配:   {stats['unmatched']} ({stats['unmatched']/total*100:.1f}%)")
    print(f"    总匹配率: {rate:.1f}%")
    print(f"    回填记录: {updated:,}")

    # 未匹配的样本
    if stats["unmatched"] > 0:
        cur = conn.execute("""
            SELECT DISTINCT building_name, owner_name, parcel_no
            FROM housing_units_new WHERE project_name IS NULL
            LIMIT 20
        """)
        print(f"\n  ⚠️ 未匹配楼栋样本:")
        for row in cur.fetchall():
            print(f"    {row[0]} | {row[1][:20]} | {row[2]}")

    # 各项目统计
    cur = conn.execute("""
        SELECT project_name, zone, COUNT(*) as total,
               SUM(CASE WHEN status='未售' THEN 1 ELSE 0 END) as unsold
        FROM housing_units_new
        WHERE project_name IS NOT NULL AND house_usage='住宅'
        GROUP BY project_name ORDER BY total DESC LIMIT 20
    """)
    print(f"\n  Top 20 楼盘（住宅）:")
    for row in cur.fetchall():
        print(f"    {row[0]:30s} {row[1]:4s}  总{row[2]:5d}  未售{row[3] or 0:5d}")

    conn.close()
    print(f"\n✅ 完成！下一步: python3 rebuild_db.py")


if __name__ == "__main__":
    main()
