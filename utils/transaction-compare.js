'use strict';

const METRIC_LABELS = {
  total: '总成交',
  new: '新房',
  used: '二手房'
};

function assertYearCount(yearCount) {
  if (yearCount !== 3 && yearCount !== 5) {
    throw new RangeError('yearCount must be 3 or 5');
  }
}

function assertMetric(metric) {
  if (!Object.prototype.hasOwnProperty.call(METRIC_LABELS, metric)) {
    throw new RangeError('metric must be total, new, or used');
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function selectYears(currentYear, yearCount) {
  if (!Number.isInteger(currentYear) || currentYear < 1) {
    throw new TypeError('currentYear must be a positive integer');
  }
  assertYearCount(yearCount);

  return Array.from({ length: yearCount }, (_, index) => currentYear - index);
}

function resolveMetric(row, metric) {
  assertMetric(metric);
  if (!row || typeof row !== 'object') {
    return null;
  }

  // total 必须直接消费后端的同口径值，不在前端自行相加。
  const value = row[metric];
  return isFiniteNumber(value) ? value : null;
}

function formatDelta(current, previous) {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) {
    return {
      comparable: false,
      status: 'unavailable',
      direction: 'unknown',
      percent: null,
      text: '不可比',
      ariaLabel: '数据不完整，暂不提供同期判断'
    };
  }

  if (previous === 0) {
    if (current === 0) {
      return {
        comparable: true,
        status: 'both-zero',
        direction: 'flat',
        percent: null,
        text: '持平（均为 0）',
        ariaLabel: '与上一年持平，两年均为 0 套'
      };
    }

    return {
      comparable: false,
      status: 'zero-base',
      direction: current > 0 ? 'up' : 'down',
      percent: null,
      text: '上年为 0',
      ariaLabel: '上一年为 0 套，暂不计算增减幅'
    };
  }

  const rawPercent = ((current - previous) / previous) * 100;
  const percent = Math.round(rawPercent * 10) / 10;

  if (percent === 0) {
    return {
      comparable: true,
      status: 'flat',
      direction: 'flat',
      percent: 0,
      text: '持平 0.0%',
      ariaLabel: '较上一年持平'
    };
  }

  const isIncrease = percent > 0;
  const absolutePercent = Math.abs(percent).toFixed(1);
  return {
    comparable: true,
    status: isIncrease ? 'increase' : 'decrease',
    direction: isIncrease ? 'up' : 'down',
    percent,
    text: isIncrease
      ? `↑ +${absolutePercent}%`
      : `↓ -${absolutePercent}%`,
    ariaLabel: isIncrease
      ? `较上一年增长 ${absolutePercent}%`
      : `较上一年下滑 ${absolutePercent}%`
  };
}

function formatCount(value) {
  if (!isFiniteNumber(value)) {
    return '—';
  }

  const parts = String(value).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function getCurrentYear(payload) {
  const latestDate = payload && payload.latest_date;
  const match = typeof latestDate === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(latestDate)
    : null;
  if (match) {
    return Number(match[1]);
  }

  const years = payload && Array.isArray(payload.years) ? payload.years : [];
  const validYears = years.filter(Number.isInteger);
  return validYears.length ? Math.max(...validYears) : null;
}

function getYearLabel(year, currentYear) {
  const distance = currentYear - year;
  if (distance === 0) return '今年';
  if (distance === 1) return '去年';
  if (distance === 2) return '前年';
  return `${distance}年前`;
}

function baselineDelta() {
  return {
    comparable: false,
    status: 'baseline',
    direction: 'baseline',
    percent: null,
    text: '基准',
    ariaLabel: '当前年份范围的基准年'
  };
}

function buildMonthlyCards(payload, metric, yearCount) {
  assertMetric(metric);
  assertYearCount(yearCount);

  const currentYear = getCurrentYear(payload);
  const groups = payload && Array.isArray(payload.monthly_same_period)
    ? payload.monthly_same_period
    : [];
  if (!currentYear || groups.length === 0) {
    return [];
  }

  const years = selectYears(currentYear, yearCount);
  const cutoff = payload && payload.cutoff && typeof payload.cutoff === 'object'
    ? payload.cutoff
    : {};

  return groups
    .filter(group => group && Number.isInteger(group.month) && group.month >= 1 && group.month <= 12)
    .slice()
    .sort((left, right) => left.month - right.month)
    .map(group => {
      const sourceRows = Array.isArray(group.rows) ? group.rows : [];
      const rowByYear = new Map(
        sourceRows
          .filter(row => row && Number.isInteger(row.year))
          .map(row => [row.year, row])
      );
      const values = years.map(year => resolveMetric(rowByYear.get(year), metric));
      const validValues = values.filter(isFiniteNumber);
      const maxValue = validValues.length ? Math.max(...validValues, 0) : 0;

      const rows = years.map((year, index) => {
        const source = rowByYear.get(year) || null;
        const value = values[index];
        const hasValue = isFiniteNumber(value);
        const isOldest = index === years.length - 1;
        const barPercent = !hasValue
          ? null
          : maxValue > 0
            ? Math.round((value / maxValue) * 1000) / 10
            : 0;

        return {
          year,
          yearLabel: getYearLabel(year, currentYear),
          value,
          valueText: formatCount(value),
          hasValue,
          barPercent,
          isCurrent: year === currentYear,
          isOldest,
          isIncomplete: !hasValue,
          delta: isOldest
            ? baselineDelta()
            : formatDelta(value, values[index + 1])
        };
      });

      const currentDelta = rows[0] && rows[0].delta;
      const headline = currentDelta && currentDelta.comparable
        ? `今年较去年 ${currentDelta.text}`
        : '暂不提供同期判断';
      const isCurrentMonth = group.month === cutoff.month;
      const periodStatus = group.period_status || '';
      const isPartial = periodStatus === 'through_day';

      return {
        month: group.month,
        label: `${group.month}月`,
        metric,
        metricLabel: METRIC_LABELS[metric],
        periodStatus,
        isCurrentMonth,
        isPartial,
        cutoffLabel: isCurrentMonth && isPartial && Number.isInteger(cutoff.day)
          ? `各年截至${cutoff.day}日`
          : '',
        headline,
        isIncomplete: rows.some(row => row.isIncomplete),
        rows
      };
    });
}

function buildMonthlyTable(payload, yearCount, metric = 'total') {
  assertYearCount(yearCount);
  assertMetric(metric);

  const currentYear = getCurrentYear(payload);
  const groups = payload && Array.isArray(payload.monthly_same_period)
    ? payload.monthly_same_period
    : [];
  if (!currentYear || groups.length === 0) {
    return null;
  }

  const years = selectYears(currentYear, yearCount);
  const cutoff = payload && cutoffObject(payload.cutoff);
  if (cutoff) cutoff.year = currentYear;
  const months = groups
    .filter(group => group && Number.isInteger(group.month) && group.month >= 1 && group.month <= 12)
    .slice()
    .sort((left, right) => right.month - left.month)
    .map(group => {
      const sourceRows = Array.isArray(group.rows) ? group.rows : [];
      const rowByYear = new Map(
        sourceRows
          .filter(row => row && Number.isInteger(row.year))
          .map(row => [row.year, row])
      );
      const cells = years.map(year => {
        const source = rowByYear.get(year);
        const value = metricValues(source);
        return {
          year,
          newValue: value.new,
          newText: formatCount(value.new),
          newHasValue: isFiniteNumber(value.new),
          usedValue: value.used,
          usedText: formatCount(value.used),
          usedHasValue: isFiniteNumber(value.used),
          totalValue: value.total,
          totalText: formatCount(value.total),
          totalHasValue: isFiniteNumber(value.total),
          displayValue: value[metric],
          displayText: formatCount(value[metric]),
          displayHasValue: isFiniteNumber(value[metric]),
          isCurrent: year === currentYear,
          isOldest: year === years[years.length - 1]
        };
      });
      const isCurrentMonth = cutoff && group.month === cutoff.month;
      const isPartial = group.period_status === 'through_day';
      return {
        month: group.month,
        label: `${group.month}月`,
        isCurrentMonth,
        isPartial,
        cutoffLabel: isCurrentMonth && isPartial && Number.isInteger(cutoff.day)
          ? `截至${cutoff.day}日`
          : '',
        cells
      };
    });

  const cumulativeValues = new Map();
  years.forEach(year => {
    const totals = { new: 0, used: 0, total: 0 };
    let complete = true;
    groups.forEach(group => {
      const source = Array.isArray(group.rows)
        ? group.rows.find(row => row && row.year === year)
        : null;
      const values = metricValues(source);
      ['new', 'used', 'total'].forEach(key => {
        if (!isFiniteNumber(values[key])) complete = false;
        else totals[key] += values[key];
      });
    });
    cumulativeValues.set(year, complete ? totals : { new: null, used: null, total: null });
  });

  const currentYearCumulative = cumulativeValues.get(currentYear) || {};
  const cumulativeCells = years.map(year => {
    const values = cumulativeValues.get(year) || { new: null, used: null, total: null };
    const displayValue = values[metric];
    const comparison = year === currentYear
      ? { comparable: false, text: '基准' }
      : formatReferenceDelta(displayValue, currentYearCumulative[metric]);
    return {
      year,
      newValue: values.new,
      newText: formatCount(values.new),
      newHasValue: isFiniteNumber(values.new),
      usedValue: values.used,
      usedText: formatCount(values.used),
      usedHasValue: isFiniteNumber(values.used),
      totalValue: values.total,
      totalText: formatCount(values.total),
      totalHasValue: isFiniteNumber(values.total),
      displayValue,
      displayText: formatCount(displayValue),
      displayHasValue: isFiniteNumber(displayValue),
      comparisonText: comparison.text,
      comparisonComparable: comparison.comparable,
      isCurrent: year === currentYear,
      isOldest: year === years[years.length - 1]
    };
  });

  months.forEach(month => {
    const reference = month.cells.find(cell => cell.year === currentYear);
    month.cells.forEach(cell => {
      const comparison = cell.isCurrent
        ? { comparable: false, text: '基准' }
        : formatReferenceDelta(cell.displayValue, reference && reference.displayValue);
      cell.comparisonText = comparison.text;
      cell.comparisonComparable = comparison.comparable;
    });
  });

  return {
    years,
    months: [{
      month: 0,
      label: '累计',
      isCumulative: true,
      isCurrentMonth: false,
      isPartial: false,
      cutoffLabel: '',
      cells: cumulativeCells
    }, ...months],
    latestMonthLabel: months.length ? months[0].label : '',
    cutoffLabel: cutoff ? `数据截至 ${cutoff.year}年${cutoff.month}月${cutoff.day}日` : ''
  };
}

function cutoffObject(value) {
  if (!value || typeof value !== 'object') return null;
  const month = Number.isInteger(value.month) ? value.month : null;
  const day = Number.isInteger(value.day) ? value.day : null;
  if (!month || month < 1 || month > 12 || !day || day < 1 || day > 31) return null;
  return { month, day, year: null };
}

function metricValues(row) {
  return {
    new: resolveMetric(row, 'new'),
    used: resolveMetric(row, 'used'),
    total: resolveMetric(row, 'total')
  };
}

function formatReferenceDelta(value, reference) {
  if (!isFiniteNumber(value) || !isFiniteNumber(reference)) {
    return {
      comparable: false,
      text: '不可比'
    };
  }
  if (reference === 0) {
    return {
      comparable: false,
      text: '不可比'
    };
  }
  const percent = Math.round(Math.abs((value - reference) / reference * 100) * 10) / 10;
  if (percent === 0) {
    return {
      comparable: true,
      text: '持平'
    };
  }
  return {
    comparable: true,
    text: value > reference ? `↑ ${percent.toFixed(1)}%` : `↓ ${percent.toFixed(1)}%`
  };
}

function parseIsoDate(value) {
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    : null;
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDay ? { year, month, day } : null;
}

function formatCutoff(payload) {
  const parsed = parseIsoDate(payload && payload.latest_date);
  return parsed
    ? `数据截至 ${parsed.year}年${parsed.month}月${parsed.day}日`
    : '';
}

function formatUpdatedAt(payload) {
  const value = payload && payload.updated_at;
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-](\d{2}):(\d{2}))?$/.exec(value)
    : null;
  if (!match) return '';

  const date = parseIsoDate(`${match[1]}-${match[2]}-${match[3]}`);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? null : Number(match[6]);
  const offsetHour = match[9] === undefined ? null : Number(match[9]);
  const offsetMinute = match[10] === undefined ? null : Number(match[10]);
  const invalidOffset = offsetHour !== null && (
    offsetHour > 14
    || offsetMinute > 59
    || (offsetHour === 14 && offsetMinute !== 0)
  );

  if (
    !date
    || hour > 23
    || minute > 59
    || (second !== null && second > 59)
    || invalidOffset
  ) {
    return '';
  }

  const timezone = match[8];
  if (!timezone) {
    return `数据生成 ${date.year}年${date.month}月${date.day}日 ${match[4]}:${match[5]}`;
  }

  const sourceOffsetMinutes = timezone === 'Z'
    ? 0
    : (timezone[0] === '+' ? 1 : -1) * (offsetHour * 60 + offsetMinute);
  const sourceTime = new Date(0);
  sourceTime.setUTCFullYear(date.year, date.month - 1, date.day);
  sourceTime.setUTCHours(hour, minute, second || 0, 0);
  const shanghaiTime = new Date(
    sourceTime.getTime() - sourceOffsetMinutes * 60 * 1000 + 8 * 60 * 60 * 1000
  );
  const shanghaiYear = shanghaiTime.getUTCFullYear();
  const shanghaiMonth = shanghaiTime.getUTCMonth() + 1;
  const shanghaiDay = shanghaiTime.getUTCDate();
  const shanghaiHour = String(shanghaiTime.getUTCHours()).padStart(2, '0');
  const shanghaiMinute = String(shanghaiTime.getUTCMinutes()).padStart(2, '0');

  return `数据生成 ${shanghaiYear}年${shanghaiMonth}月${shanghaiDay}日 ${shanghaiHour}:${shanghaiMinute}`;
}

function formatYearRange(years) {
  if (!Array.isArray(years)) return '';

  const validYears = years.filter(Number.isInteger);
  if (validYears.length === 0) return '';

  const earliest = Math.min(...validYears);
  const latest = Math.max(...validYears);
  return earliest === latest ? String(earliest) : `${earliest}—${latest}`;
}

module.exports = {
  selectYears,
  resolveMetric,
  formatDelta,
  formatReferenceDelta,
  buildMonthlyCards,
  formatCutoff,
  formatUpdatedAt,
  formatYearRange,
  buildMonthlyTable
};
