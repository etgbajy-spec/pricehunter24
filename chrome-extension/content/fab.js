/**
 * 상품 페이지 플로팅 의뢰 버튼
 */
(function () {
  'use strict';

  var PH = globalThis.PH_EXTENSION;
  var FAB_ID = 'ph-extension-fab';

  function safeExtractProduct() {
    var fallback = {
      url: PH.cleanProductUrl(location.href),
      productName: '',
      price: null,
      option: '',
      marketplace: '쇼핑몰'
    };
    try {
      if (!globalThis.PHExtract || !PHExtract.extractProductInfo) return fallback;
      var product = PHExtract.extractProductInfo();
      if (!product || !product.url) product.url = fallback.url;
      return product;
    } catch (err) {
      return fallback;
    }
  }

  function openRequest(member) {
    var product = safeExtractProduct();

    if (globalThis.PHOpenRequest && PHOpenRequest.openRequestPage) {
      PHOpenRequest.openRequestPage(product, member);
      return;
    }

    var url = PH.buildRequestUrl(product, { siteBase: PH.DEFAULT_SITE, member: !!member });
    if (!PH.isExtensionContextValid()) PH.showContextInvalidNotice();
    window.open(url, '_blank', 'noopener');
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
    if (!document.getElementById(FAB_ID) && globalThis.PHExtract && PHExtract.isLikelyProductPage && PHExtract.isLikelyProductPage()) {
      createFab();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
