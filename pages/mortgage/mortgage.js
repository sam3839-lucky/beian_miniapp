const mortgage = require('../../utils/mortgage');

Page({
  data: {
    mode: 'installment',   // 'installment' 等额本息 | 'principal' 等额本金
    housePrice: '',         // 房屋总价（万）
    downRatio: 30,          // 首付比例 %
    years: 30,              // 贷款年限
    rate: '3.05',           // 年化利率 %
    result: null,
    // 快速选择
    downChips: [
      { label: '15%', v: 15 },
      { label: '20%', v: 20 },
      { label: '30%', v: 30 },
      { label: '50%', v: 50 },
      { label: '70%', v: 70 }
    ],
    yearChips: [
      { label: '10年', v: 10 },
      { label: '20年', v: 20 },
      { label: '30年', v: 30 }
    ]
  },

  onLoad() {
    const r = getApp().globalData.mortgageRate || 0.0305;
    this.setData({ rate: (r * 100).toFixed(2) });
  },

  onShareAppMessage() {
    return { title: '房贷计算器', path: '/pages/mortgage/mortgage' };
  },

  // ── 输入处理 ──
  onHousePriceInput(e) { this.setData({ housePrice: e.detail.value, result: null }); },
  onRateInput(e) { this.setData({ rate: e.detail.value, result: null }); },

  onDownChip(e) { this.setData({ downRatio: e.currentTarget.dataset.v, result: null }); },
  onDownInput(e) {
    let v = parseInt(e.detail.value) || 30;
    v = Math.max(10, Math.min(90, v));
    this.setData({ downRatio: v, result: null });
  },
  onYearChip(e) { this.setData({ years: e.currentTarget.dataset.v, result: null }); },
  onYearInput(e) {
    let v = parseInt(e.detail.value) || 30;
    v = Math.max(1, Math.min(40, v));
    this.setData({ years: v, result: null });
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, result: null });
  },

  // ── 计算 ──
  onCalc() {
    const price = parseFloat(this.data.housePrice);
    if (!price || price <= 0) {
      wx.showToast({ title: '请输入房屋总价', icon: 'none' });
      return;
    }
    const downRatio = this.data.downRatio / 100;
    const downPayment = price * downRatio;         // 首付（万）
    const loan = price - downPayment;              // 贷款额（万）
    const rate = parseFloat(this.data.rate) / 100;
    const years = this.data.years;

    let detail;
    if (this.data.mode === 'installment') {
      const r = mortgage.equalInstallment(loan, rate, years);
      detail = {
        monthly: r.monthly,
        monthlyText: mortgage.formatMonthly(r.monthly),
        totalInterest: r.totalInterest,
        totalPayment: r.totalPayment
      };
    } else {
      const r = mortgage.equalPrincipal(loan, rate, years);
      detail = {
        firstMonthText: mortgage.formatMonthly(r.firstMonth),
        lastMonthText: mortgage.formatMonthly(r.lastMonth),
        monthlyDeclineText: r.monthlyDecline < 1
          ? Math.round(r.monthlyDecline * 10000) + '元' : r.monthlyDecline.toFixed(2) + '万',
        totalInterest: r.totalInterest,
        totalPayment: r.totalPayment
      };
    }

    this.setData({
      result: {
        housePrice: price,
        downRatio: this.data.downRatio,
        downPayment: downPayment.toFixed(0),
        loan: loan.toFixed(0),
        years: years,
        rate: this.data.rate,
        mode: this.data.mode,
        ...detail
      }
    });
  }
});
