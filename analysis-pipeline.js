/**
 * PriceHunter AI 분석 파이프라인 (Phase 2)
 * 가격 수집 → AI 초안 생성
 */
'use strict';

const ReportPresets = require('./report-presets');

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

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function cleanProductTitle(raw) {
  if (!raw) return null;
  let t = decodeHtmlEntities(raw).trim();
  t = t.replace(/\s*[-|:|]\s*(쿠팡|Coupang|네이버|Naver|스마트스토어|11번가|G마켓|옥션|Gmarket|Auction).*$/i, '');
  t = t.replace(/\s*:\s*.*$/, '').trim();
  return t.slice(0, 200) || null;
}

function guessProductNameFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = decodeURIComponent(u.pathname)
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean);
    if (host.includes('coupang') || host.includes('naver') || host.includes('11st') ||
        host.includes('gmarket') || host.includes('auction')) {
      const slug = parts.find((p) => /[가-힣a-zA-Z]/.test(p) && !/^\d+$/.test(p) && p.length > 2);
      if (slug) return slug.replace(/[-_+]/g, ' ').slice(0, 200);
    }
  } catch (e) { /* ignore */ }
  return null;
}

function extractMetaContent(html, prop) {
  const re = new RegExp(
    '<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)["\']',
    'i'
  );
  const m1 = html.match(re);
  if (m1) return m1[1];
  const re2 = new RegExp(
    '<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + prop + '["\']',
    'i'
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function extractFromJsonLd(html) {
  const result = { title: null, price: null };
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks) return result;
  for (const block of blocks) {
    const inner = (block.match(/<script[^>]*>([\s\S]*?)<\/script>/i) || [])[1];
    if (!inner) continue;
    try {
      let data = JSON.parse(inner.trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const nodes = item['@graph'] ? item['@graph'] : [item];
        for (const node of nodes) {
          if (!node || typeof node !== 'object') continue;
          const type = String(node['@type'] || '').toLowerCase();
          if (!result.title && node.name) result.title = String(node.name);
          if (type.includes('product') && node.name) result.title = String(node.name);
          const offers = node.offers;
          const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
          for (const offer of offerList) {
            if (!offer) continue;
            const p = parsePriceNumber(offer.price || offer.lowPrice || offer.highPrice);
            if (p) result.price = result.price ? Math.min(result.price, p) : p;
          }
          if (!result.price && node.lowPrice) {
            const p = parsePriceNumber(node.lowPrice);
            if (p) result.price = p;
          }
        }
      }
    } catch (e) { /* ignore invalid JSON-LD */ }
  }
  return result;
}

function extractMarketplacePrice(html, url) {
  const u = (url || '').toLowerCase();
  const jsonPatterns = [
    /"salePrice"\s*:\s*(\d{3,9})/g,
    /"discountedSalePrice"\s*:\s*(\d{3,9})/g,
    /"finalPrice"\s*:\s*(\d{3,9})/g,
    /"lowPrice"\s*:\s*(\d{3,9})/g,
    /"price"\s*:\s*(\d{3,9})/g,
    /"originPrice"\s*:\s*(\d{3,9})/g
  ];
  const prices = [];
  for (const re of jsonPatterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const n = parseInt(m[1], 10);
      if (n >= 1000 && n <= 100000000) prices.push(n);
    }
  }
  if (prices.length) return Math.min(...prices);

  if (u.includes('naver') || u.includes('smartstore')) {
    const naver = html.match(/"dispName"\s*:\s*"([^"]{2,200})"/);
    if (naver) return { title: naver[1], price: null };
  }
  return null;
}

function extractPriceFromHtml(html, url) {
  const ogPrice =
    extractMetaContent(html, 'product:price:amount') ||
    extractMetaContent(html, 'og:price:amount') ||
    extractMetaContent(html, 'product:price');
  if (ogPrice) {
    const n = parsePriceNumber(ogPrice);
    if (n) return n;
  }

  const jsonLd = extractFromJsonLd(html);
  if (jsonLd.price) return jsonLd.price;

  const mp = extractMarketplacePrice(html, url);
  if (mp && typeof mp === 'number') return mp;

  const patterns = [
    /(?:판매가|할인가|최종가|현재가|salePrice|priceAmount)[^0-9]{0,30}([0-9][0-9,]{2,})/gi,
    /₩\s*([0-9][0-9,]{2,})/g,
    /([0-9][0-9,]{2,})\s*원/g
  ];
  const found = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const n = parsePriceNumber(m[1]);
      if (n && n >= 1000 && n <= 100000000) found.push(n);
    }
  }
  if (found.length) return Math.min(...found);
  return null;
}

