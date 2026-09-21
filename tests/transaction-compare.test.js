'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectYears,
  selectComparisonYears,
  resolveMetric,
  formatDelta,
  formatReferenceDelta,
  buildMonthlyCards,
  buildMonthlyTable,
  formatCutoff,
  formatUpdatedAt,
  formatYearRange
} = require('../utils/transaction-compare');

function row(year, values = {}) {
  return {
    year,
    month: 1,
    period_status: 'full_month',
    new: null,
    used: null,
    total: null,
    ...values
  };
}

function payload() {
  return {
    latest_date: '2026-08-30',
    updated_at: '2026-08-31T09:05:32+08:00',
    cutoff: { month: 8, day: 30 },
    years: [2026, 2025, 2024, 2023, 2022],
    monthly_same_period: [
      {
        month: 2,
        period_status: 'full_month',
        rows: [
          row(2026, { month: 2, new: 20, used: 30, total: 50 }),
          row(2025, { month: 2, new: 10, used: 10, total: 20 }),
          row(2024, { month: 2, new: 5, used: 5, total: 10 }),
          row(2023, { month: 2, new: 4, used: 4, total: 8 }),
          row(2022, { month: 2, new: 3, used: 3, total: 6 })
        ]
      },
      {
        month: 1,
        period_status: 'full_month',
        rows: [
          row(2024, { new: 0, used: 0, total: 0 }),
          row(2026, { new: 70, used: 50, total: 120 }),
          row(2022, { new: 40, used: 40, total: 80 }),
          row(2025, { new: 60, used: 40, total: 100 }),
          row(2023, { new: 55, used: null, total: null })
        ]
      },
      {
        month: 8,
        period_status: 'through_day',
        rows: [
          row(2026, { month: 8, new: 1, used: 2, total: 999 }),
          row(2025, { month: 8, new: 1, used: 2, total: 3 }),
          row(2024, { month: 8, new: 1, used: 2, total: 3 }),
          row(2023, { month: 8, new: 1, used: 2, total: 3 }),
          row(2022, { month: 8, new: 1, used: null, total: null })
        ]
      }
    ]
  };
}

test('selectYears 精确返回含今年在内的近 3 年和近 5 年', () => {
  assert.deepEqual(selectYears(2026, 3), [2026, 2025, 2024]);
  assert.deepEqual(selectYears(2026, 5), [2026, 2025, 2024, 2023, 2022]);
});

test('selectYears 拒绝含糊的年份范围', () => {
  assert.throws(() => selectYears(2026, 4), /yearCount must be 3 or 5/);
  assert.throws(() => selectYears('2026', 3), /positive integer/);
});

test('selectComparisonYears 按业务定义返回往年两列或近三年四列', () => {
  assert.deepEqual(selectComparisonYears(2026, 'past'), [2026, 2025]);
  assert.deepEqual(selectComparisonYears(2026, 'recent3'), [2026, 2025, 2024, 2023]);
});

test('resolveMetric 保留真实 0 且不把缺失值当成 0', () => {
  assert.equal(resolveMetric({ new: 0 }, 'new'), 0);
  assert.equal(resolveMetric({ used: null }, 'used'), null);
  assert.equal(resolveMetric({ used: undefined }, 'used'), null);
  assert.equal(resolveMetric({ used: '12' }, 'used'), null);
  assert.equal(resolveMetric(null, 'new'), null);
});

test('resolveMetric 直接消费后端 total，绝不在前端重算', () => {
  assert.equal(resolveMetric({ new: 10, used: 20, total: 999 }, 'total'), 999);
  assert.equal(resolveMetric({ new: 10, used: 20 }, 'total'), null);
  assert.throws(() => resolveMetric({}, 'unknown'), /metric must be/);
});

