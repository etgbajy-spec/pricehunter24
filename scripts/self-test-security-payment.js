/**
 * 자체 테스트: payment-amount / merchant_uid 파싱
 * 실행: node scripts/self-test-security-payment.js
 */
'use strict';

const assert = require('assert');
const {
  computePaymentAmounts,
  computeSupportFee,
  parseReqIdFromMerchantUid
} = require('../payment-amount');

function testSupportFee() {
  assert.strictEqual(computeSupportFee(100000), 1000);
  assert.strictEqual(computeSupportFee(1), 1);
  assert.strictEqual(computeSupportFee(0), 0);
}

function testPaymentAmounts() {
  const data = {
    purchaseReport: { price: 85000 },
    purchaseDecision: 'support'
  };
  const amounts = computePaymentAmounts(data, 'support');
  assert.strictEqual(amounts.basePrice, 85000);
  assert.strictEqual(amounts.supportFee, 850);
  assert.strictEqual(amounts.finalPrice, 85850);
  assert.strictEqual(amounts.earnedPoints, 850);
}

function testMerchantUidParse() {
  assert.strictEqual(parseReqIdFromMerchantUid('PHl5abc_PH-20260718123'), 'PH-20260718123');
  assert.strictEqual(parseReqIdFromMerchantUid('PH__PH-20260718123__1710000000'), 'PH-20260718123');
  assert.strictEqual(parseReqIdFromMerchantUid(''), '');
}

function testDirectMethod() {
  const amounts = computePaymentAmounts({ purchaseReport: { price: 10000 } }, 'direct');
  assert.strictEqual(amounts.finalPrice, 10000);
  assert.strictEqual(amounts.supportFee, 0);
}

try {
  testSupportFee();
  testPaymentAmounts();
  testMerchantUidParse();
  testDirectMethod();
  console.log('PASS: payment-amount self-test');
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
