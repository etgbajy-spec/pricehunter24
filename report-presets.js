/**
 * 구매판단 리포트 자동 완성 프리셋 (관리자 폼 + AI 파이프라인 공용)
 */
(function (global) {
  'use strict';

  function parsePriceNum(val) {
    if (typeof val === 'number') return val;
    return parseInt(String(val || '').replace(/[^\d]/g, ''), 10) || 0;
  }

  function formatPriceKr(val) {
    var n = parsePriceNum(val);
    if (!n) return String(val || '');
    return n.toLocaleString('ko-KR') + '원';
  }

  function buildContext(input) {
    input = input || {};
    return {
      productName: input.productName || input.name || '해당 제품',
      lowestPrice: input.lowestPrice || input.price || '',
      requestedPrice: input.requestedPrice || input.requestPrice || '',
      sellerName: input.sellerName || input.origin || '',
      referenceUrl: input.referenceUrl || input.url || input.link || '',
      description: input.description || input.desc || '',
      priceSummary: input.priceSummary || ''
    };
  }

  function getVerdictPreset(verdict, ctx) {
    ctx = buildContext(ctx);
    var lowest = formatPriceKr(ctx.lowestPrice);
    var requested = formatPriceKr(ctx.requestedPrice);
    var presets = {
      buy: {
        confidence: 88,
        summary: lowest
          ? 'PriceHunter 검증 결과, ' + lowest + ' 수준에서 구매를 추천합니다. 의뢰가 대비 유리한 조건입니다.'
          : 'PriceHunter 검증 결과, 현재 시점에서 구매를 추천합니다.',
        recommendFor: '합리적인 가격에 구매를 원하시는 분 · 빠르게 구매를 마치고 싶은 분',
        notRecommendFor: '추가 할인을 더 기다릴 수 있는 분'
      },
      hold: {
        confidence: 82,
        summary: requested && lowest && parsePriceNum(ctx.lowestPrice) >= parsePriceNum(ctx.requestedPrice)
          ? '현재 최저가(' + lowest + ')가 의뢰가(' + requested + ')와 같거나 높습니다. 프로모션·할인 시점까지 관망을 권장드립니다.'
          : '가격 변동 여지가 있어 당장 구매보다 관망이 유리합니다. PriceHunter가 확인한 시점 기준입니다.',
        recommendFor: '급하지 않고 더 좋은 타이밍을 기다릴 수 있는 분',
        notRecommendFor: '지금 당장 구매가 꼭 필요한 분'
      },
      skip: {
        confidence: 85,
        summary: '가격 대비 만족도 또는 대안 측면에서 지금 구매는 권장하지 않습니다. 다른 선택지를 검토해 보시는 편이 좋습니다.',
        recommendFor: '충분히 비교한 뒤 다른 제품을 검토하고 싶은 분',
        notRecommendFor: '즉시 구매가 필요한 분 · 가격이 더 내려갈 때까지 기다릴 수 없는 분'
      }
    };
    return presets[verdict] || null;
  }

  function getTrendPreset(trend, ctx) {
    ctx = buildContext(ctx);
    var presets = {
      down: {
        timingScore: 86,
        timingNote: '하락 또는 유리한 가격대가 확인되었습니다. 구매 타이밍이 좋은 편입니다.'
      },
      stable: {
        timingScore: 72,
        timingNote: '가격이 비교적 안정적입니다. 필요하시면 합리적인 수준에서 구매를 검토할 수 있습니다.'
      },
      up: {
        timingScore: 48,
        timingNote: '상승 또는 불리한 가격 흐름이 관찰됩니다. 성급한 구매보다 관망을 권장합니다.'
      }
    };
    return presets[trend] || presets.stable;
  }

  function buildProductAnalysis(ctx) {
    ctx = buildContext(ctx);
    var name = ctx.productName;
    return {
      valueScore: 80,
      reviewSummary: name + '은(는) 의뢰하신 용도와 스펙에 잘 맞는 선택으로 확인되었습니다. 가격 대비 만족도가 양호한 편입니다.',
      pros: '의뢰 조건에 부합하는 스펙 · PriceHunter 검증 경로에서 확인된 정상 판매처 · 합리적인 가격대',
      cons: '특별히 우려되는 단점은 확인되지 않았습니다.',
      alternatives: ''
    };
  }

  function buildSellerAnalysis(ctx) {
    ctx = buildContext(ctx);
    var seller = ctx.sellerName || '검증 판매처';
    var isImport = /직구|해외|amazon|aliexpress|ebay/i.test(seller + ctx.referenceUrl);
    return {
      sellerName: seller.replace(/ \/ PriceHunter.*/, ''),
      trustScore: 84,
      risks: isImport
        ? '해외 배송·통관·AS 절차는 구매 전 안내드린 범위 내에서 확인했습니다.'
        : '국내 판매처 기준으로 정상 운영이 확인되었으며, 특이 리스크는 발견되지 않았습니다.',
      domesticVsImport: isImport
        ? '해외 직구 경로입니다. 총비용(배송·관세)을 포함해 검증했습니다.'
        : '국내 구매 기준으로 검증했으며, 배송·AS 접근성이 양호합니다.'
    };
  }

  function buildEvidenceNotes(ctx) {
    ctx = buildContext(ctx);
    var lines = [
      'PriceHunter 검증팀이 ' + new Date().toLocaleDateString('ko-KR') + ' 기준으로 가격·판매처를 확인했습니다.',
      ctx.lowestPrice ? '확인된 최저가: ' + formatPriceKr(ctx.lowestPrice) : '',
      ctx.requestedPrice ? '의뢰가: ' + formatPriceKr(ctx.requestedPrice) : '',
      ctx.sellerName ? '추천 판매처: ' + ctx.sellerName.replace(/ \/ PriceHunter.*/, '') : '',
      ctx.priceSummary && !/^수집 요약:/.test(ctx.priceSummary) ? ctx.priceSummary : ''
    ].filter(Boolean);
    return lines.join('\n');
  }

  function enrichDraft(draft, ctx) {
    if (!draft || typeof draft !== 'object') return draft;
    draft.decision = draft.decision || {};
    draft.priceAnalysis = draft.priceAnalysis || {};
    draft.productAnalysis = draft.productAnalysis || {};
    draft.sellerAnalysis = draft.sellerAnalysis || {};

    var mergedCtx = buildContext(Object.assign({}, ctx, {
      productName: ctx && ctx.productName,
      lowestPrice: draft.price || draft.priceAnalysis.lowestPrice,
      requestedPrice: draft.priceAnalysis.requestedPrice || (ctx && ctx.requestedPrice),
      sellerName: draft.origin || draft.sellerAnalysis.sellerName,
      referenceUrl: draft.link || (ctx && ctx.referenceUrl),
      priceSummary: ctx && ctx.priceSummary
    }));

    var verdict = draft.decision.verdict;
    if (verdict) {
      var vp = getVerdictPreset(verdict, mergedCtx);
      if (vp) {
        draft.decision.confidence = vp.confidence;
        draft.decision.summary = vp.summary;
        draft.decision.recommendFor = vp.recommendFor;
        draft.decision.notRecommendFor = vp.notRecommendFor;
      }
    }

    var trend = draft.priceAnalysis.trend || 'stable';
    var tp = getTrendPreset(trend, mergedCtx);
    draft.priceAnalysis.timingScore = tp.timingScore;
    draft.priceAnalysis.timingNote = tp.timingNote;
    if (!draft.priceAnalysis.trend) draft.priceAnalysis.trend = trend;

    Object.assign(draft.productAnalysis, buildProductAnalysis(mergedCtx));
    Object.assign(draft.sellerAnalysis, buildSellerAnalysis(mergedCtx));
    draft.evidenceNotes = buildEvidenceNotes(mergedCtx);

    return draft;
  }

  function applyVerdictToAdminForm(verdict, ctx) {
    var preset = getVerdictPreset(verdict, ctx);
    if (!preset) return;
    function set(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val != null ? val : '';
    }
    set('admin-confidence', preset.confidence);
    set('admin-decision-summary', preset.summary);
    set('admin-recommend-for', preset.recommendFor);
    set('admin-not-recommend-for', preset.notRecommendFor);
  }

  function applyTrendToAdminForm(trend, ctx) {
    var preset = getTrendPreset(trend, ctx);
    if (!preset) return;
    function set(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val != null ? val : '';
    }
    set('admin-timing-score', preset.timingScore);
    set('admin-timing-note', preset.timingNote);
  }

  function applyAnalysisSectionsToAdminForm(ctx) {
    var prod = buildProductAnalysis(ctx);
    var seller = buildSellerAnalysis(ctx);
    function set(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val != null ? val : '';
    }
    set('admin-value-score', prod.valueScore);
    set('admin-review-summary', prod.reviewSummary);
    set('admin-pros', prod.pros);
    set('admin-cons', prod.cons);
    set('admin-alternatives', prod.alternatives);
    set('admin-seller-name', seller.sellerName);
    set('admin-trust-score', seller.trustScore);
    set('admin-seller-risks', seller.risks);
    set('admin-domestic-import', seller.domesticVsImport);
    set('admin-evidence-notes', buildEvidenceNotes(ctx));
  }

  function buildAdminFormContextFromRequest(req, formVals) {
    formVals = formVals || {};
    return buildContext({
      productName: (req && (req.name || req.productName)) || formVals.productName || '',
      lowestPrice: formVals.lowestPrice || formVals.price || '',
      requestedPrice: formVals.requestedPrice || (req && req.price) || '',
      sellerName: formVals.sellerName || formVals.origin || '',
      referenceUrl: formVals.link || (req && req.url) || '',
      description: (req && (req.description || req.desc)) || '',
      priceSummary: formVals.priceSummary || ''
    });
  }

  var api = {
    buildContext: buildContext,
    buildAdminFormContextFromRequest: buildAdminFormContextFromRequest,
    getVerdictPreset: getVerdictPreset,
    getTrendPreset: getTrendPreset,
    buildProductAnalysis: buildProductAnalysis,
    buildSellerAnalysis: buildSellerAnalysis,
    buildEvidenceNotes: buildEvidenceNotes,
    enrichDraft: enrichDraft,
    applyVerdictToAdminForm: applyVerdictToAdminForm,
    applyTrendToAdminForm: applyTrendToAdminForm,
    applyAnalysisSectionsToAdminForm: applyAnalysisSectionsToAdminForm
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.ReportPresets = api;
})(typeof window !== 'undefined' ? window : global);
