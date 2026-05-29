const API_BASE = 'https://ruiheqi.cn/api/resale';

Page({
  data: {
    community: '',
    stats: {},
    trend: [],
    layouts: [],
    recent: [],
    maxLayoutCnt: 1,
    loading: true,
    error: false
  },

  onLoad(options) {
    const community = decodeURIComponent(options.community || '');
    if (community) {
      this.setData({ community });
      wx.setNavigationBarTitle({ title: community });
      this.loadData();
    } else {
      this.setData({ loading: false, error: true });
    }
  },

  async loadData() {
    this.setData({ loading: true, error: false });
    try {
      const res = await this.request('/community/' + encodeURIComponent(this.data.community));
      const s = res.stats || {};
      const layouts = res.layouts || [];
      const maxCnt = layouts.length ? layouts[0].cnt : 1;

      this.setData({
        stats: {
          total: s.total || 0,
          avgPrice: s.avg_price ? s.avg_price + '万' : '--',
          avgUnit: s.avg_unit ? (s.avg_unit / 10000).toFixed(1) + '万' : '--',
          avgArea: s.avg_area ? s.avg_area + '㎡' : '--',
          earliest: s.earliest ? s.earliest.substring(0, 10) : '--',
          latest: s.latest ? s.latest.substring(0, 10) : '--'
        },
        trend: res.trend || [],
        layouts,
        recent: (res.recent || []).slice(0, 10),
        maxLayoutCnt: maxCnt,
        loading: false
      }, () => {
        if (res.trend && res.trend.length) this.drawTrendChart();
      });
    } catch (e) {
      console.error('loadData error:', e);
      this.setData({ loading: false, error: true });
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

  drawTrendChart() {
    const trend = this.data.trend;
    if (!trend.length) return;
    const q = wx.createSelectorQuery().in(this);
    q.select('.chart-canvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = 200;

      const ctx = wx.createCanvasContext('overviewCanvas', this);
      const pad = { top: 16, right: 16, bottom: 32, left: 44 };
      const pw = w - pad.left - pad.right;
      const ph = h - pad.top - pad.bottom;

      const prices = trend.map(t => parseFloat(t.avg_price) || 0).filter(p => p > 0);
      if (!prices.length) { ctx.draw(); return; }

      const maxP = Math.max(...prices) * 1.1;
      const minP = Math.min(...prices) * 0.9;
      const range = maxP - minP || 1;

      // grid
      ctx.setFillStyle('#999');
      ctx.setFontSize(9);
      ctx.setTextAlign('right');
      for (let i = 0; i <= 3; i++) {
        const y = pad.top + ph * (i / 3);
        const val = maxP - range * (i / 3);
        ctx.fillText(Math.round(val / 1000) + 'k', pad.left - 4, y + 3);
        ctx.setStrokeStyle('#f0f0f0');
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
      }

      // line
      const stepX = pw / Math.max(trend.length - 1, 1);
      ctx.beginPath();
      ctx.setStrokeStyle('#FF8C00');
      ctx.setLineWidth(2);
      let first = true;
      const points = [];
      trend.forEach((t, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + ph * (1 - (parseFloat(t.avg_price) - minP) / range);
        points.push({ x, y, month: t.month });
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // fill area under line
      if (points.length > 0) {
        ctx.setFillStyle('rgba(255,140,0,0.08)');
        const last = points[points.length - 1];
        ctx.lineTo(last.x, pad.top + ph);
        ctx.lineTo(pad.left, pad.top + ph);
        ctx.closePath();
        ctx.fill();
      }

      // dots + labels
      ctx.setTextAlign('center');
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.setFillStyle('#FF8C00');
        ctx.fill();

        if (i % 2 === 0) {
          ctx.setFillStyle('#999');
          ctx.setFontSize(9);
          ctx.fillText(p.month || '', p.x, h - 6);
        }
      });

      ctx.draw();
    });
  },

  onViewAll() {
    wx.navigateTo({
      url: '/pages/history-result/history-result?community=' + encodeURIComponent(this.data.community)
    });
  },

  onRetry() {
    this.loadData();
  }
});
