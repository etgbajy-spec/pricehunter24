/**
 * PriceHunter 의뢰 페이지 — 확장 prefill (runtime 메시지, storage 미사용)
 */
(function () {
  'use strict';

  function dispatchPrefill(product) {
    if (!product || typeof product !== 'object') return;
    try {
      globalThis.__PH_EXTENSION_PREFILL__ = product;
    } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('ph-extension-prefill', { detail: product }));
  }

  function onPrefillMessage(product) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        dispatchPrefill(product);
      }, { once: true });
    } else {
      dispatchPrefill(product);
    }
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.action !== 'applyPrefill' || !message.product) return;
    onPrefillMessage(message.product);
    sendResponse({ ok: true });
    return true;
  });

  if (globalThis.__PH_EXTENSION_PREFILL__) {
    onPrefillMessage(globalThis.__PH_EXTENSION_PREFILL__);
  }
})();
