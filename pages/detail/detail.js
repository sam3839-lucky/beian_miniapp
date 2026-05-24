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
    _totalWan: 0
  },

  async onLoad() {
    try {
      // 等待 globalData 被赋值（navigateTo 可能在赋值完成前触发 onLoad）
      let ctx = getApp().globalData.detailUnit;
      if (!ctx) {
        // 延迟重试一次
        await new Promise(r => setTimeout(r, 100));
        ctx = getApp().globalData.detailUnit;
      }
      getApp().globalData.detailUnit = null;
      const unit = (ctx && ctx.unit) || {};
      const project = (ctx && ctx.project) || '';
      const building = (ctx && ctx.building) || '';

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
      const rate = getApp().globalData.mortgageRate || 0.0305;

      this.setData({
        unit, project, building,
        area, unitPrice: up, totalPrice: tp,
        status: sm.text, statusColor: sm.color,
        _totalWan: tw,
        mortgageRateText: (rate * 100).toFixed(2) + '%'
      });
      this.calcMortgage();
    } catch (e) {
      wx.showToast({ title: '数据错误', icon: 'none' });
    }
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
  }
});
