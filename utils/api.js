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
  quickSearch: (q) => request('/api/quick-search?q=' + encodeURIComponent(q)),
  subscribe: (openid, project) => request('/api/subscribe', 'POST', { openid, project }),
  unsubscribe: (openid, project) => request('/api/unsubscribe', 'POST', { openid, project }),
  getMySubscriptions: (openid) => request('/api/my-subscriptions?openid=' + encodeURIComponent(openid)),
  getUserTier: (openid) => request('/api/user-tier?openid=' + encodeURIComponent(openid)),
  incrementUsage: (openid, counter) => request('/api/increment-usage', 'POST', { openid, counter }),
};
