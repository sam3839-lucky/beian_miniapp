<!-- /autoplan restore point: /Users/sam/.gstack/projects/beian_miniapp/feature-pg-migration-autoplan-restore-20260614-002641.md -->
# 备案价小程序 v2.0 改进设计方案

> 基于鹏城好屋深度逆向分析 + beian_miniapp v1.4.6 基线  
> 日期：2026-06-14

---

## 一、鹏城好屋 逆向分析摘要

### 1.1 基本信息

| 项目 | 内容 |
|------|------|
| 公司 | 深圳市鹏城好屋科技有限公司 |
| 备案 | 粤ICP备2023144153号（2023.12 上线） |
| 平台 | 微信小程序 + 公众号 + 抖音 + 小红书 |
| 定位 | 以数据为钩子的房产经纪平台 |
| 商业模式 | 房源数据查询引流 → 选房师咨询 → 大额返佣成交 |

### 1.2 页面架构（自定义 5 Tab）

| Tab | 名称 | 核心功能 |
|-----|------|---------|
| 1 | 新房查询 | 首页 + 新盘搜索 + 楼盘列表（含去化率、取证日期、总价区间） |
| 2 | 在建项目 | 未开盘项目追踪（预估均价+上市倒计时+建设进度） |
| 3 | 楼市资讯 | 政策解读文章（人工撰写，595篇）+ 团队介绍 Trust Building |
| 4 | 数据统计 | 每日/每月认购网签数据表 + 趋势折线图 |
| 5 | 我的 | 登录 + 工具集 + 关注管理 |

### 1.3 楼盘卡片数据字段

```
项目名 | 区域·街道 | 备案均价(元/㎡)
总套数|剩余套数 | 装修标准（精装/毛坯/简装）
总价区间(万) | 面积区间(平)
去化率 | 取证日期（含"已过N天"标记）
```

### 1.4 六级页面结构

| 层级 | 页面 | 说明 |
|------|------|------|
| 首页 | 新房查询 Tab | 功能入口 + Hero Banner + 搜索 + 楼盘列表 |
| 列表 | 楼盘搜索结果 | 按取证日期排序，分页加载 |
| 项目总览 | 项目详情页 | 基本信息（容积率/车位比/绿化率/开发商/位置）+ 户型 + 多Tab详情 |
| 房源表 | 一房一价表 | 按楼栋/单元/楼层筛选，表格展示所有房源 |
| 单套详情 | 房间详情 | 单个房间完整信息 + 折扣计算器 + 前后翻页 |
| 对比 | 同板块项目 | 周边竞品并列对比（价格/去化率/总价范围） |

### 1.5 核心竞争力

| # | 能力 | 说明 |
|---|------|------|
| 1 | 去化率展示 | 每张楼盘卡片含去化率进度条 |
| 2 | 在建项目追踪 | 未开盘项目预估均价+上市倒计时 |
| 3 | 同板块竞品对比 | 周边项目并列比较 |
| 4 | 折扣计算器 | 输入折扣算折后价+月供 |
| 5 | 取证日期新鲜度 | 标注"已过N天"体现数据时效 |
| 6 | 内容+工具闭环 | 楼市资讯→信任建设→选房师转化 |
| 7 | 每页嵌入咨询入口 | 交流群、在线咨询、大额返佣 CTA |

### 1.6 与 beian_miniapp v1.4.6 对比

| 维度 | beian_miniapp | 鹏城好屋 |
|------|-------------|---------|
| 核心数据 | 备案价一房一价（更深度） | 认购/网签 + 去化率 |
| 产品形态 | 纯工具（搜→查→走） | 内容+工具+经纪闭环 |
| 用户粘性 | 低（用完即走） | 中高（定期回访看数据） |
| 去化率 | ❌ 有数据但未展示 | ✅ 突出展示 |
| 在建项目 | ❌ 完全缺失 | ✅ 核心差异化功能 |
| 项目对比 | ❌ 无 | ✅ 同板块并列 |
| 折扣计算 | ⚠️ 仅有房贷计算 | ✅ 折扣→折后价→月供 |
| 二手房数据 | ✅ 全量成交 | ❌ 仅每日总量 |
| 数据导出 | ❌ 无 | ❌ 也无 |

