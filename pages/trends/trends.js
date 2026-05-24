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
    zoneRanking: [],
    items: [],
    hasMore: true,
    nextCursor: '',
    loading: true,
    loadingMore: false,
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
        api.getRecentTransactions('', 20, '')
      ]);
      // 从 recent 数据中提取区域排名
      const zoneRanking = this.buildZoneRanking(recent.items);
      this.setData({
        summary, trends,
        zoneRanking,
        items: recent.items,
        hasMore: recent.has_more,
        nextCursor: recent.next_cursor || '',
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
      this.setData({ trends: data.trends || [] });
    } catch (e) { /* keep existing data */ }
  },

  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    try {
      const data = await api.getRecentTransactions(this.data.nextCursor, 20, '');
      this.setData({
        items: [...this.data.items, ...data.items],
        hasMore: data.has_more,
        nextCursor: data.next_cursor || '',
        loadingMore: false
      });
    } catch (e) {
      this.setData({ loadingMore: false });
    }
  },

  buildZoneRanking(items) {
    const map = {};
    items.forEach(item => {
      if (!map[item.zone]) map[item.zone] = { zone: item.zone, count: 0, totalPrice: 0 };
      map[item.zone].count++;
      map[item.zone].totalPrice += item.total_price;
    });
    return Object.values(map)
      .map(z => ({ ...z, avgPrice: Math.round(z.totalPrice / z.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  },

  onRetry() { this.loadAll(); },

  onReachBottom() { this.loadMore(); },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item;
    getApp().globalData.detailUnit = { unit: item, project: item.project_name, building: item.building_name };
    wx.navigateTo({ url: '/pages/detail/detail' });
  }
});
