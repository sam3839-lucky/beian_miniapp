'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadComponentDefinition() {
  const componentPath = require.resolve('../custom-tab-bar/index');
  const previousComponent = global.Component;
  let definition = null;
  global.Component = config => { definition = config; };
  delete require.cache[componentPath];
  require(componentPath);
  if (previousComponent === undefined) delete global.Component;
  else global.Component = previousComponent;
  return definition;
}

function createComponentInstance(definition, list) {
  return {
    ...definition,
    ...definition.methods,
    data: { ...definition.data, list: list || definition.data.list.map(item => ({ ...item })) },
    setData(update) { Object.assign(this.data, update); }
  };
}

test('custom tab bar adds the collection tab only for admins', () => {
  const previousGetApp = global.getApp;
  try {
    global.getApp = () => ({ globalData: { isAdmin: true } });
    const definition = loadComponentDefinition();
    const component = createComponentInstance(definition);
    definition.lifetimes.attached.call(component);

    assert.equal(component.data.showCollect, true);
    assert.equal(component.data.list.at(-1).pagePath, '/pages/swipe-collect/swipe-collect');
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
  }
});

test('custom tab bar switches valid tabs and ignores invalid indexes', () => {
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const calls = [];
  try {
    global.getApp = () => ({ globalData: { isAdmin: false } });
    global.wx = { switchTab(value) { calls.push(value); } };
    const definition = loadComponentDefinition();
    const component = createComponentInstance(definition);
    definition.methods.switchTab.call(component, { currentTarget: { dataset: { index: 2 } } });
    definition.methods.switchTab.call(component, { currentTarget: { dataset: { index: 99 } } });

    assert.deepEqual(calls, [{ url: '/pages/trends/trends' }]);
    assert.equal(component.data.selected, 2);
  } finally {
    if (previousGetApp === undefined) delete global.getApp;
    else global.getApp = previousGetApp;
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});
