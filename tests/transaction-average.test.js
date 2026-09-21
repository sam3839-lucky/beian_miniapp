'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTransactionAverage } = require('../utils/transaction-average');

function summary({ date = '2026-09-18', total = 4450, newCount = 926, used = 3524, month = 9, year = 2026 } = {}) {
  return {
    latest_date: date,
    this_month: { year, month, total, new: newCount, used }
  };
}

test('uses actual 30-day month and exposes forecast from the 10th', () => {
  const result = buildTransactionAverage(summary());

  assert.equal(result.monthDays, 30);
  assert.equal(result.elapsedDays, 18);
  assert.equal(result.remainingDays, 12);
  assert.equal(result.daily.total, 247.2);
  assert.equal(result.daily.new, 51.4);
  assert.equal(result.daily.used, 195.8);
  assert.equal(result.showForecast, true);
  assert.equal(result.forecastTotal, 7416);
  assert.equal(result.forecastProgress, 60);
});

test('does not show forecast before the 10th day', () => {
  const result = buildTransactionAverage(summary({ date: '2026-09-09', total: 900, newCount: 200, used: 700 }));

  assert.equal(result.showForecast, false);
  assert.equal(result.forecastTotal, null);
  assert.equal(result.forecastFormula, '');
});

test('shows forecast exactly on the 10th day and uses 31 days for January', () => {
  const result = buildTransactionAverage(summary({
    date: '2026-01-10',
    month: 1,
    total: 1000,
    newCount: 400,
    used: 600
  }));

  assert.equal(result.showForecast, true);
  assert.equal(result.monthDays, 31);
  assert.equal(result.remainingDays, 21);
  assert.equal(result.forecastTotal, 3100);
});

test('uses 28 days for a non-leap February', () => {
  const result = buildTransactionAverage(summary({
    date: '2026-02-18',
    month: 2,
    total: 2800,
    newCount: 800,
    used: 2000
  }));

  assert.equal(result.monthDays, 28);
  assert.equal(result.remainingDays, 10);
  assert.equal(result.forecastTotal, 4356);
});

test('uses 29 days for a leap February', () => {
  const result = buildTransactionAverage(summary({
    date: '2028-02-18',
    year: 2028,
    month: 2,
    total: 2800,
    newCount: 800,
    used: 2000
  }));

  assert.equal(result.monthDays, 29);
  assert.equal(result.remainingDays, 11);
  assert.equal(result.forecastTotal, 4512);
});

test('returns no card data when the summary date is inconsistent', () => {
  assert.equal(buildTransactionAverage(summary({ date: '2026-10-01' })), null);
  assert.equal(buildTransactionAverage({ latest_date: 'bad', this_month: {} }), null);
});
