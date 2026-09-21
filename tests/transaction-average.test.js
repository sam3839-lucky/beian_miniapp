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

test('accepts a year-month string and falls back to latest date year', () => {
  const result = buildTransactionAverage(summary({
    date: '2026-02-10',
    month: '2026-2',
    year: undefined,
    total: 100,
    newCount: 40,
    used: 60
  }));

  assert.equal(result.year, 2026);
  assert.equal(result.month, 2);
  assert.equal(result.monthDays, 28);
  assert.equal(result.showForecast, true);
});

test('rejects missing or non-numeric summary values', () => {
  assert.equal(buildTransactionAverage(null), null);
  assert.equal(buildTransactionAverage({ latest_date: '2026-09-18' }), null);
  assert.equal(buildTransactionAverage(summary({ total: '4450' })), null);
  assert.equal(buildTransactionAverage(summary({ newCount: Infinity })), null);
});

test('rejects invalid calendar dates and malformed month values', () => {
  assert.equal(buildTransactionAverage(summary({ date: '2026-02-30', month: 2 })), null);
  assert.equal(buildTransactionAverage(summary({ date: '2026-09-18', month: 'bad' })), null);
  assert.equal(buildTransactionAverage(summary({ date: 20260918 })), null);
});

test('keeps zero forecast progress when there are no completed transactions', () => {
  const result = buildTransactionAverage(summary({
    date: '2026-09-10',
    total: 0,
    newCount: 0,
    used: 0
  }));

  assert.equal(result.showForecast, true);
  assert.equal(result.forecastTotal, 0);
  assert.equal(result.forecastProgress, 0);
});

test('uses zero remaining days at month end without changing the completed total', () => {
  const result = buildTransactionAverage(summary({
    date: '2026-09-30',
    total: 3000,
    newCount: 1200,
    used: 1800
  }));

  assert.equal(result.remainingDays, 0);
  assert.equal(result.forecastTotal, 3000);
  assert.equal(result.forecastProgress, 100);
});

test('rejects a numeric month outside the calendar range', () => {
  assert.equal(buildTransactionAverage(summary({ month: 13 })), null);
});
