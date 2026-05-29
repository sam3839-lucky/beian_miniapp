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
    districts: null,
    dailyItems: [],
    trendMax: 1,
    salesRanks: [],
    salesZones: [],
    salesZone: '',
    salesLoading: false,
    loading: true,
    error: false,
    pctFmt: v => (v > 0 ? '+' : '') + v + '%',
    classFmt: v => v > 0 ? 'up' : 'down'
  },

  onShow() {
    if (!this._loaded) { this._loaded = true; this.loadAll(); }
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
      const [summary, trends, districts, recent] = await Promise.all([
        api.getTransactionSummary(),
        api.getTransactionTrends(this.data.range),
        api.getTransactionDistricts(),
        api.getRecentTransactions(14)
      ]);
      const years = new Set((trends.trends || []).map(t => t.month.split('-')[0]));
      const crossYear = years.size > 1;
      const trendsLabeled = (trends.trends || []).map(t => {
        const [y, m] = t.month.split('-');
        return { ...t, monthLabel: crossYear ? y.slice(2) + '/' + m : m + '月' };
      });
      const s = summary;
      if (s && s.this_month) {
        const t = s.this_month.total || 1;
        s.newPct = (s.this_month.new / t * 100).toFixed(1);
        s.usedPct = (s.this_month.used / t * 100).toFixed(1);
      }
      // 格式化标题 "5月" + 最新交易日期 "5月24日"
      if (s && s.this_month) {
        s.monthTitle = s.this_month.month + '月';
      }
      if (s && s.latest_date) {
        const parts = s.latest_date.split('-');
        if (parts.length === 3) {
          s.latestLabel = parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
        }
      }
      const trendMax = Math.max(...trendsLabeled.map(t => t.total), 1);
      this.setData({ summary: s, trends: trendsLabeled, districts, trendMax, dailyItems: recent.items || [], loading: false }, () => {
        this.drawDonut(s);
      });
      this.loadSalesRank('');
    } catch (e) {
      console.error(e); this.setData({ loading: false, error: true });
    }
  },

  async loadTrends(months) {
    const data = await api.getTransactionTrends(months);
    const raw = data.trends || [];
    const years = new Set(raw.map(t => t.month.split('-')[0]));
    const crossYear = years.size > 1;
    const labeled = raw.map(t => {
      const [y, m] = t.month.split('-');
      return { ...t, monthLabel: crossYear ? y.slice(2) + '/' + m : m + '月' };
    });
    this.setData({ trends: labeled, trendMax: Math.max(...labeled.map(t => t.total), 1) });
  },

  drawDonut(s) {
    if (!s || !s.this_month) return;
    const n = s.this_month.new || 0, u = s.this_month.used || 0, t = n + u;
    if (t <= 0) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('.donut-canvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || w;

      const ctx = wx.createCanvasContext('donutCanvas', this);
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35, sw = Math.min(w, h) * 0.11;

      // 二手（橙色，从12点顺时针）
      const usedAngle = (u / t) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + usedAngle);
      ctx.setLineWidth(sw);
      ctx.setStrokeStyle('#FF8C00');
      ctx.stroke();

      // 一手（绿色，接着二手继续）
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2 + usedAngle, Math.PI * 1.5);
      ctx.setLineWidth(sw);
      ctx.setStrokeStyle('#07C160');
      ctx.stroke();

      // 中心文字
      ctx.setFillStyle('#333');
      ctx.setFontSize(Math.round(w * 0.09));
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(t + '', cx, cy - Math.round(h * 0.04));
      ctx.setFillStyle('#888');
      ctx.setFontSize(Math.round(w * 0.06));
      ctx.fillText('总套数', cx, cy + Math.round(h * 0.10));

      ctx.draw();
    });
  },

  onRetry() { this.loadAll(); },

  // ── 销量排行 ──
  async loadSalesRank(zone) {
    const z = zone || '';
    this.setData({ salesZone: z, salesLoading: true });
    try {
      const data = await api.getProjectSalesRank(z, 30);
      this.setData({
        salesRanks: data.ranks || [],
        salesZones: data.zones || [],
        salesLoading: false
      });
    } catch (e) {
      this.setData({ salesLoading: false });
    }
  },

  onSalesZoneTap(e) {
    const zone = e.currentTarget.dataset.zone || '';
    this.loadSalesRank(zone);
  },

  onSalesRankTap(e) {
    const { project, zone } = e.currentTarget.dataset;
    const app = getApp();
    app.globalData.filterParams = { project, zone };
    wx.switchTab({ url: '/pages/index/index' });
  },

  onHistorySearchTap() {
    wx.navigateTo({ url: '/pages/history-search/history-search' });
  }
});
