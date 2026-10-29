'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadPageDefinition() {
  const pagePath = require.resolve('../pages/swipe-collect/swipe-collect');
  const previousPage = global.Page;
  let definition = null;
  global.Page = config => { definition = config; };
  delete require.cache[pagePath];
  require(pagePath);
  if (previousPage === undefined) delete global.Page;
  else global.Page = previousPage;
  return definition;
}

function createPageInstance(definition, data = {}) {
  return {
    ...definition,
    data: { ...JSON.parse(JSON.stringify(definition.data)), ...data },
    setData(update) { Object.assign(this.data, update); }
  };
}

test('入库页面拒绝空文案', async () => {
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const toasts = [];
  try {
    global.getApp = () => ({ globalData: {} });
    global.wx = { showToast(value) { toasts.push(value); } };
    const page = createPageInstance(loadPageDefinition());
    await page.onSubmit();

    assert.deepEqual(toasts, [{ title: '请粘贴文案内容', icon: 'none' }]);
    assert.equal(page.data.submitting, false);
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('入库页面成功提交后清空输入并加入最近列表', async () => {
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const toasts = [];
  try {
    global.getApp = () => ({ globalData: { openid: 'test-openid', baseUrl: 'https://example.test' } });
    global.wx = {
      showToast(value) { toasts.push(value); },
      request(options) {
        assert.equal(options.url, 'https://example.test/api/swipe-collect');
        assert.equal(options.data.copy_content, '一段测试文案');
        options.success({ data: { ok: true, id: 7 } });
      }
    };
    const page = createPageInstance(loadPageDefinition(), {
      title: '测试标题',
      copyContent: ' 一段测试文案 ',
      region: '南山'
    });
    await page.onSubmit();

    assert.equal(page.data.title, '');
    assert.equal(page.data.copyContent, '');
    assert.equal(page.data.region, '');
    assert.equal(page.data.submitting, false);
    assert.equal(page.data.recentList[0].id, 7);
    assert.deepEqual(toasts, [{ title: '入库成功', icon: 'success' }]);
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('入库页面网络失败后恢复可提交状态', async () => {
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const toasts = [];
  try {
    global.getApp = () => ({ globalData: { openid: 'test-openid', baseUrl: 'https://example.test' } });
    global.wx = {
      showToast(value) { toasts.push(value); },
      request(options) { options.fail(new Error('timeout')); }
    };
    const page = createPageInstance(loadPageDefinition(), { copyContent: '一段测试文案' });
    await page.onSubmit();

    assert.equal(page.data.submitting, false);
    assert.deepEqual(toasts, [{ title: '网络超时，请重试', icon: 'none' }]);
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});
