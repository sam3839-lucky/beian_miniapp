const api = require('../../utils/api');

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
    discount: 85,
    afterTotal: '--',
    afterUnit: '--',
    afterDown15: '--',
    calcMonthly: '--',
    mortgageRateText: '3.05%',
    subscribed: false,
    _totalWan: 0,
    bldStats: [],
    bldActive: '',
    bldTotalSold: 0,
  },

  onLoad(opts) {
    // URL 传参，逐字段解析
    const unit = {
      unit_no:     decodeURIComponent(opts.unit_no || ''),
      built_area:  parseFloat(opts.area) || 0,
      unit_price:  parseFloat(opts.up) || 0,
      total_price: parseFloat(opts.tp) || 0,
      status:      decodeURIComponent(opts.status || '期房待售'),
    };
    const project  = decodeURIComponent(opts.project || '');
    const building = decodeURIComponent(opts.building || '');

    const area = unit.built_area ? unit.built_area + '㎡' : '-';
    const up = unit.unit_price ? (unit.unit_price / 10000).toFixed(2) + '万/㎡' : '-';
    const tw = unit.total_price;
    const tp = tw > 0 ? tw.toFixed(1) + '万' : '-';

    const statusMap = {
      '期房待售':  { text: '可售',       color: '#07C160' },
      '在建抵押':   { text: '可售(抵押)',  color: '#FF9800' },
      '已签认购书': { text: '已认购',     color: '#1890FF' },
      '已签合同':   { text: '已签合同',    color: '#FAAD14' },
      '已录入合同': { text: '已签合同',    color: '#FAAD14' },
      '已备案':    { text: '已备案',      color: '#FF8C00' },
      '首次登记':   { text: '已登记',      color: '#722ED1' },
      '安居房':    { text: '安居房',      color: '#52C41A' },
      '共有产权房': { text: '共有产权',    color: '#13C2C2' },
      '自动锁定':   { text: '锁定',       color: '#FF4D4F' },
      '区局锁定':   { text: '锁定',       color: '#FF4D4F' },
      '市局锁定':   { text: '锁定',       color: '#FF4D4F' },
      '司法查封':   { text: '查封',       color: '#FF4D4F' },
    };
    const sm = statusMap[unit.status] || { text: unit.status, color: '#888' };
    const rate = getApp().globalData.mortgageRate || 0.0305;

    this.loadBuildingStats();
    this.setData({
      unit, project, building,
      area, unitPrice: up, totalPrice: tp,
      status: sm.text, statusColor: sm.color,
      _totalWan: tw,
      mortgageRateText: (rate * 100).toFixed(2) + '%'
    });
    this.calcMortgage();
  },

  onDiscountInput(e) {
    const v = parseInt(e.detail.value) || 85;
    const discount = Math.max(85, Math.min(100, v));
    this.setData({ discount });
    this.calcMortgage();
  },

  onDiscountChip(e) {
    const v = parseInt(e.currentTarget.dataset.v);
    this.setData({ discount: v });
    this.calcMortgage();
  },

  calcMortgage() {
    const tw = this.data._totalWan;
    if (!tw || tw <= 0) return;
    const discount = this.data.discount;
    const afterTotalWan = tw * discount / 100;
    const afterUnitPrice = this.data.unitPrice ? (parseFloat(this.data.unitPrice.replace('万/㎡','')) * 10000 * discount / 100) : 0;
    const down15 = Math.round(afterTotalWan * 0.15);
    const loan = afterTotalWan - down15;
    const rate = getApp().globalData.mortgageRate || 0.0305;
    const mr = rate / 12;
    const months = 360;
    const factor = (mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1);
    const monthly = Math.round(loan * factor * 10000) / 10000;

    this.setData({
      afterTotal: afterTotalWan.toFixed(1) + '万',
      afterUnit: afterUnitPrice > 0 ? (afterUnitPrice / 10000).toFixed(2) + '万/㎡' : '--',
      afterDown15: down15.toFixed(0) + '万',
      calcMonthly: monthly >= 1 ? monthly.toFixed(2) + '万' : Math.round(monthly * 10000) + '元'
    });
  },

  async loadBuildingStats() {
    if (!this.data.project) return;
    try {
      const d = await api.getBuildingStats(this.data.project);
      const buildings = d.buildings || [];
      const totalSold = buildings.reduce((s, b) => s + (b.sold || 0), 0);
      this.setData({ bldStats: buildings, bldTotalSold: totalSold });
    } catch (e) { /* ignore */ }
  },

  onBldRowTap(e) {
    const bld = e.currentTarget.dataset.building;
    this.setData({ bldActive: this.data.bldActive === bld ? '' : bld });
  },

  onSharePoster() {
    const project = this.data.project;
    if (!project) return;

    // 免费用户检查海报用量
    const app = getApp();
    const openid = app.globalData.openid;
    if (openid && app.globalData.tier === 'free') {
      const max = app.globalData.tierLimits.posters || 3;
      const used = (app.globalData.postersUsed || 0);
      if (used >= max) {
        wx.showModal({
          title: '今日海报已达上限',
          content: `免费版每天可生成 ${max} 张海报。升级专业版无限使用。`,
          confirmText: '升级',
          success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/pay/pay' }); }
        });
        return;
      }
      api.incrementUsage(openid, 'posters').then(u => {
        app.globalData.postersUsed = u.used;
      }).catch(() => {});
    }

    wx.showLoading({ title: '生成海报中...' });
    const baseUrl = app.globalData.baseUrl || 'https://ruiheqi.cn';
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
  },

  onShareAppMessage() {
    const u = this.data.unit;
    const pn = this.data.project;
    const title = pn
      ? pn + ' ' + (u.unit_no || '') + ' - 备案价' + this.data.totalPrice
      : '深圳备案价详情';
    const path = [
      'unit_no=' + encodeURIComponent(u.unit_no || ''),
      'area=' + (u.built_area || 0),
      'up=' + (u.unit_price || 0),
      'tp=' + (u.total_price || 0),
      'status=' + encodeURIComponent(u.status || '未售'),
      'project=' + encodeURIComponent(pn),
      'building=' + encodeURIComponent(this.data.building || '')].join('&');
    return {
      title,
      path: '/pages/detail/detail?' + path
    };
  },
});
