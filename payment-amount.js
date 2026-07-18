/**
 * 결제 금액 계산 (payment-info / portone-verify 공통)
 */
'use strict';

const SUPPORT_FEE_RATE = 0.01;

function toNumberPrice(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const digits = String(v).replace(/[^0-9]/g, '');
  if (!digits) return NaN;
  return Number(digits);
}

function computeSupportFee(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n * SUPPORT_FEE_RATE));
}

function resolveBasePrice(data) {
  data = data || {};
  return toNumberPrice(
    data.purchaseReport?.price ??
      data.adminResponse?.lowestPrice ??
      data.adminResponse?.totalCost ??
      data.totalAmount ??
      data.finalPrice ??
      data.finalAmount ??
      data.productPrice ??
      0
  );
}

function resolvePaymentMethod(data, queryMethod) {
  data = data || {};
  const q = String(queryMethod || '').trim();
  if (q === 'support' || q === 'direct') return q;
  if (
    data.method === 'support' ||
    data.purchaseMethod === 'support' ||
    data.purchaseDecision === 'support'
  ) {
    return 'support';
  }
  return 'direct';
}

function computePaymentAmounts(data, queryMethod) {
  const basePrice = resolveBasePrice(data);
  const method = resolvePaymentMethod(data, queryMethod);
  let supportFee = 0;
  let finalPrice = basePrice;
  if (method === 'support' && Number.isFinite(basePrice) && basePrice > 0) {
    supportFee = computeSupportFee(basePrice);
    finalPrice = basePrice + supportFee;
  }
  return {
    basePrice,
    method,
    supportFee,
    finalPrice,
    earnedPoints: method === 'support' ? supportFee : 0,
    supportFeeRate: SUPPORT_FEE_RATE
  };
}

/**
 * merchant_uid 에서 의뢰번호 추출
 * - 현재: PH{ts36}_{reqId}
 * - 구형: PH__{reqId}__{digits}
 */
function parseReqIdFromMerchantUid(merchantUid) {
  const s = String(merchantUid || '').trim();
  if (!s) return '';

  const legacy = s.match(/^PH__([^_]+)__(\d{8,})$/);
  if (legacy) return legacy[1].replace(/^#+/, '').slice(0, 80);

  const current = s.match(/^PH[a-z0-9]+_(.+)$/i);
  if (current) return String(current[1] || '').replace(/^#+/, '').slice(0, 80);

  return '';
}

module.exports = {
  SUPPORT_FEE_RATE,
  toNumberPrice,
  computeSupportFee,
  resolveBasePrice,
  resolvePaymentMethod,
  computePaymentAmounts,
  parseReqIdFromMerchantUid
};
