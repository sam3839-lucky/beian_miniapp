const api = require('../../utils/api');

function pct(a, b) {
  if (!a || !b) return '--';
  const v = ((a - b) / b * 100).toFixed(1);
  return v > 0 ? '+' + v + '%' : v + '%';
}

function arrow(a, b) {
  return a > b ? '↑' : a < b ? '↓' : '→';
}

Page({
  data: {
    today: {}, yesterday: {},
    thisMonth: {}, lastMonth: {},
    thisYear: {}, lastYear: {},
    dailyTrends: [],
    avg30New: 0,
    avg30Used: 0,
    avgPrice: '--',
    topDistricts: [],
    loading: true,
    error: false
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, error: false });
    try {
      const [dash, ov] = await Promise.all([
        api.getDashboard(24),
        api.getOverview()
      ]);

      // --- 今日/昨日 ---
      const daily = dash.dailyItems || [];
      const today = daily[0] || {};
      const yesterday = daily[1] || {};

      // --- 本月/上月 ---
      const sm = dash.summary || {};
      const tm = sm.this_month || {};
      const lm = sm.last_month || {};

      // --- 本年/去年 (从trends累加) ---
      const monthTrends = (dash.trends || []).slice(0, 12);
      let thisYearNew = 0, thisYearUsed = 0;
      monthTrends.forEach(t => {
        thisYearNew += t.new || 0;
        thisYearUsed += t.used || 0;
      });

      // --- 去年 (trends里往前12个月) ---
      const allTrends = dash.trends || [];
      const lastYearTrends = allTrends.slice(12, 24);
      let lastYearNew = 0, lastYearUsed = 0;
      lastYearTrends.forEach(t => {
        lastYearNew += t.new || 0;
        lastYearUsed += t.used || 0;
      });

      // --- 日走势数据(最近14天) ---
      const dailyTrends = (dash.dailyItems || []).slice(0, 14).reverse();
      // 30日均 = 新房和二手分别算
      const all30 = (dash.dailyItems || []).slice(0, 30);
      const avg30New = all30.length ? Math.round(all30.reduce((s, t) => s + (t.new || 0), 0) / all30.length) : 0;
      const avg30Used = all30.length ? Math.round(all30.reduce((s, t) => s + (t.used || 0), 0) / all30.length) : 0;

      // --- 均价 ---
      const avgPrice = ov.avg_unit_price ? (ov.avg_unit_price / 10000).toFixed(2) : '--';

      // --- TOP3 片区 ---
      const zones = (ov.zones || []).slice(0, 3).map(z => ({
        name: z.name,
        count: z.count
      }));

      this.setData({
        today: { date: today.date, new: today.new || 0, used: today.used || 0 },
        yesterday: { date: yesterday.date, new: yesterday.new || 0, used: yesterday.used || 0 },
        thisMonth: { month: tm.month, new: tm.new || 0, used: tm.used || 0 },
        lastMonth: { new: lm.new || 0, used: lm.used || 0 },
        thisYear: { new: thisYearNew, used: thisYearUsed },
        lastYear: { new: lastYearNew || '/', used: lastYearUsed || '/' },
        dailyTrends, avg30New, avg30Used,
        avgPrice,
        topDistricts: zones,
        loading: false
      }, () => this.drawChart());
    } catch (e) {
      console.error('dashboard load failed', e);
      this.setData({ loading: false, error: true });
    }
  },

  drawChart() {
    const trends = this.data.dailyTrends;
    const avgN = this.data.avg30New;
    const avgU = this.data.avg30Used;
    if (!trends || !trends.length) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#trendCanvas').boundingClientRect().exec(res => {
      if (!res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || 200;
      const ctx = wx.createCanvasContext('trendCanvas', this);
      const pad = { top: 20, right: 8, bottom: 28, left: 38 };
      const pw = w - pad.left - pad.right;
      const ph = h - pad.top - pad.bottom;
      const vals = trends.map(t => (t.new || 0) + (t.used || 0));
      const maxV = Math.max(...vals, avgN, avgU) * 1.2 || 1;
      const gap = pw / trends.length;
      const barW = gap * 0.7;

      // Y轴
      ctx.setFillStyle('#999'); ctx.setFontSize(9); ctx.setTextAlign('right');
      for (let i = 0; i <= 3; i++) {
        const y = pad.top + ph * (1 - i / 3);
        ctx.fillText(Math.round(maxV * i / 3) + '', pad.left - 4, y + 3);
        ctx.setStrokeStyle('#f0f0f0'); ctx.beginPath();
        ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      }

      // 柱子
      trends.forEach((t, i) => {
        const x = pad.left + i * gap + (gap - barW) / 2;
        const hNew = (t.new || 0) / maxV * ph;
        const hUsed = (t.used || 0) / maxV * ph;
        ctx.setFillStyle('#7EB8E0');
        ctx.fillRect(x, pad.top + ph - hNew, barW / 2, Math.max(hNew, 1));
        ctx.setFillStyle('#0066B3');
        ctx.fillRect(x + barW / 2, pad.top + ph - hUsed, barW / 2, Math.max(hUsed, 1));
        if (i % 2 === 0 && t.date) {
          ctx.setFillStyle('#999'); ctx.setFontSize(8); ctx.setTextAlign('center');
          ctx.fillText(t.date.slice(5), x + barW / 2, h - 4);
        }
      });

      // 新房30日均线(浅蓝虚线)
      if (avgN > 0) {
        const yN = pad.top + ph * (1 - avgN / maxV);
        ctx.setStrokeStyle('#7EB8E0'); ctx.setLineWidth(1.5);
        ctx.setLineDash([4, 3]); ctx.beginPath();
        ctx.moveTo(pad.left, yN); ctx.lineTo(w - pad.right, yN); ctx.stroke();
        ctx.setLineDash([]);
        ctx.setFillStyle('#7EB8E0'); ctx.setFontSize(9); ctx.setTextAlign('right');
        ctx.fillText('新房均' + avgN, w - pad.right, yN - 4);
      }
      // 二手30日均线(深蓝虚线)
      if (avgU > 0) {
        const yU = pad.top + ph * (1 - avgU / maxV);
        ctx.setStrokeStyle('#0066B3'); ctx.setLineWidth(1.5);
        ctx.setLineDash([4, 3]); ctx.beginPath();
        ctx.moveTo(pad.left, yU); ctx.lineTo(w - pad.right, yU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.setFillStyle('#0066B3'); ctx.setFontSize(9); ctx.setTextAlign('right');
        ctx.fillText('二手均' + avgU, w - pad.right, yU - 4);
      }

      ctx.draw();
    });
  },

  onRetry() {
    this.loadData();
  },

  // 海报生成
  onSavePoster() {
    const that = this;
    wx.showLoading({ title: '生成海报中...' });
    const ctx = wx.createCanvasContext('posterCanvas', this);
    const W = 750, H = 1334; // 设计尺寸

    // 背景
    ctx.setFillStyle('#F0F5FA');
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.setFillStyle('#0066B3'); ctx.setFontSize(40); ctx.setTextAlign('center');
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('深圳楼市成交概览', W / 2, 80);

    ctx.setFillStyle('#8C9BA8'); ctx.setFontSize(20); ctx.setTextAlign('center');
    const now = new Date();
    ctx.fillText('数据更新时间：' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日', W / 2, 115);

    // 分隔线
    ctx.setStrokeStyle('#0066B3'); ctx.setLineWidth(3);
    ctx.beginPath(); ctx.moveTo(W / 2 - 40, 130); ctx.lineTo(W / 2 + 40, 130); ctx.stroke();

    // 6张数据卡
    const d = this.data;
    const cards = [
      { label: '今日新房成交', val: d.today.new + '套', sub: '昨日 ' + d.yesterday.new + '套', color: '#0066B3' },
      { label: '本月新房成交', val: d.thisMonth.new + '套', sub: '上月 ' + d.lastMonth.new + '套', color: '#0066B3' },
      { label: '今年新房成交', val: d.thisYear.new + '套', sub: '去年 ' + d.lastYear.new + '套', color: '#0066B3' },
      { label: '今日二手房成交', val: d.today.used + '套', sub: '昨日 ' + d.yesterday.used + '套', color: '#34A853' },
      { label: '本月二手房成交', val: d.thisMonth.used + '套', sub: '上月 ' + d.lastMonth.used + '套', color: '#34A853' },
      { label: '今年二手房成交', val: d.thisYear.used + '套', sub: '去年 ' + d.lastYear.used + '套', color: '#34A853' },
    ];
    const cardW = 220, cardH = 120;
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = 30 + col * (cardW + 10), cy = 155 + row * (cardH + 10);
      ctx.setFillStyle('#fff'); ctx.setShadow(0, 2, 8, 'rgba(0,0,0,0.06)');
      this._roundRect(ctx, cx, cy, cardW, cardH, 12);
      ctx.fill(); ctx.setShadow(0, 0, 0, 'rgba(0,0,0,0)');
      ctx.setFillStyle('#5A6B7A'); ctx.setFontSize(16); ctx.setTextAlign('center');
      ctx.fillText(cards[i].label, cx + cardW / 2, cy + 30);
      ctx.setFillStyle(cards[i].color); ctx.setFontSize(36);
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(cards[i].val, cx + cardW / 2, cy + 68);
      ctx.setFillStyle('#8C9BA8'); ctx.setFontSize(14);
      ctx.fillText(cards[i].sub, cx + cardW / 2, cy + 98);
    }
    ctx.font = 'normal 20px sans-serif';

    // 均价
    ctx.setFillStyle('#fff');
    this._roundRect(ctx, 30, 420, W - 60, 60, 12); ctx.fill();
    ctx.setFillStyle('#333'); ctx.setFontSize(24); ctx.setTextAlign('center');
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('网签均价：' + d.avgPrice + ' 万/㎡', W / 2, 458);

    // 走势图
    ctx.setFillStyle('#fff');
    this._roundRect(ctx, 30, 495, W - 60, 200, 12); ctx.fill();
    ctx.setFillStyle('#333'); ctx.setFontSize(20); ctx.setTextAlign('left');
    ctx.fillText('日成交走势', 50, 525);

    const pTrends = d.dailyTrends;
    if (pTrends.length) {
      const maxT = Math.max(...pTrends.map(t => (t.new || 0) + (t.used || 0))) * 1.15 || 1;
      const cw = W - 100, ch = 130;
      const gapC = cw / pTrends.length;
      const barC = gapC * 0.6;
      pTrends.forEach((t, i) => {
        const bx = 50 + i * gapC + (gapC - barC) / 2;
        const hn = (t.new || 0) / maxT * ch;
        const hu = (t.used || 0) / maxT * ch;
        ctx.setFillStyle('#7EB8E0');
        ctx.fillRect(bx, 675 - hn, barC / 2, hn);
        ctx.setFillStyle('#0066B3');
        ctx.fillRect(bx + barC / 2, 675 - hu, barC / 2, hu);
      });
    }

    // 底部
    ctx.setFillStyle('#A0ACB8'); ctx.setFontSize(16); ctx.setTextAlign('center');
    ctx.fillText('数据来源：深圳市住房和建设局官方平台', W / 2, 720);
    ctx.fillText('#深圳楼市 #深圳买房 #深圳新房', W / 2, 745);

    ctx.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: 'posterCanvas',
          success: res => {
            wx.hideLoading();
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: () => wx.showToast({ title: '请授权保存图片', icon: 'none' })
            });
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '生成失败', icon: 'none' }); }
        });
      }, 500);
    });
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

});
