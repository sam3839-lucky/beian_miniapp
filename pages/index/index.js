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
    areaFilter: { min: 0, max: 9999 }
  },

  onLoad() {
    this.loadZones();
  },

  onShow() {
    const app = getApp();
    const params = app.globalData.filterParams;
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
      const idx = this.data.zones.indexOf(zone);
      if (idx > 0) {
        this.setData({ zoneIdx: idx });
        await this.onZoneChange({ detail: { value: idx } });
        if (project) {
          this._selectProject(project);
        }
      }
    } else if (project) {
      await this._selectGlobalProject(project);
    }

    if (priceFilter) {
      this.setData({ priceFilter, priceActive: 5 });
    }
  },

  _selectProject(project) {
    const pi = this.data.projects.findIndex(p => p.value === project);
    if (pi > 0) {
      this.setData({ projectIdx: pi, projectName: project });
      this.onProjectChange({ detail: { value: pi } });
    }
  },

  async _selectGlobalProject(project) {
    try {
      const data = await api.getProjects('');
      const idx = data.projects.indexOf(project);
      if (idx >= 0) {
        // 注入该项目到列表并选中
        const items = [{name: '选择小区', value: ''}].concat(
          data.projects.map((p, i) => ({name: `${i + 1}. ${p}`, value: p}))
        );
        const pi = items.findIndex(p => p.value === project);
        this.setData({ projects: items, projectIdx: pi, projectName: project });
        if (pi > 0) {
          this.onProjectChange({ detail: { value: pi } });
        }
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
    if (idx === 0) return;
    try {
      const [data, statsData] = await Promise.all([
        api.getProjects(this.data.zones[idx]),
        api.getZoneStats(this.data.zones[idx], this.data.priceFilter, this.data.areaFilter)
      ]);
      const items = [{name: '选择小区', value: ''}].concat(
        data.projects.map((p, i) => ({name: `${i + 1}. ${p}`, value: p}))
      );
      this.setData({ projects: items, stats: statsData });
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
      this.loadUnits();
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
    if (this.data.projectName) this.loadUnits();
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

  async loadUnits() {
    if (!this.data.projectName) return;
    this.setData({ loading: true });
    try {
      const { projectName, buildingName, search, priceFilter, areaFilter } = this.data;
      const [unitData, statsData] = await Promise.all([
        api.getUnits(projectName, buildingName, search, priceFilter, areaFilter),
        api.getStats(projectName, buildingName, priceFilter, areaFilter)
      ]);
      this.setData({ allUnits: unitData.units, stats: statsData, loading: false });
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
    this.setData({ units, floors, groups });
  },

  onCardTap(e) {
    const unit = e.detail.unit;
    wx.navigateTo({
      url: `/pages/detail/detail?data=${encodeURIComponent(JSON.stringify(unit))}&project=${encodeURIComponent(this.data.projectName)}&building=${encodeURIComponent(this.data.buildingName)}`
    });
  }
});
