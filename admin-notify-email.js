/**
 * 운영자 신규 의뢰 알림 — EmailJS REST (서버 발송, 브라우저 의존 없음)
 */
'use strict';

const { sendEmailJs } = require('./emailjs-rest');
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
  return sendEmailJs(templateParams);
}

module.exports = {
  sendAdminNewRequestEmail,
  buildAdminNewRequestParams,
  ADMIN_NOTIFY_EMAIL
};
