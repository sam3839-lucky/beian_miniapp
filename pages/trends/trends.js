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
      // 预处理月份标签：跨年时显示年份，否则只显示月份
      const years = new Set((trends.trends || []).map(t => t.month.split('-')[0]));
      const crossYear = years.size > 1;
      const trendsLabeled = (trends.trends || []).map(t => {
        const [y, m] = t.month.split('-');
        return { ...t, monthLabel: crossYear ? y.slice(2) + '/' + m : m + '月' };
      });
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
      const raw = data.trends || [];
      const years = new Set(raw.map(t => t.month.split('-')[0]));
      const crossYear = years.size > 1;
      const labeled = raw.map(t => {
        const [y, m] = t.month.split('-');
        return { ...t, monthLabel: crossYear ? y.slice(2) + '/' + m : m + '月' };
      });
      this.setData({ trends: labeled });
    } catch (e) { /* keep existing data */ }
  },

  onRetry() { this.loadAll(); },
});
