const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatMonths,
  progressPercent,
  statusText,
  sortDistricts,
  preparePayload,
} = require('../utils/destocking');

test('formats valid and missing months distinctly', () => {
  assert.equal(formatMonths(7.26), '7.3');
  assert.equal(formatMonths(0), '0.0');
  assert.equal(formatMonths(null), '暂无');
});

test('progress is fixed to a 0-24 month scale and caps at 100', () => {
  assert.equal(progressPercent(0), 0);
  assert.equal(progressPercent(12), 50);
  assert.equal(progressPercent(30), 100);
  assert.equal(progressPercent(null), 0);
});

test('sorts numerical months ascending and missing values last', () => {
  const result = sortDistricts([
    { district_name: '无数据', months: null },
    { district_name: '龙岗', months: 12.6 },
    { district_name: '南山', months: 7.2 },
  ]);
  assert.deepEqual(result.map(item => item.district_name), ['南山', '龙岗', '无数据']);
});

test('maps unknown statuses to unavailable without changing real zero', () => {
  assert.equal(statusText('no_deal'), '最近90天暂无成交');
  assert.equal(statusText('unexpected'), '数据暂时不可用');
  const prepared = preparePayload({ districts: [{ district_name: '福田', months: 0, status: 'ok' }] });
  assert.equal(prepared.districts[0].monthsText, '0.0');
  assert.equal(prepared.districts[0].progress, 0);
});
