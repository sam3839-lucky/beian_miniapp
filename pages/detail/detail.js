Page({
  data: {
    unit: {},
    project: '',
    building: '',
    area: '',
    unitPrice: '',
    totalPrice: '',
    status: '',
    statusColor: '',
    calcRatio: 15,
    discount: 0,
    discountIdx: 0,
    discountOptions: ['无折扣', '99折', '98折', '97折', '96折', '95折', '94折', '93折', '92折', '91折', '90折', '89折', '88折', '87折', '86折', '85折'],
    discountValues:  [0, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85],
    dealPrice: '',
    calcDown: '--',
    calcLoan: '--',
    calcMonthly: '--',
    mortgageRateText: '3.05%',
    subscribed: false,
    _totalWan: 0
  },

  onLoad(opts) {
    // URL 传参，逐字段解析
    const unit = {
      unit_no:     decodeURIComponent(opts.unit_no || ''),
      built_area:  parseFloat(opts.area) || 0,
      unit_price:  parseFloat(opts.up) || 0,
      total_price: parseFloat(opts.tp) || 0,
      status:      decodeURIComponent(opts.status || '未售'),
    };
    const project  = decodeURIComponent(opts.project || '');
    const building = decodeURIComponent(opts.building || '');

    const area = unit.built_area ? unit.built_area + '㎡' : '-';
    const up = unit.unit_price ? (unit.unit_price / 10000).toFixed(2) + '万/㎡' : '-';
    const tw = unit.total_price;
    const tp = tw > 0 ? tw.toFixed(1) + '万' : '-';

    const statusMap = {
      '未售':   { text: '可售',     color: '#07C160' },
      '已网签': { text: '已网签',   color: '#FAAD14' },
      '已备案': { text: '已备案',   color: '#FF8C00' },
      '已转移登记': { text: '已转移登记', color: '#D9D9D9' }
    };
    const sm = statusMap[unit.status] || { text: unit.status, color: '#888' };
    const rate = getApp().globalData.mortgageRate || 0.0305;

    this.setData({
      unit, project, building,
      area, unitPrice: up, totalPrice: tp,
      status: sm.text, statusColor: sm.color,
      _totalWan: tw,
      mortgageRateText: (rate * 100).toFixed(2) + '%'
    });
    this.calcMortgage();
  },

  onDiscountChange(e) {
    const idx = parseInt(e.detail.value);
    const discount = this.data.discountValues[idx];
    const tw = this.data._totalWan;
    const dealPrice = discount > 0 ? (tw * discount / 100).toFixed(1) : '';
    this.setData({ discountIdx: idx, discount, dealPrice });
    this.calcMortgage();
  },

  onRatioTap(e) {
    this.setData({ calcRatio: parseInt(e.currentTarget.dataset.ratio) });
    this.calcMortgage();
  },

  calcMortgage() {
    // 折扣价优先，否则用备案总价
    const d = this.data.discount;
    const total = (d > 0) ? this.data._totalWan * d / 100 : this.data._totalWan;
    if (!total || total <= 0) return;
    const ratio = this.data.calcRatio / 100;
    const down = Math.round(total * ratio);
    const loan = total - down;
    const rate = getApp().globalData.mortgageRate || 0.0315;
    const mr = rate / 12;
    const months = 360;
    const factor = (mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1);
    const monthly = Math.round(loan * factor * 10000) / 10000;

    this.setData({
      calcDown: down.toFixed(0),
      calcLoan: loan.toFixed(0),
      calcMonthly: monthly.toFixed(2)
    });
  },

  onSharePoster() {
    const project = this.data.project;
    if (!project) return;
    wx.showLoading({ title: '生成海报中...' });
    const baseUrl = getApp().globalData.baseUrl || 'https://ruiheqi.cn';
    const url = baseUrl + '/api/generate-poster?project=' + encodeURIComponent(project);
    wx.downloadFile({
      url,
      success: res => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showToast({ title: '生成失败', icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册，去分享吧', icon: 'none', duration: 2000 }),
          fail: () => {
            wx.showToast({ title: '请授权保存图片', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      }
    });
  },

  onToggleFollow() {
    const openid = getApp().globalData.openid;
    if (!openid) {
      wx.showToast({ title: '请稍后再试', icon: 'none' });
      return;
    }
    const project = this.data.project;
    const api = require('../../utils/api');
    const subscribed = this.data.subscribed;

    if (subscribed) {
      api.unsubscribe(openid, project).then(() => {
        this.setData({ subscribed: false });
        wx.showToast({ title: '已取消关注', icon: 'none' });
      });
    } else {
      // 微信订阅消息授权
      wx.requestSubscribeMessage({
        tmplIds: ['TEMPLATE_ID_PLACEHOLDER'],  // 替换为实际模板 ID
        success: () => {
          api.subscribe(openid, project).then(res => {
            if (res.count >= res.max) {
              wx.showToast({ title: '已达关注上限(5个)', icon: 'none' });
            }
            this.setData({ subscribed: true });
            wx.showToast({ title: '已关注', icon: 'success' });
          });
        },
        fail: () => {
          wx.showToast({ title: '需要授权才能接收通知', icon: 'none' });
        }
      });
    }
  }
});
