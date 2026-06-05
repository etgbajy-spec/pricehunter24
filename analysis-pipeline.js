/**
 * PriceHunter AI 분석 파이프라인 (Phase 2)
 * 가격 수집 → AI 초안 생성
 */
'use strict';

const REPORT_JSON_SCHEMA = {
  reportVersion: 'v2',
  price: 'string (최저가, 숫자 또는 N원)',
  origin: 'string',
  summary: 'string (HTML 가능, 종합설명)',
  link: 'string (구매 URL)',
  decision: {
    verdict: 'buy | hold | skip',
    summary: 'string (한 줄 결론)',
    confidence: 'number 0-100',
    recommendFor: 'string',
    notRecommendFor: 'string'
  },
  priceAnalysis: {
    currentPrice: 'string',
    lowestPrice: 'string',
    avgPrice: 'string',
    requestedPrice: 'string',
    trend: 'down | stable | up',
    timingScore: 'number 0-100',
    timingNote: 'string'
  },
  productAnalysis: {
    valueScore: 'number 0-100',
    reviewSummary: 'string',
    pros: 'string',
    cons: 'string',
    alternatives: 'string (줄바꿈 구분)'
  },
  sellerAnalysis: {
    sellerName: 'string',
    trustScore: 'number 0-100',
    risks: 'string',
    domesticVsImport: 'string'
  },
  evidenceNotes: 'string'
};

function parsePriceNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const cleaned = String(value).replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function formatPriceKr(num) {
  if (!num) return '';
  return num.toLocaleString('ko-KR') + '원';
}

function detectMarketplace(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('coupang')) return { name: '쿠팡', trust: 85 };
  if (u.includes('11st') || u.includes('11번가')) return { name: '11번가', trust: 80 };
  if (u.includes('gmarket') || u.includes('지마켓')) return { name: 'G마켓', trust: 80 };
  if (u.includes('auction') || u.includes('옥션')) return { name: '옥션', trust: 78 };
  if (u.includes('naver') || u.includes('smartstore')) return { name: '네이버 스마트스토어', trust: 82 };
  if (u.includes('amazon')) return { name: 'Amazon', trust: 75 };
  if (u.includes('aliexpress') || u.includes('alibaba')) return { name: '해외직구', trust: 60 };
  return { name: '외부 판매처', trust: 70 };
}

async function fetchPageMeta(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PriceHunter/2.0; +https://pricehunt24.com)',
        Accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });
    clearTimeout(timer);
    if (!res.ok) return { url, status: res.status, title: null, snippet: null };
    const html = await res.text();
    const title =
      (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] ||
      null;
    const ogPrice =
      (html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      (html.match(/<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i) || [])[1] ||
      null;
    const priceFromHtml = ogPrice ? parsePriceNumber(ogPrice) : extractPriceFromHtml(html);
    return {
      url,
      status: res.status,
      title: title ? title.trim().slice(0, 200) : null,
      detectedPrice: priceFromHtml,
      marketplace: detectMarketplace(url)
    };
  } catch (err) {
    return { url, error: err.message || 'fetch_failed' };
  }
}

function extractPriceFromHtml(html) {
  const patterns = [
    /(?:판매가|할인가|최종가|price)[^0-9]{0,20}([0-9][0-9,]{3,})/i,
    /₩\s*([0-9][0-9,]{3,})/,
    /([0-9][0-9,]{3,})\s*원/
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parsePriceNumber(m[1]);
      if (n && n >= 1000 && n <= 100000000) return n;
    }
  }
  return null;
}

/**
 * 1단계: 가격·판매처 데이터 수집
 */
