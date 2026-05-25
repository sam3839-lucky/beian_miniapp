const api = require('../../utils/api');

Page({
  data: {
    // P0: 概览
    overview: null,
    overviewError: false,
    // P0: 搜索（瞬搜模式）
    search: '',
    searchResults: [],
    searchLoading: false,
    searchTapped: false,
    searchHistory: [],
    searchFocus: false,
    // P1: 榜单 tab
    rankTab: 0,
    rankTabs: ['总价最低', '总价最高', '单价最低', '单价最高'],
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
    this._loadHistory();
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  _loadHistory() {
    try {
      const h = wx.getStorageSync('search_history') || [];
      this.setData({ searchHistory: h.slice(0, 10) });
    } catch (e) { /* ignore */ }
  },

  _saveHistory(kw) {
    if (!kw.trim()) return;
    try {
      let h = wx.getStorageSync('search_history') || [];
      h = [kw, ...h.filter(k => k !== kw)].slice(0, 10);
      wx.setStorageSync('search_history', h);
      this.setData({ searchHistory: h });
    } catch (e) { /* ignore */ }
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

  // ── P0: 瞬搜 ──
  onSearchInput(e) {
    const v = e.detail.value;
    this.setData({ search: v, searchTapped: false });
    if (this._timer) clearTimeout(this._timer);
    if (!v.trim()) {
      this.setData({ searchResults: [], searchLoading: false });
      return;
    }
    this._timer = setTimeout(() => this._doSearch(v.trim()), 300);
  },

  onQuickSearch() {
    const v = this.data.search.trim();
    if (!v) return;
    this._saveHistory(v);
    this.setData({ searchTapped: true });
    if (this._timer) clearTimeout(this._timer);
    this._doSearch(v);
  },

  async _doSearch(q) {
    this.setData({ searchLoading: true });
    try {
      const data = await api.quickSearch(q);
      const results = (data.results || []).map(r => ({
        ...r,
        avg_unit_w: (r.avg_unit / 10000).toFixed(1),
        avg_total: r.avg_total || 0,
        price_min: r.price_min || 0,
        price_max: r.price_max || 0
      }));
      this.setData({ searchResults: results, searchLoading: false });
    } catch (e) {
      console.error('quick search failed', e);
      this.setData({ searchLoading: false });
    }
  },

  onClearSearch() {
    this.setData({
      search: '', searchResults: [], searchTapped: false, searchFocus: false
    });
  },

  onQuickResultTap(e) {
    const { project, zone } = e.currentTarget.dataset;
    this._saveHistory(project);
    this._navToFilter({ project, zone });
  },

  onHistoryTap(e) {
    const kw = e.currentTarget.dataset.kw;
    this.setData({ search: kw, searchFocus: true });
    this._doSearch(kw);
    this._saveHistory(kw);
  },

  _navToFilter(params) {
    const app = getApp();
    app.globalData.filterParams = params;
    wx.switchTab({ url: '/pages/index/index' });
  },

  onSearchConfirm() {
    const kw = this.data.search.trim();
    if (kw) this._navToFilter({ search: kw });
  },

  onZoneTap(e) {
    const zone = e.currentTarget.dataset.zone;
    this._navToFilter({ zone });
  },

  // ── P1: 榜单 ──
  async loadRankings() {
    try {
      const data = await api.getRankings();
      const keys = ['cheap_total', 'dear_total', 'cheap_unit', 'dear_unit'];
      const list = (data[keys[this.data.rankTab]] || []).map(item => ({
        ...item,
        unitPriceWan: (item.unit_price / 10000).toFixed(1)
      }));
      this.setData({
        rankings: data,
        rankList: list,
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
    const keys = ['cheap_total', 'dear_total', 'cheap_unit', 'dear_unit'];
    const list = ((this.data.rankings || {})[keys[idx]] || []).map(item => ({
      ...item,
      unitPriceWan: (item.unit_price / 10000).toFixed(1)
    }));
    this.setData({ rankTab: idx, rankList: list });
  },

  onRankItemTap(e) {
    const item = e.currentTarget.dataset.item;
    const u = item;
    const p = [
      'unit_no=' + encodeURIComponent(u.unit_no),
      'area=' + (u.built_area || 0),
      'up=' + (u.unit_price || 0),
      'tp=' + (u.total_price || 0),
      'status=' + encodeURIComponent(u.status || '未售'),
      'project=' + encodeURIComponent(u.project_name || ''),
      'building=' + encodeURIComponent(u.building_name || '')
    ].join('&');
    wx.navigateTo({ url: '/pages/detail/detail?' + p });
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
    const { project, zone } = e.currentTarget.dataset;
    if (project) this._navToFilter({ project, zone });
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
    this._navToFilter({ price_min: r.totalLow, price_max: r.affordMax });
  },

  onOpenOps() {
    wx.navigateTo({ url: '/pages/ops/ops' });
  },
});
