/**
 * PriceHunter 구매판단 리포트 (Phase 1)
 * 기존 result-{reqNum} 데이터와 100% 하위 호환
 */
(function (global) {
  'use strict';

  var REPORT_VERSION = 'v2';

  var VERDICT_CONFIG = {
    buy: { label: '구매 추천', emoji: '✅', bg: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
    hold: { label: '보류 (관망)', emoji: '⏸️', bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
    skip: { label: '구매 비추천', emoji: '❌', bg: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' }
  };

  var TREND_CONFIG = {
    down: { label: '하락 추세', emoji: '📉' },
    stable: { label: '횡보', emoji: '➡️' },
    up: { label: '상승 추세', emoji: '📈' }
  };

  function emptyReport() {
    return {
      reportVersion: REPORT_VERSION,
      price: '',
      origin: '',
      summary: '',
      link: '',
      decision: {
        verdict: '',
        summary: '',
        confidence: '',
        recommendFor: '',
        notRecommendFor: ''
      },
      priceAnalysis: {
        currentPrice: '',
        lowestPrice: '',
        avgPrice: '',
        requestedPrice: '',
        trend: '',
        timingScore: '',
        timingNote: ''
      },
      productAnalysis: {
        valueScore: '',
        reviewSummary: '',
        pros: '',
        cons: '',
        alternatives: ''
      },
      sellerAnalysis: {
        sellerName: '',
        trustScore: '',
        risks: '',
        domesticVsImport: '',
        domesticImportPreset: ''
      },
      evidenceNotes: ''
    };
  }

  function normalizeResultData(raw) {
    if (!raw || typeof raw !== 'object') return emptyReport();
    var base = emptyReport();
    var merged = Object.assign({}, base, raw);
    merged.decision = Object.assign({}, base.decision, raw.decision || {});
    merged.priceAnalysis = Object.assign({}, base.priceAnalysis, raw.priceAnalysis || {});
    merged.productAnalysis = Object.assign({}, base.productAnalysis, raw.productAnalysis || {});
    merged.sellerAnalysis = Object.assign({}, base.sellerAnalysis, raw.sellerAnalysis || {});
    if (!merged.reportVersion && hasV2Content(merged)) merged.reportVersion = REPORT_VERSION;
    return merged;
  }

  function hasV2Content(data) {
    if (!data) return false;
    if (data.decision && data.decision.verdict) return true;
    if (data.priceAnalysis && (data.priceAnalysis.trend || data.priceAnalysis.timingScore)) return true;
    if (data.productAnalysis && (data.productAnalysis.valueScore || data.productAnalysis.reviewSummary)) return true;
    if (data.sellerAnalysis && (data.sellerAnalysis.trustScore || data.sellerAnalysis.sellerName)) return true;
    return !!(data.evidenceNotes && data.evidenceNotes.trim());
  }

  /** 기존 완료 판정 로직 유지 + v2 확장 */
  function isReportComplete(result) {
    if (!result) return false;
    var legacy = !!(result.price && result.origin && result.summary && result.link);
    if (legacy) return true;
    var v2 = !!(result.decision && result.decision.verdict && result.price && result.link);
    return v2;
  }

  function hasDisplayableContent(result) {
    if (!result) return false;
    if (result.summary && result.summary.trim()) return true;
    if (result.decision && result.decision.summary && result.decision.summary.trim()) return true;
    if (result.price) return true;
    return hasV2Content(result);
  }

  function formatPrice(price) {
    if (!price && price !== 0) return '가격 정보 없음';
    var numPrice;
    if (typeof price === 'number') {
      numPrice = price;
    } else if (typeof price === 'string') {
      numPrice = parseInt(price.replace(/[^\d]/g, ''), 10) || 0;
      if (!numPrice && price.trim()) return price;
    } else {
      return '가격 정보 없음';
    }
    return numPrice.toLocaleString() + '원';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

  function scoreBar(score, colorClass) {
    var num = parseInt(score, 10);
    if (isNaN(num)) return '';
    num = Math.max(0, Math.min(100, num));
    return (
      '<div class="mt-1">' +
      '<div class="flex justify-between text-xs text-gray-500 mb-1"><span>점수</span><span>' + num + '/100</span></div>' +
      '<div class="w-full bg-gray-200 rounded-full h-2">' +
      '<div class="h-2 rounded-full ' + (colorClass || 'bg-blue-500') + '" style="width:' + num + '%"></div>' +
      '</div></div>'
    );
  }

  function sectionBlock(title, emoji, content) {
    if (!content || !String(content).trim()) return '';
    return (
      '<div class="mb-4 p-4 rounded-xl border border-gray-100 bg-gray-50">' +
      '<div class="font-bold text-gray-800 mb-2">' + emoji + ' ' + escapeHtml(title) + '</div>' +
      '<div class="text-gray-700 text-sm leading-relaxed">' + content + '</div>' +
      '</div>'
    );
  }

  function parsePriceNum(val) {
    if (typeof val === 'number') return val;
    return parseInt(String(val || '').replace(/[^\d]/g, ''), 10) || 0;
  }

  function reportFromFirebaseItem(item) {
    if (!item) return null;
    if (item.purchaseReport) return normalizeResultData(item.purchaseReport);
    var ar = item.adminResponse;
    if (!ar || typeof ar !== 'object') return null;
    return normalizeResultData({
      price: ar.lowestPrice || '',
      origin: ar.seller || '',
      summary: ar.additionalInfo || '',
      link: ar.link || ar.sellerLink || '',
      decision: {
        verdict: ar.purchaseVerdict || '',
        summary: ar.purchaseSummary || '',
        confidence: ar.confidence || ''
      }
    });
  }

  function isAdminMetaLine(line) {
    var s = String(line || '').trim();
    if (!s) return true;
    return /^(수집 요약:|생성 방식:|OPENAI_API_KEY|AI 오류:)/i.test(s) ||
      (/규칙 기반/i.test(s) && /초안|미연동|관리자/i.test(s)) ||
      /^※\s*AI API/i.test(s);
  }

  function sanitizeCustomerReport(raw) {
    var data = normalizeResultData(raw);
    if (data.evidenceNotes) {
      data.evidenceNotes = data.evidenceNotes.split('\n')
        .filter(function (l) { return !isAdminMetaLine(l); })
        .join('\n')
        .trim();
    }
    if (data.summary) {
      data.summary = String(data.summary)
        .replace(/<p>※\s*AI API[^<]*<\/p>/gi, '')
        .replace(/1차 분석 결과/g, '검증 결과')
        .replace(/관리자 검수 후 발송[^<]*/gi, '')
        .trim();
    }
    if (data.productAnalysis && data.productAnalysis.reviewSummary &&
        /AI 연동|수동 입력/.test(data.productAnalysis.reviewSummary)) {
      data.productAnalysis.reviewSummary = '';
    }
    if (data.decision && data.decision.summary === '가격·판매처 추가 확인 후 판단하는 것이 좋습니다.') {
      data.decision.summary = '현재는 구매 타이밍이 아닙니다. 할인·프로모션 시점까지 관망을 권장드립니다.';
    }
    return data;
  }

  function getVerdictHeroTheme(verdict) {
    if (verdict === 'buy') {
      return { border: 'border-emerald-300', bg: 'from-emerald-50 via-teal-50 to-white', accent: 'text-emerald-700', badge: 'bg-emerald-600' };
    }
    if (verdict === 'hold') {
      return { border: 'border-amber-300', bg: 'from-amber-50 via-orange-50 to-white', accent: 'text-amber-800', badge: 'bg-amber-500' };
    }
    if (verdict === 'skip') {
      return { border: 'border-rose-300', bg: 'from-rose-50 via-red-50 to-white', accent: 'text-rose-800', badge: 'bg-rose-500' };
    }
    return { border: 'border-blue-300', bg: 'from-blue-50 via-indigo-50 to-white', accent: 'text-blue-800', badge: 'bg-blue-600' };
  }

  function getVerdictHeroCopy(verdict, savings, lowest, requested) {
    if (verdict === 'buy') {
      return {
        headline: savings > 0
          ? savings.toLocaleString() + '원 더 낮은 조건 확인'
          : '구매 검토 가능한 조건이 확인되었습니다',
        sub: 'PriceHunter 검증팀이 확인한 최저가입니다. 아래 리포트의 가격·제품·판매처 항목을 확인한 뒤 구매를 검토해 주세요.',
        verdictIntro: 'PriceHunter 구매 조건 검토 결과'
      };
    }
    if (verdict === 'hold') {
      var samePrice = lowest && requested && lowest >= requested;
      return {
        headline: samePrice ? '현재 최저가 = 의뢰가 (동일)' : '잠시 관망을 권장드립니다',
        sub: samePrice
          ? '지금 시점의 최저가는 의뢰하신 가격과 같습니다. 추가 할인·프로모션이 나올 때까지 기다리시는 편이 유리할 수 있습니다.'
          : '가격 변동 가능성이 있어 당장 구매보다 관망이 유리합니다. PriceHunter가 시장을 계속 모니터링했습니다.',
        verdictIntro: 'PriceHunter 구매 조건 검토 결과'
      };
    }
    if (verdict === 'skip') {
      return {
        headline: '지금은 구매를 권장하지 않습니다',
        sub: '가격 대비 만족도 또는 대안 제품 측면에서 더 나은 선택이 있을 수 있습니다. 아래 리포트에서 확인이 필요한 조건을 검토해 주세요.',
        verdictIntro: 'PriceHunter 구매 조건 검토 결과'
      };
    }
    return {
      headline: lowest ? '검증팀이 확인한 최저가 ' + formatPrice(lowest) : '검증이 완료되었습니다',
      sub: '아래 리포트에서 가격·제품·판매처 조건을 확인한 뒤 구매 방법을 선택해 주세요.',
      verdictIntro: 'PriceHunter 구매 조건 검토 결과'
    };
  }

  function renderCustomerHeroHTML(result, options) {
    options = options || {};
    var data = sanitizeCustomerReport(result);
    var lowest = parsePriceNum(data.price || (data.priceAnalysis && data.priceAnalysis.lowestPrice));
    var requested = parsePriceNum(options.requestedPrice || (data.priceAnalysis && data.priceAnalysis.requestedPrice));
    var savings = requested && lowest && requested > lowest ? requested - lowest : 0;
    var pct = requested && savings ? Math.round(savings / requested * 100) : 0;
    var verdict = data.decision && data.decision.verdict;
    var cfg = VERDICT_CONFIG[verdict];
    var theme = getVerdictHeroTheme(verdict);
    var copy = getVerdictHeroCopy(verdict, savings, lowest, requested);
    var html = '';

    html += '<div class="mb-6 rounded-2xl border-2 ' + theme.border + ' bg-gradient-to-br ' + theme.bg + ' overflow-hidden text-left shadow-sm">';
    html += '<div class="px-5 py-4 border-b border-white/60 flex flex-wrap items-center justify-between gap-2">';
    html += '<span class="inline-flex items-center gap-2 text-sm font-bold ' + theme.accent + '">';
    html += '<span class="w-8 h-8 rounded-full ' + theme.badge + ' text-white flex items-center justify-center text-base">✓</span>';
    html += 'PriceHunter 검증 완료</span>';
    if (cfg) {
      html += '<span class="px-3 py-1 rounded-full text-white text-xs font-bold ' + cfg.bg + '">' + cfg.emoji + ' ' + cfg.label + '</span>';
    }
    html += '</div>';
    html += '<div class="px-5 py-5">';
    html += '<p class="text-xs font-semibold ' + theme.accent + ' mb-1">' + escapeHtml(copy.verdictIntro) + '</p>';
    html += '<h2 class="text-xl md:text-2xl font-extrabold text-gray-900 mb-2 leading-snug">' + escapeHtml(copy.headline) + '</h2>';
    if (lowest) {
      html += '<div class="flex flex-wrap items-baseline gap-2 mb-3">';
      html += '<span class="text-sm text-gray-500">확인된 최저가</span>';
      html += '<span class="text-2xl font-extrabold text-emerald-600">' + escapeHtml(formatPrice(lowest)) + '</span>';
      if (requested) {
        html += '<span class="text-sm text-gray-400">(의뢰가 ' + escapeHtml(formatPrice(requested)) + ')</span>';
      }
      html += '</div>';
    }
    if (savings > 0) {
      html += '<p class="text-emerald-800 font-semibold mb-2">절약 가능 <span class="text-lg">' + savings.toLocaleString() + '원</span> · ' + pct + '%</p>';
    }
    html += '<p class="text-sm text-gray-600 leading-relaxed mb-3">' + escapeHtml(copy.sub) + '</p>';
    if (data.decision && data.decision.summary) {
      html += '<div class="p-3 rounded-xl bg-white/80 border border-gray-100 text-gray-800 text-sm font-medium">' + nl2br(data.decision.summary) + '</div>';
    }
    if (data.decision && data.decision.confidence) {
      html += '<p class="text-xs text-gray-500 mt-2">분석 신뢰도 ' + escapeHtml(String(data.decision.confidence)) + '%</p>';
    }
    html += '</div></div>';
    return html;
  }

  function renderPurchaseActionCardsHTML(options) {
    options = options || {};
    var directLink = options.directLink || '';
    var hasDirect = directLink && directLink !== '링크 정보 없음' && /^https?:\/\//i.test(String(directLink));
    var reqId = options.reqId ? String(options.reqId).replace(/^#+/, '') : '';
    var supportUrl = options.supportUrl || (reqId ? 'payment.html?req=' + encodeURIComponent(reqId) + '&method=support' : '#');
    var variant = options.variant || 'search';
    var html = '';

    html += '<div class="ph-purchase-actions mt-8 pt-6 border-t border-gray-200">';
    html += '<h3 class="text-lg font-bold text-gray-900 text-center mb-1">다음 단계 — 구매 방법</h3>';
    html += '<p class="text-sm text-gray-500 text-center mb-5">리포트 조건을 확인한 뒤 아래 방법 중 선택해 주세요</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

    html += '<div class="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 flex flex-col h-full shadow-sm">';
    html += '<span class="text-xs font-bold text-emerald-700 mb-2">✨ 추천 · 가장 빠름</span>';
    html += '<div class="text-lg font-bold text-gray-900 mb-2">🛒 검증된 최저가로 구매</div>';
    html += '<ul class="text-sm text-gray-600 space-y-1.5 mb-4 flex-1 list-none pl-0">';
    html += '<li>✓ PriceHunter가 확인한 판매처로 이동</li>';
    html += '<li>✓ 해당 쇼핑몰에서 직접 결제 (수수료 없음)</li>';
    html += '<li>✓ 조건 확인 후 가장 빠르게 구매하는 방법</li>';
    html += '</ul>';
    if (variant === 'search') {
      html += hasDirect
        ? '<button type="button" id="buy-external-btn" onclick="goToExternalPurchase()" class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition">조건 확인 후 구매 링크 이동 →</button>'
        : '<button type="button" disabled class="w-full py-3 px-4 bg-gray-200 text-gray-500 font-bold rounded-xl cursor-not-allowed">구매 링크 준비 중</button>';
    } else {
      html += hasDirect
        ? '<a id="btn-direct-buy" href="' + escapeHtml(directLink) + '" target="_blank" rel="noopener noreferrer" class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition text-center block">조건 확인 후 구매 링크 이동 →</a>'
        : '<span id="btn-direct-buy" class="w-full py-3 px-4 bg-gray-200 text-gray-500 font-bold rounded-xl text-center block opacity-50">구매 링크 없음</span>';
    }
    html += '</div>';

    html += '<div class="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 flex flex-col h-full shadow-sm">';
    html += '<span class="text-xs font-bold text-blue-700 mb-2">🤝 대행 · 편의</span>';
    html += '<div class="text-lg font-bold text-gray-900 mb-2">PriceHunter 구매 지원</div>';
    html += '<ul class="text-sm text-gray-600 space-y-1.5 mb-4 flex-1 list-none pl-0">';
    html += '<li>✓ 해외·복잡한 주문을 PriceHunter가 대신 진행</li>';
    html += '<li>✓ 검증 최저가 + <strong>1% 수수료</strong>로 결제</li>';
    html += '<li>✓ 수수료 <strong>전액 포인트 적립</strong> (구매확정 후)</li>';
    html += '</ul>';
    if (variant === 'search') {
      html += '<button type="button" onclick="showPurchaseSupport()" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition">구매 지원 신청하기 →</button>';
    } else {
      html += '<a id="btn-support-buy" href="' + escapeHtml(supportUrl) + '" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition text-center block">구매 지원 신청하기 →</a>';
    }
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  function renderCustomerResultHTML(result, options) {
    options = options || {};
    var clean = sanitizeCustomerReport(result);
    var html = renderCustomerHeroHTML(clean, options);
    html += renderPurchaseReportHTML(clean, { skipVerdict: true, customerView: true });
    if (options.includeActions !== false) {
      html += renderPurchaseActionCardsHTML(Object.assign({
        directLink: clean.link,
        variant: options.variant || 'search'
      }, options));
    }
    return html;
  }

  function renderPurchaseReportHTML(result, options) {
    options = options || {};
    var data = options.customerView ? sanitizeCustomerReport(result) : normalizeResultData(result);
    var html = '';
    var verdict = data.decision && data.decision.verdict;
    var cfg = VERDICT_CONFIG[verdict];

    if (cfg && !options.skipVerdict) {
      html +=
        '<div class="mb-6 p-5 rounded-2xl border-2 ' + cfg.border + ' ' + cfg.light + ' text-left">' +
        '<div class="flex flex-wrap items-center gap-3 mb-3">' +
        '<span class="px-4 py-2 rounded-full text-white font-bold text-sm ' + cfg.bg + '">' + cfg.emoji + ' ' + cfg.label + '</span>';
      if (data.decision.confidence) {
        html += '<span class="text-sm text-gray-600">신뢰도 ' + escapeHtml(String(data.decision.confidence)) + '%</span>';
      }
      html += '</div>';
      if (data.decision.summary) {
        html += '<p class="text-lg font-semibold ' + cfg.text + ' mb-2">' + nl2br(data.decision.summary) + '</p>';
      }
      if (data.decision.recommendFor) {
        html += '<p class="text-sm text-gray-600"><span class="font-semibold">추천 대상:</span> ' + nl2br(data.decision.recommendFor) + '</p>';
      }
      if (data.decision.notRecommendFor) {
        html += '<p class="text-sm text-gray-600 mt-1"><span class="font-semibold">비추천 대상:</span> ' + nl2br(data.decision.notRecommendFor) + '</p>';
      }
      html += '</div>';
    }

    var pa = data.priceAnalysis || {};
    var priceParts = [];
    if (pa.currentPrice) priceParts.push('<div><span class="text-gray-500">현재가</span> <strong>' + escapeHtml(formatPrice(pa.currentPrice)) + '</strong></div>');
    if (pa.lowestPrice) priceParts.push('<div><span class="text-gray-500">최저가</span> <strong class="text-emerald-600">' + escapeHtml(formatPrice(pa.lowestPrice)) + '</strong></div>');
    if (pa.avgPrice) priceParts.push('<div><span class="text-gray-500">시장 평균</span> <strong>' + escapeHtml(formatPrice(pa.avgPrice)) + '</strong></div>');
    if (pa.requestedPrice) priceParts.push('<div><span class="text-gray-500">의뢰가</span> <strong>' + escapeHtml(formatPrice(pa.requestedPrice)) + '</strong></div>');
    if (pa.trend && TREND_CONFIG[pa.trend]) {
      priceParts.push('<div><span class="text-gray-500">가격 추세</span> <strong>' + TREND_CONFIG[pa.trend].emoji + ' ' + TREND_CONFIG[pa.trend].label + '</strong></div>');
    }
    if (priceParts.length) {
      var priceContent = '<div class="grid grid-cols-2 gap-3">' + priceParts.join('') + '</div>';
      if (pa.timingScore) priceContent += scoreBar(pa.timingScore, 'bg-emerald-500');
      if (pa.timingNote) priceContent += '<p class="mt-2 text-gray-600">' + nl2br(pa.timingNote) + '</p>';
      html += sectionBlock('가격 분석', '💰', priceContent);
    }

    var prod = data.productAnalysis || {};
    var prodParts = [];
    if (prod.valueScore) prodParts.push(scoreBar(prod.valueScore, 'bg-blue-500'));
    if (prod.reviewSummary && !(options.customerView && /AI 연동|수동 입력/.test(prod.reviewSummary))) {
      prodParts.push('<p>' + nl2br(prod.reviewSummary) + '</p>');
    }
    if (prod.pros) prodParts.push('<p><span class="font-semibold text-emerald-700">장점</span><br>' + nl2br(prod.pros) + '</p>');
    if (prod.cons) prodParts.push('<p><span class="font-semibold text-red-700">단점</span><br>' + nl2br(prod.cons) + '</p>');
    if (prod.alternatives) {
      var alts = prod.alternatives.split('\n').filter(function (l) { return l.trim(); });
      if (alts.length) {
        prodParts.push('<ul class="list-disc list-inside">' + alts.map(function (a) { return '<li>' + escapeHtml(a.trim()) + '</li>'; }).join('') + '</ul>');
      }
    }
    if (prodParts.length) html += sectionBlock('제품 분석', '⭐', prodParts.join(''));

    var seller = data.sellerAnalysis || {};
    var sellerParts = [];
    if (seller.sellerName) sellerParts.push('<p><span class="font-semibold">판매처:</span> ' + escapeHtml(seller.sellerName) + '</p>');
    if (seller.trustScore) sellerParts.push(scoreBar(seller.trustScore, 'bg-indigo-500'));
    if (seller.risks) sellerParts.push('<p><span class="font-semibold text-amber-700">주의사항</span><br>' + nl2br(seller.risks) + '</p>');
    if (seller.domesticVsImport) sellerParts.push('<p>' + nl2br(seller.domesticVsImport) + '</p>');
    if (sellerParts.length) html += sectionBlock('판매처 분석', '🏪', sellerParts.join(''));

    if (data.evidenceNotes && data.evidenceNotes.trim() && !(options.customerView && isAdminMetaLine(data.evidenceNotes))) {
      html += sectionBlock('판단 근거', '⚖️', nl2br(data.evidenceNotes));
    }

    return html;
  }

  function collectFromAdminForm() {
    function val(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }
    return normalizeResultData({
      reportVersion: REPORT_VERSION,
      price: val('admin-price'),
      origin: val('admin-origin'),
      summary: val('admin-summary'),
      link: val('admin-link'),
      decision: {
        verdict: val('admin-verdict'),
        summary: val('admin-decision-summary'),
        confidence: val('admin-confidence'),
        recommendFor: val('admin-recommend-for'),
        notRecommendFor: val('admin-not-recommend-for')
      },
      priceAnalysis: {
        currentPrice: val('admin-current-price'),
        lowestPrice: val('admin-lowest-price'),
        avgPrice: val('admin-avg-price'),
        requestedPrice: val('admin-requested-price'),
        trend: val('admin-price-trend'),
        timingScore: val('admin-timing-score'),
        timingNote: val('admin-timing-note')
      },
      productAnalysis: {
        valueScore: val('admin-value-score'),
        reviewSummary: val('admin-review-summary'),
        pros: val('admin-pros'),
        cons: val('admin-cons'),
        alternatives: val('admin-alternatives')
      },
      sellerAnalysis: {
        sellerName: val('admin-seller-name'),
        trustScore: val('admin-trust-score'),
        risks: val('admin-seller-risks'),
        domesticVsImport: val('admin-domestic-import'),
        domesticImportPreset: val('admin-domestic-import-preset')
      },
      evidenceNotes: val('admin-evidence-notes')
    });
  }

  function populateAdminForm(result) {
    var data = normalizeResultData(result);
    function set(id, value) {
      var el = document.getElementById(id);
      if (el) el.value = value != null ? value : '';
    }
    set('admin-price', data.price);
    set('admin-origin', data.origin);
    set('admin-summary', data.summary);
    set('admin-link', data.link);
    set('admin-verdict', data.decision.verdict);
    set('admin-decision-summary', data.decision.summary);
    set('admin-confidence', data.decision.confidence);
    set('admin-recommend-for', data.decision.recommendFor);
    set('admin-not-recommend-for', data.decision.notRecommendFor);
    set('admin-current-price', data.priceAnalysis.currentPrice);
    set('admin-lowest-price', data.priceAnalysis.lowestPrice);
    set('admin-avg-price', data.priceAnalysis.avgPrice);
    set('admin-requested-price', data.priceAnalysis.requestedPrice);
    set('admin-price-trend', data.priceAnalysis.trend);
    set('admin-timing-score', data.priceAnalysis.timingScore);
    set('admin-timing-note', data.priceAnalysis.timingNote);
    set('admin-value-score', data.productAnalysis.valueScore);
    set('admin-review-summary', data.productAnalysis.reviewSummary);
    set('admin-pros', data.productAnalysis.pros);
    set('admin-cons', data.productAnalysis.cons);
    set('admin-alternatives', data.productAnalysis.alternatives);
    set('admin-seller-name', data.sellerAnalysis.sellerName);
    set('admin-trust-score', data.sellerAnalysis.trustScore);
    set('admin-seller-risks', data.sellerAnalysis.risks);
    set('admin-domestic-import-preset', data.sellerAnalysis.domesticImportPreset);
    set('admin-domestic-import', data.sellerAnalysis.domesticVsImport);
    set('admin-evidence-notes', data.evidenceNotes);
  }

  function saveResult(reqNum, data) {
    var normalized = normalizeResultData(data);
    var json = JSON.stringify(normalized);
    var num = String(reqNum || '').replace(/^#+/, '');
    localStorage.setItem('result-' + num, json);
    localStorage.setItem('result-PH-' + num, json);
    if (num.indexOf('PH-') === 0) {
      localStorage.setItem('result-' + num.replace(/^PH-/, ''), json);
    }
    return normalized;
  }

  /** 반자동 QA: 저장 전 관리자 검수 항목 */
  function getQaWarnings(report) {
    var data = normalizeResultData(report);
    var warnings = [];
    var confidence = parseInt(data.decision && data.decision.confidence, 10);
    if (data.decision && data.decision.verdict && (isNaN(confidence) || confidence < 85)) {
      warnings.push('구매 판단 신뢰도가 85% 미만입니다. verdict·근거를 다시 확인하세요.');
    }
    if (!data.price || !String(data.price).trim()) {
      warnings.push('최저가(price)가 비어 있습니다.');
    }
    if (!data.link || !String(data.link).trim()) {
      warnings.push('구매 링크가 비어 있습니다.');
    }
    if (!data.summary || !String(data.summary).trim()) {
      warnings.push('종합설명(summary)이 비어 있습니다.');
    }
    if (data.decision && data.decision.verdict && !(data.decision.summary && data.decision.summary.trim())) {
      warnings.push('구매 판단 한 줄 결론이 비어 있습니다.');
    }
    if (hasV2Content(data) && !(data.evidenceNotes && data.evidenceNotes.trim())) {
      warnings.push('판단 근거(evidenceNotes)를 입력하면 리포트 신뢰도가 높아집니다.');
    }
    if (data.sellerAnalysis && data.sellerAnalysis.trustScore) {
      var trust = parseInt(data.sellerAnalysis.trustScore, 10);
      if (!isNaN(trust) && trust < 70) {
        warnings.push('판매처 신뢰도가 70점 미만입니다. 주의사항을 확인하세요.');
      }
    }
    return warnings;
  }

  /** Firebase requests 문서용 페이로드 (admin-dashboard 호환 + v2) */
  function toFirebasePayload(report) {
    var data = normalizeResultData(report);
    return {
      purchaseReport: data,
      reportVersion: data.reportVersion || REPORT_VERSION,
      adminResponse: {
        lowestPrice: data.price,
        seller: data.origin,
        additionalInfo: data.summary,
        link: data.link,
        purchaseVerdict: data.decision && data.decision.verdict,
        purchaseSummary: data.decision && data.decision.summary,
        confidence: data.decision && data.decision.confidence
      },
      status: '답변완료'
    };
  }

  global.PurchaseReport = {
    REPORT_VERSION: REPORT_VERSION,
    VERDICT_CONFIG: VERDICT_CONFIG,
    TREND_CONFIG: TREND_CONFIG,
    emptyReport: emptyReport,
    normalizeResultData: normalizeResultData,
    hasV2Content: hasV2Content,
    isReportComplete: isReportComplete,
    hasDisplayableContent: hasDisplayableContent,
    formatPrice: formatPrice,
    parsePriceNum: parsePriceNum,
    reportFromFirebaseItem: reportFromFirebaseItem,
    sanitizeCustomerReport: sanitizeCustomerReport,
    renderCustomerHeroHTML: renderCustomerHeroHTML,
    renderCustomerResultHTML: renderCustomerResultHTML,
    renderPurchaseActionCardsHTML: renderPurchaseActionCardsHTML,
    renderPurchaseReportHTML: renderPurchaseReportHTML,
    collectFromAdminForm: collectFromAdminForm,
    populateAdminForm: populateAdminForm,
    saveResult: saveResult,
    getQaWarnings: getQaWarnings,
    toFirebasePayload: toFirebasePayload
  };
})(typeof window !== 'undefined' ? window : this);