---

## 二、v2.0 改进方案

### 2.1 设计原则

1. **保持工具属性**：不照抄鹏城好屋的过度商业化（每页塞返佣 CTA）
2. **数据密度升级**：补齐去化率、取证日期、总价区间、装修标准
3. **差异化突破**：在建项目追踪 + AI 日报 + 数据导出（鹏城好屋没有的）
4. **自动化运营**：AI 生成楼市解读替代人工写文章

### 2.2 页面结构调整

```
tabBar (4 个，保持原生)：
├── 📊 行情 (home)          ← 改造：从"数据罗盘"升级为"楼市日报"信息流
├── 🔍 找房 (index)         ← 保留：卡片信息密度升级
├── 📈 成交 (trends)        ← 升级：ECharts 替换 Canvas
└── 👤 我的 (mine)          ← 优化：会员转化路径

三级页面：
├── 楼盘详情 (detail)              ← 新增：历史价格走势图
├── 楼盘对比 (compare)              ← 全新：同板块竞品并列
├── 即将入市 (upcoming)            ← 全新：在建项目追踪
├── AI 解读详情 (ai-insight)       ← 全新
├── 二手房搜索 (history-search)     ← 保留
├── 二手房结果 (history-result)     ← 保留
├── 二手房详情 (history-detail)     ← 保留
├── 小区概览 (community-overview)   ← 保留
├── 大盘数据 (dashboard)           ← 保留，ECharts 升级
├── 会员中心 (member)              ← 保留，优化转化
├── 订阅管理 (subscriptions)       ← 保留
└── 支付页 (pay)                   ← 保留
```

### 2.3 六大改进模块

#### 模块 1：楼盘卡片信息升级 【P0，3天】

新增 4 个数据字段：

- **去化率**：(总套数 - 可售套数) / 总套数，进度条可视化
- **取证日期**：标注"已过 N 天"体现时效
- **总价区间**：最低单价×最小面积 ~ 最高单价×最大面积
- **装修标准**：精装/毛坯/简装

现有数据已覆盖，仅需前端展示层改造。

#### 模块 2：同板块项目对比 【P0，3天】

基于同一街道/区域的已取证楼盘，自动生成对比矩阵：

| 维度 | 本项目 | 竞品A | 竞品B |
|------|--------|--------|--------|
| 备案均价 | - | - | - |
| 面积范围 | - | - | - |
| 总价区间 | - | - | - |
| 去化率 | - | - | - |
| 装修标准 | - | - | - |
| 取证日期 | - | - | - |

**筛选逻辑**：同 `zone` + `area`（街道级），按取证日期倒序取最近 4 个。

#### 模块 3：即将入市（在建项目追踪）【P1，4天】

利用现有 `sync_permits.py`（预售证抓取），增加在建/待售项目页面：

| 字段 | 数据来源 |
|------|---------|
| 项目名称 | 预售证抓取 |
| 区域·街道 | 已有 |
| 预估均价 | 同区域近期备案均价参考 |
| 总套数 | 预售证数据 |
| 面积区间 | 已有 |
| 建设进度 | 建设中 / 样板房已开 / 已封顶（需新增数据源） |
| 预计入市 | 手动维护或 AI 估算 |
| 总价区间 | 预估均价×面积区间估算 |

#### 模块 4：行情页改造（日报式首页）【P1，2天】

把现有首页从"数据罗盘"升级为"楼市日报"信息流：

```
📊 深圳楼市日报 2026年6月13日
├── 今日快报（新房/二手网签量，环比变化）
├── 今日新取证项目
├── 本周去化最快 Top 3
├── AI 每日解读（自动生成 200 字）
└── 下拉加载历史行情
```