test('formatDelta 生成带方向和正负号的增减文案', () => {
  assert.deepEqual(formatDelta(125, 100), {
    comparable: true,
    status: 'increase',
    direction: 'up',
    percent: 25,
    text: '↑ +25.0%',
    ariaLabel: '较上一年增长 25.0%'
  });
  assert.deepEqual(formatDelta(75, 100), {
    comparable: true,
    status: 'decrease',
    direction: 'down',
    percent: -25,
    text: '↓ -25.0%',
    ariaLabel: '较上一年下滑 25.0%'
  });
  assert.equal(formatDelta(100.01, 100).text, '持平 0.0%');
});

test('formatDelta 明确区分缺失、零基数和两年均为 0', () => {
  const missing = formatDelta(null, 0);
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.text, '不可比');

  const zeroBase = formatDelta(10, 0);
  assert.equal(zeroBase.status, 'zero-base');
  assert.equal(zeroBase.comparable, false);
  assert.equal(zeroBase.text, '上年为 0');

  const bothZero = formatDelta(0, 0);
  assert.equal(bothZero.status, 'both-zero');
  assert.equal(bothZero.comparable, true);
  assert.equal(bothZero.text, '持平（均为 0）');

  const toZero = formatDelta(0, 10);
  assert.equal(toZero.percent, -100);
  assert.equal(toZero.text, '↓ -100.0%');
});

test('formatReferenceDelta 以今年为基准生成历史年份增降幅', () => {
  assert.equal(formatReferenceDelta(4837, 5642).text, '↓ 14.3%');
  assert.equal(formatReferenceDelta(6000, 5642).text, '↑ 6.3%');
  assert.equal(formatReferenceDelta(5642, 5642).text, '持平');
  assert.equal(formatReferenceDelta(null, 5642).text, '不可比');
});

test('buildMonthlyCards 按自然月和新到旧年份稳定排序', () => {
  const cards = buildMonthlyCards(payload(), 'total', 3);
  assert.deepEqual(cards.map(card => card.month), [1, 2, 8]);
  assert.deepEqual(cards[0].rows.map(item => item.year), [2026, 2025, 2024]);
  assert.deepEqual(cards[0].rows.map(item => item.yearLabel), ['今年', '去年', '前年']);
  assert.equal(cards[0].rows[0].isCurrent, true);
  assert.equal(cards[0].rows[2].isOldest, true);
  assert.equal(cards[0].rows[2].delta.text, '基准');
});

test('buildMonthlyCards 的近 5 年严格包含今年和前 4 年', () => {
  const rows = buildMonthlyCards(payload(), 'total', 5)[0].rows;
  assert.deepEqual(rows.map(item => item.year), [2026, 2025, 2024, 2023, 2022]);
  assert.equal(rows[4].isOldest, true);
  assert.equal(rows[4].delta.text, '基准');
});

test('buildMonthlyCards 每张月份卡独立归一化条形', () => {
  const cards = buildMonthlyCards(payload(), 'total', 3);
  assert.deepEqual(cards[0].rows.map(item => item.barPercent), [100, 83.3, 0]);
  assert.deepEqual(cards[1].rows.map(item => item.barPercent), [100, 40, 20]);
});

test('buildMonthlyCards 保留精确 0 和 null 的不同表达', () => {
  const cards = buildMonthlyCards(payload(), 'total', 5);
  const january = cards[0];
  const zero = january.rows.find(item => item.year === 2024);
  const missing = january.rows.find(item => item.year === 2023);

  assert.equal(zero.value, 0);
  assert.equal(zero.valueText, '0');
  assert.equal(zero.hasValue, true);
  assert.equal(zero.isIncomplete, false);
  assert.equal(zero.barPercent, 0);

  assert.equal(missing.value, null);
  assert.equal(missing.valueText, '—');
  assert.equal(missing.hasValue, false);
  assert.equal(missing.isIncomplete, true);
  assert.equal(missing.barPercent, null);
  assert.equal(january.isIncomplete, true);
});

