/**
 * Netlify Function: Tier 0 Quick Scan (공개)
 */
const pipeline = require('../../analysis-pipeline');
const { validateProductLinkUrl } = require('../../url-safety');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const url = String(body.url || '').trim();
    if (!url || url.length < 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '쇼핑몰 상품 링크를 입력해주세요.' })
      };
    }

    const urlCheck = validateProductLinkUrl(url);
    if (!urlCheck.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: urlCheck.error }) };
    }

    const result = await pipeline.quickScan({
      url: urlCheck.normalized,
      price: body.price,
      productName: String(body.productName || '').trim(),
      urlMeta: { flagged: urlCheck.flagged }
    });

    if (!result.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: result.error }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('quick-scan function error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message || 'Quick Scan 오류' })
    };
  }
};
