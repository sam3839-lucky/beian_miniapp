const api = require('../../utils/api');

Page({
  data: {
    detail: null,
    recent: [],
    loading: true,
    error: false,
    notFound: false
  },

  onLoad(options) {
    const id = parseInt(options.id) || 0;
    if (!id) { this.setData({ notFound: true, loading: false }); return; }
    this.loadDetail(id);
  },

  async loadDetail(id) {
    this.setData({ loading: true, error: false });
    try {
      const data = await api.getProjectHistoryDetail(id);
      const d = data.detail || {};
      if (d.unit_price) d._unitPriceWan = (d.unit_price / 10000).toFixed(2);
      if (d.total_price_wan === undefined && d.total_price != null) d.total_price_wan = Number(d.total_price).toFixed(0);
      const recent = (data.recent || []).map(r => ({
        ...r,
        _unitPriceWan: r.unit_price ? (r.unit_price / 10000).toFixed(2) : null,
        total_price_wan: r.total_price_wan || (r.total_price != null ? Number(r.total_price).toFixed(0) : 0)
      }));
      this.setData({
        detail: d,
        recent,
        loading: false
      });
    } catch (e) {
      console.error('loadDetail error:', e);
      this.setData({ loading: false, error: true });
    }
  },

  onViewAll() {
    if (this.data.detail && this.data.detail.project_name) {
      wx.navigateTo({
        url: '/pages/history-result/history-result?project=' +
          encodeURIComponent(this.data.detail.project_name)
      });
    }
  },

  onViewOverview() {
    if (this.data.detail && this.data.detail.project_name) {
      wx.navigateTo({
        url: '/pages/community-overview/overview?community=' +
          encodeURIComponent(this.data.detail.project_name)
      });
    }
  },

  onRetry() {
    const id = this.data.detail ? this.data.detail.id : 0;
    if (id) this.loadDetail(id);
  },

  onBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    const d = this.data.detail;
    const title = d && d.project_name
      ? d.project_name + ' - 成交详情'
      : '深圳二手房成交详情';
    const id = d ? d.id : 0;
    return {
      title,
      path: '/pages/history-detail/history-detail?id=' + id
    };
  },
});
