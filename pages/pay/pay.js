const app = getApp();

Page({
  data: {
    tier: 'free',      // free | pro | team
    billing: 'monthly', // monthly | yearly
    monthlyPrice: 29,
    yearlyPrice: 199,
    features: [
      { name: '瞬搜查价', free: '20次/天', pro: '无限', team: '无限' },
      { name: '房源详情', free: '10次/天', pro: '无限', team: '无限' },
      { name: '分享海报', free: '3张/天', pro: '无限', team: '无限' },
      { name: '成交分析', free: '近3月', pro: '近12月', team: '全部+导出' },
      { name: '关注项目', free: '3个', pro: '10个', team: '30个' },
      { name: '推送通知', free: '每周1次', pro: '即时推送', team: '即时推送' },
      { name: '数据导出', free: '-', pro: 'Excel', team: 'Excel+API' },
      { name: '团队共享', free: '-', pro: '-', team: '5个账号' }
    ]
  },

  onLoad() {
    const tier = app.globalData.tier || 'free';
    this.setData({ tier });
  },

  onSwitchBilling(e) {
    const billing = e.currentTarget.dataset.billing;
    this.setData({ billing });
  },

  onCopyWechat() {
    wx.setClipboardData({
      data: 'bogelsf',
      success: () => wx.showToast({ title: '已复制微信号，去微信添加', icon: 'none', duration: 2000 })
    });
  }
});
