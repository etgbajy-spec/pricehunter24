/**
 * 추출 데이터 → 백그라운드 경유 의뢰 페이지 열기
 */
(function (global) {
  'use strict';

  var PH = global.PH_EXTENSION;

  function openRequestPage(product, member) {
    chrome.storage.sync.get(['siteMode'], function (data) {
      var siteBase = data.siteMode === 'local' ? PH.LOCAL_SITE : PH.DEFAULT_SITE;
      var url = PH.buildRequestUrl(product, { siteBase: siteBase, member: !!member });

      chrome.runtime.sendMessage({
        action: 'openRequestPage',
        url: url,
        product: product
      }, function (response) {
        if (chrome.runtime.lastError || !response || !response.ok) {
          chrome.tabs.create({ url: url });
        }
      });
    });
  }

  global.PHOpenRequest = { openRequestPage: openRequestPage };
})(typeof globalThis !== 'undefined' ? globalThis : self);
