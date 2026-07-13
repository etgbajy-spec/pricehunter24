/**
 * 상품 페이지 플로팅 의뢰 버튼
 */
(function () {
  'use strict';

  var PH = globalThis.PH_EXTENSION;
  var FAB_ID = 'ph-extension-fab';
  var HINT_ID = 'ph-extension-fab-hint';
  var HINT_WRAP_ID = 'ph-extension-fab-wrap';

  var SUSPICIOUS_OPTION_RE =
    /다른\s*컬러|비슷한\s*상품|이\s*상품과\s*비슷|추천\s*상품|함께\s*본|컬러\s*[&＆]\s*디자인\s*상품|상품\s*바로가기|이\s*상품담기|선택해\s*주세요|옵션\s*선택|필수\s*옵션/i;

  function isSuspiciousOption(option) {
    if (!option) return false;
    var t = String(option).trim();
    if (!t) return false;
    if (SUSPICIOUS_OPTION_RE.test(t)) return true;
    if (/상품\s*\d+\s*\/\s*\d+/i.test(t)) return true;
    if (/^\d+\s*\/\s*\d+$/.test(t)) return true;
    return false;
  }

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

  function getOptionState() {
    var opt = String(safeExtractProduct().option || '').trim();
    if (!opt) return 'empty';
    if (isSuspiciousOption(opt)) return 'suspicious';
    return 'ok';
  }

  function updateFabHint() {
    var hint = document.getElementById(HINT_ID);
    var btn = document.getElementById(FAB_ID);
    if (!hint || !btn) return;

    var state = getOptionState();
    if (state === 'ok') {
      hint.classList.add('ph-fab-hint--hidden');
      btn.classList.remove('ph-fab--needs-option');
      return;
    }

    hint.classList.remove('ph-fab-hint--hidden');
    btn.classList.add('ph-fab--needs-option');
    hint.textContent =
      state === 'empty'
        ? '옵션을 선택한 뒤 의뢰해 주세요'
        : '옵션을 확인한 뒤 의뢰해 주세요';
  }

  function openRequest(member) {
    var product = safeExtractProduct();
    var state = getOptionState();

    if (state === 'empty') {
      var goEmpty = window.confirm(
        '옵션이 선택되지 않은 것 같습니다.\n\n' +
          '상품 페이지에서 색상·사이즈 등 옵션을 선택한 뒤 다시 의뢰하거나,\n' +
          '의뢰 페이지에서 직접 입력할 수 있습니다.\n\n' +
          '의뢰 페이지로 이동할까요?'
      );
      if (!goEmpty) return;
      product.option = '';
    } else if (state === 'suspicious') {
      var goSuspicious = window.confirm(
        '옵션이 정확하지 않을 수 있습니다.\n\n' +
          '상품 페이지에서 옵션을 다시 선택한 뒤 의뢰하거나,\n' +
          '의뢰 페이지에서 직접 수정할 수 있습니다.\n\n' +
          '그래도 의뢰 페이지로 이동할까요?'
      );
      if (!goSuspicious) return;
      product.option = '';
    }

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

    var wrap = document.createElement('div');
    wrap.id = HINT_WRAP_ID;

    var hint = document.createElement('div');
    hint.id = HINT_ID;
    hint.className = 'ph-fab-hint ph-fab-hint--hidden';
    hint.setAttribute('role', 'status');

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

    wrap.appendChild(hint);
    wrap.appendChild(btn);
    document.documentElement.appendChild(wrap);
    updateFabHint();
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
    updateFabHint();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(updateFabHint, 2000);
})();
