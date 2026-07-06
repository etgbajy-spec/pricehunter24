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

  function buildRequestUrl(product, options) {
    options = options || {};
    var baseSite = options.siteBase || DEFAULT_SITE;
    var path = options.member ? '/request-v2.html' : '/request-lite.html';
    var params = new URLSearchParams();
    params.set('from', 'extension');
    if (product.url) params.set('url', cleanProductUrl(product.url));
    if (product.productName) params.set('name', String(product.productName).slice(0, 200));
    if (product.option) params.set('option', String(product.option).slice(0, 300));
    if (product.price) params.set('price', String(Math.round(product.price)));
    return baseSite.replace(/\/$/, '') + path + '?' + params.toString();
  }

  return {
    DEFAULT_SITE: DEFAULT_SITE,
    LOCAL_SITE: LOCAL_SITE,
    normalizePrice: normalizePrice,
    cleanProductUrl: cleanProductUrl,
    buildRequestUrl: buildRequestUrl
  };
})();

// content script (non-module)
if (typeof globalThis !== 'undefined') {
  globalThis.PH_EXTENSION = PH_EXTENSION;
}
