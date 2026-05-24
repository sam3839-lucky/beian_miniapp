# 底部 TabBar + 成交分析 — 细化方案

## 现状

3 个页面（home / index / detail），无底部导航。用户从 home 进入 index 后无法直接返回 home（只能用左上角返回箭头），也无法快速切换。

## 目标

三 Tab 底部导航 + 新建成交分析页。

## TabBar 配置

```json
{
  "tabBar": {
    "color": "#888888",
    "selectedColor": "#07C160",
    "backgroundColor": "#FFFFFF",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/home/home",    "text": "首页", "iconPath": "...", "selectedIconPath": "..." },
      { "pagePath": "pages/index/index",  "text": "新房", "iconPath": "...", "selectedIconPath": "..." },
      { "pagePath": "pages/trends/trends","text": "成交", "iconPath": "...", "selectedIconPath": "..." }
    ]
  }
}
```

TabBar 要求被引用的页面不能通过 `wx.navigateTo` 跳转。当前 home→index 用了 navigateTo，需要改为 `wx.switchTab`。

## 三个 Tab 的详细设计

### Tab 1：首页 (pages/home/home) — 已有

保持现有 6 模块不变。底部新增 TabBar 自动出现。移除之前加的手工「运营面板」入口（改为隐藏入口，长按标题触发或放到成交页底部）。

### Tab 2：新房 (pages/index/index) — 已有，微调

现有筛选+列表页。改动：
- 运营面板入口移到页面顶部右侧小字（"运营"），tap 进入 ops 页
- 首次进入如果无筛选条件，默认选中"全深圳"并展示热门项目列表（而非空白提示"选择小区开始查询"）

### Tab 3：成交 (pages/trends/trends) — **新建**

数据源：`housing_units` 表中状态为「已网签」+「已备案」的记录。

#### 3.1 页面布局（自上而下）

```
┌────────────────────────────────────┐
│  成交分析                           │  ← 导航栏
├────────────────────────────────────┤
│  [近12个月]  [近30天]  [全部]       │  ← 时间范围切换
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │  月度成交量价走势（折线+柱状）  │  │  ← 用 progress/bar 实现
│  │  █▃▅▇▆▄▂▁▃▅▇█  ...        │  │
│  │  1月 2月 ... 12月             │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  📊 本月成交概览                     │
│  成交量 1,234 套   均价 512万       │  ← 数字卡片
│  环比上月 ↑12%     ↑3.2%           │
├────────────────────────────────────┤
│  🏆 各区成交量排名                   │
│  龙岗  ████████████  3,456 套      │  ← 横向柱状条
│  宝安  ██████████    2,890 套      │
│  南山  ██████        1,567 套      │
│  ...                               │
├────────────────────────────────────┤
│  🔥 近期成交                         │
│  ┌──────────────────────────────┐  │
│  │ 佳盛园 A-1203  108㎡          │  │  ← 类似 price-card 的卡片
│  │ 总价 320万  单价 2.96万/㎡     │  │
│  │ 网签日期 2026-05-20           │  │
│  └──────────────────────────────┘  │
│  ...（滚动加载）                    │
└────────────────────────────────────┘
```

#### 3.2 后端 API（三个新端点）

**GET /api/transactions/summary**

返回本月成交概览和环比数据。

```json
{
  "this_month": { "count": 1234, "avg_total": 512, "avg_unit": 46123 },
  "last_month": { "count": 1102, "avg_total": 495, "avg_unit": 45200 },
  "delta_count_pct": 12.0,
  "delta_price_pct": 3.2
}
```

实现：基于 `date_signed` 字段做月级聚合。

**GET /api/transactions/trends?months=12**

返回近 N 个月成交量价走势。

```json
{
  "trends": [
    { "month": "2025-06", "count": 980,  "avg_total": 488 },
    { "month": "2025-07", "count": 1050, "avg_total": 495 },
    ...
  ]
}
```

**GET /api/transactions/recent?page=1&page_size=20&zone=**

返回近期成交列表（按网签日期倒序）。

```json
{
  "items": [
    {
      "project_name": "佳盛园",
      "building_name": "A座",
      "unit_no": "1203",
      "built_area": 108.5,
      "total_price": 320.0,
      "unit_price": 29500,
      "date_signed": "2026-05-20",
      "zone": "龙岗"
    }
  ],
  "total": 79372
}
```

#### 3.3 前端文件

| 文件 | 说明 |
|------|------|
| `pages/trends/trends.js` | 页面逻辑：数据加载、时间范围切换、分页 |
| `pages/trends/trends.wxml` | 页面模板：概要卡片、走势图、排行榜、成交列表 |
| `pages/trends/trends.wxss` | 样式（WeUI 规范） |
| `pages/trends/trends.json` | 页面配置：下拉刷新 |

## 其他页面调整

| 页面 | 改动 |
|------|------|
| `app.json` | 新增 `tabBar` 配置；新增 `pages/trends/trends` |
| `pages/index` | 首页→新房的跳转从 `navigateTo` 改为 `switchTab` |
| `pages/home` | 移除底部运营入口；全区标签点击改为 `switchTab` |
| `pages/ops` | 入口移到 index 页顶部右侧小字 |
| `utils/api.js` | 新增 `getTransactionSummary`、`getTrends`、`getRecentTransactions` |

## 工作量估算

| 模块 | 工作量 (human/CC) |
|------|-------------------|
| 3 个后端 API | 15 min CC |
| 成交分析页 (trends) | 25 min CC |
| TabBar 配置 + 跳转改造 | 10 min CC |
| 图标资源 | 需要手动准备 6 张 40×40px PNG |
| **合计** | **~50 min CC + 图标** |

## 图标需求

TabBar 的每个 tab 需要两个图标（未选中 / 选中态），共 6 张 40×40px PNG。放在 `assets/tabbar/` 目录：

```
assets/tabbar/
  home.png / home-active.png       ← 首页图标
  search.png / search-active.png   ← 新房图标
  chart.png / chart-active.png     ← 成交图标
```

可以从 WeUI 图标库提取或使用 iconfont。