#### 模块 5：去化率全场景可视化 【P2，2天】

- 首页热门楼盘排行 → 去化率进度条
- 楼盘详情页顶部 → 大盘去化率指标
- 区域统计 → 各区去化率对比
- 楼盘卡片 → 每张卡片含去化率

#### 模块 6：折扣计算器增强 【P2，1天】

在现有房贷计算基础上增加：
- 输入折扣（如 85%）
- 自动计算折后总价、折后单价
- 基于折后价计算首付（15%/20%/30%）
- 与现有月供计算串联

### 2.4 可选增强（P3）

| 功能 | 说明 | 工作量 |
|------|------|--------|
| AI 楼市日报自动生成 | 后端 LLM 读取每日 synced 数据生成摘要 | 3天 |
| 数据导出/分享 | 一房一价表导出图片或 Excel | 3天 |
| ECharts 替换 Canvas | 交互式图表替代手写 Canvas | 2天 |
| 地图找房 | 腾讯地图 SDK 集成 | 5天 |
| 会员转化优化 | 场景化触发升级提示 | 2天 |

---

## 三、实施路线图

```
第 1 周（P0 核心体验）：
├── Day 1-3：楼盘卡片信息升级（去化率+取证日期+总价区间+装修标准）
├── Day 3-6：同板块项目对比页面
└── Day 7：行情页信息流改造

第 2 周（P1 差异化）：
├── Day 8-11：即将入市/在建项目页面
├── Day 12-13：去化率全场景可视化
└── Day 14：折扣计算器增强

第 3 周（P2 增值）：
├── AI 楼市日报自动生成
├── ECharts 替换 Canvas 图表
├── 数据导出/分享功能
└── 会员转化路径优化
```

---

## 四、技术选型

| 现有 | 升级方向 | 理由 |
|------|---------|------|
| 原生 WXSS | 保持 | 无 UI 库依赖，包体积小 |
| Canvas 绑图 | → echarts-for-weixin | 代码量 -60%，支持触摸交互 |
| Python Flask 后端 | 保持 | 稳定性好，已有爬虫管线 |
| SQLite | → PostgreSQL（已有准备） | 已在 .env 中预留 PG URL |
| 手动海报 | → 后端自动生成 + CDN | 降低用户等待时间 |

---

## 五、不做的事

- ❌ 不抄鹏城好屋的过度商业化（每页塞返佣/咨询CTA）
- ❌ 不用自定义 5 Tab（微信官方不推荐，兼容性风险）
- ❌ 不模仿人工写楼市文章（用 AI 自动化替代，零边际成本）
- ❌ 不照搬他们的"交流群"模式（维护成本高，不适合工具定位）

---

## GSTACK REVIEW REPORT

### Runs

| Run | Skill | Status | Via | Findings |
|-----|-------|--------|-----|----------|
| 2026-06-14 | plan-ceo-review | issues_found | autoplan (subagent-only) | 7 strategic |
| 2026-06-14 | plan-eng-review | pending | autoplan | — |
| 2026-06-14 | plan-devex-review | skipped | — | no developer-facing scope detected |

### Phase 1: CEO Review Complete

**Mode:** SELECTIVE EXPANSION → User chose Option A (retention-first restructuring).

**CEO Consensus:** 0/6 confirmed (all strategic dimensions flagged). Codex returned empty — proceeding with Claude subagent findings only [subagent-only].

**Key Findings (7):** Wrong problem framing (CRITICAL), zero user retention (CRITICAL), upcoming projects data pipeline is fiction (HIGH), backend scope underestimated (HIGH), AI日报 liability risk (MEDIUM), community dismissed too quickly (MEDIUM), monetization unaddressed (MEDIUM).

**Scope Restructured:**
- KEEP: Modules 1+2 (de-rate cards, project comparison), Module 4 (homepage refresh), Module 5 (de-rate visualization), Module 6 (discount calculator)
- ADD: 备案价-vs-成交价 spread module (unique insight), user retention (saved searches + price alerts + watchlists, P1)
- CUT: Module 3 (upcoming projects — no real data pipeline)
- DEFER: AI日报 (needs fact-grounding), ECharts (polish, retention first)

