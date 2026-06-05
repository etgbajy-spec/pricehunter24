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
        domesticVsImport: ''
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

  function renderCustomerHeroHTML(result, options) {
    options = options || {};
    var data = normalizeResultData(result);
    var lowest = parsePriceNum(data.price || (data.priceAnalysis && data.priceAnalysis.lowestPrice));
    var requested = parsePriceNum(options.requestedPrice || (data.priceAnalysis && data.priceAnalysis.requestedPrice));
    var savings = requested && lowest && requested > lowest ? requested - lowest : 0;
    var pct = requested && savings ? Math.round(savings / requested * 100) : 0;
    var verdict = data.decision && data.decision.verdict;
    var cfg = VERDICT_CONFIG[verdict];
    var link = data.link;
    var html = '';

    html += '<div class="mb-6 p-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 text-left">';
    html += '<div class="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">✅ PriceHunter 검증 완료</div>';
    html += '<h2 class="text-xl md:text-2xl font-extrabold text-gray-900 mb-2">';
    if (lowest) {
      html += '검증팀이 찾은 최저가 <span class="text-emerald-600">' + escapeHtml(formatPrice(lowest)) + '</span>';
    } else {
      html += '최저가 검증 · 구매판단 리포트';
    }
    html += '</h2>';
    if (savings > 0) {
      html += '<p class="text-emerald-800 font-semibold mb-2">의뢰가 대비 <span class="text-lg">' + savings.toLocaleString() + '원</span> (' + pct + '%) 절약 가능</p>';
    }
    html += '<p class="text-sm text-gray-600 mb-3">직접 가격 비교·판매처 검증을 하실 필요 없습니다. PriceHunter가 대신 찾아드렸습니다.</p>';
    if (cfg) {
      html += '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-bold ' + cfg.bg + ' mb-2">' +
        cfg.emoji + ' PriceHunter 구매 판단: ' + cfg.label + '</div>';
      if (data.decision.summary) {
        html += '<p class="text-gray-800 font-medium">' + nl2br(data.decision.summary) + '</p>';
      }
    }
    if (link && link !== '링크 정보 없음' && /^https?:\/\//i.test(String(link))) {
      html += '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="mt-4 inline-flex w-full md:w-auto justify-center items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition">' +
        '🛒 검증된 최저가로 구매하기</a>';
      html += '<p class="text-xs text-gray-500 mt-2">↑ PriceHunter가 검증한 판매처 링크입니다</p>';
    }
    html += '</div>';
    return html;
  }

  function renderCustomerResultHTML(result, options) {
    return renderCustomerHeroHTML(result, options) + renderPurchaseReportHTML(result, { skipVerdict: true });
  }

  function renderPurchaseReportHTML(result, options) {
    options = options || {};
    var data = normalizeResultData(result);
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
    if (prod.reviewSummary) prodParts.push('<p>' + nl2br(prod.reviewSummary) + '</p>');
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

    if (data.evidenceNotes && data.evidenceNotes.trim()) {
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
        domesticVsImport: val('admin-domestic-import')
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
    renderCustomerHeroHTML: renderCustomerHeroHTML,
    renderCustomerResultHTML: renderCustomerResultHTML,
    renderPurchaseReportHTML: renderPurchaseReportHTML,
    collectFromAdminForm: collectFromAdminForm,
    populateAdminForm: populateAdminForm,
    saveResult: saveResult,
    getQaWarnings: getQaWarnings,
    toFirebasePayload: toFirebasePayload
  };
})(typeof window !== 'undefined' ? window : this);
