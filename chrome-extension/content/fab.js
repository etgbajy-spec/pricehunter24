/**
 * 상품 페이지 플로팅 의뢰 버튼
 */
(function () {
  'use strict';

  var PH = globalThis.PH_EXTENSION;
  var FAB_ID = 'ph-extension-fab';

  function openRequest(member) {
    var product = globalThis.PHExtract && PHExtract.extractProductInfo
      ? PHExtract.extractProductInfo()
      : { url: location.href, option: '단일옵션' };

    if (globalThis.PHOpenRequest && PHOpenRequest.openRequestPage) {
      PHOpenRequest.openRequestPage(product, member);
      return;
    }

    chrome.storage.sync.get(['siteMode'], function (data) {
      var siteBase = data.siteMode === 'local' ? PH.LOCAL_SITE : PH.DEFAULT_SITE;
      var url = PH.buildRequestUrl(product, { siteBase: siteBase, member: !!member });
      window.open(url, '_blank', 'noopener');
    });
  }

  function createFab() {
    if (document.getElementById(FAB_ID)) return;
    if (!globalThis.PHExtract || !PHExtract.isLikelyProductPage || !PHExtract.isLikelyProductPage()) return;

    var btn = document.createElement('button');
    btn.id = FAB_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'PriceHunter 구매판단 리포트 의뢰');
    btn.innerHTML = '<span class="ph-fab-icon">🎯</span><span class="ph-fab-text">구매판단 의뢰</span>';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openRequest(false);
    });

    document.documentElement.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFab);
  } else {
    createFab();
  }

  var observer = new MutationObserver(function () {
    if (!document.getElementById(FAB_ID) && PHExtract.isLikelyProductPage()) createFab();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
