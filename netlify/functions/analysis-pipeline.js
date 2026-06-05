/**
 * Netlify Function: AI 분석 파이프라인
 */
const pipeline = require('../../analysis-pipeline');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-key, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function verifyAdminApiKey(event) {
  const apiKey = (event.headers['x-admin-api-key'] || event.headers['X-Admin-Api-Key'] || '').trim();
  const expected = process.env.ADMIN_API_SECRET || '';
  if (!expected) {
    return { ok: false, status: 503, error: 'ADMIN_API_SECRET이 설정되지 않았습니다.' };
  }
  if (apiKey !== expected) {
    return { ok: false, status: 401, error: '관리자 API 키가 올바르지 않습니다.' };
  }
  return { ok: true };
}

function validateRequest(body) {
  const request = body?.request;
  if (!request || typeof request !== 'object') {
    return { error: 'request 객체가 필요합니다.' };
  }
  const name = String(request.name || request.productName || '').trim();
  if (!name || name.length > 200) {
    return { error: '유효한 제품명이 필요합니다.' };
  }
  return { request };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAdminApiKey(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const validated = validateRequest(body);
    if (validated.error) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: validated.error }) };
    }

    const path = event.path || '';
    let result;

    if (path.includes('collect-prices')) {
      const priceData = await pipeline.collectPrices(validated.request);
      result = { ok: true, priceData };
    } else if (path.includes('generate-draft')) {
      let priceData = body.priceData;
      if (!priceData) priceData = await pipeline.collectPrices(validated.request);
      const { draft, mode } = await pipeline.generateDraft(validated.request, priceData, body.options || {});
      result = { ok: true, draft, mode, priceData };
    } else {
      result = await pipeline.runAnalysisPipeline(validated.request, body.options || {});
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('analysis-pipeline function error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message || '분석 파이프라인 오류' })
    };
  }
};
