'use strict';

const FORECAST_MIN_DAY = 10;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLatestDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;

  const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= monthDays ? { year, month, day, monthDays } : null;
}

function parseMonth(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return { year: null, month: value };
  }
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function formatCount(value) {
  return Number(value).toLocaleString('en-US');
}

function buildTransactionAverage(summary) {
  const monthData = summary && summary.this_month;
  const latest = parseLatestDate(summary && summary.latest_date);
  const month = parseMonth(monthData && monthData.month);
  if (!monthData || !latest || !month) return null;

  const year = isFiniteNumber(monthData.year) ? monthData.year : latest.year;
  if (
    latest.year !== year
    || latest.month !== month.month
    || (month.year !== null && month.year !== latest.year)
    || month.month < 1
    || month.month > 12
  ) {
    return null;
  }

  const total = monthData.total;
  const newCount = monthData.new;
  const usedCount = monthData.used;
  if (
    !isFiniteNumber(total)
    || !isFiniteNumber(newCount)
    || !isFiniteNumber(usedCount)
    || latest.day > latest.monthDays
  ) {
    return null;
  }

  const daily = {
    total: roundToOneDecimal(total / latest.day),
    new: roundToOneDecimal(newCount / latest.day),
    used: roundToOneDecimal(usedCount / latest.day)
  };
  const showForecast = latest.day >= FORECAST_MIN_DAY;
  const remainingDays = latest.monthDays - latest.day;
  const forecastTotal = showForecast
    ? Math.round(total + daily.total * remainingDays)
    : null;

  return {
    year: latest.year,
    month: latest.month,
    elapsedDays: latest.day,
    monthDays: latest.monthDays,
    remainingDays,
    currentTotal: total,
    currentTotalText: formatCount(total),
    daily,
    periodLabel: `${latest.month}月1日—${latest.month}月${latest.day}日 · 按自然日计算`,
    statusLabel: '进行中',
    showForecast,
    forecastTotal,
    forecastTotalText: forecastTotal === null ? '' : formatCount(forecastTotal),
    forecastFormula: showForecast
      ? `已成交 ${formatCount(total)} 套 + 当前日均 ${daily.total.toFixed(1)} 套 × 剩余 ${remainingDays} 天`
      : '',
    forecastProgress: showForecast && forecastTotal > 0
      ? Math.round(total / forecastTotal * 100)
      : 0
  };
}

module.exports = {
  FORECAST_MIN_DAY,
  parseLatestDate,
  buildTransactionAverage
};
