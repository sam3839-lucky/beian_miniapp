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
      this.setData({ summary: s, trends: trendsLabeled, districts, dailyItems: recent.items || [], loading: false });
      this.drawDonut(summary);
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
    this.setData({ trends: labeled });
  },

  drawDonut(s) {
    if (!s || !s.this_month) return;
    const q = wx.createSelectorQuery();
    q.select('#donutCanvas').fields({ node: true, size: true }).exec(res => {
      if (!res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const w = 200;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
      ctx.scale(dpr, dpr);

      const cx = 100, cy = 100, r = 70, sw = 22;
      const n = s.this_month.new, u = s.this_month.used, t = n + u;
      ctx.clearRect(0, 0, w, w);

      // 二手（底层，从12点顺时针）
      const usedAngle = (u / t) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + usedAngle);
      ctx.lineWidth = sw;
      ctx.strokeStyle = '#FF8C00';
      ctx.stroke();

      // 一手（上层，接着二手继续）
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2 + usedAngle, Math.PI * 1.5);
      ctx.lineWidth = sw;
      ctx.strokeStyle = '#07C160';
      ctx.stroke();

      // 中心文字
      ctx.fillStyle = '#333';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t + '', cx, cy - 8);
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.fillText('总套数', cx, cy + 20);
    });
  },

  onRetry() { this.loadAll(); },
});
