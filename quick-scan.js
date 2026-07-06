/**
 * PriceHunter Tier 0 Quick Scan — 클라이언트 UI
 */
(function (global) {
  'use strict';

  var VERDICT_STYLES = {
    positive: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      icon: '✅'
    },
    caution: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800',
      icon: '⏸️'
    },
    warning: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-800',
      icon: '⚠️'
    }
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(num) {
    if (!num || !Number.isFinite(num)) return null;
    return num.toLocaleString('ko-KR') + '원';
  }

  function getApiBase() {
    return global.location.origin;
  }

  async function runScan(url, price, productName) {
    var res = await fetch(getApiBase() + '/api/quick-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        price: price || null,
        productName: productName || null
      })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || '스캔에 실패했습니다.');
    }
    return data;
  }

  function renderLoading(container) {
    if (!container) return;
    container.innerHTML =
      '<div class="ph-qs-loading rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-6 text-center">' +
      '<div class="inline-flex items-center gap-2 text-emerald-800 font-semibold">' +
      '<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
      '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>' +
      '1차 Quick Scan 중…' +
      '</div>' +
      '<p class="text-sm text-emerald-700 mt-2">판매처·가격·1차 판단을 확인하고 있습니다</p>' +
      '</div>';
    container.classList.remove('hidden');
  }

  function renderError(container, message) {
    if (!container) return;
    container.innerHTML =
      '<div class="rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center">' +
      '<p class="text-red-800 font-semibold mb-1">스캔을 완료하지 못했습니다</p>' +
      '<p class="text-sm text-red-700">' + escapeHtml(message) + '</p>' +
      '</div>';
    container.classList.remove('hidden');
  }

  function renderResult(container, data) {
    if (!container || !data || !data.scan) return;
    var s = data.scan;
    var style = VERDICT_STYLES[s.verdictTone] || VERDICT_STYLES.caution;
    var detected = formatPrice(s.detectedPrice || s.requestedPrice);
    var marketplace = s.marketplace && s.marketplace.name ? s.marketplace.name : '판매처 확인 중';
    var reasons = (s.verificationReasons || []).slice(0, 4);
    var blockedNote = s.fetchBlocked && !detected
      ? '<div class="rounded-xl bg-slate-100 border border-slate-200 p-3 mb-3 text-sm text-slate-700 leading-relaxed">' +
        '<strong>쿠팡·네이버 등</strong>은 보안 정책상 서버에서 가격을 바로 읽기 어렵습니다.<br>' +
        '아래 <strong>현재 가격</strong>을 입력하거나, 정밀 리포트에서 확인해 드립니다.' +
        '</div>'
      : '';

    var priceBlock = detected
      ? '<div class="grid grid-cols-2 gap-3 mb-3">' +
        '<div class="rounded-xl bg-white/70 border border-white p-3">' +
        '<div class="text-xs text-gray-500">' + (s.priceFromClient ? '입력·확인 가격' : '감지 가격') + '</div>' +
        '<div class="text-lg font-bold text-gray-900">' + escapeHtml(detected) + '</div>' +
        '</div>' +
        '<div class="rounded-xl bg-white/70 border border-white p-3">' +
        '<div class="text-xs text-gray-500">가격 추세</div>' +
        '<div class="text-lg font-bold text-gray-900">' +
        (s.trend === 'down' ? '📉 하락' : s.trend === 'up' ? '📈 상승' : '➡️ 횡보') +
        '</div></div></div>'
      : (s.fetchBlocked
        ? blockedNote
        : '<p class="text-sm text-gray-600 mb-3 rounded-xl bg-white/70 border border-white p-3">페이지에서 가격을 확인하지 못했습니다. 정밀 리포트에서 확인합니다.</p>');

    var reasonsHtml = reasons.length
      ? '<ul class="mt-3 space-y-1 text-left text-xs text-gray-600">' +
        reasons.map(function (r) {
          return '<li class="flex gap-2"><span class="text-emerald-600">·</span><span>' + escapeHtml(r) + '</span></li>';
        }).join('') +
        '</ul>'
      : '';

    container.innerHTML =
      '<div class="rounded-2xl border-2 ' + style.border + ' ' + style.bg + ' p-5 sm:p-6 text-left">' +
      '<div class="flex flex-wrap items-start justify-between gap-3 mb-4">' +
      '<div>' +
      '<span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/80 text-gray-700 mb-2">Tier 0 · Quick Scan</span>' +
      '<h3 class="text-base sm:text-lg font-bold text-gray-900 leading-snug">' + escapeHtml(s.productName) + '</h3>' +
      '<p class="text-xs text-gray-500 mt-1">' + escapeHtml(marketplace) + '</p>' +
      '</div>' +
      '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ' + style.badge + '">' +
      style.icon + ' ' + escapeHtml(s.verdictLabel) +
      '</span>' +
      '</div>' +
      priceBlock +
      (s.oneLineNote
        ? '<p class="text-sm text-gray-700 leading-relaxed mt-3">' + escapeHtml(s.oneLineNote) + '</p>'
        : '') +
      reasonsHtml +
      '<p class="text-xs text-gray-500 mt-4 pt-3 border-t border-black/5">' + escapeHtml(data.disclaimer || '') + '</p>' +
      '</div>';
    container.classList.remove('hidden');
  }

  function renderFlowSteps(container, activeStep) {
    if (!container) return;
    var steps = [
      { n: 1, label: '1차 스캔', sub: '약 30초' },
      { n: 2, label: '정밀 의뢰', sub: '옵션·이메일' },
      { n: 3, label: '전문 검증', sub: '24h 이내' },
      { n: 4, label: '리포트 수령', sub: '이메일' }
    ];
    container.innerHTML =
      '<div class="ph-flow-steps grid grid-cols-4 gap-1 sm:gap-2 mb-6">' +
      steps
        .map(function (step) {
          var isActive = step.n === activeStep;
          var isDone = step.n < activeStep;
          return (
            '<div class="text-center">' +
            '<div class="mx-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold mb-1 ' +
            (isDone
              ? 'bg-emerald-500 text-white'
              : isActive
                ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                : 'bg-gray-100 text-gray-400') +
            '">' +
            (isDone ? '✓' : step.n) +
            '</div>' +
            '<div class="text-[10px] sm:text-xs font-semibold ' + (isActive ? 'text-emerald-700' : 'text-gray-500') + '">' +
            escapeHtml(step.label) +
            '</div>' +
            '<div class="text-[9px] sm:text-[10px] text-gray-400 hidden sm:block">' + escapeHtml(step.sub) + '</div>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  }

  function applyScanToForm(scan) {
    if (!scan) return;
    var urlEl = document.getElementById('productUrl');
    var priceEl = document.getElementById('productPrice');
    if (urlEl && scan.url) urlEl.value = scan.url;
    if (priceEl && scan.detectedPrice && !priceEl.value) {
      priceEl.value = String(Math.round(scan.detectedPrice));
    }
  }

  global.QuickScan = {
    run: runScan,
    renderLoading: renderLoading,
    renderError: renderError,
    renderResult: renderResult,
    renderFlowSteps: renderFlowSteps,
    applyScanToForm: applyScanToForm,
    formatPrice: formatPrice,
    escapeHtml: escapeHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
