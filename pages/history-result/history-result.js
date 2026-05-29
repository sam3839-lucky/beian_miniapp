const API_BASE = 'https://ruiheqi.cn/api/resale';

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
      this.setData({
        summary: {
          total: s.total || 0,
          max_price: s.max_price ? (s.max_price / 10000).toFixed(1) + '万/㎡' : '--',
          max_price_date: fmt(s.max_price_date),
          min_price: s.min_price ? (s.min_price / 10000).toFixed(1) + '万/㎡' : '--',
          min_price_date: fmt(s.min_price_date)
        },
        trend: res.trend || [],
        zoneName: this.data.zoneName || '',
        zoneName: res.zone || this.data.zoneName || '',
        loading: false
      }, () => {
        if (res.trend && res.trend.length) this.drawTrendChart();
      });
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

    // 12-bucket grouping
    const step = this.data.trendYears;
    const buckets = [];
    for (let i = 0; i < raw.length; i += step) {
      const slice = raw.slice(i, Math.min(i + step, raw.length));
      const sumPrice = slice.reduce((s, t) => s + (parseFloat(t.avg_price) || 0), 0);
      const sumCnt = slice.reduce((s, t) => s + (t.cnt || 0), 0);
      buckets.push({
        month: slice[0].month,
        avg_price: sumCnt > 0 ? Math.round(sumPrice / slice.length) : 0,
        cnt: sumCnt
      });
    }
    const trend = buckets.slice(-12);
    if (!trend.length) return;

    // Read actual canvas size for accurate rendering on all devices
    const that = this;
    const q = wx.createSelectorQuery().in(this);
    q.select('.trend-canvas').boundingClientRect().exec(res => {
      if (!res || !res[0] || !res[0].width) return;
      const w = res[0].width;
      const h = res[0].height || 160;

    const ctx = wx.createCanvasContext('trendCanvas', that);

    const pad = { top: 20, right: 12, bottom: 28, left: 40 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    const prices = trend.map(t => t.avg_price).filter(p => p > 0);
    if (!prices.length) return;

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
    trend.forEach((t, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + ph * (1 - (t.avg_price - minP) / range);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // dots + labels
    ctx.setFontSize(9);
    ctx.setTextAlign('center');
    // Show fewer labels on narrow screens (< 320px)
    const labelStep = w < 320 ? 3 : 2;
    trend.forEach((t, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + ph * (1 - (t.avg_price - minP) / range);
      // dot
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.setFillStyle('#FF8C00');
      ctx.fill();
      // price label (every point)
      const priceWan = (t.avg_price / 10000).toFixed(2);
      ctx.setFillStyle('#FF4D4F');
      ctx.fillText(priceWan + '万', x, y - 8);
      // month label (sparse)
      if (i % labelStep === 0) {
        ctx.setFillStyle('#999');
        ctx.fillText(t.month || '', x, h - 4);
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
