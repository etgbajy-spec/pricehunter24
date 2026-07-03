/**
 * 의뢰 상품 링크 안전 검증 (Node + 브라우저 공용)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UrlSafety = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_URL_LENGTH = 2048;

  var BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'metadata.google.internal',
    '169.254.169.254'
  ];

  /** 알려진 쇼핑몰 — 미등록 도메인은 접수는 허용하되 flagged 처리 */
  var TRUSTED_SHOPPING_SUFFIXES = [
    'coupang.com',
    'naver.com',
    'shopping.naver.com',
    'smartstore.naver.com',
    'brand.naver.com',
    '11st.co.kr',
    'gmarket.co.kr',
    'auction.co.kr',
    'ssg.com',
    'lotteon.com',
    'kurly.com',
    'musinsa.com',
    'amazon.com',
    'amazon.co.jp',
    'amazon.de',
    'aliexpress.com',
    'alibaba.com',
    'ebay.com',
    'rakuten.co.jp',
    'walmart.com',
    'target.com',
    'bestbuy.com',
    'costco.com',
    'temu.com',
    'shein.com',
    'qoo10.jp',
    'interpark.com',
    'yes24.com',
    'kyobobook.co.kr',
    'danawa.com',
    'enuri.com',
    'cjonstyle.com',
    'hmall.com',
    'homeplus.co.kr',
    'emart.com',
    'oliveyoung.co.kr',
    'dabagirl.com',
    'ably.com',
    'zigzag.kr',
    'kakao.com',
    'store.kakao.com'
  ];

  function normalizeInput(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    if (!/^https?:\/\//i.test(text)) {
      text = 'https://' + text.replace(/^\/\//, '');
    }
    return text;
  }

  function isPrivateIpv4(host) {
    var parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some(function (n) { return isNaN(n) || n < 0 || n > 255; })) {
      return false;
    }
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }

  function isIpv4Host(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  }

  function isBlockedHost(hostname) {
    var host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (!host) return true;
    if (BLOCKED_HOSTS.indexOf(host) !== -1) return true;
    if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (host.endsWith('.internal')) return true;
    if (isIpv4Host(host) && isPrivateIpv4(host)) return true;
    return false;
  }

  function isTrustedShoppingHost(hostname) {
    var host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (!host) return false;
    return TRUSTED_SHOPPING_SUFFIXES.some(function (suffix) {
      return host === suffix || host.endsWith('.' + suffix);
    });
  }

  function hasDangerousScheme(raw) {
    return /^(javascript|data|file|vbscript|blob):/i.test(String(raw || '').trim());
  }

  /**
   * @param {string} raw
   * @returns {{ ok: boolean, error?: string, normalized?: string, hostname?: string, flagged?: boolean, flags?: string[] }}
   */
  function validateProductLinkUrl(raw) {
    var input = String(raw || '').trim();
    if (!input) {
      return { ok: false, error: '상품 링크를 입력해주세요.' };
    }
    if (input.length > MAX_URL_LENGTH) {
      return { ok: false, error: '링크가 너무 깁니다. 짧은 상품 페이지 주소를 입력해주세요.' };
    }
    if (hasDangerousScheme(input)) {
      return { ok: false, error: '허용되지 않는 링크 형식입니다. http 또는 https 주소만 입력해주세요.' };
    }

    var normalized = normalizeInput(input);
    var parsed;

    try {
      parsed = new URL(normalized);
    } catch (e) {
      return { ok: false, error: '올바른 상품 링크 주소를 입력해주세요.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'http 또는 https 링크만 입력할 수 있습니다.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, error: '로그인 정보가 포함된 링크는 사용할 수 없습니다.' };
    }

    var hostname = parsed.hostname.toLowerCase();
    if (isBlockedHost(hostname)) {
      return { ok: false, error: '내부 주소나 테스트용 주소는 입력할 수 없습니다.' };
    }
    if (isIpv4Host(hostname)) {
      return { ok: false, error: '숫자(IP) 주소 링크는 보안상 입력할 수 없습니다. 쇼핑몰 상품 페이지 주소를 입력해주세요.' };
    }
    if (!hostname.includes('.')) {
      return { ok: false, error: '올바른 쇼핑몰 도메인 주소를 입력해주세요.' };
    }

    var flags = [];
    var flagged = false;

    if (hostname.indexOf('xn--') !== -1) {
      flags.push('punycode');
      flagged = true;
    }
    if (!isTrustedShoppingHost(hostname)) {
      flags.push('unknown_domain');
      flagged = true;
    }

    return {
      ok: true,
      normalized: parsed.toString(),
      hostname: hostname,
      flagged: flagged,
      flags: flags
    };
  }

  return {
    validateProductLinkUrl: validateProductLinkUrl,
    isTrustedShoppingHost: isTrustedShoppingHost,
    TRUSTED_SHOPPING_SUFFIXES: TRUSTED_SHOPPING_SUFFIXES
  };
});
