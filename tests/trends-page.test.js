'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../utils/api');

function loadPageDefinition() {
  const pagePath = require.resolve('../pages/trends/trends');
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

function summary(date = '2026-09-18') {
  return {
    latest_date: date,
    this_month: { year: 2026, month: 9, total: 4450, new: 926, used: 3524 }
  };
}

test('成交分析页面装配日均成交和全月预估数据', async t => {
  const originalSummary = api.getTransactionSummary;
  const originalDashboard = api.getDashboard;
  api.getTransactionSummary = async () => summary();
  api.getDashboard = async () => ({ trends: [], districts: null, dailyItems: [] });
  t.after(() => {
    api.getTransactionSummary = originalSummary;
    api.getDashboard = originalDashboard;
  });

  const page = createPageInstance(loadPageDefinition());
  page.drawDonut = () => {};
  page.buildAndDrawChart = () => {};
  await page.loadAll();

  assert.equal(page.data.loading, false);
  assert.equal(page.data.error, false);
  assert.equal(page.data.summary.monthTitle, '2026年9月');
  assert.equal(page.data.dailyAverage.daily.total, 247.2);
  assert.equal(page.data.dailyAverage.daily.new, 51.4);
  assert.equal(page.data.dailyAverage.daily.used, 195.8);
  assert.equal(page.data.dailyAverage.showForecast, true);
  assert.equal(page.data.dailyAverage.forecastTotal, 7416);
});

test('成交分析页面在第10天前隐藏全月预估', async t => {
  const originalSummary = api.getTransactionSummary;
  const originalDashboard = api.getDashboard;
  api.getTransactionSummary = async () => summary('2026-09-09');
  api.getDashboard = async () => ({ trends: [], districts: null, dailyItems: [] });
  t.after(() => {
    api.getTransactionSummary = originalSummary;
    api.getDashboard = originalDashboard;
  });

  const page = createPageInstance(loadPageDefinition());
  page.drawDonut = () => {};
  page.buildAndDrawChart = () => {};
  await page.loadAll();

  assert.equal(page.data.dailyAverage.showForecast, false);
  assert.equal(page.data.dailyAverage.forecastTotal, null);
});

test('成交分析页面将摘要请求失败转换为错误状态', async t => {
  const originalSummary = api.getTransactionSummary;
  const originalError = console.error;
  api.getTransactionSummary = async () => { throw new Error('network down'); };
  console.error = () => {};
  t.after(() => {
    api.getTransactionSummary = originalSummary;
    console.error = originalError;
  });

  const page = createPageInstance(loadPageDefinition());
  await page.loadAll();

  assert.equal(page.data.loading, false);
  assert.equal(page.data.error, true);
  assert.equal(page.data.dailyAverage, null);
});
