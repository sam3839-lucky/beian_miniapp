/** 房贷计算工具 — 等额本息 + 等额本金
 *
 * 所有金额单位统一为「万元」，利率为年化小数（如 0.0305 = 3.05%）。
 * 返回结果中月供 < 1 万时自动降级显示为「元」。
 */

/**
 * 等额本息 — 每月还款额固定
 *
 *  月供 = 贷款额 × [月利率×(1+月利率)^期数] / [(1+月利率)^期数 - 1]
 *
 * @param {number} loan      贷款额（万元）
 * @param {number} rate      年化利率（小数），默认取全局 mortgageRate
 * @param {number} years     贷款年限，默认 30
 * @returns {{ monthly: number, totalInterest: number, totalPayment: number }}
 */
function equalInstallment(loan, rate, years) {
  rate = rate || getApp().globalData.mortgageRate || 0.0305;
  years = years || 30;
  const mr = rate / 12;
  const months = years * 12;
  const factor = (mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1);
  const monthly = loan * factor;
  const totalPayment = monthly * months;
  return {
    monthly: round(monthly),
    totalInterest: round(totalPayment - loan),
    totalPayment: round(totalPayment)
  };
}

/**
 * 等额本金 — 每月还本金固定，月供逐月递减
 *
 *  首月月供 = 贷款额/期数 + 贷款额×月利率
 *  末月月供 = 贷款额/期数 + (贷款额 - 已还本金)×月利率
 *
 * @param {number} loan      贷款额（万元）
 * @param {number} rate      年化利率（小数）
 * @param {number} years     贷款年限，默认 30
 * @returns {{ firstMonth: number, lastMonth: number, monthlyDecline: number, totalInterest: number, totalPayment: number }}
 */
function equalPrincipal(loan, rate, years) {
  rate = rate || getApp().globalData.mortgageRate || 0.0305;
  years = years || 30;
  const mr = rate / 12;
  const months = years * 12;
  const principalPerMonth = loan / months;          // 每月固定还本
  const firstMonth = principalPerMonth + loan * mr;
  const lastMonth = principalPerMonth + principalPerMonth * mr;
  // 利息总额 = (首月利息 + 末月利息) × 期数 / 2
  const totalInterest = ((loan * mr + principalPerMonth * mr) * months) / 2;
  return {
    firstMonth: round(firstMonth),
    lastMonth: round(lastMonth),
    monthlyDecline: round(principalPerMonth * mr),
    totalInterest: round(totalInterest),
    totalPayment: round(loan + totalInterest)
  };
}

/**
 * 反向计算 — 根据月供能力估算最高可贷额
 *
 * @param {number} monthly   月供能力（万元/月）
 * @param {number} rate      年化利率
 * @param {number} years     贷款年限
 * @returns {number} 最高可贷额（万元，取整）
 */
function maxLoanByMonthly(monthly, rate, years) {
  rate = rate || getApp().globalData.mortgageRate || 0.0305;
  years = years || 30;
  const mr = rate / 12;
  const months = years * 12;
  const factor = (mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1);
  return Math.round(monthly / factor);
}

/**
 * 格式化月供显示 — < 1 万用「元」，>= 1 万用「万元」
 */
function formatMonthly(val) {
  if (val >= 1) return val.toFixed(2) + '万';
  return Math.round(val * 10000) + '元';
}

/** 四舍五入到分（万元精度） */
function round(v) {
  return Math.round(v * 10000) / 10000;
}

module.exports = {
  equalInstallment,
  equalPrincipal,
  maxLoanByMonthly,
  formatMonthly
};