test('buildMonthlyCards 直接使用 total 并格式化千分位', () => {
  const august = buildMonthlyCards(payload(), 'total', 3)[2];
  assert.equal(august.rows[0].value, 999);
  assert.equal(august.rows[0].valueText, '999');
  assert.equal(august.rows[0].value, 999);

  const source = payload();
  source.monthly_same_period[2].rows[0].total = 12345;
  const formatted = buildMonthlyCards(source, 'total', 3)[2].rows[0];
  assert.equal(formatted.valueText, '12,345');
});

test('buildMonthlyCards 为不可比卡片提供明确标题', () => {
  const source = payload();
  source.monthly_same_period[0].rows[1].total = null;
  const february = buildMonthlyCards(source, 'total', 3)[1];
  assert.equal(february.headline, '暂不提供同期判断');
  assert.equal(february.rows[0].delta.text, '不可比');
});

test('buildMonthlyCards 标记当前月、同日截止和指标名', () => {
  const august = buildMonthlyCards(payload(), 'new', 3)[2];
  assert.equal(august.metric, 'new');
  assert.equal(august.metricLabel, '新房');
  assert.equal(august.isCurrentMonth, true);
  assert.equal(august.periodStatus, 'through_day');
  assert.equal(august.isPartial, true);
  assert.equal(august.cutoffLabel, '各年截至30日');
  assert.equal(august.rows[0].value, 1);
});

test('buildMonthlyCards 在截止月已完整时不误标为未完结', () => {
  const source = payload();
  source.latest_date = '2026-08-31';
  source.cutoff.day = 31;
  source.monthly_same_period[2].period_status = 'full_month';

  const august = buildMonthlyCards(source, 'total', 3)[2];
  assert.equal(august.isCurrentMonth, true);
  assert.equal(august.periodStatus, 'full_month');
  assert.equal(august.isPartial, false);
  assert.equal(august.cutoffLabel, '');
});

test('buildMonthlyCards 缺少某年时补齐 null 行，不伪造 0', () => {
  const source = payload();
  source.monthly_same_period[1].rows = source.monthly_same_period[1].rows
    .filter(item => item.year !== 2025);

  const january = buildMonthlyCards(source, 'total', 3)[0];
  const missing = january.rows[1];
  assert.equal(missing.year, 2025);
  assert.equal(missing.value, null);
  assert.equal(missing.hasValue, false);
});

test('buildMonthlyCards 不会改写后端返回的月份或年份顺序', () => {
  const source = payload();
  const original = JSON.stringify(source);
  buildMonthlyCards(source, 'total', 5);
  assert.equal(JSON.stringify(source), original);
});

test('buildMonthlyCards 对空或无截止年份的负载返回稳定空数组', () => {
  assert.deepEqual(buildMonthlyCards(null, 'total', 3), []);
  assert.deepEqual(buildMonthlyCards({ monthly_same_period: [] }, 'total', 5), []);
});

test('buildMonthlyTable 以月份为行、年份为列并按最新月份优先', () => {
  const table = buildMonthlyTable(payload(), 3);
  assert.deepEqual(table.years, [2026, 2025, 2024]);
  assert.deepEqual(table.months.map(item => item.month), [0, 8, 2, 1]);
  assert.equal(table.months[0].isCumulative, true);
  assert.equal(table.months[0].cells[0].comparisonText, '基准');
  assert.equal(table.months[1].isCurrentMonth, true);
  assert.equal(table.months[1].isPartial, true);
  assert.deepEqual(table.months[2].cells[0], {
    year: 2026,
    newValue: 20,
    newText: '20',
    newHasValue: true,
    usedValue: 30,
    usedText: '30',
    usedHasValue: true,
    totalValue: 50,
    totalText: '50',
    totalHasValue: true,
    displayValue: 50,
    displayText: '50',
    displayHasValue: true,
    comparisonText: '基准',
    comparisonComparable: false,
    isCurrent: true,
    isOldest: false
  });
});