**Updated Implementation Plan:**

| Week | Tasks |
|------|-------|
| Week 1 (P0) | 楼盘卡片升级(去化率+取证日期+总价区间+装修) + 同板块项目对比 + 备案价vs成交价价差模块 |
| Week 2 (P1) | 行情页日报式改造 + 去化率全场景可视化 + 用户留存(收藏+价格提醒+关注列表) |
| Week 3 (P2) | 折扣计算器增强 + 后端新API(compare, spread, alerts) + 联调测试 |

### Phase 2: Design Review (UI scope — skipped for speed)

UI review skipped in autoplan fast path. Key design decisions already covered by CEO scope restructuring. Design litmus: de-rate progress bars on every card + spread comparison as centerpiece + homepage daily brief layout follow existing WeUI-style design system in `app.wxss`.

### Phase 3: Eng Review

#### Architecture ASCII Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    WeChat Mini Program (Frontend)                 │
├──────────────────────────────────────────────────────────────────┤
│  pages/home        pages/index       pages/detail    pages/trends │
│  +daily-brief      +de-rate bars     +spread module  +compare tab│
│  +spread highlight +compare entry    +price alert btn            │
├──────────────────────────────────────────────────────────────────┤
│  components/                                                      │
│  price-card (extended)    spread-card (NEW)    watchlist (NEW)   │
│  +de-rate bar             +price delta         +alert badge       │
│  +permit-age              +trend mini-chart                      │
├──────────────────────────────────────────────────────────────────┤
│  utils/api.js                                                     │
│  +getProjectSpread()    +saveSearch()    +subscribePriceAlert()  │
│  +getCompareData()      +getWatchlist()  +deleteWatchlist()      │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼───────────────────────────────────────┐
│              Flask Backend (ruiheqi.cn)                           │
├──────────────────────────────────────────────────────────────────┤
│  NEW ENDPOINTS:                                                   │
│  GET /api/project-spread?project=X   → 备案价 vs 成交价 价差     │
│  GET /api/compare?projects=A,B,C     → 同板块项目对比矩阵         │
│  POST /api/saved-searches            → 保存搜索条件               │
│  GET /api/saved-searches             → 获取已保存搜索             │
│  POST /api/price-alerts              → 创建价格提醒               │
│  GET /api/price-alerts               → 获取提醒列表               │
│                                                                   │
│  MODIFIED ENDPOINTS:                                              │
│  GET /api/units         → +decoration, +permit_date, +de-rate_pct│
│  GET /api/projects      → +decoration, +permit_date span         │
│  GET /api/stats         → +de_rate_pct, +permit_age_days         │
│  GET /api/overview      → +daily_spread_summary                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│              Data Pipeline (sync/)                                │
│  No new pipelines needed. Existing sync_units + sync_daily cover │
│  all required data. Spread computation is query-level (JOIN).    │
│  Price alerts: cron job checking new daily data against alerts.  │
└──────────────────────────────────────────────────────────────────┘
```

#### Test Coverage

| Codepath | Test Type | Existing? | Gap |
|----------|-----------|-----------|-----|
| de-rate % calculation (sold/total) | Unit (JS) | ❌ | Add `computeDeRate(sold, total)` test; edge: total=0 |
| permit age display ("已过N天") | Unit (JS) | ❌ | Add `formatPermitAge(date)` test; edge: future date |
| spread computation (备案价-成交价) | Unit (Python) | ❌ | Add backend test for JOIN logic; edge: no resale data |
| compare API with 4 projects | Integration | ❌ | Add API test; edge: <2 projects in same zone |
| price alert cron job | Integration | ❌ | Add test for alert matching logic |
| saved search with 0 results | Unit (JS) | ❌ | Add empty state test |
| watchlist limit enforcement | Unit (JS) | ❌ | Add boundary test at 20 items |

**Test plan artifact:** `~/.gstack/projects/beian_miniapp/feature-pg-migration-test-plan-20260614.md`

#### Failure Modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Spread API returns null (no resale data) | User sees empty section | Graceful fallback: hide section, show "暂无成交数据" |
| Compare API slow (4-project JOIN) | Page load >3s | Cache compare results per zone per day |
| Price alert fires on stale data | False notification erodes trust | Include data freshness timestamp in alert; don't fire if data >48h old |
| Saved search DB grows unbounded | Storage cost | Cap at 10 saved searches per user; auto-delete >90d inactive |
| De-rate = 0% (new project, no sales) | Misleading "sold out" display | Show "新取证" badge instead of 0% bar |

### Phase 3.5: DX Review

**Skipped** — no developer-facing scope detected. Plan is consumer mini program UI + backend endpoints. Backend changes are standard Flask CRUD, not a new API/SDK/CLI/developer platform.

### Cross-Phase Themes

No cross-phase themes — each phase's concerns were distinct.

### VERDICT

**APPROVED with restructuring.** The plan as written was a feature catch-up exercise. With Option A restructuring (retention-first, spread-centerpiece, cut zombie features), it becomes a defensible product strategy. Key risks accepted: AI日报 deferred (needs fact-grounding), ECharts deferred (polish vs retention tradeoff), upcoming projects cut (no data pipeline). These are correct calls given current constraints.

### Implementation Tasks (aggregated)

- [ ] **P0-1 (P0, human: ~2d / CC: ~30min) — 后端API扩展** — 扩展 units/projects/stats API 返回去化率+取证日期+装修标准+总价区间
  - Surfaced by: ceo-review — backend scope underestimated
  - Files: beian_query/app.py, sync/ (SQL queries)
- [ ] **P0-2 (P0, human: ~2d / CC: ~30min) — 楼盘卡片升级** — price-card组件新增去化率进度条+取证日期+总价区间+装修标准
  - Surfaced by: ceo-review — Module 1 (KEEP)
  - Files: components/price-card/, pages/index/
- [ ] **P0-3 (P0, human: ~2d / CC: ~30min) — 同板块项目对比页** — 新建compare页面+后端compare API
  - Surfaced by: ceo-review — Module 2 (KEEP)
  - Files: pages/compare/ (NEW), utils/api.js, beian_query/app.py
- [ ] **P0-4 (P0, human: ~2d / CC: ~30min) — 备案价vs成交价价差模块** — 新建spread-card组件+后端spread API,首页+详情页嵌入
  - Surfaced by: ceo-review — ADD: unique insight
  - Files: components/spread-card/ (NEW), pages/detail/, pages/home/, beian_query/app.py
- [ ] **P1-1 (P1, human: ~1d / CC: ~15min) — 行情页日报式改造** — 首页升级为日报信息流(今日快报+新取证+去化TOP3)
  - Surfaced by: ceo-review — Module 4 (KEEP)
  - Files: pages/home/
- [ ] **P1-2 (P1, human: ~2d / CC: ~30min) — 用户留存基础设施** — 收藏搜索+价格提醒+项目关注列表,后端新API
  - Surfaced by: ceo-review — ADD: retention
  - Files: pages/watchlist/ (NEW), pages/subscriptions/, utils/api.js, beian_query/app.py
- [ ] **P2-1 (P2, human: ~1d / CC: ~15min) — 去化率全场景覆盖** — 首页排行+详情页+区域统计全加去化率
  - Surfaced by: ceo-review — Module 5 (KEEP)
  - Files: pages/home/, pages/detail/, pages/trends/
- [ ] **P2-2 (P2, human: ~0.5d / CC: ~10min) — 折扣计算器增强** — 折扣→折后价→首付→月供串联
  - Surfaced by: ceo-review — Module 6 (KEEP)
  - Files: pages/detail/

NO UNRESOLVED DECISIONS
