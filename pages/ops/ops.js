const api = require('../../utils/api');

Page({
  data: {
    status: null,
    loading: true,
    error: false
  },

  onLoad() {
    this.loadStatus();
  },

  onPullDownRefresh() {
    this.loadStatus().finally(() => wx.stopPullDownRefresh());
  },

  async loadStatus() {
    this.setData({ loading: true, error: false });
    try {
      const data = await api.getAdminStatus();
      // 转换 statuses 对象为数组供 wx:for 使用
      const statusList = Object.entries(data.statuses || {}).map(([k, v]) => ({ key: k, count: v }));
      const order = ['未售', '已网签', '已备案', '已转移登记'];
      statusList.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
      this.setData({ status: data, statusList, loading: false });
    } catch (e) {
      console.error('admin status load failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  onRetry() {
    this.loadStatus();
  }
});
