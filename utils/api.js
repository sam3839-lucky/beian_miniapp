function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    wx.request({
      url: (app && app.globalData.baseUrl || 'https://ruiheqi.cn') + path,
      method,
      data,
      success: res => {
        if (res.statusCode === 200) resolve(res.data);
        else reject(res);
      },
      fail: reject
    });
  });
}

module.exports = {
  getZones: () => request('/api/zones'),
  getProjects: (zone) => request('/api/projects?zone=' + encodeURIComponent(zone)),
  getBuildings: (project) => request('/api/buildings?project=' + encodeURIComponent(project)),
  getUnits: (project, building, search = '', price = {}, area = {}) => {
    let url = '/api/units?project=' + encodeURIComponent(project);
    if (building) url += '&building=' + encodeURIComponent(building);
    if (search) url += '&search=' + encodeURIComponent(search);
    if (price.min) url += '&price_min=' + (price.min * 10000);
    if (price.max < 999999) url += '&price_max=' + (price.max * 10000);
    if (area.min) url += '&area_min=' + area.min;
    if (area.max < 9999) url += '&area_max=' + area.max;
    return request(url);
  },
  getStats: (project, building, price = {}, area = {}) => {
    let url = '/api/stats?project=' + encodeURIComponent(project);
    if (building) url += '&building=' + encodeURIComponent(building);
    if (price.min) url += '&price_min=' + (price.min * 10000);
    if (price.max < 999999) url += '&price_max=' + (price.max * 10000);
    if (area.min) url += '&area_min=' + area.min;
    if (area.max < 9999) url += '&area_max=' + area.max;
    return request(url);
  },
  getZoneStats: (zone, price = {}, area = {}) => {
    let url = '/api/stats?zone=' + encodeURIComponent(zone);
    if (price.min) url += '&price_min=' + (price.min * 10000);
    if (price.max < 999999) url += '&price_max=' + (price.max * 10000);
    if (area.min) url += '&area_min=' + area.min;
    if (area.max < 9999) url += '&area_max=' + area.max;
    return request(url);
  },
  getOverview: () => request('/api/overview'),
  getRankings: () => request('/api/rankings'),
  getLatestPermits: () => request('/api/latest-permits'),
  getAdminStatus: () => request('/api/admin/status'),
  getTransactionSummary: () => request('/api/transactions/summary'),
  getTransactionTrends: (months = 12) => request('/api/transactions/trends?months=' + months),
  getRecentTransactions: (days = 30) => request('/api/transactions/recent?days=' + days),
  getTransactionDistricts: () => request('/api/transactions/districts'),
  getDashboard: (months = 12) => request('/api/dashboard?months=' + months + '&days=14'),
  quickSearch: (q) => request('/api/quick-search?q=' + encodeURIComponent(q)),
  subscribe: (openid, project) => request('/api/subscribe', 'POST', { openid, project }),
  unsubscribe: (openid, project) => request('/api/unsubscribe', 'POST', { openid, project }),
  getMySubscriptions: (openid) => request('/api/my-subscriptions?openid=' + encodeURIComponent(openid)),
  getUserTier: (openid) => request('/api/user-tier?openid=' + encodeURIComponent(openid)),
  incrementUsage: (openid, counter) => request('/api/increment-usage', 'POST', { openid, counter }),
  getProjectSalesRank: (zone, days) => request('/api/project-sales-rank?zone=' + encodeURIComponent(zone || '') + '&days=' + (days || 30)),

  // ── 小区历史成交价查询 ──
  getProjectHistoryMeta: () => request('/api/project-history-search-meta'),
  searchProjectHistory: (q, zone) => {
    let url = '/api/project-history-search?q=' + encodeURIComponent(q || '');
    if (zone) url += '&zone=' + encodeURIComponent(zone);
    return request(url);
  },
  getProjectHistory: (project, opts = {}) => {
    let url = '/api/project-history?project=' + encodeURIComponent(project);
    if (opts.years) url += '&years=' + encodeURIComponent(opts.years);
    if (opts.building) url += '&building=' + encodeURIComponent(opts.building);
    if (opts.sort) url += '&sort=' + opts.sort;
    if (opts.offset != null) url += '&offset=' + opts.offset;
    if (opts.limit != null) url += '&limit=' + opts.limit;
    return request(url);
  },
  getProjectHistoryDetail: (id) => request('/api/project-history-detail?id=' + id),
};
