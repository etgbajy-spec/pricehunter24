/**
 * 운영자 신규 의뢰 알림 — EmailJS REST (서버 발송, 브라우저 의존 없음)
 */
'use strict';

const EMAILJS_SERVICE_ID = 'service_qq3o0or';
const EMAILJS_TEMPLATE_ID = 'template_fk0poj6';
const EMAILJS_PUBLIC_KEY = 'zrRVWnL0cA9eyxpDp';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';
const ADMIN_NOTIFY_EMAIL = 'pricehunter.service@gmail.com';
const EMAILJS_SITE_URL = process.env.SITE_URL || 'https://pricehunt24.com';

function formatPriceKrw(price) {
  if (price == null || price === '' || isNaN(Number(String(price).replace(/[^\d]/g, '')))) {
    return '';
  }
  const num = Number(String(price).replace(/[^\d]/g, ''));
  if (!num) return String(price).trim();
  return num.toLocaleString('ko-KR') + '원';
}

function buildAdminNewRequestParams(params) {
  params = params || {};
  const detailLines = [
    '유형: ' + (params.requestType || '의뢰'),
    '고객 이메일: ' + (params.customerEmail || '(미입력)'),
    '옵션: ' + (params.productOption || '(미입력)'),
    '상품 링크: ' + String(params.productUrl || '(미입력)').slice(0, 500),
    '요청가: ' + (formatPriceKrw(params.productPrice) || '(미입력)'),
    '접수 시각: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  ].join('\n');

  const subjectLine = '[PriceHunter] 새 의뢰 접수 ' + (params.requestNumber || '');

  return {
    to_email: ADMIN_NOTIFY_EMAIL,
    name: 'PriceHunter',
    user_name: '운영자',
    subject: subjectLine,
    mail_subject: subjectLine,
    email_subject: subjectLine,
    headline: '새 의뢰가 접수되었습니다.',
    request_number: params.requestNumber || '',
    product_name: detailLines,
    footer_message: '관리자 페이지에서 의뢰를 확인해 주세요.',
    check_url: EMAILJS_SITE_URL + '/admin-dashboard.html',
    cta_label: '관리자 페이지 열기 →',
    has_result: '',
    is_guest: ''
  };
}

async function sendAdminNewRequestEmail(params) {
  const templateParams = buildAdminNewRequestParams(params);
  const body = {
    lib_version: '4.0.0',
    user_id: EMAILJS_PUBLIC_KEY,
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    template_params: templateParams
  };
  if (EMAILJS_PRIVATE_KEY) {
    body.accessToken = EMAILJS_PRIVATE_KEY;
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || 'EmailJS 발송 실패 (' + res.status + ')');
    err.needsBrowserFallback = /non-browser|API access/i.test(text);
    throw err;
  }

  return { success: true, toEmail: ADMIN_NOTIFY_EMAIL };
}

module.exports = {
  sendAdminNewRequestEmail,
  buildAdminNewRequestParams,
  ADMIN_NOTIFY_EMAIL
};
