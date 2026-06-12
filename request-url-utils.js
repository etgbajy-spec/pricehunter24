/**
 * 의뢰 상품 링크 수집·복구 (브라우저 + Node 공용)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RequestUrlUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var URL_IN_TEXT_RE = /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

  function isLikelyProductUrl(url) {
    var t = String(url || '').trim();
    if (!t || t.length < 8) return false;
    if (/^data:/i.test(t)) return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|#|$)/i.test(t)) return false;
    return /^(https?:\/\/|www\.)/i.test(t) || /\.[a-z]{2,}(\/|$)/i.test(t);
  }

  function normalizeUrlToken(raw) {
    return String(raw || '').trim().replace(/[.,;:!?)}\]]+$/, '');
  }

  function extractUrlsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    var found = [];
    var seen = {};
    var re = new RegExp(URL_IN_TEXT_RE.source, 'gi');
    var m;
    while ((m = re.exec(text)) !== null) {
      var u = normalizeUrlToken(m[0]);
      if (u && !seen[u] && isLikelyProductUrl(u)) {
        seen[u] = true;
        found.push(u);
      }
    }
    text.split('\n').forEach(function (line) {
      var ref = line.match(/^\s*참고\s*URL\s*:\s*(.+)$/i);
      if (ref && ref[1]) {
        var u = normalizeUrlToken(ref[1]);
        if (u && !seen[u]) {
          seen[u] = true;
          found.push(u);
        }
      }
    });
    return found;
  }

  function getRequestDescriptionText(request) {
    if (!request || typeof request !== 'object') return '';
    return request.desc || request.description || request.productDescription || '';
  }

  function hasStoredRequestUrls(request) {
    if (!request || typeof request !== 'object') return false;
    if (request.customerProductUrl && String(request.customerProductUrl).trim()) return true;
    if (request.url && String(request.url).trim()) return true;
    if (Array.isArray(request.urls) && request.urls.some(function (u) { return u && String(u).trim(); })) return true;
    return false;
  }

  function collectRequestUrls(request) {
    if (!request || typeof request !== 'object') return [];
    var urls = [];
    var seen = {};

    function add(raw) {
      var text = raw == null ? '' : normalizeUrlToken(raw);
      if (!text || seen[text] || !isLikelyProductUrl(text)) return;
      seen[text] = true;
      urls.push(text);
    }

    if (Array.isArray(request.urls)) request.urls.forEach(add);
    add(request.url);
    add(request.productUrl);
    add(request.customerProductUrl);
    add(request.referenceUrl);

    if (request.purchaseReport && typeof request.purchaseReport === 'object') {
      add(request.purchaseReport.referenceUrl);
      add(request.purchaseReport.customerUrl);
      add(request.purchaseReport.link);
    }

    extractUrlsFromText(getRequestDescriptionText(request)).forEach(add);

    if (request.purchaseReport && request.purchaseReport.evidenceNotes) {
      extractUrlsFromText(request.purchaseReport.evidenceNotes).forEach(add);
    }

    return urls;
  }

  function derivePrimaryRequestUrl(request) {
    var urls = collectRequestUrls(request);
    return urls[0] || '';
  }

  function toClickableRequestUrl(url) {
    var text = String(url || '').trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    return 'https://' + text.replace(/^\/\//, '');
  }

  function buildUrlRestorePatch(request) {
    if (!request || typeof request !== 'object') return null;
    if (hasStoredRequestUrls(request)) return null;
    var recovered = collectRequestUrls(request);
    if (!recovered.length) return null;
    return {
      url: recovered[0],
      urls: recovered,
      customerProductUrl: recovered[0]
    };
  }

  return {
    extractUrlsFromText: extractUrlsFromText,
    getRequestDescriptionText: getRequestDescriptionText,
    hasStoredRequestUrls: hasStoredRequestUrls,
    collectRequestUrls: collectRequestUrls,
    derivePrimaryRequestUrl: derivePrimaryRequestUrl,
    toClickableRequestUrl: toClickableRequestUrl,
    buildUrlRestorePatch: buildUrlRestorePatch,
    isLikelyProductUrl: isLikelyProductUrl
  };
});
