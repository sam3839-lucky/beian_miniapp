---
paths: ["pages/**"]
---
# 微信小程序开发规则
- WXML 表达式不能调用 JS 函数，Math.round/Array.map 在 JS 层预处理
- Canvas 统一用 wx.createCanvasContext(id, this)，不要用 type="2d" node API
- 新增页面必须在 app.json 的 pages 数组中注册
- API 请求走统一封装，baseUrl 从 app.globalData 读取
- 颜色用设计 token: 主绿 #07C160, 二手橙 #FF8C00, 价格红 #FF4D4F
- 文字 #333 / #888 / #A8A8A8, 背景 #F7F7F7, 卡片 #fff
- 间距 rpx: 页面 32rpx, 卡片内 24rpx, 卡片间 12-16rpx
- 数据来源: https://ruiheqi.cn/api/
- 所有页面必须实现 onShareAppMessage()：返回 { title: 页面标题, path: 页面路径 }。新建页面时自动添加。
