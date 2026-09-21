const STATUS_TEXT = {
  ok: '日报已同步',
  partial: '部分区域尚未更新',
  forward_filled: '库存沿用历史快照',
  stale: '库存快照较旧',
  no_deal: '最近90天暂无成交',
  no_inventory: '当前暂无可售库存',
  not_published: '区域数据待同步',
  unavailable: '数据暂时不可用',
};

function formatMonths(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return '暂无';
  }
  return Number(value).toFixed(1);
}

function progressPercent(value) {
  const months = Number(value);
  if (!Number.isFinite(months) || months <= 0) return 0;
  return Math.min(100, Math.max(0, months / 24 * 100));
}

function statusText(status) {
  return STATUS_TEXT[status] || STATUS_TEXT.unavailable;
}

function sortDistricts(items) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const am = a && a.months !== null && a.months !== undefined ? Number(a.months) : Infinity;
    const bm = b && b.months !== null && b.months !== undefined ? Number(b.months) : Infinity;
    if (am !== bm) return am - bm;
    return String((a && a.district_name) || '').localeCompare(String((b && b.district_name) || ''), 'zh-CN');
  });
}

function preparePayload(payload) {
  const districts = sortDistricts(payload && payload.districts).map(item => ({
    ...item,
    monthsText: formatMonths(item.months),
    progress: progressPercent(item.months),
    statusText: statusText(item.status),
  }));
  const citywide = payload && payload.citywide
    ? {
      ...payload.citywide,
      monthsText: formatMonths(payload.citywide.months),
      progress: progressPercent(payload.citywide.months),
      statusText: statusText(payload.citywide.status),
    }
    : null;
  return { citywide, districts };
}

module.exports = { formatMonths, progressPercent, statusText, sortDistricts, preparePayload };
