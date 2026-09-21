# 备案价小程序 v3 — 数据可获取性评估（含 API 调研）

## 数据源

- **PostgreSQL `property_clawer`**：`housing_units`(38.6万条) + `presale_permits`(4400条) + `buildings`(楼栋)
- **后端 API**：Flask `beian_query/app.py`，约 30 个端点
- **住建局 API**：`getHouseInfoListToPublicity`（v2 主力）+ `getYsfYsPublicity`（预售证）+ `getBuildingInfoToPublicity`（楼栋信息）

---

## 六大数据缺口 — API 调研结果

### 1. 装修（精装/毛坯）
**API 结论：❌ 住建局 API 不提供**

| 调查项 | 结果 |
|--------|------|
| `getHouseInfoListToPublicity` | 无装修字段 |
| `getBuildingInfoToPublicity` | 无装修字段 |
| `getYsfYsPublicity` | 无装修字段 |
| v1 `houseAttr` | 存的是"市场化商品房"/"保障性住房"分类，非装修 |

**替代方案：** 第三方数据（链家/贝壳爬取），或从项目名/开发商推断（如"万科精装"系列），或暂时隐藏装修筛选。

---

### 2. 户内面积 / 分摊面积 / 得房率
**API 结论：✅ API 已返回，只是没存！**

住建局 `getHouseInfoListToPublicity` 每条房源返回：

```json
{
  "ysinsidearea": 85.41,       // ← 预售套内面积（户内面积）
  "ysexpandarea": 21.09,       // ← 预售分摊面积
  "ysbuildingarea": 106.5,     // ← 预售建筑面积（已存为 built_area）
  "jginsidearea": 0.0,         // 竣工套内面积（竣工后才有值）
  "jgexpandarea": 0.0,         // 竣工分摊面积
  "jgbuildingarea": 0.0,       // 竣工建筑面积
  "recordedPricePerUnitInside": 65419.65  // 按套内面积单价
}
```

**当前状态：** `presale_fetcher_v2.py` 只解析了 `ysbuildingarea` → `built_area`，其余字段全部丢弃。

**修复方案：** 在 `housing_units` 表加 3 列（`inner_area` / `share_area` / `inner_unit_price`），抓取器加 3 行映射，重跑全量同步。**工作量：1-2 天。**

---

### 3. 车位比
**API 结论：❌ 住建局 API 不提供**

`getBuildingInfoToPublicity` 有 `sitearea`（地块面积）和 `buildingarea`（建筑面积），但无停车位数量。

**替代方案：** 规自局施工许可公示（`ghzy.sz.gov.cn`），或第三方数据。

---

### 4. 容积率
**API 结论：❌ 住建局 API 不提供**

API 不直接返回容积率。理论上可通过 `buildingarea / sitearea` 近似计算，但 `getBuildingInfoToPublicity` 返回的是单栋楼数据而非项目整体。项目级容积率需从其他来源获取。

**替代方案：** 规自局土地出让合同公示，或第三方数据。

---

### 5. 物业费
**API 结论：⚠️ 可能可从页面抓取，但非 API 直接返回**

- `presale_permits` 表已有 `property_management` 列（物业公司名），但全是空值
- `presale_fetcher_v2.py` 中存在死代码函数 `upsert_permit_project_info`，原本设计从预售证详情页的 Vue 组件抓取物业公司等信息，但从未被调用
- API 不直接返回物业费

**修复方案：** 激活 `upsert_permit_project_info` 逻辑（从预售证详情页 HTML/Vue 提取），或直接爬取预售证详情页。

---

### 6. 即将入市项目
**API 结论：❌ 住建局 API 不提供**

所有住建局 API 只返回已发预售证的项目。无未上市/即将入市端点。

**替代方案：** 土拍成交公示（规自局 `ghzy.sz.gov.cn`）、施工许可公示、开发商官宣、第三方媒体聚合。

---

## 汇总：缺口闭合路线图

| 缺口 | 之前状态 | API 调研后 | 闭合方案 |
|------|---------|-----------|---------|
| 户内面积/分摊面积/得房率 | ❌ 硬缺口 | ✅ **API 已有** | 加列+改抓取器，1-2 天 |
| 按套内面积单价 | 未发现 | ✅ **API 已有** | 同上 |
| 物业费 | ❌ 硬缺口 | ⚠️ **可能可抓** | 激活死代码 `upsert_permit_project_info` |
| 装修 | ❌ 硬缺口 | ❌ **确认无** | 第三方数据或暂时隐藏 |
| 车位比 | ❌ 硬缺口 | ❌ **确认无** | 规自局或其他数据源 |
| 容积率 | ❌ 硬缺口 | ❌ **确认无** | 规自局或其他数据源 |
| 即将入市 | ❌ 硬缺口 | ❌ **确认无** | 需要全新数据管道 |

---

## 更新后的逐页评估

### Screen 1: 行情 → 95% ✅（不变）
### Screen 2: 找房 → 85%（装修仍缺）
### Screen 3: 楼盘详情 → 85% ⬆（户内面积/得房率可补，仅车位比/容积率仍缺）
### Screen 4: 同板块对比 → 75% ⬆（得房率可补，装修+物业费仍缺）
### Screen 5: 即将入市 → 0%（不变，需新管道）
### Screen 6: 单套详情 → 90% ⬆（户内面积/分摊面积/套内单价均可补，仅物业费仍缺）
### Screen 7: 房贷计算 → 100%（不变）

---

## 建议优先级

| 优先级 | 行动 | 工作量 | 影响 |
|--------|------|--------|------|
| P0 | 户内面积+分摊面积+套内单价 → 加列+改抓取器+重跑全量 | 1-2 天 | 解锁 3 个页面关键数据 |
| P1 | 激活物业费抓取 | 1 天 | 解锁详情页物业费 |
| P1 | 新增 3 个聚合端点（项目去化率/楼栋去化率/项目均价） | 2 天 | 解锁列表+详情页核心指标 |
| P2 | 装修数据补源（贝壳/链家爬取） | 3-5 天 | 解锁筛选+对比功能 |
| P2 | 车位比/容积率补源 | 2-3 天 | 解锁详情页 6 格面板完整度 |
| P3 | 即将入市数据管道 | 1-2 周 | 解锁整页 |
