Component({
  data: {
    selected: 0,
    list: [
      {pagePath: '/pages/home/home', text: '首页', icon: '🏠'},
      {pagePath: '/pages/index/index', text: '找房', icon: '🔍'},
      {pagePath: '/pages/trends/trends', text: '成交', icon: '📊'},
      {pagePath: '/pages/mine/mine', text: '我的', icon: '👤'},
    ],
    showCollect: false  // 第5个tab，仅管理员可见
  },

  lifetimes: {
    attached() {
      this.checkAdmin();
    }
  },

  methods: {
    checkAdmin() {
      const app = getApp();
      const isAdmin = app && app.globalData && app.globalData.isAdmin;
      if (isAdmin) {
        this.setData({
          showCollect: true,
          list: this.data.list.concat([{
            pagePath: '/pages/swipe-collect/swipe-collect',
            text: '入库',
            icon: '📥'
          }])
        });
      }
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      if (!item) return;
      wx.switchTab({ url: item.pagePath });
      this.setData({ selected: idx });
    }
  }
});
