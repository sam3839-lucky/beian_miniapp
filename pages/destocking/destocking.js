const api = require('../../utils/api');
const { preparePayload } = require('../../utils/destocking');

Page({
  data: {
    loading: true,
    error: '',
    empty: false,
    dataAsOf: '',
    citywide: null,
    districts: [],
  },

  onLoad() {
    return this.loadData();
  },

  onPullDownRefresh() {
    return this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true, error: '', empty: false });
    try {
      const payload = await api.getNewHouseDestocking();
      const prepared = preparePayload(payload);
      const empty = !prepared.citywide && prepared.districts.length === 0;
      this.setData({
        loading: false,
        empty,
        dataAsOf: payload && payload.data_as_of ? payload.data_as_of : '',
        citywide: prepared.citywide,
        districts: prepared.districts,
      });
    } catch (error) {
      console.error('new house destocking load failed', error);
      this.setData({ loading: false, error: '暂时无法获取去化周期，请稍后重试', empty: false, citywide: null, districts: [] });
    }
  },

  onRetry() {
    return this.loadData();
  },

  onDistrictTap(event) {
    const index = event && event.currentTarget && event.currentTarget.dataset.index;
    const item = this.data.districts[index];
    if (!item || !item.district_name) return;
    const app = getApp();
    app.globalData.filterParams = { zone: item.district_name };
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    return {
      title: '深圳新房去化周期（最近90天）',
      path: '/pages/destocking/destocking',
    };
  },
});
