const api = require('../../utils/api');
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
    followCount: 0,
    followMax: 3,
    openid: '',
    loading: true
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    const openid = app.globalData.openid;
    this.setData({ openid: openid || '', loading: true });

    // 加载会员信息
    if (openid) {
      try {
        const data = await api.getUserTier(openid);
        const tier = data.tier || 'free';
        const limits = data.limits || {};
        const labels = { free: '免费用户', pro: '专业版会员', team: '团队版会员' };
        this.setData({
          tier,
          tierLabel: labels[tier] || '免费用户',
          searchesUsed: data.searches_used || 0,
          searchesMax: limits.searches || 20,
          postersUsed: data.posters_used || 0,
          postersMax: limits.posters || 3,
          followMax: limits.follows || 3,
        });
      } catch (e) { /* ignore */ }
    }

    // 加载关注数
    if (openid) {
      try {
        const data = await api.getMySubscriptions(openid);
        this.setData({ followCount: (data.subscriptions || []).length });
      } catch (e) { /* ignore */ }
    }

    this.setData({ loading: false });
  },

  onUpgrade() {
    wx.navigateTo({ url: '/pages/pay/pay' });
  },

  onOpenSubscriptions() {
    wx.navigateTo({ url: '/pages/subscriptions/subscriptions' });
  },

  onOpenOps() {
    wx.navigateTo({ url: '/pages/ops/ops' });
  }
});
