/**
 * 카카오 알림톡 — Solapi REST (환경변수 설정 시에만 발송)
 */
'use strict';

const crypto = require('crypto');

const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || '';
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || '';
const SOLAPI_SENDER = process.env.SOLAPI_SENDER || '';
const SOLAPI_PFID = process.env.SOLAPI_PFID || '';
const SOLAPI_TEMPLATE_REQUEST_RECEIVED = process.env.SOLAPI_TEMPLATE_REQUEST_RECEIVED || '';
const SOLAPI_TEMPLATE_REQUEST_COMPLETE = process.env.SOLAPI_TEMPLATE_REQUEST_COMPLETE || '';

function getAlimtalkConfig() {
  const hasCredentials = !!(SOLAPI_API_KEY && SOLAPI_API_SECRET && SOLAPI_SENDER && SOLAPI_PFID);
  return {
    configured: hasCredentials,
    pfId: SOLAPI_PFID || null,
    sender: SOLAPI_SENDER || null,
    templates: {
      requestReceived: SOLAPI_TEMPLATE_REQUEST_RECEIVED || null,
      requestComplete: SOLAPI_TEMPLATE_REQUEST_COMPLETE || null
    }
  };
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('010') && digits.length === 11) return digits;
  if (digits.length === 10 && digits.startsWith('10')) return '0' + digits;
  return digits;
}

function buildSolapiAuthHeader() {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 ApiKey=${SOLAPI_API_KEY}, Date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendAlimtalk({ to, templateId, variables }) {
  const config = getAlimtalkConfig();
  if (!config.configured) {
    return { success: false, skipped: true, errorMessage: 'Solapi 알림톡이 설정되지 않았습니다.' };
  }
  if (!templateId) {
    return { success: false, skipped: true, errorMessage: '알림톡 템플릿 ID가 설정되지 않았습니다.' };
  }

  const phone = normalizePhone(to);
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return { success: false, errorMessage: '유효한 휴대폰 번호가 없습니다.' };
  }

  const res = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildSolapiAuthHeader()
    },
    body: JSON.stringify({
      message: {
        to: phone,
        from: SOLAPI_SENDER,
        kakaoOptions: {
          pfId: SOLAPI_PFID,
          templateId,
          variables: variables || {}
        }
      }
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.errorMessage || data.message)) || 'Solapi 알림톡 발송 실패 (' + res.status + ')';
    return { success: false, errorMessage: msg };
  }

  return { success: true, channel: 'alimtalk', toPhone: phone, messageId: data.messageId || data.groupId || null };
}

function buildRequestReceivedVariables(params) {
  params = params || {};
  const reqNum = String(params.requestNumber || '').replace(/^#/, '');
  return {
    '#{고객명}': params.userName || '고객',
    '#{의뢰번호}': reqNum,
    '#{옵션}': String(params.productOption || params.optionName || '단일옵션').slice(0, 100),
    '#{예상시간}': '24~48시간'
  };
}

function buildRequestCompleteVariables(params) {
  params = params || {};
  const reqNum = String(params.requestNumber || '').replace(/^#/, '');
  const siteUrl = process.env.SITE_URL || 'https://pricehunt24.com';
  const guest = params.isGuest === true || params.source === 'guest_trial';
  let checkUrl = siteUrl + '/member-dashboard.html';
  if (guest) {
    const qs = [];
    if (params.toEmail) qs.push('email=' + encodeURIComponent(String(params.toEmail).trim()));
    if (reqNum) qs.push('req=' + encodeURIComponent(reqNum));
    checkUrl = siteUrl + '/guest-result.html' + (qs.length ? '?' + qs.join('&') : '');
  }
  return {
    '#{고객명}': params.userName || '고객',
    '#{의뢰번호}': reqNum,
    '#{상품명}': String(params.productOption || params.productName || '의뢰 상품').slice(0, 100),
    '#{확인링크}': checkUrl
  };
}

async function sendRequestReceivedAlimtalk(params) {
  return sendAlimtalk({
    to: params.toPhone || params.phone,
    templateId: SOLAPI_TEMPLATE_REQUEST_RECEIVED,
    variables: buildRequestReceivedVariables(params)
  });
}

async function sendReportCompleteAlimtalk(params) {
  return sendAlimtalk({
    to: params.toPhone || params.phone,
    templateId: SOLAPI_TEMPLATE_REQUEST_COMPLETE,
    variables: buildRequestCompleteVariables(params)
  });
}

module.exports = {
  getAlimtalkConfig,
  normalizePhone,
  sendAlimtalk,
  sendRequestReceivedAlimtalk,
  sendReportCompleteAlimtalk,
  buildRequestReceivedVariables,
  buildRequestCompleteVariables
};
