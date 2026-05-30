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
      this.setData({
        detail: data.detail,
        recent: data.recent || [],
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
  }
});
