const api = require('../../utils/api');

Page({
  data: {
    zones: ['全深圳'],
    projects: [{name: '选择小区', value: ''}],
    buildings: ['全部楼栋'],
    zoneIdx: 0,
    projectIdx: 0,
    buildingIdx: 0,
    projectName: '',
    buildingName: '',
    search: '',
    units: [],
    floors: [],
    groups: {},
    stats: null,
    loading: false,
    priceRanges: ['全部', '200-300万', '300-500万', '500-800万', '800-1200万', '自定义'],
    priceActive: 0,
    areaRanges: ['全部', '70-90㎡', '90-120㎡', '120-150㎡', '150-200㎡', '自定义'],
    areaActive: 0,
    priceFilter: { min: 0, max: 999999 },
    areaFilter: { min: 0, max: 9999 },
    // 瞬搜
    quickSearch: '',
    searchResults: [],
    searchTapped: false,
    visibleFloors: [],
    hasMore: false,
  },

  onShowAll() {
    this.setData({ visibleFloors: this.data.floors, hasMore: false });
  },

  onLoad() {
    this.loadZones();
  },

  onShow() {
    const app = getApp();
    const params = app.globalData.filterParams;

    // 扫码直达：海报二维码携带项目名 scene
    const scene = app.globalData.launchScene;
    if (scene) {
      app.globalData.launchScene = null; // 仅消费一次
      if (!params) {
        // 直接用 scene 作为项目名跳转
        this._pendingProject = scene;
        if (this.data.zones.length > 1) {
          this._applyPendingNav();
        }
        return;
      }
    }

    if (!params) return;
    app.globalData.filterParams = null;

    if (params.zone) this._pendingZone = params.zone;
    if (params.project) this._pendingProject = params.project;
    if (params.search) this.setData({ search: params.search });
    if (params.price_min) {
      this._pendingPrice = { min: params.price_min, max: params.price_max || 999999 };
    }

    // zones 已加载：直接执行；否则等 loadZones 回调触发
    if (this.data.zones.length > 1) {
      this._applyPendingNav();
    }
  },

  async loadZones() {
    try {
      const data = await api.getZones();
      this.setData({ zones: ['全深圳', ...data.zones] });
      // zones 加载完毕，消费待处理的导航参数
      if (this._pendingZone || this._pendingProject || this._pendingPrice) {
        this._applyPendingNav();
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 区域加载完成后，自动执行从主页传来的导航
  async _applyPendingNav() {
    const zone = this._pendingZone;
    const project = this._pendingProject;
    const priceFilter = this._pendingPrice;
    this._pendingZone = null;
    this._pendingProject = null;
    this._pendingPrice = null;

    if (zone) {
      let idx = this.data.zones.indexOf(zone);
      if (idx <= 0) {
        // zone 不在列表中：追加并选中
        this.data.zones.push(zone);
        idx = this.data.zones.length - 1;
        this.setData({ zones: this.data.zones, zoneIdx: idx });
      } else {
        this.setData({ zoneIdx: idx });
      }
      await this.onZoneChange({ detail: { value: idx } });
      if (project) {
        this._selectProject(project);
      }
    } else if (project) {
      await this._selectGlobalProject(project);
    }

    if (priceFilter) {
      this.setData({ priceFilter, priceActive: 5 });
    }
  },

  _selectProject(project) {
    // 精确匹配
    let pi = this.data.projects.findIndex(p => p.value === project);
    // 宽松匹配：项目名包含搜索词（如搜"御景"→"宝昌利御景公馆"）
    if (pi <= 0) {
      const pj = project.trim();
      pi = this.data.projects.findIndex(p =>
        p.value && (p.value.trim() === pj || p.value.includes(pj))
      );
    }
    if (pi <= 0) {
      // 仍不匹配：追加到列表并选中
      const items = [...this.data.projects, { name: `${this.data.projects.length}. ${project}`, value: project }];
      pi = items.length - 1;
      this.setData({ projects: items });
    }
    // 使用列表中的真实项目名，而非传入参数（两表名字可能不同）
    const realName = this.data.projects[pi] ? this.data.projects[pi].value : project;
    this.setData({ projectIdx: pi, projectName: realName });
    if (pi > 0) {
      this.onProjectChange({ detail: { value: pi } });
    }
  },

  async _selectGlobalProject(project) {
    try {
      const data = await api.getProjects('');
      const pj = project.trim();
      let idx = data.projects.indexOf(project);
      if (idx < 0) {
        idx = data.projects.findIndex(p => p.trim() === pj || p.includes(pj));
      }
      const items = [{name: '选择小区', value: ''}].concat(
        data.projects.map((p, i) => ({name: `${i + 1}. ${p}`, value: p}))
      );
      let pi = items.findIndex(p => p.value === project);
      if (pi <= 0) {
        pi = items.findIndex(p => p.value && (p.value.trim() === pj || p.value.includes(pj)));
      }
      if (pi <= 0) {
        items.push({ name: `${items.length}. ${project}`, value: project });
        pi = items.length - 1;
      }
      this.setData({ projects: items });
      const realName = items[pi] ? items[pi].value : project;
      this.setData({ projectIdx: pi, projectName: realName });
      if (pi > 0) {
        this.onProjectChange({ detail: { value: pi } });
      }
    } catch (e) {
      // 静默失败
    }
  },

  async onZoneChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ zoneIdx: idx, projectIdx: 0, buildingIdx: 0,
      projects: [{name: '选择小区', value: ''}], buildings: ['全部楼栋'],
      projectName: '', buildingName: '',
      units: [], floors: [], groups: {}, stats: null });
    const zone = idx === 0 ? '' : this.data.zones[idx];
    const cacheKey = 'projects_' + (zone || 'all');

    // 先读缓存，即时展示
    try {
      const cached = wx.getStorageSync(cacheKey);
      if (cached && cached.length) {
        this.setData({ projects: cached });
      }
    } catch (e) { /* ignore */ }

    try {
      const projectsData = await api.getProjects(zone);
      const items = [{name: '选择小区', value: ''}].concat(
        projectsData.projects.map((p, i) => ({name: `${i + 1}. ${p}`, value: p}))
      );
      // 写入缓存
      try { wx.setStorageSync(cacheKey, items); } catch (e) { /* ignore */ }
      this.setData({ projects: items });

      // 全深圳也拉统计
      let statsData = null;
      try { statsData = await api.getZoneStats(zone, this.data.priceFilter, this.data.areaFilter); } catch(e) { /* ignore */ }
      this.setData({ stats: statsData });
    } catch (e) {
      wx.showToast({ title: '加载小区失败', icon: 'none' });
    }
  },

  async onProjectChange(e) {
    const idx = parseInt(e.detail.value);
    if (idx === 0) {
      this.setData({ projectIdx: 0, projectName: '', buildingIdx: 0,
        buildings: ['全部楼栋'], units: [], floors: [], groups: {}, stats: null });
      return;
    }
    const name = this.data.projects[idx].value;
    this.setData({ projectIdx: idx, projectName: name, buildingIdx: 0, buildings: ['全部楼栋'] });
    try {
      const [bldgData] = await Promise.all([api.getBuildings(name)]);
      this.setData({ buildings: ['全部楼栋', ...bldgData.buildings] });
      this.loadUnits(name);
    } catch (e) {
      wx.showToast({ title: '加载楼栋失败', icon: 'none' });
    }
  },

  onBuildingChange(e) {
    const idx = parseInt(e.detail.value);
    const name = idx === 0 ? '' : this.data.buildings[idx];
    this.setData({ buildingIdx: idx, buildingName: name });
    this.loadUnits();
  },

  onSearchInput(e) {
    this.setData({ search: e.detail.value });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    if (!this.data.projectName) return;
    this._searchTimer = setTimeout(() => this.loadUnits(), 300);
  },

  onPriceFilter(e) {
    const idx = e.detail.index;
    const ranges = [
      { min: 0, max: 999999 }, { min: 200, max: 300 },
      { min: 300, max: 500 }, { min: 500, max: 800 },
      { min: 800, max: 1200 }, { min: 0, max: 999999 }
    ];
    this.setData({ priceActive: idx, priceFilter: ranges[idx] || ranges[0] });
    this.loadUnits();
  },

  onAreaFilter(e) {
    const idx = e.detail.index;
    const ranges = [
      { min: 0, max: 9999 }, { min: 70, max: 90 },
      { min: 90, max: 120 }, { min: 120, max: 150 },
      { min: 150, max: 200 }, { min: 0, max: 9999 }
    ];
    this.setData({ areaActive: idx, areaFilter: ranges[idx] || ranges[0] });
    this.loadUnits();
  },

  async loadUnits(projectName) {
    const pn = projectName || this.data.projectName;
    if (!pn) return;
    this.setData({ loading: true });
    try {
      const { buildingName, search, priceFilter, areaFilter } = this.data;
      const [unitData, statsData] = await Promise.all([
        api.getUnits(pn, buildingName, search, priceFilter, areaFilter),
        api.getStats(pn, buildingName, priceFilter, areaFilter)
      ]);
      this.setData({ stats: statsData, loading: false });
      this.groupAndRender(unitData.units);
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载房源失败', icon: 'none' });
    }
  },

  groupAndRender(units) {
    const groups = {};
    units.forEach(u => {
      const f = u.floor || '?';
      if (!groups[f]) groups[f] = [];
      groups[f].push(u);
    });
    const floors = Object.keys(groups).sort((a, b) => (b === '?' ? -1 : Number(b)) - (a === '?' ? -1 : Number(a)));
    const visibleFloors = floors.slice(0, 3);
    this.setData({ units, floors, groups, visibleFloors, hasMore: floors.length > 3 });
  },

  onCardTap(e) {
    const unit = (e.detail && e.detail.unit) || {};
    if (!unit.unit_no) return;
    const p = [
      'unit_no=' + encodeURIComponent(unit.unit_no || ''),
      'area=' + (unit.built_area || 0),
      'up=' + (unit.unit_price || 0),
      'tp=' + (unit.total_price || 0),
      'status=' + encodeURIComponent(unit.status || '未售'),
      'project=' + encodeURIComponent(this.data.projectName || ''),
      'building=' + encodeURIComponent(this.data.buildingName || '')
    ].join('&');
    wx.navigateTo({ url: '/pages/detail/detail?' + p });
  },

  // ── 瞬搜 ──
  onQuickSearchInput(e) {
    const v = e.detail.value;
    this.setData({ quickSearch: v, searchTapped: false });
    if (this._timer) clearTimeout(this._timer);
    if (!v.trim()) {
      this.setData({ searchResults: [] });
      return;
    }
    this._timer = setTimeout(() => this._doQuickSearch(v.trim()), 300);
  },

  onQuickSearchConfirm() {
    const v = this.data.quickSearch.trim();
    if (!v) return;
    this.setData({ searchTapped: true });
    if (this._timer) clearTimeout(this._timer);
    this._doQuickSearch(v);
  },

  async _doQuickSearch(q) {
    try {
      const data = await api.quickSearch(q);
      const results = (data.results || []).map(r => ({
        ...r,
        avg_unit_w: (r.avg_unit / 10000).toFixed(1),
      }));
      this.setData({ searchResults: results });
    } catch (e) {
      console.error('quick search failed', e);
    }
  },

  onClearQuickSearch() {
    this.setData({ quickSearch: '', searchResults: [], searchTapped: false });
  },

  onQuickResultTap(e) {
    const { project, zone } = e.currentTarget.dataset;
    this.setData({ quickSearch: '', searchResults: [], searchTapped: false });
    this._quickSelectProject(project, zone);
  },

  async _quickSelectProject(project, zone) {
    // 选择区域并加载项目
    if (zone) {
      let zi = this.data.zones.indexOf(zone);
      if (zi <= 0) {
        this.data.zones.push(zone);
        zi = this.data.zones.length - 1;
        this.setData({ zones: this.data.zones, zoneIdx: zi });
      } else {
        this.setData({ zoneIdx: zi });
      }
      await this.onZoneChange({ detail: { value: zi } });
    }
    // 区域加载完毕后再选项目
    this._selectProject(project);
  },

  onShareAppMessage() {
    const pn = this.data.projectName;
    const path = pn
      ? '/pages/index/index?project=' + encodeURIComponent(pn)
      : '/pages/index/index';
    return {
      title: pn ? '看看' + pn + '的备案价' : '深圳新房备案价查询',
      path
    };
  },
});
