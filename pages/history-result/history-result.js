const API_BASE = 'https://ruiheqi.cn/api/resale';

function formatMonth(m) {
  if (!m) return '';
  const parts = m.split('-');
  return parts.length >= 2 ? parts[0].slice(2) + '/' + parts[1] : m;
}

Page({
  data: {
    community: '',
    zoneName: '',
    districtId: '',
    summary: null,
    trend: [],
    trendYears: 1,
    records: [],
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 20,
    pageNums: [],
    showEndEllipsis: false,

    // filters
    sortBy: 'date',
    sortOrder: 'desc',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: '',
    minDate: '',
    maxDate: '',
    today: '',

    // district picker
    districtOptions: [{ id: '', name: '▾ 区域' }],
    districtIdx: 0,

    loading: true,
    error: false,
    hasFilters: false
  },

  onLoad(options) {
    const community = decodeURIComponent(options.community || '');
    const districtId = options.district_id || '';
    const districtName = decodeURIComponent(options.district_name || '');

    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    this.setData({
      community,
      districtId,
      zoneName: districtName,
      today
    });

    // 导航栏标题：区 · 小区名 · 成交分析
    const navTitle = districtName ? districtName + ' · ' + community + ' · 成交分析' : (community ? community + ' · 成交分析' : '二手房查询');
    wx.setNavigationBarTitle({ title: navTitle });

    this.loadDistricts();
    if (community) {
      this.loadCommunity();
    } else if (districtId) {
      this.loadSearch();
    } else {
      this.setData({ loading: false, error: true });
    }
  },

  async loadDistricts() {
    try {
      const res = await this.request('/districts');
      const options = [{ id: '', name: '▾ 区域' }];
      (res.districts || []).forEach(d => {
        options.push({ id: d.id, name: d.name });
      });
      // set district picker index if we have a districtId
      let idx = 0;
      if (this.data.districtId) {
        idx = options.findIndex(o => String(o.id) === String(this.data.districtId));
        if (idx < 0) idx = 0;
      }
      this.setData({ districtOptions: options, districtIdx: idx });
    } catch (e) {
      console.error('loadDistricts error:', e);
    }
  },

  async loadCommunity() {
    this.setData({ loading: true, error: false });
    try {
      const res = await this.request('/community/' + encodeURIComponent(this.data.community) + '?years=' + this.data.trendYears);
      const s = res.stats || {};
      const fmt = (d) => d ? String(d).slice(0,10) : '';
      const fmtPrice = (v) => v ? (v / 10000).toFixed(1) + '万/㎡' : '--';
      this.setData({
        summary: {
          total: s.total || 0,
          avgUnit: s.avg_unit ? fmtPrice(s.avg_unit) : '--',
          maxPrice: fmtPrice(s.max_price),
          minPrice: fmtPrice(s.min_price),
          max_price_date: fmt(s.max_price_date),
          min_price_date: fmt(s.min_price_date)
        },
        trend: res.trend || [],
        zoneName: res.zone || this.data.zoneName || '',
        loading: false
      }, () => {
        if (res.trend && res.trend.length) this.drawTrendChart();
      });
      // 导航栏标题：区 · 小区名 · 成交分析
      const zone = res.zone || this.data.zoneName || '';
      wx.setNavigationBarTitle({ title: zone ? zone + ' · ' + this.data.community + ' · 成交分析' : this.data.community + ' · 成交分析' });
    } catch (e) {
      console.error('loadCommunity error:', e);
      this.setData({ loading: false, error: true });
    }
    this.loadSearch();
  },

  async loadSearch() {
    try {
      const params = [];
      if (this.data.community) params.push('community=' + encodeURIComponent(this.data.community));
      if (this.data.districtId) params.push('district_id=' + this.data.districtId);
      if (this.data.minPrice) params.push('min_price=' + this.data.minPrice);
      if (this.data.maxPrice) params.push('max_price=' + this.data.maxPrice);
      if (this.data.minArea) params.push('min_area=' + this.data.minArea);
      if (this.data.maxArea) params.push('max_area=' + this.data.maxArea);
      if (this.data.minDate) params.push('min_date=' + this.data.minDate);
      if (this.data.maxDate) params.push('max_date=' + this.data.maxDate);
      params.push('sort_by=' + this.data.sortBy);
      params.push('sort_order=' + this.data.sortOrder);
      params.push('page=' + this.data.page);
      params.push('limit=' + this.data.limit);

      const res = await this.request('/search?' + params.join('&'));
      const records = (res.data || []).map(r => ({
        ...r,
        total_price: r.total_price || 0,
        unit_price: r.unit_price ? Math.round(r.unit_price) : null
      }));
      const totalPages = Math.ceil(res.total / this.data.limit);

      this.setData({
        records,
        total: res.total,
        totalPages,
        pageNums: this.buildPageNums(res.page, totalPages),
        showEndEllipsis: totalPages > 7,
        hasFilters: !!(this.data.districtId || this.data.minPrice || this.data.maxPrice ||
          this.data.minArea || this.data.maxArea || this.data.minDate || this.data.maxDate)
      });
    } catch (e) {
      console.error('loadSearch error:', e);
    }
  },

  buildPageNums(page, total) {
    if (total <= 7) {
      const nums = [];
      for (let i = 1; i <= total; i++) nums.push(i);
      return nums;
    }
    const nums = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    if (start > 2) nums.push(-1); // ellipsis marker
    for (let i = start; i <= end; i++) nums.push(i);
    if (end < total - 1) nums.push(-1);
    nums.push(total);
    return nums;
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

  onTrendYears(e) {
    const years = parseInt(e.currentTarget.dataset.years);
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(1);
    const minDate = d.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    this.setData({ trendYears: years, minDate, maxDate: '', page: 1 });
    this.loadCommunity();
    this.loadSearch();
  },

  // ── chart ──

  drawTrendChart() {
    const raw = this.data.trend;
    if (!raw.length) return;

    // 始终产生 12 个 bucket
    const n = raw.length;
    const bucketSize = n / 12;
    const trend = [];
    for (let i = 0; i < 12; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.floor((i + 1) * bucketSize);
      const slice = raw.slice(start, Math.min(end, n));
      if (!slice.length) { trend.push({ month: '', avg_price: 0, cnt: 0 }); continue; }
      // 均价 = 总成交额 / 总面积
      const sumPrice = slice.reduce((s, t) => s + (parseFloat(t.avg_price) || 0), 0);
      const first = slice[0].month;
      const last = slice[slice.length - 1].month;
      const label = bucketSize <= 1.2 ? formatMonth(first)
        : formatMonth(first) + '-' + formatMonth(last);
      trend.push({
        month: label,
        avg_price: sumPrice > 0 ? Math.round(sumPrice / slice.length) : 0,
        cnt: slice.reduce((s, t) => s + (t.cnt || 0), 0)
      });
    }
    if (!trend.length) return;

    const that = this;
    const q = wx.createSelectorQuery().in(this);
    q.select('.trend-canvas').boundingClientRect().exec(res => {
      if (!res || !res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || 180;

    const ctx = wx.createCanvasContext('trendCanvas', that);

    const pad = { top: 28, right: 8, bottom: 32, left: 44 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    const prices = trend.map(t => t.avg_price).filter(p => p > 0);
    if (!prices.length) { ctx.draw(); return; }

    const maxP = Math.max(...prices) * 1.1;
    const minP = Math.min(...prices) * 0.9;
    const range = maxP - minP || 1;

    // Y axis + grid
    ctx.setFillStyle('#999');
    ctx.setFontSize(9);
    ctx.setTextAlign('right');
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + ph * (i / 3);
      const val = Math.round((maxP - range * (i / 3)) / 1000) + 'k';
      ctx.fillText(val, pad.left - 4, y + 3);
      ctx.setStrokeStyle('#f0f0f0');
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // axis lines
    ctx.setStrokeStyle('#ddd');
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + ph); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ph); ctx.lineTo(w - pad.right, pad.top + ph); ctx.stroke();

    // line
    const stepX = pw / Math.max(trend.length - 1, 1);
    ctx.beginPath();
    ctx.setStrokeStyle('#FF8C00');
    ctx.setLineWidth(2);
    let first = true;
    trend.forEach((t, i) => {
      if (t.avg_price <= 0) return;
      const x = pad.left + i * stepX;
      const y = pad.top + ph * (1 - (t.avg_price - minP) / range);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // dots + price labels (every point) + month labels (alternating)
    trend.forEach((t, i) => {
      if (t.avg_price <= 0) return;
      const x = pad.left + i * stepX;
      const y = pad.top + ph * (1 - (t.avg_price - minP) / range);
      // dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.setFillStyle('#FF8C00');
      ctx.fill();
      // price label on every dot
      ctx.setFillStyle('#FF4D4F');
      ctx.setFontSize(9);
      ctx.setTextAlign('center');
      ctx.fillText((t.avg_price / 10000).toFixed(2) + '万', x, y - 10);
      // month label every other point
      if (i % 2 === 0 && t.month) {
        ctx.setFillStyle('#999');
        ctx.fillText(t.month, x, h - 6);
      }
    });

    ctx.draw();
    });
  },

  // ── filters ──

  onDistrictChange(e) {
    const idx = parseInt(e.detail.value);
    const opt = this.data.districtOptions[idx];
    this.setData({
      districtIdx: idx,
      districtId: opt.id || '',
      zoneName: opt.name !== '▾ 区域' ? opt.name : '',
      page: 1
    });
    this.loadSearch();
  },

  onMinDateChange(e) { this.setData({ minDate: e.detail.value, page: 1 }); this.loadSearch(); },
  onMaxDateChange(e) { this.setData({ maxDate: e.detail.value, page: 1 }); this.loadSearch(); },

  onMinPriceInput(e) { this.setData({ minPrice: e.detail.value }); this._debounceFilter(); },
  onMaxPriceInput(e) { this.setData({ maxPrice: e.detail.value }); this._debounceFilter(); },
  onMinAreaInput(e) { this.setData({ minArea: e.detail.value }); this._debounceFilter(); },
  onMaxAreaInput(e) { this.setData({ maxArea: e.detail.value }); this._debounceFilter(); },

  _debounceFilter() {
    if (this._filterTimer) clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(() => {
      this.setData({ page: 1 });
      this.loadSearch();
    }, 600);
  },

  onSortTap(e) {
    const sort = e.currentTarget.dataset.sort;
    const order = e.currentTarget.dataset.order || 'desc';
    this.setData({ sortBy: sort, sortOrder: order, page: 1 });
    this.loadSearch();
  },

  onClearFilters() {
    this.setData({
      districtId: '', districtIdx: 0, zoneName: '',
      minPrice: '', maxPrice: '', minArea: '', maxArea: '',
      minDate: '', maxDate: '',
      sortBy: 'date', sortOrder: 'desc',
      page: 1, hasFilters: false
    });
    this.loadSearch();
  },

  // ── pagination ──

  onPrevPage() { if (this.data.page > 1) { this.setData({ page: this.data.page - 1 }); this.loadSearch(); } },
  onNextPage() { if (this.data.page < this.data.totalPages) { this.setData({ page: this.data.page + 1 }); this.loadSearch(); } },

  onGoPage(e) {
    const p = parseInt(e.currentTarget.dataset.page);
    if (p > 0 && p <= this.data.totalPages && p !== this.data.page) {
      this.setData({ page: p });
      this.loadSearch();
    }
  },

  // ── navigation ──

  onRecordTap(e) {
    if (!this.data.community) return;
    wx.navigateTo({
      url: '/pages/community-overview/overview?community=' + encodeURIComponent(this.data.community) + '&zone_name=' + encodeURIComponent(this.data.zoneName || '')
    });
  },

  onViewOverview() {
    if (this.data.community) {
      wx.navigateTo({
        url: '/pages/community-overview/overview?community=' + encodeURIComponent(this.data.community) + '&zone_name=' + encodeURIComponent(this.data.zoneName || '')
      });
    }
  },

  onRetry() {
    if (this.data.community) {
      this.loadCommunity();
    } else {
      this.loadSearch();
    }
  }
});