async function collectPrices(requestData) {
  const productName = requestData.name || requestData.productName || '';
  const description = requestData.description || requestData.desc || '';
  const urlList = []
    .concat(requestData.url || [])
    .concat(requestData.referenceUrl || [])
    .concat(Array.isArray(requestData.urls) ? requestData.urls : [])
    .filter(Boolean)
    .map(u => String(u).trim())
    .filter(u => /^https?:\/\//i.test(u));
  const uniqueUrls = [...new Set(urlList)];
  const referenceUrl = uniqueUrls[0] || '';
  const requestedPrice = parsePriceNumber(requestData.price || requestData.userPrice);
  const sources = [];

  for (const url of uniqueUrls.slice(0, 3)) {
    const meta = await fetchPageMeta(url);
    if (meta) sources.push({ type: 'reference_url', ...meta });
  }

  const marketplace = detectMarketplace(referenceUrl);
  const referencePrices = sources.map(s => s.detectedPrice).filter(Boolean);
  const referencePrice = referencePrices.length ? Math.min(...referencePrices) : null;
  const prices = [requestedPrice, referencePrice].filter(Boolean);
  const lowest = prices.length ? Math.min(...prices) : null;
  const highest = prices.length ? Math.max(...prices) : null;
  const avg = prices.length
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null;

  let trend = 'stable';
  if (requestedPrice && referencePrice) {
    if (referencePrice < requestedPrice * 0.95) trend = 'down';
    else if (referencePrice > requestedPrice * 1.05) trend = 'up';
  }

  return {
    collectedAt: new Date().toISOString(),
    productName,
    description: description.slice(0, 500),
    referenceUrl,
    requestedPrice,
    referencePrice,
    lowestPrice: lowest,
    avgPrice: avg,
    highestPrice: highest,
    trend,
    marketplace,
    sources,
    summary: buildPriceCollectionSummary({ productName, requestedPrice, referencePrice, lowest, avg, trend, marketplace })
  };
}

function buildPriceCollectionSummary(ctx) {
  const parts = [];
  if (ctx.requestedPrice) parts.push(`의뢰가 ${formatPriceKr(ctx.requestedPrice)}`);
  if (ctx.referencePrice) parts.push(`참고 URL 감지가 ${formatPriceKr(ctx.referencePrice)}`);
  if (ctx.lowest) parts.push(`수집 최저 ${formatPriceKr(ctx.lowest)}`);
  if (ctx.marketplace?.name) parts.push(`판매처 추정: ${ctx.marketplace.name}`);
  return parts.join(' · ') || '가격 데이터 수집됨 (수동 보완 필요)';
}

/**
 * 규칙 기반 초안 (OpenAI 없을 때 fallback)
 */
function generateRuleBasedDraft(requestData, priceData) {
  const requested = priceData.requestedPrice;
  const reference = priceData.referencePrice;
  const lowest = priceData.lowestPrice;
  const marketplace = priceData.marketplace || detectMarketplace(priceData.referenceUrl);

  let verdict = 'hold';
  let timingScore = 55;
  let confidence = 60;

  if (lowest && requested && lowest < requested * 0.9) {
    verdict = 'buy';
    timingScore = 82;
    confidence = 72;
  } else if (reference && requested && reference > requested * 1.15) {
    verdict = 'skip';
    timingScore = 35;
    confidence = 65;
  }

  const productName = priceData.productName || '해당 제품';
  const decisionSummary =
    verdict === 'buy'
      ? `현재 ${formatPriceKr(lowest || requested)} 수준이 의뢰가 대비 유리해 구매를 검토할 만합니다.`
      : verdict === 'skip'
        ? '참고 가격이 의뢰가보다 높아 지금 구매는 권장하지 않습니다.'
        : lowest && requested && lowest >= requested
          ? '현재 최저가가 의뢰가와 같습니다. 추가 할인·프로모션 시점까지 관망을 권장드립니다.'
          : '가격 변동 가능성이 있어 당장 구매보다 관망이 유리합니다.';

  return normalizeDraft({
    reportVersion: 'v2',
    price: formatPriceKr(lowest || reference || requested || ''),
    origin: marketplace?.name ? `${marketplace.name} / PriceHunter 검증` : 'PriceHunter 검증',
    summary: `<p><strong>${productName}</strong> — PriceHunter 검증팀이 ${formatPriceKr(lowest || reference || requested || '')} 수준의 최저가를 확인했습니다.</p>`,
    link: priceData.referenceUrl || requestData.url || '',
    decision: {
      verdict,
      summary: decisionSummary,
      confidence,
      recommendFor: verdict === 'buy' ? '가격 대비 구매를 고려 중인 분' : '충분한 정보 확인 후 결정하고 싶은 분',
      notRecommendFor: verdict === 'skip' ? '즉시 구매가 필요한 분' : ''
    },
    priceAnalysis: {
      currentPrice: formatPriceKr(reference || requested || ''),
      lowestPrice: formatPriceKr(lowest || reference || requested || ''),
      avgPrice: formatPriceKr(priceData.avgPrice || ''),
      requestedPrice: formatPriceKr(requested || ''),
      trend: priceData.trend || 'stable',
      timingScore,
      timingNote: priceData.trend === 'down' ? '하락 또는 유리한 가격대가 관찰됩니다.' : '추가 가격 변동 모니터링을 권장합니다.'
    },
    productAnalysis: {
      valueScore: verdict === 'buy' ? 75 : 55,
      reviewSummary: '',
      pros: requestData.description ? '의뢰하신 스펙/용도에 부합하는 제품' : '',
      cons: '',
      alternatives: ''
    },
    sellerAnalysis: {
      sellerName: marketplace?.name || '',
      trustScore: marketplace?.trust || 70,
      risks: marketplace?.name === '해외직구' ? '배송·관세·AS 리스크가 있을 수 있습니다' : '',
      domesticVsImport: marketplace?.name === '해외직구' ? '직구 시 총비용(관세·배송)을 함께 확인했습니다' : '국내 구매 기준으로 검증했습니다'
    },
    evidenceNotes: priceData.summary ? priceData.summary.replace(/^수집 요약:\s*/, '') : ''
  });
}

function normalizeDraft(raw) {
  const draft = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!draft.reportVersion) draft.reportVersion = 'v2';
  draft.decision = draft.decision || {};
  draft.priceAnalysis = draft.priceAnalysis || {};
  draft.productAnalysis = draft.productAnalysis || {};
  draft.sellerAnalysis = draft.sellerAnalysis || {};
  return draft;
}

