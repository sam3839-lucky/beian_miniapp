const api = require('../../utils/api');
const {
  selectComparisonYears,
  buildMonthlyCards,
  buildMonthlyTable,
  formatCutoff,
  formatUpdatedAt,
  formatYearRange,
} = require('../../utils/transaction-compare');

Page({
  data: {
    metric: 'total',
    metricLabel: '汇总',
    metrics: [
      { value: 'total', label: '汇总' },
      { value: 'new', label: '新房' },
      { value: 'used', label: '二手房' },
    ],
    rangeKey: 'past',
    rangeIndex: 0,
    rangeOptions: ['往年', '近三年'],
    metricIndex: 0,
    metricOptions: ['汇总', '新房', '二手房'],
    yearCount: 2,
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
      ? selectComparisonYears(currentYear, this.data.rangeKey)
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

  onRangeChange(event) {
    const rawIndex = event && event.detail && event.detail.value;
    if (rawIndex === undefined || rawIndex === null) return;
    const index = Number(rawIndex);
    if (![0, 1].includes(index) || index === this.data.rangeIndex) return;
    const rangeKey = index === 0 ? 'past' : 'recent3';
    const yearCount = index === 0 ? 2 : 4;
    this.setData({ rangeIndex: index, rangeKey, yearCount }, () => this.rebuildMonthlyCards());
  },

  onMetricPickerChange(event) {
    const rawIndex = event && event.detail && event.detail.value;
    if (rawIndex === undefined || rawIndex === null) return;
    const index = Number(rawIndex);
    if (![0, 1, 2].includes(index) || index === this.data.metricIndex) return;
    const metric = ['total', 'new', 'used'][index];
    this.setData({ metricIndex: index, metric }, () => this.rebuildMonthlyCards());
  },

  onYearCountChange(event) {
    const value = event
      && event.currentTarget
      && event.currentTarget.dataset
      && event.currentTarget.dataset.value;
    const yearCount = Number(value);
    if (![3, 5].includes(yearCount) || yearCount === this.data.yearCount) return;
    const rangeKey = yearCount === 3 ? 'recent3' : 'legacy5';
    this.setData({ yearCount, rangeKey }, () => this.rebuildMonthlyCards());
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
