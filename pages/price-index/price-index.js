const api = require('../../utils/api');

Page({
  data: {
    cities: ['深圳','北京','上海','广州','成都','杭州','南京','武汉','西安','重庆'],
    cityIdx: 0,
    timeRange: 36,   // 默认3年
    timeRanges: [12, 36, 60, 120, 0],  // 0=全部
    timeLabels: ['1年','3年','5年','10年','全部'],
    timeIdx: 1,      // 默认3年
    items: [],
    hasVolume: false,
    // KPI
    kpiNewMom: '--', kpiNewYoy: '--', kpiUsedMom: '--', kpiUsedYoy: '--',
    kpiNewCumul: '--', kpiUsedCumul: '--',
    cumulStart: '',
    // 面积段
    areaNew90: {}, areaNew90_144: {}, areaNew144: {},
    aiText: '',
    loading: true
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const city = this.data.cities[this.data.cityIdx];
      const months = this.data.timeRanges[this.data.timeIdx] || 100;
      const d = await api.getPriceVolume(city, months);
      this.setData({ items: d.items, hasVolume: d.has_volume || false, loading: false });
      this.updateDisplay();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  updateDisplay() {
    const items = this.data.items;
    if (!items.length) return;
    const latest = items[items.length - 1];

    const _dir = (v) => ({
      arrow: v > 100 ? '↑' : v < 100 ? '↓' : '→',
      chg: Math.abs(v - 100).toFixed(1),
      color: v > 100 ? '#FF4D4F' : v < 100 ? '#07C160' : '#888'
    });
    const _yoy = (v) => ({
      arrow: v < 100 ? '↓' : '↑',
      chg: Math.abs(100 - v).toFixed(1)
    });

    const dNew = _dir(latest.new.mom || 100);
    const dUsed = _dir(latest.used.mom || 100);
    const yNew = _yoy(latest.new.yoy || 100);
    const yUsed = _yoy(latest.used.yoy || 100);

    // 累积值：以起始月为100，逐月乘环比
    let newCumul = 100, usedCumul = 100;
    const startMonth = items[0].month;
    for (const item of items) {
      if (item.new.mom) newCumul = Math.round(newCumul * item.new.mom / 100 * 10) / 10;
      if (item.used.mom) usedCumul = Math.round(usedCumul * item.used.mom / 100 * 10) / 10;
    }
    const newDelta = (newCumul - 100).toFixed(1);
    const usedDelta = (usedCumul - 100).toFixed(1);

    // 面积段
    const area90 = latest.new_90 || {};
    const area144 = latest.new_90_144 || {};
    const area144p = latest.new_144 || {};
    [area90, area144, area144p].forEach(a => {
      a.dirArrow = (a.yoy || 0) < 100 ? '↓' : '↑';
      a.dirChg = Math.abs(100 - (a.yoy || 0)).toFixed(1);
    });
    const areaNoteChg = Math.abs(100 - (area144.yoy || 0)).toFixed(1);

    this.setData({
      kpiNewMom: latest.new.mom || '--',
      kpiNewYoy: latest.new.yoy || '--',
      kpiNewArrow: dNew.arrow, kpiNewChg: dNew.chg, kpiNewDirColor: dNew.color,
      kpiNewYoyArrow: yNew.arrow, kpiNewYoyChg: yNew.chg,
      kpiUsedMom: latest.used.mom || '--',
      kpiUsedYoy: latest.used.yoy || '--',
      kpiUsedArrow: dUsed.arrow, kpiUsedChg: dUsed.chg, kpiUsedDirColor: dUsed.color,
      kpiUsedYoyArrow: yUsed.arrow, kpiUsedYoyChg: yUsed.chg,
      kpiNewCumul: newDelta > 0 ? '+' + newDelta + '%' : newDelta + '%',
      kpiUsedCumul: usedDelta > 0 ? '+' + usedDelta + '%' : usedDelta + '%',
      cumulStart: startMonth,
      areaNew90: area90,
      areaNew90_144: area144,
      areaNew144: area144p,
      areaNoteChg: areaNoteChg,
    });

    this.genAiText(items);
  },

  genAiText(items) {
    if (items.length < 6) return;
    const recent = items.slice(-6);
    const momVals = recent.map(i => i.new.mom).filter(v => v);
    const stable = momVals.filter(v => v >= 99.5 && v <= 100.5).length;
    const latest = items[items.length - 1];
    const city = this.data.cities[this.data.cityIdx];
    const parts = [];
    parts.push(`${city}新房价格指数自${items[0].month.slice(0,7)}以来持续跟踪。`);
    if (stable >= 4) parts.push(`近${momVals.length}个月中有${stable}个月环比在100附近，处于企稳筑底阶段。`);
    if (latest.used && latest.used.mom && latest.used.mom > 100) {
      parts.push(`二手房${latest.month.slice(5)}月环比${latest.used.mom}，出现反弹信号。`);
    }
    if (this.data.hasVolume) {
      parts.push('成交量方面，近3个月新房和二手房成交量温和放大，是价格企稳的前置信号。');
    }
    this.setData({ aiText: parts.join('') });
  },

  onCityChange(e) {
    this.setData({ cityIdx: parseInt(e.detail.value) });
    this.loadData();
  },

  onTimeTap(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({ timeIdx: idx, timeRange: this.data.timeRanges[idx] });
    this.loadData();
  },

  onShareAppMessage() {
    return {
      title: '全国房价指数查询',
      path: '/pages/price-index/price-index'
    };
  }
});
