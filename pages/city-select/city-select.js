const ALL_CITIES = [
  "北京","天津","石家庄","太原","呼和浩特","沈阳","大连","长春","哈尔滨",
  "上海","南京","杭州","宁波","合肥","福州","厦门","南昌","济南","青岛",
  "郑州","武汉","长沙","广州","深圳","南宁","海口","重庆","成都","贵阳",
  "昆明","西安","兰州","西宁","银川","乌鲁木齐",
  "唐山","秦皇岛","包头","丹东","锦州","吉林","牡丹江","无锡","徐州",
  "扬州","温州","金华","蚌埠","安庆","泉州","九江","赣州","烟台","济宁",
  "洛阳","平顶山","宜昌","襄阳","岳阳","常德","韶关","湛江","惠州","桂林",
  "北海","三亚","泸州","南充","遵义","大理"
];

const TIER1 = ["北京","上海","广州","深圳"];
const HOT = ["成都","杭州","南京","武汉","西安","重庆","苏州","天津"];
const CAPITALS = ["长沙","福州","贵阳","哈尔滨","合肥","济南","昆明","兰州","南昌","南宁","沈阳","石家庄","太原","长春","郑州","海口"];

Page({
  data: {
    search: '',
    recent: [],
    filtered: [],
    showAll: false,
    letterGroups: [],
    TIER1: TIER1,
    HOT: HOT,
    CAPITALS: CAPITALS,
  },

  onLoad() {
    const recent = wx.getStorageSync('recent_cities') || [];
    // 预计算字母分组
    const groupsMap = {};
    for (const c of ALL_CITIES) {
      const first = c[0];
      if (!groupsMap[first]) groupsMap[first] = [];
      groupsMap[first].push(c);
    }
    const letterGroups = [];
    // 手动分组，保持字母顺序
    const ranges = [['A','D'],['F','J'],['K','N'],['Q','S'],['T','Z']];
    for (const [start, end] of ranges) {
      const cities = [];
      for (const [letter, cs] of Object.entries(groupsMap).sort()) {
        if (letter >= start && letter <= end) cities.push(...cs);
      }
      if (cities.length) letterGroups.push({ letter: start + '-' + end, cities });
    }
    this.setData({ recent: recent.slice(0, 4), letterGroups });
  },

  onSearchInput(e) {
    const v = e.detail.value.trim();
    this.setData({ search: v });
    if (v) {
      const filtered = ALL_CITIES.filter(c => c.includes(v) || this._pinyinMatch(c, v));
      this.setData({ filtered });
    }
  },

  _pinyinMatch(city, q) {
    // simple: check if city starts with or contains the query
    return city.includes(q) || city[0] === q;
  },

  onCityTap(e) {
    const city = e.currentTarget.dataset.city;
    this._saveRecent(city);
    // 返回上一页并传参数
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && prev.onCitySelected) {
      prev.onCitySelected(city);
    }
    wx.navigateBack();
  },

  _saveRecent(city) {
    let recent = wx.getStorageSync('recent_cities') || [];
    recent = [city, ...recent.filter(c => c !== city)].slice(0, 4);
    wx.setStorageSync('recent_cities', recent);
  },

  onToggleAll() {
    this.setData({ showAll: !this.data.showAll });
  },

  getLetterGroups() {
    const groups = {};
    for (const c of ALL_CITIES) {
      const first = c[0];
      if (!groups[first]) groups[first] = [];
      groups[first].push(c);
    }
    return groups;
  },

  onShareAppMessage() {
    return { title: '选择城市', path: '/pages/city-select/city-select' };
  }
});
