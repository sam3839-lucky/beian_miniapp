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
    calcRatio: 30,
    calcDown: '--',
    calcLoan: '--',
    calcMonthly: '--',
    _totalWan: 0
  },

  onLoad(options) {
    try {
      const unit = JSON.parse(decodeURIComponent(options.data || '{}'));
      const project = decodeURIComponent(options.project || '');
      const building = decodeURIComponent(options.building || '');

      const area = (unit.built_area || '-') + '㎡';
      const up = unit.unit_price ? (unit.unit_price / 10000).toFixed(2) + '万/㎡' : '-';
      const tw = unit.total_price > 0 ? unit.total_price : 0;
      const tp = tw > 0 ? tw.toFixed(1) + '万' : '-';

      const statusMap = {
        '未售':   { text: '可售',     color: '#07C160' },
        '已网签': { text: '已网签',   color: '#FAAD14' },
        '已备案': { text: '已备案',   color: '#FF8C00' },
        '已转移登记': { text: '已转移登记', color: '#D9D9D9' }
      };
      const st = unit.status || '未售';
      const sm = statusMap[st] || { text: st, color: '#888' };

      this.setData({
        unit, project, building,
        area, unitPrice: up, totalPrice: tp,
        status: sm.text, statusColor: sm.color,
        _totalWan: tw
      });
      this.calcMortgage();
    } catch (e) {
      wx.showToast({ title: '数据错误', icon: 'none' });
    }
  },

  onRatioTap(e) {
    this.setData({ calcRatio: parseInt(e.currentTarget.dataset.ratio) });
    this.calcMortgage();
  },

  calcMortgage() {
    const total = this.data._totalWan;
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
  }
});
