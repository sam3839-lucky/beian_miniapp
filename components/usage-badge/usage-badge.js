Component({
  properties: {
    used: { type: Number, value: 0 },      // 已使用次数
    max: { type: Number, value: 20 },       // 上限
    label: { type: String, value: '搜索' },  // 功能名（搜索/海报/关注）
    show: { type: Boolean, value: false }    // 是否显示
  },

  data: {
    remaining: 0,
    pct: 0
  },

  observers: {
    'used, max': function (used, max) {
      this.setData({
        remaining: Math.max(0, max - used),
        pct: Math.min(100, Math.round(used / max * 100))
      });
    }
  },

  methods: {
    onUpgrade() {
      wx.navigateTo({ url: '/pages/pay/pay' });
    }
  }
});
