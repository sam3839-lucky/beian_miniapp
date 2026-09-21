'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadPageDefinition() {
  const pagePath = require.resolve('../pages/mortgage/mortgage');
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
    setData(update) { Object.assign(this.data, update); }
  };
}

test('房贷页面拒绝空房屋总价并提示用户', () => {
  const previousWx = global.wx;
  const toasts = [];
  global.wx = { showToast(value) { toasts.push(value); } };
  try {
    const page = createPageInstance(loadPageDefinition());
    page.onCalc();
    assert.equal(page.data.result, null);
    assert.deepEqual(toasts, [{ title: '请输入房屋总价', icon: 'none' }]);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('房贷页面计算等额本息结果', () => {
  const page = createPageInstance(loadPageDefinition());
  page.data.housePrice = '1000';
  page.data.downRatio = 30;
  page.data.rate = '3.05';
  page.data.years = 30;
  page.onCalc();

  assert.equal(page.data.result.mode, 'installment');
  assert.equal(page.data.result.downPayment, '300');
  assert.equal(page.data.result.loan, '700');
  assert.equal(page.data.result.monthly, 2.9701);
  assert.equal(page.data.result.monthlyText, '2.97万');
});

test('房贷页面计算等额本金结果', () => {
  const page = createPageInstance(loadPageDefinition());
  page.data.mode = 'principal';
  page.data.housePrice = '1000';
  page.data.downRatio = 30;
  page.data.rate = '3.05';
  page.data.years = 30;
  page.onCalc();

  assert.equal(page.data.result.mode, 'principal');
  assert.equal(page.data.result.firstMonthText, '3.72万');
  assert.equal(page.data.result.lastMonthText, '1.95万');
  assert.equal(page.data.result.monthlyDeclineText, '49元');
});

test('房贷页面限制首付和贷款年限输入范围', () => {
  const page = createPageInstance(loadPageDefinition());
  page.onDownInput({ detail: { value: '5' } });
  assert.equal(page.data.downRatio, 10);
  page.onDownInput({ detail: { value: '95' } });
  assert.equal(page.data.downRatio, 90);
  page.onYearInput({ detail: { value: '0' } });
  assert.equal(page.data.years, 30);
  page.onYearInput({ detail: { value: '50' } });
  assert.equal(page.data.years, 40);
});
