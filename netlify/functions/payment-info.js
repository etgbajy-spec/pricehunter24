/**
 * Netlify Function: 결제(상품) 정보 조회
 */
const admin = require('firebase-admin');
const { computePaymentAmounts, toNumberPrice } = require('../../payment-amount');
const { loadRequestByReqId, normalizeReqId } = require('./_request-loader');

function initAdmin() {
  if (admin.apps.length) return true;
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'pricehunter-99a1b';
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    if (!privateKey || !clientEmail) return false;

    admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id: projectId,
        private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: clientEmail,
        client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL
      }),
      projectId
    });
    return true;
  } catch (e) {
    console.error('❌ Firebase Admin init failed:', e.message);
    return false;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const reqId = normalizeReqId(event.queryStringParameters?.req);
  if (!reqId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '의뢰 번호(req)가 필요합니다.' }) };
  }

  if (!initAdmin()) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: '서버 설정이 완료되지 않아 결제 정보를 불러올 수 없습니다. (FIREBASE_ADMIN_*)' })
    };
  }

  try {
    const db = admin.firestore();
    const loaded = await loadRequestByReqId(db, reqId);
    if (!loaded) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '해당 의뢰 정보를 찾을 수 없습니다.' }) };
    }
    const data = loaded.data || {};

    const amounts = computePaymentAmounts(data, event.queryStringParameters?.method);
    if (!Number.isFinite(amounts.basePrice) || amounts.basePrice <= 0 || amounts.basePrice > 100000000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '유효한 결제 금액을 확인할 수 없습니다.' }) };
    }

    const requestPrice = toNumberPrice(
      data.requestPrice ?? data.requestedPrice ?? data.userPrice ?? data.price ?? data.productPrice ?? 0
    );

    const name = String(data.productName ?? data.name ?? '상품').slice(0, 200);
    const origin = String(
      data.purchaseReport?.origin ?? data.adminResponse?.seller ?? data.productOrigin ?? data.origin ?? '정보 없음'
    ).slice(0, 100);
    const status = String(data.status || '').slice(0, 40);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        name,
        origin,
        method: amounts.method,
        status,
        reqId,
        basePrice: amounts.basePrice,
        supportFee: amounts.supportFee,
        requestPrice: Number.isFinite(requestPrice) && requestPrice > 0 ? requestPrice : null,
        finalPrice: amounts.finalPrice,
        earnedPoints: amounts.earnedPoints
      })
    };
  } catch (e) {
    console.error('❌ payment-info error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '결제 정보를 불러오는 중 오류가 발생했습니다.' }) };
  }
};
