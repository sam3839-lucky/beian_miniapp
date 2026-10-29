'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  equalInstallment,
  equalPrincipal,
  maxLoanByMonthly,
  formatMonthly
} = require('../utils/mortgage');

test('equalInstallment returns fixed monthly payment and totals', () => {
  assert.deepEqual(equalInstallment(100, 0.0305, 30), {
    monthly: 0.4243,
    totalInterest: 52.75,
    totalPayment: 152.75
  });
});

test('equalPrincipal returns decreasing payment details', () => {
  const result = equalPrincipal(100, 0.0305, 30);

  assert.equal(result.firstMonth, 0.5319);
  assert.equal(result.lastMonth, 0.2785);
  assert.equal(result.monthlyDecline, 0.0007);
  assert.equal(result.totalInterest, 45.8771);
  assert.equal(result.totalPayment, 145.8771);
  assert.ok(result.firstMonth > result.lastMonth);
});

test('maxLoanByMonthly rounds the affordable loan amount', () => {
  assert.equal(maxLoanByMonthly(0.5, 0.0305, 30), 118);
});

test('formatMonthly switches between yuan and ten-thousand-yuan display', () => {
  assert.equal(formatMonthly(0.5), '5000元');
  assert.equal(formatMonthly(1.234), '1.23万');
});