test('buildMonthlyTable 对缺失的新房、二手房和总成交保留破折号', () => {
  const table = buildMonthlyTable(payload(), 5);
  const january = table.months.find(item => item.month === 1);
  const missing = january.cells.find(item => item.year === 2023);
  assert.equal(missing.newText, '55');
  assert.equal(missing.newHasValue, true);
  assert.equal(missing.usedText, '—');
  assert.equal(missing.usedHasValue, false);
  assert.equal(missing.totalText, '—');
  assert.equal(missing.totalHasValue, false);
});

test('formatCutoff 严格格式化后端 latest_date，不依赖手机当天日期', () => {
  assert.equal(formatCutoff({ latest_date: '2026-08-30' }), '数据截至 2026年8月30日');
  assert.equal(formatCutoff({ latest_date: '2024-02-29' }), '数据截至 2024年2月29日');
  assert.equal(formatCutoff({ latest_date: '2025-02-29' }), '');
  assert.equal(formatCutoff({ latest_date: '2026/08/30' }), '');
  assert.equal(formatCutoff(null), '');
});

test('formatUpdatedAt 保留无时区时分，并将有时区时间转为上海时间', () => {
  assert.equal(
    formatUpdatedAt({ updated_at: '2026-08-31T09:05' }),
    '数据生成 2026年8月31日 09:05'
  );
  assert.equal(
    formatUpdatedAt({ updated_at: '2026-08-31T21:45:32+08:00' }),
    '数据生成 2026年8月31日 21:45'
  );
  assert.equal(
    formatUpdatedAt({ updated_at: '2026-08-31T00:00:59.123Z' }),
    '数据生成 2026年8月31日 08:00'
  );
  assert.equal(
    formatUpdatedAt({ updated_at: '2026-08-31T09:05+08:00' }),
    '数据生成 2026年8月31日 09:05'
  );
  assert.equal(
    formatUpdatedAt({ updated_at: '2026-08-31T20:30:00Z' }),
    '数据生成 2026年9月1日 04:30'
  );
});

test('formatUpdatedAt 对缺失或非法 ISO 时间返回空串', () => {
  const invalidValues = [
    null,
    '',
    '2026-02-29T09:05',
    '2026-08-31 09:05',
    '2026-08-31T24:00',
    '2026-08-31T09:60',
    '2026-08-31T09:05:60Z',
    '2026-08-31T09:05+14:30',
    '2026-08-31T09:05+15:00',
    '2026-08-31T09:05 garbage'
  ];

  invalidValues.forEach(updatedAt => {
    assert.equal(formatUpdatedAt({ updated_at: updatedAt }), '');
  });
  assert.equal(formatUpdatedAt(null), '');
});

test('formatYearRange 生成从旧到新的实际年份范围', () => {
  const years = [2026, 2025, 2024];
  assert.equal(formatYearRange(years), '2024—2026');
  assert.deepEqual(years, [2026, 2025, 2024]);
  assert.equal(formatYearRange([2026]), '2026');
  assert.equal(formatYearRange([]), '');
  assert.equal(formatYearRange(null), '');
});

function loadPageDefinition() {
  const pagePath = require.resolve('../pages/transaction-compare/transaction-compare');
  const previousPage = global.Page;
  let definition = null;
  global.Page = config => { definition = config; };
  delete require.cache[pagePath];
  require(pagePath);
  if (previousPage === undefined) delete global.Page;
  else global.Page = previousPage;
  return definition;
}

function createPageInstance(definition) {
  return {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(update, callback) {
      Object.assign(this.data, update);
      if (callback) callback();
    }
  };
}

test('API客户端只允许3年或5年并使用规范化数字拼接URL', async t => {
  const api = require('../utils/api');
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  let requestedUrl = '';
  global.getApp = () => ({ globalData: { baseUrl: 'https://example.test' } });
  global.wx = {
    request(options) {
      requestedUrl = options.url;
      options.success({ statusCode: 200, data: { ok: true } });
    }
  };
  t.after(() => {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  });

  assert.deepEqual(await api.getTransactionComparison('3'), { ok: true });
  assert.equal(requestedUrl, 'https://example.test/api/transactions/comparison?years=3');
  await assert.rejects(
    api.getTransactionComparison('5&inject=1'),
    /years must be 3 or 5/
  );
});

