/**
 * 고객 알림 이메일 — EmailJS REST (서버 발송)
 */
'use strict';

const { sendEmailJs } = require('./emailjs-rest');

const EMAILJS_SITE_URL = process.env.SITE_URL || 'https://pricehunt24.com';

const VERDICT_LABELS = {
  buy: '구매 추천',
  hold: '보류 (관망)',
  skip: '구매 비추천'
};

function withSubjectFields(subjectLine, params) {
  const subject = String(subjectLine || '').trim();
  return Object.assign({}, params, {
    mail_subject: subject,
    email_subject: subject,
    subject
  });
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function formatPriceKrw(price) {
  if (price == null || price === '' || isNaN(Number(String(price).replace(/[^\d]/g, '')))) {
    return '';
  }
  const num = Number(String(price).replace(/[^\d]/g, ''));
  if (!num) return String(price).trim();
  return num.toLocaleString('ko-KR') + '원';
}

function isGuestRequest(params) {
  params = params || {};
  if (params.isGuest === true) return true;
  if (params.source === 'guest_trial') return true;
  if (params.requestType && String(params.requestType).indexOf('게스트') >= 0) return true;
  return false;
}

function resolveRecipientName(params) {
  params = params || {};
  const n = String(params.userName || '').trim();
  if (!n || n === '(링크로 확인 예정)' || n === '의뢰 상품') return '고객';
  return n;
}

function buildCustomerReceivedParams(params) {
  params = params || {};
  const guest = isGuestRequest(params);
  const recipientName = resolveRecipientName(params);
  const reqNum = params.requestNumber || '';
  const optionLabel = String(params.productOption || params.optionName || '').slice(0, 200);
  const subjectLine = '[PriceHunter] 의뢰가 접수되었습니다';

  const detailLines = [
    '의뢰 번호: ' + reqNum,
    '옵션: ' + (optionLabel || '(미입력)'),
    guest ? '유형: 무료 체험 (1회)' : '유형: 회원 의뢰',
    '예상 소요: 24~48시간 내 결과 안내',
    '접수 시각: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  ].join('\n');

  return withSubjectFields(subjectLine, {
    to_email: String(params.toEmail).trim(),
    name: 'PriceHunter',
    from_name: 'PriceHunter',
    user_name: recipientName,
    recipient_name: recipientName,
    headline: recipientName + '님, 구매판단 리포트 의뢰가 접수되었습니다.',
    request_number: reqNum,
    product_name: detailLines,
    footer_message: '검토가 완료되면 이메일로 결과 안내를 드립니다. PriceHunter 사이트에서도 진행 상황을 확인하실 수 있습니다.',
    check_url: guest
      ? EMAILJS_SITE_URL + '/guest-result.html?email=' + encodeURIComponent(String(params.toEmail).trim())
      : EMAILJS_SITE_URL + '/member-dashboard.html',
    cta_label: guest ? '의뢰 현황 확인하기 →' : '내 의뢰 보기 →',
    is_guest: guest ? 'yes' : '',
    has_result: '',
    site_teaser: '담당자가 상품 링크·옵션·시장 가격을 검토한 뒤 구매 판단 리포트를 작성합니다.',
    show_site_notice: 'yes'
  });
}

function emptyResultFields() {
  return {
    result_price: '',
    result_origin: '',
    result_verdict_label: '',
    result_decision: '',
    result_summary: '',
    result_link: '',
    has_result: ''
  };
}

function buildCustomerCompleteParams(params) {
  params = params || {};
  const guest = isGuestRequest(params);
  const subjectLine = '[PriceHunter] 의뢰 답변이 완료되었습니다';
  let productLabel = String(params.productName || '의뢰 상품')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 200);

  if (guest && params.productOption) {
    productLabel = String(params.productOption).slice(0, 200);
  } else if (productLabel === '(링크로 확인 예정)' && params.productOption) {
    productLabel = String(params.productOption).slice(0, 200);
  }

  const recipientName = resolveRecipientName(params);
  const resultFields = emptyResultFields();

  let headline;
  let footerMessage;
  let checkUrl;
  let ctaLabel;
  let siteTeaser;

  if (guest) {
    headline = recipientName + '님, 무료 체험 의뢰 검토가 완료되었습니다.';
    siteTeaser = '검토가 완료되었습니다. 가격·판매처·구매 판단이 담긴 리포트 전문은 회원가입 후 사이트에서 확인하실 수 있습니다.';
    footerMessage = '아래 버튼을 눌러 PriceHunter 사이트에서 안내에 따라 결과를 확인해 주세요.';
    const qs = [];
    if (params.toEmail) qs.push('email=' + encodeURIComponent(String(params.toEmail).trim()));
    if (params.requestNumber) {
      qs.push('req=' + encodeURIComponent(String(params.requestNumber).replace(/^#/, '')));
    }
    checkUrl = EMAILJS_SITE_URL + '/guest-result.html' + (qs.length ? '?' + qs.join('&') : '');
    ctaLabel = 'PriceHunter에서 결과 확인하기 →';
  } else {
    headline = recipientName + '님, 요청하신 의뢰에 대한 답변이 완료되었습니다.';
    siteTeaser = '검토가 완료되었습니다. 리포트 전문은 로그인 후 사이트의 내 의뢰 내역에서 확인하실 수 있습니다.';
    footerMessage = '아래 버튼을 눌러 PriceHunter 사이트에서 결과 리포트를 확인해 주세요.';
    checkUrl = EMAILJS_SITE_URL + '/member-dashboard.html';
    ctaLabel = 'PriceHunter에서 결과 확인하기 →';
  }

  return withSubjectFields(subjectLine, Object.assign({
    to_email: String(params.toEmail).trim(),
    name: 'PriceHunter',
    from_name: 'PriceHunter',
    user_name: recipientName,
    recipient_name: recipientName,
    headline,
    request_number: params.requestNumber || '',
    product_name: productLabel,
    footer_message: footerMessage,
    check_url: checkUrl,
    cta_label: ctaLabel,
    is_guest: guest ? 'yes' : '',
    site_teaser: siteTeaser,
    show_site_notice: 'yes'
  }, resultFields));
}

function buildParamsFromRequestData(data, overrides) {
  data = data || {};
  overrides = overrides || {};
  return Object.assign({
    toEmail: overrides.toEmail || data.email || data.userEmail,
    userName: data.userName || (
      data.name && data.name !== '(링크로 확인 예정)' ? data.name : '고객'
    ),
    requestNumber: data.requestNumber || data.reqNum || overrides.requestId || '',
    productName: data.name || data.productName || '의뢰 상품',
    productOption: data.optionName || data.productOption || '',
    isGuest: data.isGuest === true || data.source === 'guest_trial',
    source: data.source || '',
    requestType: overrides.requestType || (data.isGuest ? '게스트 체험 (1회)' : '회원 의뢰'),
    purchaseReport: data.purchaseReport || null,
    adminResponse: data.adminResponse || null
  }, overrides);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function sendCustomerRequestReceivedEmail(params) {
  if (!isValidEmail(params.toEmail)) {
    return { success: false, errorMessage: '유효한 고객 이메일이 없습니다.' };
  }
  try {
    const result = await sendEmailJs(buildCustomerReceivedParams(params));
    return Object.assign({ channel: 'email' }, result);
  } catch (err) {
    return { success: false, errorMessage: err.message || String(err), needsBrowserFallback: err.needsBrowserFallback === true };
  }
}

async function sendCustomerReportCompleteEmail(params) {
  if (!isValidEmail(params.toEmail)) {
    return { success: false, errorMessage: '유효한 고객 이메일이 없습니다.' };
  }
  try {
    const result = await sendEmailJs(buildCustomerCompleteParams(params));
    return Object.assign({ channel: 'email', isGuest: isGuestRequest(params) }, result);
  } catch (err) {
    return { success: false, errorMessage: err.message || String(err), needsBrowserFallback: err.needsBrowserFallback === true };
  }
}

module.exports = {
  sendCustomerRequestReceivedEmail,
  sendCustomerReportCompleteEmail,
  buildCustomerReceivedParams,
  buildCustomerCompleteParams,
  buildParamsFromRequestData,
  isValidEmail,
  isGuestRequest
};
