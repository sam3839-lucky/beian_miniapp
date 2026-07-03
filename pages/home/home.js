const api = require('../../utils/api');

Page({
  data: {
    // Hero 卡片
    hero: { totalListings: '--', permits: '--', todayNew: '--' },
    aiText: '',
    priceIndex: null,
    priceType: 'new',  // 'new' | 'used'
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
    searchUsed: 0,
    searchMax: 20,
    showUsageBadge: false,
    // P1: 榜单 tab
    rankTab: 0,
    rankTabs: ['总价最低', '总价最高', '单价最低', '单价最高'],
    rankings: null,
    rankList: [],
    rankingsError: false,
    topAbsorption: [],
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
    // 先加载缓存，快速渲染
    this._showCachedOverview();
    // 快速接口并行
    Promise.all([this.loadRankings(), this.loadPermits(), this.loadTopAbsorption(), this.loadPriceIndex()]);
    // 慢接口单独跑，不阻塞页面
    this.loadOverview().catch(() => {});
  },

  _showCachedOverview() {
    try {
      const cached = wx.getStorageSync('overview_cache');
      if (cached) {
        this.setData({ overview: cached, overviewError: false });
        this._fillHeroData(cached);
      }
    } catch (e) { /* ignore */ }
  },

  // ── P0: 市场概览 ──
  async loadOverview() {
    try {
      const data = await api.getOverview();
      data.unsold_w = (data.unsold / 10000).toFixed(2);
      data.unsold_n = data.unsold || 0;
      data.presale_n = data.presale || 0;
      data.spot_sale_n = data.spot_sale || 0;
      data.signed_w = (data.signed / 10000).toFixed(2);
      data.filed_w = (data.filed / 10000).toFixed(2);
      data.transferred_w = (data.transferred / 10000).toFixed(2);
      data.avg_unit_price_w = data.avg_unit_price ? (data.avg_unit_price / 10000).toFixed(2) : '--';
      data.recent_n = data.recent || 0;
      this.setData({ overview: data, overviewError: false });
      this._fillHeroData(data);
      try { wx.setStorageSync('overview_cache', data); } catch (e) { /* ignore */ }
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
      // 增量计数
      const openid = getApp().globalData.openid;
      if (openid) {
        api.incrementUsage(openid, 'searches').then(usage => {
          const app = getApp();
          app.globalData.searchesUsed = usage.used;
          this.setData({ searchUsed: usage.used, searchMax: usage.max, showUsageBadge: true });
        }).catch(() => {});
      }
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
  async loadRankings(tab) {
    try {
      const t = tab || 'cheap_total';
      const data = await api.getRankings(t);
      const list = (data.items || []).map(item => ({
        ...item,
        unitPriceWan: (item.unit_price / 10000).toFixed(1)
      }));
      this.setData({ rankList: list, rankingsError: false });
    } catch (e) {
      this.setData({ rankingsError: true });
    }
  },

  onRetryRankings() {
    this.setData({ rankingsError: false });
    this.loadRankings();
  },

  onRankTabChange(e) {
    const idx = parseInt(e.currentTarget.dataset.index);
    const tabs = ['cheap_total', 'dear_total', 'cheap_unit', 'dear_unit'];
    this.setData({ rankTab: idx, rankList: [] });
    this.loadRankings(tabs[idx]);
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

  onPriceTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ priceType: type });
    this._updatePriceDisplay();
  },

  _updatePriceDisplay() {
    const idx = this.data.priceIndex;
    if (!idx || !idx.items) return;
    const key = this.data.priceType;
    const items = idx.items.map(item => {
      const d = item[key] || {};
      const mom = d.mom;
      const diff = mom ? (mom - 100).toFixed(1) : '0.0';
      const label = mom > 100 ? '+' + diff + '%' : diff + '%';
      const barH = mom ? Math.max(4, Math.abs(mom - 100) * 60) : 4;
      const yoy = d.yoy;
      return { month: item.month.slice(5), mom, yoy, label, barH, up: mom > 100 };
    });
    for (let i = 0; i < items.length; i++) items[i].show = (i % 2 === 0);
    const latest = items[items.length - 1] || {};
    this.setData({
      idxItems: items,
      idxLatest: latest,
      idxMonth: (idx.items[idx.items.length - 1] || {}).month || ''
    });
  },

  async loadPriceIndex() {
    try {
      const d = await api.getPriceIndex('深圳', 12);
      this.setData({ priceIndex: d });
      this._updatePriceDisplay();
    } catch (e) { /* ignore */ }
  },

  async loadTopAbsorption() {
    try {
      const d = await api.getTopAbsorption();
      this.setData({ topAbsorption: d.items || [] });
    } catch (e) { /* ignore */ }
  },

  onTopAbsorptionTap(e) {
    const pn = e.currentTarget.dataset.project;
    if (pn) wx.navigateTo({ url: '/pages/index/index?project=' + encodeURIComponent(pn) });
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


  onEntryTap(e) {
    const page = e.currentTarget.dataset.page;
    // 跳转映射：trends是tab页用switchTab，其余用navigateTo
    if (page === 'trends') {
      wx.switchTab({ url: '/pages/trends/trends' });
    } else if (page === 'upcoming') {
      wx.navigateTo({ url: '/pages/upcoming/upcoming' });
    } else if (page === 'mortgage') {
      wx.navigateTo({ url: '/pages/mortgage/mortgage' });
    } else {
      wx.navigateTo({ url: '/pages/index/index' });
    }
  },

  _fillHeroData(data) {
    this.setData({
      hero: {
        totalListings: data.total ? (data.total / 10000).toFixed(1) + '万' : '--',
        permits: '4,402',
        todayNew: (data.recent_n || data.recent || 0) > 0 ? (data.recent_n || data.recent) : '--'
      },
      aiText: this._genAiText(data)
    });
  },

  _genAiText(data) {
    if (!data || !data.total) return '';
    const unsold = data.unsold_n || 0;
    const avgPrice = data.avg_unit_price_w || '--';
    const presale = data.presale_n || 0;
    const spot = data.spot_sale_n || 0;
    const signedW = parseFloat(data.signed_w || 0);
    const filedW = parseFloat(data.filed_w || 0);
    const recent = data.recent_n || 0;
    const parts = [];
    parts.push(`深圳目前在售住宅约${(unsold / 10000).toFixed(1)}万套，均价${avgPrice}万/㎡。`);
    parts.push(`其中期房${presale}套，现房${spot}套。`);
    if (recent > 0) parts.push(`最近有${recent}套新房源入市。`);
    if (filedW > signedW) parts.push(`近期备案量(${filedW.toFixed(1)}万套)高于网签量(${signedW.toFixed(1)}万套)，市场活跃度较高。`);
    // 加入价格指数分析
    const idx = this.data.priceIndex;
    if (idx && idx.items && idx.items.length) {
      const latest = idx.items[idx.items.length - 1];
      const mom = latest.new && latest.new.mom;
      const yoy = latest.new && latest.new.yoy;
      if (mom) {
        const dir = mom > 100 ? '上涨' : mom < 100 ? '下跌' : '持平';
        const arrow = mom > 100 ? '↑' : mom < 100 ? '↓' : '→';
        parts.push(`价格指数：${latest.month.slice(5)}月新房环比${arrow}${dir}(${mom})，同比${yoy ? (yoy > 100 ? '↑' : '↓') : ''}${yoy || '--'}。`);
      }
    }
    return parts.join('');
  },

  onShareAppMessage() {
    return {
      title: '深圳备案价查询 - 新房备案价一目了然',
      path: '/pages/home/home'
    };
  },
});
