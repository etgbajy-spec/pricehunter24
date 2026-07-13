/**
 * 의뢰 폼 제출 전 검증 (게스트·회원 공용)
 */
(function (global) {
  'use strict';

  var SUSPICIOUS_OPTION_RE =
    /다른\s*컬러|비슷한\s*상품|이\s*상품과\s*비슷|추천\s*상품|함께\s*본|컬러\s*[&＆]\s*디자인\s*상품|상품\s*바로가기|이\s*상품담기|선택해\s*주세요|옵션\s*선택|필수\s*옵션/i;

  function isSuspiciousOption(option) {
    if (!option) return false;
    var t = String(option).trim();
    if (!t || t === '단일옵션') return false;
    if (SUSPICIOUS_OPTION_RE.test(t)) return true;
    if (/상품\s*\d+\s*\/\s*\d+/i.test(t)) return true;
    if (/^\d+\s*\/\s*\d+$/.test(t)) return true;
    return false;
  }

  function validateOption(option) {
    var t = String(option || '').trim();
    if (!t) {
      return {
        ok: false,
        error: '옵션을 입력해 주세요. 옵션이 없으면 "단일옵션"이라고 적어 주세요.'
      };
    }
    if (isSuspiciousOption(t)) {
      return {
        ok: false,
        error:
          '옵션 값이 상품 선택란이 아닌 추천·위젯 문구로 보입니다. 상품 페이지에서 옵션을 선택한 뒤 다시 불러오거나, 직접 수정해 주세요.'
      };
    }
    return { ok: true, value: t };
  }

  function validateUrl(url, opts) {
    opts = opts || {};
    var raw = String(url || '').trim();
    if (!raw) {
      return { ok: false, error: '상품 링크를 입력해 주세요.' };
    }
    if (global.UrlSafety && UrlSafety.validateProductLinkUrl) {
      return UrlSafety.validateProductLinkUrl(raw);
    }
    var urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)$/i;
    if (!urlPattern.test(raw)) {
      return {
        ok: false,
        error: '상품 링크는 http://, https://, 또는 www.로 시작하는 올바른 주소를 입력해 주세요.'
      };
    }
    return { ok: true, normalized: raw };
  }

  function confirmFlaggedUrl(urlCheck) {
    if (!urlCheck || !urlCheck.flagged) return true;
    return global.confirm(
      '등록되지 않은 쇼핑몰 링크입니다.\n' +
        '악성 사이트일 수 있으니 주소를 한번 더 확인해 주세요.\n\n' +
        '이 링크로 의뢰를 접수할까요?'
    );
  }

  global.RequestFormValidate = {
    isSuspiciousOption: isSuspiciousOption,
    validateOption: validateOption,
    validateUrl: validateUrl,
    confirmFlaggedUrl: confirmFlaggedUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
