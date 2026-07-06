/**
 * 고객 알림 통합 디스패치 — 이메일 + 알림톡(설정 시)
 */
'use strict';

const customerEmail = (() => {
  try { return require('./customer-notify-email'); } catch (e) { return null; }
})();
const alimtalk = (() => {
  try { return require('./kakao-alimtalk'); } catch (e) { return null; }
})();

function getNotificationConfig() {
  const emailConfigured = !!customerEmail;
  const alimtalkConfig = alimtalk ? alimtalk.getAlimtalkConfig() : { configured: false, templates: {} };
  return {
    email: { configured: emailConfigured },
    alimtalk: alimtalkConfig
  };
}

function resolvePhoneFromData(data, userData) {
  data = data || {};
  userData = userData || {};
  const raw = data.phone || data.userPhone || data.phoneNumber ||
    userData.phone || userData.userPhone || '';
  return alimtalk ? alimtalk.normalizePhone(raw) : String(raw || '').replace(/\D/g, '');
}

async function notifyCustomerRequestReceived(params) {
  params = params || {};
  const result = { email: null, alimtalk: null };

  if (customerEmail) {
    result.email = await customerEmail.sendCustomerRequestReceivedEmail(params);
  } else {
    result.email = { success: false, errorMessage: '고객 이메일 모듈을 사용할 수 없습니다.' };
  }

  if (alimtalk && params.toPhone) {
    result.alimtalk = await alimtalk.sendRequestReceivedAlimtalk(params);
  } else if (alimtalk) {
    result.alimtalk = { success: false, skipped: true, errorMessage: '휴대폰 번호 없음' };
  }

  result.success = !!(result.email && result.email.success) ||
    !!(result.alimtalk && result.alimtalk.success);
  return result;
}

async function notifyCustomerReportComplete(params) {
  params = params || {};
  const result = { email: null, alimtalk: null };

  if (customerEmail) {
    result.email = await customerEmail.sendCustomerReportCompleteEmail(params);
  } else {
    result.email = { success: false, errorMessage: '고객 이메일 모듈을 사용할 수 없습니다.' };
  }

  if (alimtalk && params.toPhone) {
    result.alimtalk = await alimtalk.sendReportCompleteAlimtalk(params);
  } else if (alimtalk) {
    result.alimtalk = { success: false, skipped: true, errorMessage: '휴대폰 번호 없음' };
  }

  result.success = !!(result.email && result.email.success) ||
    !!(result.alimtalk && result.alimtalk.success);
  return result;
}

function buildNotifyParamsFromRequestData(data, overrides) {
  if (!customerEmail) return overrides || {};
  return customerEmail.buildParamsFromRequestData(data, overrides);
}

module.exports = {
  getNotificationConfig,
  resolvePhoneFromData,
  notifyCustomerRequestReceived,
  notifyCustomerReportComplete,
  buildNotifyParamsFromRequestData
};
