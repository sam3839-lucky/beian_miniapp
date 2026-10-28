const api = require('../../utils/api');
const {
  buildMonthlyCards,
  buildMonthlyTable,
  formatCutoff,
  formatUpdatedAt,
  formatYearRange,
} = require('../../utils/transaction-compare');

// 对比范围档位：默认“往年”两列，其后依次为含今年在内的近三、近四、近五年。
const RANGE_OPTIONS = [
  { label: '往年', rangeKey: 'past', yearCount: 2 },
  { label: '近三年', rangeKey: 'recent3', yearCount: 3 },
  { label: '近四年', rangeKey: 'recent4', yearCount: 4 },
  { label: '近五年', rangeKey: 'recent5', yearCount: 5 },
];

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
    rangeOptions: RANGE_OPTIONS.map(option => option.label),
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
      empty: !monthlyTable,
      monthlyCards,
      monthlyTable,
      metricLabel: this.data.metrics.find(item => item.value === this.data.metric).label,
      yearRangeLabel: formatYearRange(monthlyTable ? monthlyTable.years : []),
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
    if (!Number.isInteger(index) || index < 0 || index >= RANGE_OPTIONS.length) return;
    if (index === this.data.rangeIndex) return;
    const option = RANGE_OPTIONS[index];
    this.setData(
      { rangeIndex: index, rangeKey: option.rangeKey, yearCount: option.yearCount },
      () => this.rebuildMonthlyCards()
    );
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
      title: '深圳历史成交对比 - 同月跨年成交量对照',
      path: '/pages/transaction-compare/transaction-compare',
    };
  },
});
