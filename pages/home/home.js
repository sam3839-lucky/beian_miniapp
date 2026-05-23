const api = require('../../utils/api');

Page({
  data: {
    // P0: 概览
    overview: null,
    overviewError: false,
    // P0: 搜索
    search: '',
    // P1: 榜单 tab
    rankTab: 0,
    rankTabs: ['总价最低', '单价最低', '面积最小'],
    rankings: null,
    rankList: [],
    rankingsError: false,
    // P2: 最新预售证
    permits: [],
    permitsError: false,
    // P3: 计算器
    calc: {
      downPayment: '',
      monthlyPayment: '',
      result: null,
    },
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  async loadAll() {
    await Promise.all([
      this.loadOverview(),
      this.loadRankings(),
      this.loadPermits()
    ]);
  },

  // ── P0: 市场概览 ──
  async loadOverview() {
    try {
      const data = await api.getOverview();
      this.setData({ overview: data, overviewError: false });
    } catch (e) {
      console.error('overview load failed', e);
      this.setData({ overviewError: true });
    }
  },

  onRetryOverview() {
    this.setData({ overviewError: false });
    this.loadOverview();
  },

  // ── P0: 搜索 ──
  onSearchInput(e) {
    this.setData({ search: e.detail.value });
  },

  onSearchConfirm() {
    const kw = this.data.search.trim();
    if (kw) {
      wx.navigateTo({
        url: `/pages/index/index?search=${encodeURIComponent(kw)}`
      });
    }
  },

  // ── P0: 区域快捷入口 ──
  onZoneTap(e) {
    const zone = e.currentTarget.dataset.zone;
    wx.navigateTo({
      url: `/pages/index/index?zone=${encodeURIComponent(zone)}`
    });
  },

  // ── P0: 查看全部 ──
  onViewAll() {
    wx.switchTab ? wx.switchTab({ url: '/pages/index/index' }) : wx.navigateTo({ url: '/pages/index/index' });
  },

  // ── P1: 榜单 ──
  async loadRankings() {
    try {
      const data = await api.getRankings();
      const keys = ['cheap_total', 'cheap_unit', 'small_area'];
      this.setData({
        rankings: data,
        rankList: data[keys[this.data.rankTab]] || [],
        rankingsError: false
      });
    } catch (e) {
      console.error('rankings load failed', e);
      this.setData({ rankingsError: true });
    }
  },

  onRetryRankings() {
    this.setData({ rankingsError: false });
    this.loadRankings();
  },

  onRankTabChange(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const keys = ['cheap_total', 'cheap_unit', 'small_area'];
    this.setData({
      rankTab: idx,
      rankList: (this.data.rankings || {})[keys[idx]] || []
    });
  },

  onRankItemTap(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({
      url: `/pages/detail/detail?data=${encodeURIComponent(JSON.stringify(item))}&project=${encodeURIComponent(item.project_name)}&building=${encodeURIComponent(item.building_name)}`
    });
  },

  // ── P2: 最新预售证 ──
  async loadPermits() {
    try {
      const data = await api.getLatestPermits();
      this.setData({ permits: (data.permits || []).slice(0, 8), permitsError: false });
    } catch (e) {
      console.error('permits load failed', e);
      this.setData({ permitsError: true });
    }
  },

  onRetryPermits() {
    this.setData({ permitsError: false });
    this.loadPermits();
  },

  onPermitTap(e) {
    const project = e.currentTarget.dataset.project;
    if (project) {
      wx.navigateTo({
        url: `/pages/index/index?project=${encodeURIComponent(project)}`
      });
    }
  },

  // ── P3: 购房计算器 ──
  onCalcInput(e) {
    const field = e.currentTarget.dataset.field;
    const calc = { ...this.data.calc, [field]: e.detail.value };
    calc.result = null;
    this.setData({ calc });
  },

  onCalcSubmit() {
    const down = parseFloat(this.data.calc.downPayment);
    const monthly = parseFloat(this.data.calc.monthlyPayment);
    if (!down || down <= 0) {
      wx.showToast({ title: '请输入首付预算', icon: 'none' });
      return;
    }
    if (!monthly || monthly <= 0) {
      wx.showToast({ title: '请输入月供能力', icon: 'none' });
      return;
    }

    // 首付30%, 30年期, 利率3.15%(当前LPR)
    const totalLow = Math.round(down / 0.3);   // 万
    const totalHigh = Math.round(down / 0.2);  // 万
    const rate = getApp().globalData.mortgageRate || 0.0315;
    const months = 360;
    const monthlyRate = rate / 12;
    const factor = (monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const loanMax = Math.round(monthly / factor);         // 万
    const affordMax = Math.round(down + loanMax);          // 万

    const calc = {
      ...this.data.calc,
      result: {
        totalLow: totalLow,
        totalHigh: totalHigh,
        affordMax: affordMax,
      }
    };
    this.setData({ calc });
  },

  onCalcResultTap() {
    if (!this.data.calc.result) return;
    const r = this.data.calc.result;
    wx.navigateTo({
      url: `/pages/index/index?price_min=${r.totalLow}&price_max=${r.affordMax}`
    });
  },

  onOpenOps() {
    wx.navigateTo({ url: '/pages/ops/ops' });
  },
});