function extractTitleFromHtml(html, url) {
  const og =
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title') ||
    extractMetaContent(html, 'title');
  if (og) return cleanProductTitle(og);
  const titleTag = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1];
  if (titleTag) return cleanProductTitle(titleTag);
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd.title) return cleanProductTitle(jsonLd.title);
  const mp = extractMarketplacePrice(html, url);
  if (mp && typeof mp === 'object' && mp.title) return cleanProductTitle(mp.title);
  const disp = html.match(/"dispName"\s*:\s*"([^"]{2,200})"/);
  if (disp) return cleanProductTitle(disp[1]);
  const prodName = html.match(/"productName"\s*:\s*"([^"]{2,200})"/);
  if (prodName) return cleanProductTitle(prodName[1]);
  return guessProductNameFromUrl(url);
}

async function fetchPageMeta(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      },
      redirect: 'follow'
    });
    clearTimeout(timer);
    const html = res.ok ? await res.text() : '';
    const title = html ? extractTitleFromHtml(html, url) : guessProductNameFromUrl(url);
    const priceFromHtml = html ? extractPriceFromHtml(html, url) : null;
    const blocked =
      !res.ok ||
      (html.length < 800 && !title && !priceFromHtml) ||
      /access denied|robot|captcha|봇/i.test(html.slice(0, 3000));
    return {
      url,
      status: res.status,
      title: title || guessProductNameFromUrl(url),
      detectedPrice: priceFromHtml,
      marketplace: detectMarketplace(url),
      fetchBlocked: blocked,
      htmlLength: html.length
    };
  } catch (err) {
    return {
      url,
      error: err.message || 'fetch_failed',
      title: guessProductNameFromUrl(url),
      marketplace: detectMarketplace(url),
      fetchBlocked: true
    };
  }
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
  if (ctx.referencePrice) parts.push(`참고가 ${formatPriceKr(ctx.referencePrice)}`);
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
  const productName = priceData.productName || requestData.name || '해당 제품';
  const adminProvided = !!priceData.adminProvided;

  let verdict = 'hold';
  if (lowest && requested && lowest < requested * 0.9) {
    verdict = 'buy';
  } else if (reference && requested && reference > requested * 1.15) {
    verdict = 'skip';
  }

  const trend = priceData.trend || (verdict === 'buy' ? 'down' : verdict === 'skip' ? 'up' : 'stable');
  const verifiedPrice = formatPriceKr(lowest || reference || requested || '');
  const purchaseLink = adminProvided
    ? (priceData.link || priceData.referenceUrl || requestData.url || '')
    : (priceData.referenceUrl || requestData.url || '');
  const sellerLabel = adminProvided && priceData.sellerName
    ? priceData.sellerName
    : (marketplace?.name ? `${marketplace.name} / PriceHunter 검증` : 'PriceHunter 검증');

  const base = normalizeDraft({
    reportVersion: 'v2',
    price: verifiedPrice,
    origin: sellerLabel,
    summary: `<p><strong>${productName}</strong> — PriceHunter 검증팀이 ${verifiedPrice} 수준의 최저가를 확인했습니다.</p>`,
    link: purchaseLink,
    decision: { verdict },
    priceAnalysis: {
      currentPrice: formatPriceKr(reference || requested || ''),
      lowestPrice: verifiedPrice,
      avgPrice: formatPriceKr(priceData.avgPrice || reference || requested || ''),
      requestedPrice: formatPriceKr(requested || ''),
      trend
    }
  });

  return ReportPresets.enrichDraft(base, {
    productName,
    lowestPrice: lowest || reference || requested,
    requestedPrice: requested,
    sellerName: base.origin,
    referenceUrl: purchaseLink,
    description: requestData.description || requestData.desc || '',
    priceSummary: priceData.summary || ''
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

  draft = ReportPresets.enrichDraft(draft, {
    productName: requestData.name || requestData.productName,
    lowestPrice: parsePriceNumber(draft.price) || priceData.lowestPrice,
    requestedPrice: priceData.requestedPrice,
    sellerName: draft.origin,
    referenceUrl: draft.link || requestData.url,
    description: requestData.description || requestData.desc,
    priceSummary: priceData.summary
  });

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

const VERDICT_LABELS = {
  buy: { label: '구매 가능성 있음', tone: 'positive' },
  hold: { label: '보류 · 정밀 검토 권장', tone: 'caution' },
  skip: { label: '주의 · 정밀 검토 권장', tone: 'warning' }
};

function assessVerifiedReportNeed(priceData, draft, urlMeta, pageMeta) {
  const reasons = [];
  if (urlMeta?.flagged) reasons.push('등록되지 않은 쇼핑몰 — 판매처 확인 필요');
  const hasPrice = !!(priceData.referencePrice || priceData.requestedPrice);
  if (!hasPrice && pageMeta?.fetchBlocked) {
    reasons.push('쇼핑몰 보안 정책으로 자동 가격 수집 불가 — 정밀 리포트에서 확인');
  } else if (!hasPrice) {
    reasons.push('페이지에서 가격을 확인하지 못했습니다');
  }
  const trust = priceData.marketplace?.trust || 70;
  if (trust < 75) reasons.push('해외·직구 판매처 — 배송·관세 확인 필요');
  const verdict = draft.decision?.verdict || 'hold';
  if (verdict === 'skip' || verdict === 'hold') {
    reasons.push('옵션·구성품·실구매가 정밀 검증 권장');
  }
  const confidence = Number(draft.decision?.confidence) || 0;
  if (confidence > 0 && confidence < 65) reasons.push('1차 스캔 확신도가 낮습니다');
  reasons.push('배송비·카드할인·멤버십 포함 실구매가는 정밀 리포트에서 확인');
  return {
    needsVerifiedReport: true,
    urgency: urlMeta?.flagged || !priceData.referencePrice || verdict === 'skip' ? 'high' : 'normal',
    reasons: [...new Set(reasons)]
  };
}

/**
 * Tier 0 — Quick Scan (공개 API용, AI 비용 절감을 위해 규칙 기반 우선)
 */
async function quickScan(input, options) {
  options = options || {};
  const url = String(input?.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: '유효한 상품 URL이 필요합니다.' };
  }

  const clientPrice = parsePriceNumber(input?.price);
  let pageMeta = null;
  try {
    pageMeta = await fetchPageMeta(url);
  } catch (e) {
    pageMeta = { url, error: e.message || 'fetch_failed', fetchBlocked: true, title: guessProductNameFromUrl(url) };
  }

  const productName = (
    String(input?.productName || input?.name || '').trim() ||
    pageMeta?.title ||
    guessProductNameFromUrl(url) ||
    detectMarketplace(url)?.name + ' 상품'
  ).slice(0, 200);

  const detectedPrice = clientPrice || pageMeta?.detectedPrice || null;

  const requestData = {
    name: productName,
    url,
    price: detectedPrice
  };

  const priceData = await collectPrices(requestData);
  const { draft, mode } = await generateDraft(requestData, priceData, {
    skipAi: options.skipAi !== false
  });

  const verdict = draft.decision?.verdict || 'hold';
  const verdictInfo = VERDICT_LABELS[verdict] || VERDICT_LABELS.hold;
  const verification = assessVerifiedReportNeed(priceData, draft, input?.urlMeta || null, pageMeta);
  const hasDetectedPrice = !!(priceData.referencePrice || priceData.requestedPrice);
  const fetchBlocked = !!(pageMeta?.fetchBlocked && !clientPrice);

  return {
    ok: true,
    tier: 0,
    scan: {
      productName: priceData.productName || productName,
      url,
      marketplace: priceData.marketplace,
      detectedPrice: priceData.referencePrice || clientPrice || null,
      requestedPrice: priceData.requestedPrice,
      lowestPrice: priceData.lowestPrice,
      trend: priceData.trend,
      priceSummary: priceData.summary,
      verdict,
      verdictLabel: verdictInfo.label,
      verdictTone: verdictInfo.tone,
      confidence: draft.decision?.confidence || null,
      summary: draft.decision?.summary || draft.summary || '',
      oneLineNote: buildQuickScanNote(priceData, verdict, fetchBlocked),
      needsVerifiedReport: verification.needsVerifiedReport,
      verificationUrgency: verification.urgency,
      verificationReasons: verification.reasons,
      pageFetchOk: hasDetectedPrice || !!(pageMeta?.title && !pageMeta?.fetchBlocked),
      fetchBlocked,
      priceFromClient: !!clientPrice,
      mode
    },
    disclaimer:
      '1차 Quick Scan 결과입니다. 배송·옵션·구성품·판매처 검증은 정밀 리포트(24시간 이내)에서 제공됩니다.',
    scannedAt: new Date().toISOString()
  };
}

function buildQuickScanNote(priceData, verdict, fetchBlocked) {
  const mp = priceData.marketplace?.name;
  const parts = [];
  if (mp) parts.push(mp);
  if (priceData.referencePrice || priceData.requestedPrice) {
    parts.push(formatPriceKr(priceData.referencePrice || priceData.requestedPrice) + ' 확인');
  } else if (fetchBlocked) {
    parts.push('자동 수집 제한 — 입력 가격 또는 정밀 리포트 이용');
  }
  if (verdict === 'buy') parts.push('정밀 리포트로 최종 확인 권장');
  else if (verdict === 'skip') parts.push('더 나은 대안이 있을 수 있습니다');
  else parts.push('정밀 리포트로 확인을 권장합니다');
  return parts.join(' · ') || '정밀 리포트 의뢰를 권장합니다';
}

module.exports = {
  parsePriceNumber,
  formatPriceKr,
  detectMarketplace,
  fetchPageMeta,
  collectPrices,
  generateDraft,
  generateRuleBasedDraft,
  runAnalysisPipeline,
  normalizeDraft,
  quickScan,
  VERDICT_LABELS
};
