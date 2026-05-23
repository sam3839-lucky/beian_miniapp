# 深圳新房备案价小程序 — 主页方案

## 背景

`beian_miniapp` 是面向深圳购房者的微信小程序，查询深圳市住建局一手房备案价。现有功能仅有"区域→项目→楼栋"三级筛选 + 房源列表，缺少主页入口。用户打开小程序后是一片空白筛选页，缺乏"一览全局"的体验。

## 数据规模

- 37.5 万条房源（housing_units），覆盖深圳 13 区
- 4383 条预售证（presale_permits）
- 可售住宅 2.6 万套，均价 530 万
- 数据源：深圳住建局 fdc.zjj.sz.gov.cn，每日增量同步

## 方案设计

主页定位：**市场一览 → 快速入口 → 发现感**。自上而下 6 个模块：

### P0 — 市场概览 + 搜索入口

**搜索栏**：顶部白底搜索框，输入项目名/开发商名，确认后跳转筛选列表页。

**4 数字卡片**：可售住宅 2.6 万 / 住宅均价 530 万 / 已网签 3.7 万 / 近 7 日更新数。下方一条彩色占比条展示四种状态（未售/网签/备案/转移登记）的比例。

后端新增 `GET /api/overview`：一次查询返回总量、均价、近 7 日更新、各区 TOP8 统计。

### P1 — 区域对比 + 排行榜

**区域快捷标签**：8 个圆角胶囊（龙岗 6299 套、宝安 4471 套...），点击跳转该区筛选。

**区域对比条**：横向柱状图展示各区未售住宅数量 + 均价，按数量降序。

**排行榜**：三 tab 切换（总价最低 / 单价最低 / 面积最小），各 TOP10，显示项目名、房号、面积、总价、单价。前三名金银铜高亮。

后端新增 `GET /api/rankings`：3 条 SQL 返回三个维度的 TOP10。

### P2 — 最新预售证

横向滑动卡片，最近 30 条获批预售证。每张卡片含：区域标签、项目名、开发商、获批日期、可售住宅数。

后端新增 `GET /api/latest-permits`：LEFT JOIN 一次查询返回预售证 + 对应项目未售数量。

### P3 — 购房能力计算器

输入首付预算（万）+ 月供能力（万），按 LPR 3.15%、30 年期计算：
- 首付 30% 可买总价区间
- 月供范围内最高贷款额
- 结果可点击跳转筛选

纯前端计算，不依赖后端。

### 导航打通

主页 → 筛选页通过 URL query string 传参（zone / project / search / price_min / price_max），筛选页 `onLoad` 解析参数并自动执行导航：
- 有 zone → 设置区域 picker → 加载项目列表 → 自动选中项目
- 只有 project → 全局搜索项目名并选中
- 有 price 参数 → 设置自定义价格筛选

## 架构

```
首页 (pages/home/home)
  ├── 搜索栏           → navigates to /pages/index/index?search=...
  ├── 概览卡片          ← GET /api/overview
  ├── 区域入口          → navigates to /pages/index/index?zone=...
  ├── 区域对比          ← GET /api/overview (复用)
  ├── 排行榜            ← GET /api/rankings
  ├── 最新预售证        ← GET /api/latest-permits
  └── 购房计算器        ← 纯前端

筛选页 (pages/index/index)
  ├── 接收 home 传入的 zone / project / search / price 参数
  └── 自动执行导航 + 筛选

后端 (Flask, beian_query/app.py)
  ├── GET /api/overview        新增
  ├── GET /api/rankings         新增
  ├── GET /api/latest-permits   新增（1 次 JOIN，避免 N+1）
  ├── GET /api/zones            已有
  ├── GET /api/projects         已有
  ├── GET /api/buildings        已有
  ├── GET /api/units            已有
  └── GET /api/stats            已有
```

## 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `beian_query/app.py` | 修改 | 新增 3 个 API 端点（+100 行） |
| `beian_miniapp/pages/home/home.js` | 新建 | 主页逻辑（165 行） |
| `beian_miniapp/pages/home/home.wxml` | 新建 | 主页模板（142 行） |
| `beian_miniapp/pages/home/home.wxss` | 新建 | 主页样式（220 行） |
| `beian_miniapp/pages/home/home.json` | 新建 | 页面配置 |
| `beian_miniapp/utils/api.js` | 修改 | 新增 3 个 API 函数（+3 行） |
| `beian_miniapp/app.json` | 修改 | home 设为首页 |
| `beian_miniapp/pages/index/index.js` | 修改 | 新增导航参数处理（+80 行） |

## 待定/未来

- P4: 收藏与对比功能
- 详情页"状态硬编码可售"bug
- 后端无鉴权（当前仅内部使用）
- 排行榜点击进入详情页通过 URL query string 传完整对象（继承现有模式，存在 URL 长度风险）
