const BASE_URL = 'https://ruiheqi.cn';
const MORTGAGE_RATE = 0.0315;  // LPR 利率，更新时改这里

App({
  globalData: {
    baseUrl: BASE_URL,
    openid: '',
    mortgageRate: MORTGAGE_RATE
  },

  onLaunch() {
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
              }
            },
            fail: () => {}
          });
        }
      },
      fail: () => {}
    });
  }
});
