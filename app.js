const BASE_URL = 'https://ruiheqi.cn';
const MORTGAGE_RATE = 0.0305;  // LPR 利率，更新时改这里

App({
  globalData: {
    baseUrl: BASE_URL,
    openid: '',
    mortgageRate: MORTGAGE_RATE,
    launchScene: null,  // 扫码进入时携带的项目名
    tier: 'free',       // 会员等级
    tierLimits: {}      // 用量限制
  },

  onLaunch(options) {
    // 解析扫码 scene（base64url 编码的项目名，调服务端解码）
    if (options && options.query && options.query.scene) {
      const scene = decodeURIComponent(options.query.scene);
      console.log('launch scene:', scene);
      wx.request({
        url: BASE_URL + '/api/resolve-scene?code=' + encodeURIComponent(scene),
        success: res => {
          if (res.data && res.data.project_name) {
            this.globalData.launchScene = res.data.project_name;
          }
        },
        fail: () => {}
      });
    }
    // 延迟登录，不阻塞页面加载
    setTimeout(() => this.login(), 500);
  },

  login() {
    wx.login({
      success: res => {
        if (res.code) {
          wx.request({
            url: `${BASE_URL}/api/wx-login`,
            method: 'POST',
            data: { code: res.code },
            success: resp => {
              if (resp.data && resp.data.openid) {
                this.globalData.openid = resp.data.openid;
                this.loadTier(resp.data.openid);
              }
            },
            fail: () => {}
          });
        }
      },
      fail: () => {}
    });
  },

  loadTier(openid) {
    wx.request({
      url: `${BASE_URL}/api/user-tier?openid=${encodeURIComponent(openid)}`,
      success: resp => {
        if (resp.data) {
          this.globalData.tier = resp.data.tier || 'free';
          this.globalData.tierLimits = resp.data.limits || {};
          this.globalData.searchesUsed = resp.data.searches_used || 0;
          this.globalData.postersUsed = resp.data.posters_used || 0;
        }
      },
      fail: () => {}
    });
  }
});
