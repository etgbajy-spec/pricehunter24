/**
 * 추출 데이터 → 백그라운드 경유 의뢰 페이지 열기
 */
(function (global) {
  'use strict';

  var PH = global.PH_EXTENSION;

  function openUrlFromPage(url, product) {
    if (!PH.isExtensionContextValid()) {
      PH.showContextInvalidNotice();
      window.open(url, '_blank', 'noopener');
      return;
    }
    try {
      chrome.runtime.sendMessage({
        action: 'openRequestPage',
        url: url,
        product: product
      }, function (response) {
        if (chrome.runtime.lastError || !response || !response.ok) {
          window.open(url, '_blank', 'noopener');
        }
      });
    } catch (e) {
      PH.showContextInvalidNotice();
      window.open(url, '_blank', 'noopener');
    }
  }

  function openRequestPage(product, member) {
    var fallbackUrl = PH.buildRequestUrl(product, { siteBase: PH.DEFAULT_SITE, member: !!member });

    if (!PH.isExtensionContextValid()) {
      PH.showContextInvalidNotice();
      window.open(fallbackUrl, '_blank', 'noopener');
      return;
    }

    try {
      chrome.storage.sync.get(['siteMode'], function (data) {
        if (chrome.runtime.lastError) {
          PH.showContextInvalidNotice();
          openUrlFromPage(fallbackUrl, product);
          return;
        }
        var siteBase = data.siteMode === 'local' ? PH.LOCAL_SITE : PH.DEFAULT_SITE;
        var url = PH.buildRequestUrl(product, { siteBase: siteBase, member: !!member });
        openUrlFromPage(url, product);
      });
    } catch (e) {
      PH.showContextInvalidNotice();
      openUrlFromPage(fallbackUrl, product);
    }
  }

  global.PHOpenRequest = { openRequestPage: openRequestPage };
})(typeof globalThis !== 'undefined' ? globalThis : self);
