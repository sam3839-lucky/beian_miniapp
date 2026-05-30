const API_BASE = 'https://ruiheqi.cn/api/resale';

Page({
  data: {
    query: '',
    results: [],
    hot: [],
    zones: [],
    stats: null,
    searched: false,
    loading: false,
    error: false
  },

  onLoad() {
    this.loadMeta();
    this.loadStats();
  },

  async loadMeta() {
    try {
      const res = await this.request('/meta');
      this.setData({
        hot: res.hot || [],
        zones: res.zones || []
      });
    } catch (e) {
      console.error('loadMeta error:', e);
    }
  },

  async loadStats() {
    try {
      const res = await this.request('/stats');
      this.setData({
        stats: {
          totalLabel: (res.total / 10000).toFixed(1) + '万',
          communitiesLabel: res.communities.toLocaleString(),
          avgPriceLabel: res.avg_price + '万'
        }
      });
    } catch (e) {
      console.error('loadStats error:', e);
    }
  },

  request(path) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: API_BASE + path,
        success: res => res.statusCode === 200 ? resolve(res.data) : reject(res),
        fail: reject
      });
    });
  },

  onInput(e) {
    const v = e.detail.value;
    this.setData({ query: v });
    if (this._timer) clearTimeout(this._timer);
    if (!v.trim()) {
      this.setData({ results: [], searched: false });
      return;
    }
    this._timer = setTimeout(() => this.doSearch(v.trim()), 300);
  },

  onClear() {
    this.setData({ query: '', results: [], searched: false });
  },

  async doSearch(q) {
    this.setData({ loading: true, error: false });
    try {
      const res = await this.request('/search?community=' + encodeURIComponent(q) + '&limit=8');
      // group by community, count occurrences
      const cmap = {};
      (res.data || []).forEach(r => {
        if (!cmap[r.community]) cmap[r.community] = { count: 0, unit_price: 0 };
        cmap[r.community].count++;
        if (r.unit_price) cmap[r.community].unit_price = r.unit_price;
      });
      const results = Object.entries(cmap).map(([community, v]) => ({
        community,
        count: v.count,
        avg_price: v.unit_price ? Math.round(v.unit_price / 10000 * 10) / 10 : null
      }));
      this.setData({ results: results.slice(0, 6), searched: true, loading: false });
    } catch (e) {
      console.error('search error:', e);
      this.setData({ loading: false, error: true });
    }
  },

  onSearchConfirm(e) {
    const q = (e && e.detail ? e.detail.value : this.data.query).trim();
    if (!q) return;
    if (this._timer) clearTimeout(this._timer);
    wx.navigateTo({
      url: '/pages/history-result/history-result?community=' + encodeURIComponent(q)
    });
  },

  onResultTap(e) {
    const community = e.currentTarget.dataset.community;
    wx.navigateTo({
      url: '/pages/history-result/history-result?community=' + encodeURIComponent(community)
    });
  },

  onHotTap(e) {
    const community = e.currentTarget.dataset.community;
    wx.navigateTo({
      url: '/pages/history-result/history-result?community=' + encodeURIComponent(community)
    });
  },

  onZoneTap(e) {
    const { zoneId, zoneName } = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/history-result/history-result?district_id=' + zoneId + '&district_name=' + encodeURIComponent(zoneName)
    });
  }
});
