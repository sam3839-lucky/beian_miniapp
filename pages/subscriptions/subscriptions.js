const api = require('../../utils/api');

Page({
  data: {
    subscriptions: [],
    loading: true,
    error: false
  },

  onShow() {
    this.loadSubscriptions();
  },

  async loadSubscriptions() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      this.setData({ loading: false, error: false });
      return;
    }
    this.setData({ loading: true, error: false });
    try {
      const data = await api.getMySubscriptions(openid);
      this.setData({
        subscriptions: data.subscriptions || [],
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false, error: true });
    }
  },

  onTapProject(e) {
    const { project, zone } = e.currentTarget.dataset;
    const app = getApp();
    app.globalData.filterParams = { project, zone };
    wx.switchTab({ url: '/pages/index/index' });
  },

  async onUnsubscribe(e) {
    const project = e.currentTarget.dataset.project;
    const openid = getApp().globalData.openid;
    if (!openid) return;
    try {
      await api.unsubscribe(openid, project);
      const subs = this.data.subscriptions.filter(s => s.project_name !== project);
      this.setData({ subscriptions: subs });
      wx.showToast({ title: '已取消关注', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onRetry() {
    this.loadSubscriptions();
  },

  onShareAppMessage() {
    return {
      title: '深圳备案价查询 - 订阅管理',
      path: '/pages/subscriptions/subscriptions'
    };
  },
});
