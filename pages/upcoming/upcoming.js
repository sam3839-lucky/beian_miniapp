const api = require('../../utils/api');

Page({
  data: {
    zones: ['所有区'],
    zoneIdx: 0,
    items: [],
    loading: true
  },

  onLoad() {
    this.loadZones();
    this.loadData();
  },

  async loadZones() {
    try {
      const d = await api.getZones();
      this.setData({ zones: ['所有区', ...(d.zones || [])] });
    } catch (e) { /* */ }
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const zone = this.data.zoneIdx > 0 ? this.data.zones[this.data.zoneIdx] : '';
      const d = await api.getUpcoming(zone);
      const items = (d.items || []).map(item => ({
        ...item,
        avgUnitWan: item.avg_unit ? (item.avg_unit / 10000).toFixed(1) : '--'
      }));
      this.setData({ items, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onZoneChange(e) {
    this.setData({ zoneIdx: parseInt(e.detail.value) });
    this.loadData();
  },

  onItemTap(e) {
    const pn = e.currentTarget.dataset.project;
    if (pn) wx.navigateTo({ url: '/pages/index/index?project=' + encodeURIComponent(pn) });
  },

  onShareAppMessage() {
    return { title: '深圳即将入市新房', path: '/pages/upcoming/upcoming' };
  }
});