function buildAiPrompt(requestData, priceData) {
  return `당신은 PriceHunter의 구매판단 분석가입니다.
고객 의뢰와 수집된 가격 데이터를 바탕으로 구매판단 리포트 JSON을 작성하세요.

## 의뢰 정보
- 제품명: ${requestData.name || requestData.productName || '(없음)'}
- 설명: ${(requestData.description || '').slice(0, 800)}
- 참고 URL: ${requestData.url || '(없음)'}
- 의뢰가: ${priceData.requestedPrice ? formatPriceKr(priceData.requestedPrice) : '(없음)'}

## 수집된 가격 데이터
${JSON.stringify(priceData, null, 2)}

## 출력 규칙
1. 반드시 유효한 JSON만 출력 (마크다운 코드블록 금지)
2. 스키마: ${JSON.stringify(REPORT_JSON_SCHEMA)}
3. verdict는 buy/hold/skip 중 하나
4. confidence, timingScore, valueScore, trustScore는 0~100 정수
5. summary는 간단한 HTML(p, strong, ul, li) 사용 가능
6. link는 참고 URL 또는 추천 구매처 URL
7. price 필드는 최종 추천 최저가 (예: "89,000원")
8. 한국어로 작성
9. 확실하지 않으면 hold + confidence 낮게
10. 명품(명품백·시계·주얼리) 의뢰로 보이면 verdict=skip, evidenceNotes에 명품 제외 안내`;
}

async function callOpenAiDraft(requestData, priceData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const prompt = buildAiPrompt(requestData, priceData);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You output only valid JSON for Korean purchase decision reports. No markdown.'
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API 오류 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI 응답이 비어 있습니다.');
  return normalizeDraft(content);
}

/**
 * 2단계: AI 초안 생성 (OpenAI → fallback 규칙 기반)
 */
async function generateDraft(requestData, priceData, options) {
  options = options || {};
  let mode = 'rule_based';
  let draft;

  if (!options.skipAi && process.env.OPENAI_API_KEY) {
    try {
      draft = await callOpenAiDraft(requestData, priceData);
      mode = 'openai';
    } catch (err) {
      console.warn('OpenAI draft failed, using rule-based fallback:', err.message);
      draft = generateRuleBasedDraft(requestData, priceData);
      mode = 'rule_based_fallback';
    }
  } else {
    draft = generateRuleBasedDraft(requestData, priceData);
  }

  return { draft, mode, pipelineMeta: { mode, generatedAt: new Date().toISOString() } };
}

/**
 * 전체 파이프라인
 */
async function runAnalysisPipeline(requestData, options) {
  options = options || {};
  const steps = [];

  steps.push({ step: 'collect', status: 'running', at: new Date().toISOString() });
  const priceData = await collectPrices(requestData);
  steps[0].status = 'done';
  steps[0].result = { summary: priceData.summary };

  steps.push({ step: 'generate', status: 'running', at: new Date().toISOString() });
  const { draft, mode } = await generateDraft(requestData, priceData, options);
  steps[1].status = 'done';
  steps[1].mode = mode;

  return {
    ok: true,
    priceData,
    draft,
    mode,
    steps,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  parsePriceNumber,
  formatPriceKr,
  collectPrices,
  generateDraft,
  generateRuleBasedDraft,
  runAnalysisPipeline,
  normalizeDraft
};
