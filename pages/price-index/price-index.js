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
      // 10s 超时保护
      const d = await Promise.race([
        api.getPriceVolume(city, months),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      ]);
      this.setData({ items: d.items, hasVolume: d.has_volume || false, loading: false });
      this.updateDisplay();
    } catch (e) {
      console.error('price-index load failed', e);
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
    // 延迟画图，等 DOM 渲染完
    setTimeout(() => {
      console.log('drawChart start, items:', this.data.items.length, 'hasVolume:', this.data.hasVolume);
      try { this.drawChart(); } catch(e) { console.error('drawChart err:', e); }
      try { this.drawVolChart(); } catch(e) { console.error('drawVolChart err:', e); }
    }, 500);
  },

  drawChart() {
    const items = this.data.items;
    if (!items.length) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#trendCanvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || 160;
      const ctx = wx.createCanvasContext('trendCanvas', this);
      const pad = { top: 8, right: 40, bottom: 18, left: 32 };
      const pw = w - pad.left - pad.right;
      const ph = h - pad.top - pad.bottom;

      // 计算累积值序列
      const n = items.length;
      let newC = 100, usedC = 100;
      const newVals = [], usedVals = [], moms = [];
      for (const item of items) {
        if (item.new.mom) newC = newC * item.new.mom / 100;
        if (item.used.mom) usedC = usedC * item.used.mom / 100;
        newVals.push(newC);
        usedVals.push(usedC);
        moms.push(item.new.mom || 100);
      }

      // Y轴范围
      const allVals = [...newVals, ...usedVals];
      const yMin = Math.floor(Math.min(...allVals, 90) - 1);
      const yMax = Math.ceil(Math.max(...allVals, 105) + 1);
      const yRange = yMax - yMin;
      const toY = (v) => pad.top + ph * (1 - (v - yMin) / yRange);
      const toX = (i) => pad.left + (pw / (n - 1)) * i;
      const gap = pw / n;

      // 背景色块
      for (let i = 0; i < n; i++) {
        const x = pad.left + gap * i;
        const mom = moms[i];
        ctx.setFillStyle(mom >= 100 ? 'rgba(7,193,96,0.15)' : 'rgba(255,77,79,0.12)');
        ctx.fillRect(x, pad.top, gap, ph);
      }

      // 基准线 100
      const y100 = toY(100);
      ctx.setStrokeStyle('#E5E5E5');
      ctx.setLineWidth(1);
      ctx.beginPath(); ctx.moveTo(pad.left, y100); ctx.lineTo(w - pad.right, y100); ctx.stroke();

      // Y轴标签
      ctx.setFillStyle('#BBB'); ctx.setFontSize(9); ctx.setTextAlign('right');
      for (let v = Math.floor(yMin); v <= Math.ceil(yMax); v += 2) {
        ctx.fillText(v + '', pad.left - 4, toY(v) + 3);
      }

      // X轴月份标签（每N个显示一个，跨年处标年份）
      ctx.setTextAlign('center'); ctx.setFillStyle('#BBB'); ctx.setFontSize(8);
      const step = Math.max(1, Math.floor(n / 6));
      let lastYear = '';
      for (let i = 0; i < n; i += step) {
        const m = items[i].month;
        const label = m.slice(2, 4) + '/' + m.slice(5, 7); // "25/05"
        ctx.fillText(label, toX(i), h - 4);
        // 每年1月标年份
        if (m.slice(5,7) === '01' || (i === 0 && m.slice(0,4) !== lastYear)) {
          ctx.setFillStyle('#999'); ctx.setFontSize(9);
          ctx.fillText(m.slice(0,4), toX(i), h - 13);
          ctx.setFillStyle('#BBB'); ctx.setFontSize(8);
          lastYear = m.slice(0,4);
        }
      }

      // 新房累积线
      ctx.setStrokeStyle('#07C160'); ctx.setLineWidth(2); ctx.setLineCap('round');
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = toY(newVals[i]), x = toX(i);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 二手累积线
      ctx.setStrokeStyle('#FF8C00'); ctx.setLineWidth(2); ctx.setLineCap('round');
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = toY(usedVals[i]), x = toX(i);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 终点数值标注
      const lastIdx = n - 1;
      ctx.setFillStyle('#07C160'); ctx.setFontSize(10); ctx.setTextAlign('left');
      ctx.fillText(newVals[lastIdx].toFixed(1), toX(lastIdx) + 4, toY(newVals[lastIdx]) + 3);
      ctx.setFillStyle('#FF8C00');
      ctx.fillText(usedVals[lastIdx].toFixed(1), toX(lastIdx) + 4, toY(usedVals[lastIdx]) + 3);

      ctx.draw();
    });
  },

  drawVolChart() {
    if (!this.data.hasVolume) return;
    const items = this.data.items || [];
    const withVol = items.filter(i => i.volume);
    if (withVol.length < 1) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('#volCanvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || 100;
      const ctx = wx.createCanvasContext('volCanvas', this);
      const pad = { top: 4, right: 8, bottom: 14, left: 32 };
      const pw = w - pad.left - pad.right;
      const ph = h - pad.top - pad.bottom;

      const n = withVol.length;
      const gap = pw / n;
      const barW = gap * 0.35;

      // 找最大值
      let maxV = 1;
      for (const item of withVol) {
        maxV = Math.max(maxV, item.volume.new || 0, item.volume.used || 0);
      }
      maxV = Math.ceil(maxV * 1.15);

      // 新房成交量柱
      for (let i = 0; i < n; i++) {
        const x = pad.left + gap * i + gap * 0.15;
        const v = withVol[i].volume.new || 0;
        const barH = (v / maxV) * ph;
        ctx.setFillStyle('#E8F8EE');
        ctx.fillRect(x, pad.top + ph - barH, barW, barH);
      }

      // 二手房成交量柱
      for (let i = 0; i < n; i++) {
        const x = pad.left + gap * i + gap * 0.5;
        const v = withVol[i].volume.used || 0;
        const barH = (v / maxV) * ph;
        ctx.setFillStyle('#FFF3E6');
        ctx.fillRect(x, pad.top + ph - barH, barW, barH);
      }

      // X轴月份（每2个显示一次，空间有限）
      ctx.setFillStyle('#BBB'); ctx.setFontSize(7); ctx.setTextAlign('center');
      const vstep = Math.max(1, Math.floor(n / 8));
      for (let i = 0; i < n; i += vstep) {
        const x = pad.left + gap * i + gap / 2;
        const m = withVol[i].month;
        ctx.fillText(m.slice(2,4)+'/'+m.slice(5,7), x, h - 2);
      }

      // Y轴参考线
      ctx.setStrokeStyle('#F0F0F0'); ctx.setLineWidth(1);
      ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(w - pad.right, pad.top + ph); ctx.stroke();

      ctx.draw();
    });
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

  onOpenCitySelect() {
    wx.navigateTo({ url: '/pages/city-select/city-select' });
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
