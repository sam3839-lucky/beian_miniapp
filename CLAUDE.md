# beian_miniapp — 深圳在售房源备案价格查询

WeChat 小程序，查询深圳市住建局公示的一手房备案价。用户按区域→项目→楼栋筛选，按价格/面积范围过滤，查看每套房源的备案价、面积、状态。

## 架构

```
小程序前端 (WeChat Mini Program)
  ├── pages/index      搜索+筛选+房源列表
  ├── pages/detail     房源详情
  ├── components/       price-card(房源卡片) + range-filter(筛选标签)
  └── utils/api.js     API 客户端 → https://ruiheqi.cn

后端 (ruiheqi.cn)
  ├── GET /api/zones            区域列表
  ├── GET /api/projects         按区域查项目
  ├── GET /api/buildings        按项目查楼栋
  ├── GET /api/units            按条件查房源
  ├── GET /api/stats            统计(总数/已售/未售)
  └── POST /api/wx-login        微信登录(换openid，当前未使用)

数据管道 (sync/)
  sync_units.py      → 全量爬取深圳住建局 getYsfXsPublicity (~38.6万条)
  sync_permits.py    → 全量爬取预售证 getYsfYsPublicity (~4400条)
  match_projects.py  → 三级匹配：楼栋名前缀 → 开发商名 → 宗地号
  rebuild_db.py      → 表切换(≥30万条才允许)+建索引
  sync_daily.py      → 每日增量同步(Cron: 0 6 * * *)
```

## 后端地址

- API: `https://ruiheqi.cn`
- 数据源: `fdc.zjj.sz.gov.cn` (深圳住建局，SSL 在 Ubuntu 上失败，仅 macOS 可跑全量同步)

## 关键约定

- 价格单位：接口内部用"元"，前端展示用"万"（`utils/api.js` 请求时 ×10000 转换）
- 筛选标签点第二次取消选中回到"全部"
- 房源按楼层分组排序（高楼层在前）
- 详情页状态硬编码"可售"——这是已知 bug，未修

## 数据同步注意事项

- 全量同步靠 macOS（SSL 兼容性），增量同步可跑 Ubuntu
- 每页 200 条，全量约 1935 页，5 次连续报错退出（支持 resume）
- rebuild_db 有 30 万行安全阈值，低于此数拒绝覆盖
- 数据库: `sync/property_new.db` (74MB, SQLite, WAL 模式)
