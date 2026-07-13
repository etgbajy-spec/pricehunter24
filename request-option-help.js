/**
 * 의뢰 폼 — 옵션 필드 안내 (? 툴팁)
 */
(function (global) {
  'use strict';

  var TIP_HTML =
    '옵션이 이상하게 자동 입력되었나요?<br>' +
    '상품 페이지에서 <strong>옵션을 선택하지 않았거나</strong>, 쇼핑몰 화면 구조 때문에 잘못 읽힐 수 있습니다.<br>' +
    '선택하신 옵션(색상·사이즈·구성 등)을 <strong>직접 입력하거나 수정</strong>해 주세요.<br>' +
    '옵션이 없으면 <strong>단일옵션</strong>이라고 적어 주세요.';

  function bindOptionHelpButtons() {
    global.document.querySelectorAll('[data-ph-option-help]').forEach(function (btn) {
      if (btn.dataset.phOptionHelpBound) return;
      btn.dataset.phOptionHelpBound = '1';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tip = btn.parentElement && btn.parentElement.querySelector('.ph-option-help-tip');
        if (!tip) return;
        var open = tip.classList.toggle('ph-option-help-tip--open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    global.document.addEventListener('click', function () {
      global.document.querySelectorAll('.ph-option-help-tip--open').forEach(function (tip) {
        tip.classList.remove('ph-option-help-tip--open');
      });
      global.document.querySelectorAll('[data-ph-option-help][aria-expanded="true"]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function ensureOptionHelpMarkup(labelFor) {
    labelFor = labelFor || 'productOption';
    var label = global.document.querySelector('label[for="' + labelFor + '"]');
    if (!label || label.closest('.ph-option-label-row')) return;

    var row = global.document.createElement('div');
    row.className = 'ph-option-label-row';

    var wrap = global.document.createElement('div');
    wrap.className = 'ph-option-help-wrap';

    var btn = global.document.createElement('button');
    btn.type = 'button';
    btn.className = 'ph-option-help-btn';
    btn.setAttribute('data-ph-option-help', '');
    btn.setAttribute('aria-label', '옵션 입력 안내');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '?';

    var tip = global.document.createElement('div');
    tip.className = 'ph-option-help-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = TIP_HTML;

    wrap.appendChild(btn);
    wrap.appendChild(tip);

    var parent = label.parentElement;
    parent.insertBefore(row, label);
    row.appendChild(label);
    row.appendChild(wrap);
  }

  function init() {
    ensureOptionHelpMarkup('productOption');
    bindOptionHelpButtons();
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.RequestOptionHelp = { init: init, bindOptionHelpButtons: bindOptionHelpButtons };
})(typeof window !== 'undefined' ? window : globalThis);
