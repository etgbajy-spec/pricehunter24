/**
 * PriceHunter 확장 — 사이트 URL 설정
 */
var PH_EXTENSION = (function () {
  'use strict';

  var DEFAULT_SITE = 'https://pricehunt24.com';
  var LOCAL_SITE = 'http://localhost:1000';

  function normalizePrice(value) {
    if (value == null || value === '') return null;
    var digits = String(value).replace(/[^\d]/g, '');
    if (!digits) return null;
    var num = Number(digits);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function cleanProductUrl(url) {
    try {
      var u = new URL(url);
      ['src', 'srcArea', 'traceId', 'itemId', 'vendorItemId', 'q', 'frm', 'NaPm', 'mallPid'].forEach(function (key) {
        u.searchParams.delete(key);
      });
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function isExtensionContextValid() {
    try {
      return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function showContextInvalidNotice() {
    if (typeof document === 'undefined') return;
    var id = 'ph-ext-context-notice';
    if (document.getElementById(id)) return;
    var el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    el.textContent = '확장이 갱신되었습니다. 다음에는 이 페이지를 새로고침(F5)한 뒤 다시 시도해 주세요.';
    el.style.cssText = 'position:fixed;bottom:80px;right:16px;max-width:280px;padding:12px 14px;background:#1e293b;color:#f8fafc;font-size:13px;line-height:1.4;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.25);z-index:2147483646;';
    document.documentElement.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 6000);
  }

  function isUsableProductName(name) {
    var t = String(name || '').trim();
    if (!t || t.length < 6) return false;
    if (/^(products|product|vp|item|goods|쿠팡|상품)$/i.test(t)) return false;
    return true;
  }

  function buildRequestUrl(product, options) {
    options = options || {};
    var baseSite = options.siteBase || DEFAULT_SITE;
    var path = options.member ? '/request-v2.html' : '/request-lite.html';
    var params = new URLSearchParams();
    params.set('from', 'extension');
    if (product.url) params.set('url', cleanProductUrl(product.url));
    if (isUsableProductName(product.productName)) {
      params.set('name', String(product.productName).slice(0, 200));
    }
    if (product.option) params.set('option', String(product.option).slice(0, 300));
    if (product.price) params.set('price', String(Math.round(product.price)));
    return baseSite.replace(/\/$/, '') + path + '?' + params.toString();
  }

  return {
    DEFAULT_SITE: DEFAULT_SITE,
    LOCAL_SITE: LOCAL_SITE,
    normalizePrice: normalizePrice,
    cleanProductUrl: cleanProductUrl,
    buildRequestUrl: buildRequestUrl,
    isExtensionContextValid: isExtensionContextValid,
    showContextInvalidNotice: showContextInvalidNotice,
    isUsableProductName: isUsableProductName
  };
})();

// content script (non-module)
if (typeof globalThis !== 'undefined') {
  globalThis.PH_EXTENSION = PH_EXTENSION;
}