test('月度同期页面首次只请求一次5年数据，筛选切换不重复请求', async t => {
  const api = require('../utils/api');
  const originalRequest = api.getTransactionComparison;
  let calls = 0;
  api.getTransactionComparison = async years => {
    calls += 1;
    assert.equal(years, 5);
    return payload();
  };
  t.after(() => { api.getTransactionComparison = originalRequest; });

  const page = createPageInstance(loadPageDefinition());
  await page.loadComparison();

  assert.equal(calls, 1);
  assert.equal(page.data.loading, false);
  assert.equal(page.data.error, '');
  assert.equal(page.data.empty, false);
  assert.equal(page.data.metric, 'total');
  assert.equal(page.data.yearCount, 2);
  assert.equal(page.data.rangeKey, 'past');
  assert.equal(page.data.metricLabel, '汇总');
  assert.equal(page.data.yearRangeLabel, '2025—2026');
  assert.equal(page.data.cutoffText, '数据截至 2026年8月30日');
  assert.equal(page.data.updatedText, '数据生成 2026年8月31日 09:05');
  assert.equal(page.data.monthlyCards.length, 3);
  assert.deepEqual(page.data.monthlyTable.years, [2026, 2025]);
  assert.deepEqual(page.data.monthlyTable.months.map(item => item.month), [0, 8, 2, 1]);

  page.onMetricPickerChange({ detail: { value: 1 } });
  page.onRangeChange({ detail: { value: 1 } });

  assert.equal(calls, 1);
  assert.equal(page.data.metric, 'new');
  assert.equal(page.data.metricLabel, '新房');
  assert.equal(page.data.monthlyTable.months[0].cells[0].displayText, '91');
  assert.equal(page.data.yearCount, 4);
  assert.equal(page.data.rangeKey, 'recent3');
  assert.equal(page.data.yearRangeLabel, '2023—2026');
  assert.equal(page.data.monthlyCards[0].rows.length, 4);
  assert.deepEqual(page.data.monthlyTable.years, [2026, 2025, 2024, 2023]);

  page.onMetricChange({ currentTarget: { dataset: { value: 'invalid' } } });
  assert.equal(page.data.metric, 'new');
  page.onMetricChange(null);
  page.onRangeChange(null);
  assert.equal(page.data.metric, 'new');
  assert.equal(page.data.yearCount, 4);
  const requestId = page._requestId;
  page.onUnload();
  assert.equal(page._requestId, requestId + 1);
});

test('月度同期页面将请求失败转换为可展示错误且清空旧卡片', async t => {
  const api = require('../utils/api');
  const originalRequest = api.getTransactionComparison;
  const originalError = console.error;
  api.getTransactionComparison = async () => {
    throw { errMsg: 'request:fail timeout' };
  };
  console.error = () => {};
  t.after(() => {
    api.getTransactionComparison = originalRequest;
    console.error = originalError;
  });

  const page = createPageInstance(loadPageDefinition());
  page.data.monthlyCards = [{ month: 1 }];
  await page.loadComparison();

  assert.equal(page.data.loading, false);
  assert.equal(page.data.error, '网络连接异常，请稍后重试');
  assert.deepEqual(page.data.monthlyCards, []);
  assert.equal(page.data.empty, false);
});

test('下拉刷新等待请求结束后停止刷新状态', async t => {
  const previousWx = global.wx;
  let stopped = 0;
  global.wx = { stopPullDownRefresh() { stopped += 1; } };
  t.after(() => {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  });

  const page = createPageInstance(loadPageDefinition());
  page.loadComparison = async () => {};
  await page.onPullDownRefresh();
  assert.equal(stopped, 1);
});
