const api = require('../../utils/api');

Page({
  data: {
    project: '',
    zone: '',
    items: [],
    highlight: '',
    aiText: '',
    loading: true
  },

  onLoad(opts) {
    const project = decodeURIComponent(opts.project || '');
    this.setData({ project, highlight: project });
    if (project) this.loadData(project);
  },

  async loadData(project) {
    this.setData({ loading: true });
    try {
      const d = await api.getZoneCompare(project);
      const items = (d.items || []).map(item => ({
        ...item,
        avgUnitWan: item.avg_unit ? (item.avg_unit / 10000).toFixed(0) : '--',
        priceMinWan: item.price_min ? (item.price_min / 10000).toFixed(0) : '--',
        priceMaxWan: item.price_max ? (item.price_max / 10000).toFixed(0) : '--',
        priceRange: item.price_min ? (item.price_min / 10000).toFixed(0) + '~' + (item.price_max / 10000).toFixed(0) + '万' : '--',
        areaRange: item.area_min ? item.area_min.toFixed(0) + '~' + item.area_max.toFixed(0) + '㎡' : '--',
        passDateShort: item.pass_date ? item.pass_date.slice(5) : '--'
      }));
      this.setData({ items, zone: d.zone || '', loading: false });
      this.genAiText(items);
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  genAiText(items) {
    if (items.length < 2) return;
    const top = items.reduce((a, b) => a.pct > b.pct ? a : b);
    const low = items.reduce((a, b) => a.avg_unit < b.avg_unit ? a : b);
    const high = items.reduce((a, b) => a.avg_unit > b.avg_unit ? a : b);
    const text = `${top.project_name}在本片区去化率领先（${top.pct}%），均价${high.avgUnitWan}万/㎡的${high.project_name}价格最高，${low.project_name}均价最低（${low.avgUnitWan}万/㎡），价差明显。`;
    this.setData({ aiText: text });
  },

  onShareAppMessage() {
    return { title: '深圳新房同板块对比', path: '/pages/compare/compare?project=' + encodeURIComponent(this.data.project) };
  }
});
