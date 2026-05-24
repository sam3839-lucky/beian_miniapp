const api = require('../../utils/api');

Page({
  data: {
    range: 6,
    ranges: [
      { label: '近3个月', value: 3 },
      { label: '近6个月', value: 6 },
      { label: '近12个月', value: 12 }
    ],
    summary: null,
    trends: [],
    dailyItems: [],
    loading: true,
    error: false
  },

  onShow() {
    if (!this._loaded) {
      this._loaded = true;
      this.loadAll();
    }
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  onRangeTap(e) {
    const v = parseInt(e.currentTarget.dataset.value);
    this.setData({ range: v });
    this.loadTrends(v);
  },

  async loadAll() {
    this.setData({ loading: true, error: false });
    try {
      const [summary, trends, recent] = await Promise.all([
        api.getTransactionSummary(),
        api.getTransactionTrends(this.data.range),
        api.getRecentTransactions(30)
      ]);
      // 预处理月份标签（WXML 不支持 substring）
      const trendsLabeled = (trends.trends || []).map(t => ({
        ...t,
        monthLabel: t.month.split('-')[1] + '月'
      }));
      this.setData({
        summary, trends: trendsLabeled,
        dailyItems: recent.items || [],
        loading: false
      });
    } catch (e) {
      console.error('trends load failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  async loadTrends(months) {
    try {
      const data = await api.getTransactionTrends(months);
      const labeled = (data.trends || []).map(t => ({
        ...t,
        monthLabel: t.month.split('-')[1] + '月'
      }));
      this.setData({ trends: labeled });
    } catch (e) { /* keep existing data */ }
  },

  onRetry() { this.loadAll(); },
});
