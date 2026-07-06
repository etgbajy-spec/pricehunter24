/**
 * 의뢰 알림 (EmailJS) — 고객 결과 발송 + 운영자 신규 의뢰 알림
 */
(function (global) {
  'use strict';

  var EMAILJS_SERVICE_ID = 'service_qq3o0or';
  /** 고객 답변 완료 + 운영자 신규 의뢰 알림 공용 (무료 템플릿 2개 한도) */
  var EMAILJS_SHARED_TEMPLATE_ID = 'template_fk0poj6';
  var EMAILJS_PUBLIC_KEY = 'zrRVWnL0cA9eyxpDp';
  var EMAILJS_SITE_URL = 'https://pricehunt24.com';
  var ADMIN_NOTIFY_EMAIL = 'pricehunter.service@gmail.com';
  var EMAILJS_TEMPLATE_IS_CONFIGURED = EMAILJS_SHARED_TEMPLATE_ID &&
    EMAILJS_SHARED_TEMPLATE_ID !== 'template_request_complete';

  var VERDICT_LABELS = {
    buy: '구매 추천',
    hold: '보류 (관망)',
    skip: '구매 비추천'
  };

  function withSubjectFields(subjectLine, params) {
    var subject = String(subjectLine || '').trim();
    return Object.assign({}, params, {
      mail_subject: subject,
      email_subject: subject,
      subject: subject
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
    var num = Number(String(price).replace(/[^\d]/g, ''));
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

  function normalizeReportFromParams(params) {
    params = params || {};
    if (params.purchaseReport && typeof params.purchaseReport === 'object') {
      return params.purchaseReport;
    }
    if (params.resultData && typeof params.resultData === 'object') {
      return params.resultData;
    }
    var ar = params.adminResponse;
    if (!ar || typeof ar !== 'object') return null;
    return {
      price: ar.lowestPrice || ar.price || '',
      origin: ar.seller || ar.origin || '',
      summary: ar.additionalInfo || ar.summary || '',
      link: ar.link || ar.sellerLink || '',
      decision: {
        verdict: ar.purchaseVerdict || (ar.decision && ar.decision.verdict) || '',
        summary: ar.purchaseSummary || (ar.decision && ar.decision.summary) || ''
      }
    };
  }

  function scrubPlaceholderText(text) {
    return String(text || '')
      .replace(/\(링크로 확인 예정\)/g, '')
      .replace(/\b의뢰 상품\b/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

  function formatResultForEmail(report) {
    if (!report || typeof report !== 'object') return null;
    var lines = [];
    var price = formatPriceKrw(report.price);
    var origin = stripHtml(report.origin);
    var verdict = report.decision && report.decision.verdict;
    var verdictLabel = VERDICT_LABELS[verdict] || (verdict ? String(verdict) : '');
    var decisionSummary = scrubPlaceholderText(stripHtml(report.decision && report.decision.summary));
    var summary = scrubPlaceholderText(stripHtml(report.summary));
    var link = String(report.link || '').trim();

    if (price) lines.push('최저가: ' + price);
    if (origin) lines.push('판매처/공급처: ' + origin);
    if (verdictLabel) lines.push('구매 판정: ' + verdictLabel);
    if (decisionSummary) lines.push('한 줄 결론: ' + decisionSummary);
    if (summary) lines.push('종합 설명:\n' + summary);
    if (link) lines.push('구매 링크: ' + link);

    if (!lines.length) return null;
    return {
      result_price: price,
      result_origin: origin,
      result_verdict_label: verdictLabel,
      result_decision: decisionSummary,
      result_summary: lines.join('\n\n'),
      result_link: link,
      has_result: 'yes'
    };
  }

  function resolveRecipientName(params) {
    params = params || {};
    var n = String(params.userName || '').trim();
    if (!n || n === '(링크로 확인 예정)' || n === '의뢰 상품') return '고객';
    return n;
  }

  function buildCustomerCompleteParams(params) {
    params = params || {};
    var guest = isGuestRequest(params);
    var subjectLine = '[PriceHunter] 의뢰 답변이 완료되었습니다';
    var productLabel = String(params.productName || '의뢰 상품')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .slice(0, 200);
    if (guest && params.productOption) {
      productLabel = String(params.productOption).slice(0, 200);
    } else if (productLabel === '(링크로 확인 예정)' && params.productOption) {
      productLabel = String(params.productOption).slice(0, 200);
    }

    var recipientName = resolveRecipientName(params);
    var resultFields = emptyResultFields();

    var headline;
    var footerMessage;
    var checkUrl;
    var ctaLabel;
    var siteTeaser;

    if (guest) {
      headline = recipientName + '님, 무료 체험 의뢰 검토가 완료되었습니다.';
      siteTeaser = '검토가 완료되었습니다. 가격·판매처·구매 판단이 담긴 리포트 전문은 회원가입 후 사이트에서 확인하실 수 있습니다.';
      footerMessage = '아래 버튼을 눌러 PriceHunter 사이트에서 안내에 따라 결과를 확인해 주세요.';
      var qs = [];
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
      /** EmailJS From Name — 항상 브랜드명 (상품명 넣지 않음) */
      name: 'PriceHunter',
      from_name: 'PriceHunter',
      user_name: recipientName,
      recipient_name: recipientName,
      headline: headline,
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

  function buildParamsFromFirestoreRequest(data, overrides) {
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
      purchaseReport: data.purchaseReport || null,
      adminResponse: data.adminResponse || null
    }, overrides);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  /**
   * @param {{ toEmail: string, userName?: string, requestNumber?: string, productName?: string, isGuest?: boolean, purchaseReport?: object, adminResponse?: object, resultData?: object }} params
   */
  async function sendRequestCompleteEmail(params) {
    params = params || {};
    if (!isValidEmail(params.toEmail)) {
      return { success: false, errorMessage: '유효한 고객 이메일이 없습니다.' };
    }

    try {
      var headers = { 'Content-Type': 'application/json' };
      var authUser = (typeof window !== 'undefined' && window.firebaseAuth && window.firebaseAuth.currentUser) ||
        (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser);
      if (authUser) {
        var idToken = await authUser.getIdToken();
        headers.Authorization = 'Bearer ' + idToken;
      }
      var apiRes = await fetch('/api/notify-customer-report-complete', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          requestId: params.requestId || params.firebaseDocId || '',
          toEmail: params.toEmail,
          userName: params.userName,
          requestNumber: params.requestNumber,
          productName: params.productName,
          productOption: params.productOption,
          isGuest: params.isGuest,
          source: params.source
        })
      });
      var apiData = await apiRes.json().catch(function () { return {}; });
      if (apiRes.ok && apiData.success !== false && (apiData.email && apiData.email.success || apiData.success)) {
        return {
          success: true,
          toEmail: (apiData.email && apiData.email.toEmail) || params.toEmail,
          isGuest: isGuestRequest(params),
          via: 'server',
          alimtalk: apiData.alimtalk || null
        };
      }
      if (apiData.email && apiData.email.needsBrowserFallback) {
        console.warn('[CustomerNotification] 서버 EmailJS 실패, 브라우저 fallback:', apiData.email.errorMessage);
      } else if (!apiRes.ok) {
        console.warn('[CustomerNotification] 서버 알림 실패, 브라우저 EmailJS 시도:', apiData.error || apiRes.status);
      }
    } catch (apiErr) {
      console.warn('[CustomerNotification] 서버 알림 요청 실패, 브라우저 EmailJS 시도:', apiErr);
    }

    if (!EMAILJS_TEMPLATE_IS_CONFIGURED) {
      return { success: false, errorMessage: 'EmailJS 템플릿이 설정되지 않았습니다.' };
    }
    if (typeof emailjs === 'undefined') {
      return { success: false, errorMessage: 'EmailJS가 로드되지 않았습니다.' };
    }
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_SHARED_TEMPLATE_ID,
        buildCustomerCompleteParams(params)
      );
      return { success: true, toEmail: params.toEmail, isGuest: isGuestRequest(params), via: 'browser' };
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

  function buildAdminNewRequestParams(params) {
    params = params || {};
    var detailLines = [
      '유형: ' + (params.requestType || '의뢰'),
      '고객 이메일: ' + (params.customerEmail || '(미입력)'),
      '옵션: ' + (params.productOption || '(미입력)'),
      '상품 링크: ' + String(params.productUrl || '(미입력)').slice(0, 500),
      '요청가: ' + (formatPriceKrw(params.productPrice) || '(미입력)'),
      '접수 시각: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    ].join('\n');

    return withSubjectFields('[PriceHunter] 새 의뢰 접수 ' + (params.requestNumber || ''), {
      to_email: ADMIN_NOTIFY_EMAIL,
      name: 'PriceHunter',
      user_name: '운영자',
      headline: '새 의뢰가 접수되었습니다.',
      request_number: params.requestNumber || '',
      product_name: detailLines,
      footer_message: '관리자 페이지에서 의뢰를 확인해 주세요.',
      check_url: EMAILJS_SITE_URL + '/admin-dashboard.html',
      cta_label: '관리자 페이지 열기 →',
      has_result: '',
      is_guest: ''
    });
  }

  /**
   * @param {{ requestNumber?: string, requestType?: string, customerEmail?: string, productUrl?: string, productName?: string, productOption?: string, productPrice?: number|string }} params
   */
  async function sendAdminNewRequestEmail(params) {
    params = params || {};
    if (!params.requestNumber) {
      return { success: false, errorMessage: '의뢰 번호가 없습니다.' };
    }

    var payload = {
      requestNumber: params.requestNumber,
      requestType: params.requestType || '의뢰',
      customerEmail: params.customerEmail || '',
      productUrl: params.productUrl || '',
      productName: params.productName || '',
      productOption: params.productOption || '',
      productPrice: params.productPrice
    };

    try {
      var apiRes = await fetch('/api/notify-admin-new-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var apiData = await apiRes.json().catch(function () { return {}; });
      if (apiRes.ok && apiData.success !== false) {
        return { success: true, toEmail: ADMIN_NOTIFY_EMAIL, via: 'server' };
      }
      console.warn('[RequestNotification] 서버 알림 실패, 브라우저 EmailJS 시도:', apiData.error || apiRes.status);
    } catch (apiErr) {
      console.warn('[RequestNotification] 서버 알림 요청 실패, 브라우저 EmailJS 시도:', apiErr);
    }

    if (!EMAILJS_TEMPLATE_IS_CONFIGURED) {
      return { success: false, errorMessage: 'EmailJS 템플릿 미설정' };
    }
    if (typeof emailjs === 'undefined') {
      return { success: false, errorMessage: 'EmailJS가 로드되지 않았습니다.' };
    }
    try {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_SHARED_TEMPLATE_ID,
        buildAdminNewRequestParams(params)
      );
      return { success: true, toEmail: ADMIN_NOTIFY_EMAIL, via: 'browser' };
    } catch (err) {
      var msg = (err && (err.text || err.message)) ? String(err.text || err.message) : '알 수 없는 오류';
      console.warn('[RequestNotification] 운영자 알림 발송 실패:', msg);
      return { success: false, errorMessage: msg };
    }
  }

  global.CustomerNotification = {
    sendRequestCompleteEmail: sendRequestCompleteEmail,
    sendAdminNewRequestEmail: sendAdminNewRequestEmail,
    buildCustomerCompleteParams: buildCustomerCompleteParams,
    buildParamsFromFirestoreRequest: buildParamsFromFirestoreRequest,
    markNotifySent: markNotifySent,
    isGuestRequest: isGuestRequest,
    ADMIN_NOTIFY_EMAIL: ADMIN_NOTIFY_EMAIL
  };
})(typeof window !== 'undefined' ? window : this);
