const api = require('../../utils/api');

Page({
  data: {
    range: 12,
    ranges: [
      { label: '近1年', value: 12 },
      { label: '近3年', value: 36 },
      { label: '近5年', value: 60 },
      { label: '近10年', value: 120 }
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
      // 第1阶段：环形图数据（~75ms），先渲染
      const summary = await api.getTransactionSummary();
      const s = summary;
      if (s && s.this_month) {
        const t = s.this_month.total || 1;
        s.newPct = (s.this_month.new / t * 100).toFixed(1);
        s.usedPct = (s.this_month.used / t * 100).toFixed(1);
      }
      if (s && s.this_month) {
        s.monthTitle = s.this_month.month + '月';
      }
      if (s && s.latest_date) {
        const parts = s.latest_date.split('-');
        if (parts.length === 3) {
          s.latestLabel = parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
        }
      }
      this.setData({ summary: s, loading: false }, () => {
        this.drawDonut(s);
      });

      // 第2阶段：走势图+详情（~700ms），并行加载
      const d = await api.getDashboard(this.data.range);
      const rawTrends = d.trends || [];
      this.setData({
        districts: d.districts, dailyItems: d.dailyItems || [],
        salesRanks: d.salesRanks || [], salesZones: d.salesZones || [], salesLoading: false,
      }, () => {
        this.buildAndDrawChart(rawTrends);
      });
    } catch (e) {
      console.error(e); this.setData({ loading: false, error: true });
    }
  },

  async loadTrends(months) {
    const data = await api.getTransactionTrends(months);
    const raw = data.trends || [];
    this.buildAndDrawChart(raw);
  },

  // 按月聚合为 12 个 bucket，每 bucket 取月均值
  buildAndDrawChart(raw) {
    const months = this.data.range;
    const bucketSize = Math.max(1, Math.floor(months / 12));
    const rawLen = raw.length;
    if (!rawLen) return;

    // 取最近 N 个月数据
    const recent = raw.slice(Math.max(0, rawLen - months));

    const buckets = [];
    for (let i = 0; i < recent.length; i += bucketSize) {
      const slice = recent.slice(i, Math.min(i + bucketSize, recent.length));
      const sumNew = slice.reduce((s, t) => s + (t.new || 0), 0);
      const sumUsed = slice.reduce((s, t) => s + (t.used || 0), 0);
      const avgNew = Math.round(sumNew / slice.length);
      const avgUsed = Math.round(sumUsed / slice.length);
      const first = slice[0].month;
      const last = slice[slice.length - 1].month;
      const [y1, m1] = first.split('-');
      const [y2, m2] = last.split('-');
      const label = bucketSize === 1
        ? y1.slice(2) + '/' + m1
        : y1.slice(2) + '/' + m1 + '-' + (y1 === y2 ? '' : y2.slice(2) + '/') + m2;
      buckets.push({ label, n: avgNew, u: avgUsed, total: avgNew + avgUsed });
    }

    // 确保正好 12 个（截断或头部补齐空），反转使横轴从左到右为旧→新
    const final12 = buckets.slice(-12).reverse();
    while (final12.length < 12) {
      final12.push({ label: '', n: 0, u: 0, total: 0 });
    }

    this.setData({ trends: final12, trendMax: 1 }, () => {
      this.drawTrendChart(final12);
    });
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
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.35, sw = Math.min(w, h) * 0.22;

      // 二手（橙色，从12点顺时针）
      const usedAngle = (u / t) * Math.PI * 2;
      const usedPct = (u / t * 100).toFixed(1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + usedAngle);
      ctx.setLineWidth(sw);
      ctx.setStrokeStyle('#FF8C00');
      ctx.stroke();

      // 一手（绿色，接着二手继续）
      const newPct = (n / t * 100).toFixed(1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2 + usedAngle, Math.PI * 1.5);
      ctx.setLineWidth(sw);
      ctx.setStrokeStyle('#07C160');
      ctx.stroke();

      // 环上标注：套数+占比（加粗=重复绘制偏移1px模拟）
      const labelR = r;
      const fs = Math.round(w * 0.071);
      ctx.setFontSize(fs);
      ctx.setTextBaseline('middle');
      function boldText(ctx, text, x, y) {
        ctx.fillText(text, x - 0.5, y);
        ctx.fillText(text, x + 0.5, y);
        ctx.fillText(text, x, y - 0.5);
        ctx.fillText(text, x, y + 0.5);
        ctx.fillText(text, x, y);
      }
      // 二手标签（环的中间偏左，深橙色）
      const uMid = -Math.PI / 2 + usedAngle / 2;
      ctx.setTextAlign('center');
      ctx.setFillStyle('#CC6600');
      boldText(ctx, u + '套', cx + labelR * Math.cos(uMid), cy + labelR * Math.sin(uMid));
      // 一手标签（环的中间偏右，深绿色）
      const nMid = -Math.PI / 2 + usedAngle + (Math.PI * 2 - usedAngle) / 2;
      ctx.setTextAlign('center');
      ctx.setFillStyle('#059048');
      boldText(ctx, n + '套', cx + labelR * Math.cos(nMid), cy + labelR * Math.sin(nMid));

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

  drawTrendChart(data) {
    if (!data || !data.length) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('.trend-canvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const W = res[0].width;
      const H = 200;
      const ctx = wx.createCanvasContext('trendChartCanvas', this);
      const pad = { top: 28, right: 8, bottom: 36, left: 44 };
      const pw = W - pad.left - pad.right;
      const ph = H - pad.top - pad.bottom;
      const maxV = Math.max(...data.map(d => d.n + d.u)) * 1.12 || 1;

      // Y 轴刻度 + 网格
      ctx.setFillStyle('#999');
      ctx.setFontSize(10);
      ctx.setTextAlign('right');
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + ph * (1 - i / 4);
        ctx.fillText(Math.round(maxV * i / 4) + '', pad.left - 6, y + 3);
        ctx.setStrokeStyle('#f0f0f0');
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
      }

      // 坐标轴
      ctx.setStrokeStyle('#ddd');
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top);
      ctx.lineTo(pad.left, pad.top + ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad.left, pad.top + ph);
      ctx.lineTo(W - pad.right, pad.top + ph);
      ctx.stroke();

      // 柱子
      const gap = pw / data.length;
      const barW = gap * 0.55;
      data.forEach((d, i) => {
        const x = pad.left + i * gap + (gap - barW) / 2;
        const hNew = (d.n / maxV) * ph;
        const hUsed = (d.u / maxV) * ph;
        const yBase = pad.top + ph;

        // 一手（绿色底层）
        ctx.setFillStyle('#07C160');
        this._fillRect(ctx, x, yBase - hNew, barW, hNew, 3);

        // 二手（橙色上层）
        ctx.setFillStyle('#FF8C00');
        this._fillRect(ctx, x, yBase - hNew - hUsed, barW, hUsed, 3);

        // 合计数字
        const total = d.n + d.u;
        if (total > 0) {
          ctx.setFillStyle('#333');
          ctx.setFontSize(9);
          ctx.setTextAlign('center');
          ctx.fillText(total + '', x + barW / 2, yBase - hNew - hUsed - 6);
        }

        // X 标签（隔一个标一个）
        if (i % 2 === 0 && d.label) {
          ctx.setFillStyle('#999');
          ctx.setFontSize(9);
          ctx.setTextAlign('center');
          ctx.fillText(d.label, x + barW / 2, H - 6);
        }
      });

      ctx.draw();
    });
  },

  _fillRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    if (r && h > r * 2) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
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
  },

  onShareAppMessage() {
    const range = this.data.range;
    const label = range <= 12 ? '近1年' : range <= 36 ? '近3年' : range <= 60 ? '近5年' : '近10年';
    return {
      title: '深圳二手房成交数据（' + label + '）',
      path: '/pages/trends/trends'
    };
  },
});
