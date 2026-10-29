const app = getApp();

Page({
  data: {
    tier: 'free',
    tierLabel: '免费用户',
    expireText: '',
    searchesUsed: 0,
    searchesMax: 20,
    postersUsed: 0,
    postersMax: 3,
    followsCount: 0,
    followsMax: 3,
    benefits: [
      { name: '无限搜索', free: false, pro: true, team: true },
      { name: '无限海报', free: false, pro: true, team: true },
      { name: '关注 10 个项目', free: false, pro: true, team: true },
      { name: '12月成交分析', free: false, pro: true, team: true },
      { name: 'Excel 数据导出', free: false, pro: true, team: true },
      { name: '即时推送通知', free: false, pro: true, team: true },
      { name: '团队账号共享', free: false, pro: false, team: true },
    ]
  },

  onShow() {
    const tier = app.globalData.tier || 'free';
    const labels = { free: '免费用户', pro: '专业版会员', team: '团队版会员' };
    this.setData({
      tier,
      tierLabel: labels[tier] || '免费用户',
    });
    // TODO: 从 API 加载实际用量
  },

  onUpgrade() {
    wx.navigateTo({ url: '/pages/pay/pay' });
  },

  onShareAppMessage() {
    return {
      title: '深圳备案价查询 - 会员中心',
      path: '/pages/member/member'
    };
  },
});
