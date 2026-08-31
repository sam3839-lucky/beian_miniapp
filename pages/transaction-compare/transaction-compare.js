const api = require('../../utils/api');
const {
  selectYears,
  buildMonthlyCards,
  buildMonthlyTable,
  formatCutoff,
  formatUpdatedAt,
  formatYearRange,
} = require('../../utils/transaction-compare');

Page({
  data: {
    metric: 'total',
    metricLabel: '总成交',
    metrics: [
      { value: 'total', label: '总成交' },
      { value: 'new', label: '新房' },
      { value: 'used', label: '二手房' },
    ],
    yearCount: 3,
    yearOptions: [
      { value: 3, label: '近3年' },
      { value: 5, label: '近5年' },
    ],
    yearRangeLabel: '',
    cutoffText: '',
    updatedText: '',
    monthlyCards: [],
    monthlyTable: null,
    loading: true,
    error: '',
    empty: false,
  },

  onLoad() {
    return this.loadComparison();
  },

  onPullDownRefresh() {
    return this.loadComparison().finally(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    this._requestId = (this._requestId || 0) + 1;
  },

  async loadComparison() {
    const requestId = (this._requestId || 0) + 1;
    this._requestId = requestId;
    this.setData({ loading: true, error: '', empty: false });

    try {
      const payload = await api.getTransactionComparison(5);
      if (requestId !== this._requestId) return;
      if (!payload || !Array.isArray(payload.monthly_same_period)) {
        throw new Error('接口未返回月度同期数据');
      }
      this._payload = payload;
      this.rebuildMonthlyCards();
    } catch (error) {
      if (requestId !== this._requestId) return;
      console.error('transaction comparison load failed', error);
      this._payload = null;
      this.setData({
        loading: false,
        error: this.formatError(error),
        empty: false,
        monthlyCards: [],
        monthlyTable: null,
        yearRangeLabel: '',
        cutoffText: '',
        updatedText: '',
      });
    }
  },

  rebuildMonthlyCards() {
    const payload = this._payload;
    if (!payload) return;

    const currentYear = Array.isArray(payload.years) && payload.years.length
      ? payload.years[0]
      : null;
    const selectedYears = Number.isInteger(currentYear)
      ? selectYears(currentYear, this.data.yearCount)
      : [];
    const monthlyCards = buildMonthlyCards(
      payload,
      this.data.metric,
      this.data.yearCount
    );
    const monthlyTable = buildMonthlyTable(payload, this.data.yearCount, this.data.metric);
    const cutoffText = formatCutoff(payload);

    this.setData({
      loading: false,
      error: '',
      empty: monthlyCards.length === 0,
      monthlyCards,
      monthlyTable,
      metricLabel: this.data.metrics.find(item => item.value === this.data.metric).label,
      yearRangeLabel: formatYearRange(selectedYears),
      cutoffText,
      updatedText: formatUpdatedAt(payload),
    });
  },

  onMetricChange(event) {
    const metric = event
      && event.currentTarget
      && event.currentTarget.dataset
      && event.currentTarget.dataset.value;
    if (!['total', 'new', 'used'].includes(metric) || metric === this.data.metric) return;
    this.setData({ metric }, () => this.rebuildMonthlyCards());
  },

  onYearCountChange(event) {
    const value = event
      && event.currentTarget
      && event.currentTarget.dataset
      && event.currentTarget.dataset.value;
    const yearCount = Number(value);
    if (![3, 5].includes(yearCount) || yearCount === this.data.yearCount) return;
    this.setData({ yearCount }, () => this.rebuildMonthlyCards());
  },

  onRetry() {
    return this.loadComparison();
  },

  formatError(error) {
    const apiMessage = error
      && error.data
      && error.data.error
      && error.data.error.message;
    if (apiMessage) return apiMessage;
    if (error && error.errMsg && /timeout|fail/i.test(error.errMsg)) {
      return '网络连接异常，请稍后重试';
    }
    return error && error.message
      ? error.message
      : '暂时无法获取成交数据，请稍后重试';
  },

  onShareAppMessage() {
    return {
      title: '深圳历史成交对比 - 同月看近3年/5年变化',
      path: '/pages/transaction-compare/transaction-compare',
    };
  },
});
