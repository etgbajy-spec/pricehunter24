/**
 * 고객 의뢰 완료 알림 (EmailJS) — admin-dashboard / result-admin 공용
 */
(function (global) {
  'use strict';

  var EMAILJS_SERVICE_ID = 'service_qq3o0or';
  var EMAILJS_REQUEST_COMPLETE_TEMPLATE_ID = 'template_fk0poj6';
  var EMAILJS_PUBLIC_KEY = 'zrRVWnL0cA9eyxpDp';
  var EMAILJS_SITE_URL = 'https://pricehunt24.com';
  var EMAILJS_TEMPLATE_IS_CONFIGURED = EMAILJS_REQUEST_COMPLETE_TEMPLATE_ID &&
    EMAILJS_REQUEST_COMPLETE_TEMPLATE_ID !== 'template_request_complete';

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  /**
   * @param {{ toEmail: string, userName?: string, requestNumber?: string, productName?: string }} params
   */
  async function sendRequestCompleteEmail(params) {
    params = params || {};
    if (!isValidEmail(params.toEmail)) {
      return { success: false, errorMessage: '유효한 고객 이메일이 없습니다.' };
    }
    if (!EMAILJS_TEMPLATE_IS_CONFIGURED) {
      return { success: false, errorMessage: 'EmailJS 템플릿이 설정되지 않았습니다.' };
    }
    if (typeof emailjs === 'undefined') {
      return { success: false, errorMessage: 'EmailJS가 로드되지 않았습니다.' };
    }
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_REQUEST_COMPLETE_TEMPLATE_ID, {
        to_email: String(params.toEmail).trim(),
        user_name: params.userName || '고객',
        request_number: params.requestNumber || '',
        product_name: String(params.productName || '의뢰 상품')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .slice(0, 200),
        check_url: EMAILJS_SITE_URL + '/member-dashboard.html'
      });
      return { success: true, toEmail: params.toEmail };
    } catch (err) {
      var msg = (err && (err.text || err.message)) ? String(err.text || err.message) : '알 수 없는 오류';
      return { success: false, errorMessage: msg };
    }
  }

  function markNotifySent(reqNum, method) {
    var key = 'notify-' + String(reqNum || '').replace(/^#+/, '');
    localStorage.setItem(key, JSON.stringify({
      sent: true,
      sentAt: new Date().toISOString(),
      method: method || 'email'
    }));
  }

  global.CustomerNotification = {
    sendRequestCompleteEmail: sendRequestCompleteEmail,
    markNotifySent: markNotifySent
  };
})(typeof window !== 'undefined' ? window : this);
