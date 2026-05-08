/**
 * Netlify Function: 결제(상품) 정보 조회
 * - payment.html 에서 /api/payment-info?req=PH-... 로 호출
 * - Firestore requests 컬렉션에서 reqId 기반으로 조회
 */
const admin = require('firebase-admin');
 
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
        client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
      }),
      projectId,
    });
    return true;
  } catch (e) {
    console.error('❌ Firebase Admin init failed:', e.message);
    return false;
  }
}
 
function normalizeReqId(input) {
  let reqId = (input || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, '');
  if (!reqId || reqId.length > 80) return '';
  return reqId;
}
 
function toNumberPrice(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v);
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return NaN;
  return Number(digits);
}

async function loadRequest(db, reqId) {
  // 1) doc(id) 우선
  const docSnap = await db.collection('requests').doc(reqId).get();
  if (docSnap.exists) return docSnap.data() || null;
 
  // 2) 필드 호환 (requestNumber / reqNum)
  const withHash = reqId.startsWith('PH-') ? `#${reqId}` : reqId;
 
  let q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
  if (!q.empty) return q.docs[0].data() || null;
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return q.docs[0].data() || null;
 
  q = await db.collection('requests').where('reqNum', '==', reqId).limit(1).get();
  if (!q.empty) return q.docs[0].data() || null;
  q = await db.collection('requests').where('reqNum', '==', withHash).limit(1).get();
  if (!q.empty) return q.docs[0].data() || null;
 
  return null;
}
 
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
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
 
  const ok = initAdmin();
  if (!ok) {
    // 배포 환경에서 Admin env가 빠졌을 때의 명확한 메시지
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: '서버 설정이 완료되지 않아 결제 정보를 불러올 수 없습니다. (FIREBASE_ADMIN_*)' }),
    };
  }
 
  try {
    const db = admin.firestore();
    const data = await loadRequest(db, reqId);
    if (!data) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '해당 의뢰 정보를 찾을 수 없습니다.' }) };
    }
 
    // 의뢰가격(의뢰자가 찾은/입력한 가격) vs 최종가격(관리자 답변/확정 금액) 분리
    const requestPrice =
      toNumberPrice(
        data.requestPrice ??
        data.requestedPrice ??
        data.userPrice ??
        data.price ?? // request.html 에서는 price 로 저장됨
        data.productPrice ?? // 일부 문서는 productPrice 로 저장되어 있을 수 있음
        0
      );

    // 관리자 답변은 adminResponse 내부에 저장됨 (admin-dashboard.html)
    const adminFinal =
      toNumberPrice(
        data.adminResponse?.totalCost ??     // "총 비용" (배송/부대비 포함)
        data.adminResponse?.lowestPrice ??   // "최저가"
        data.totalAmount ??
        data.finalPrice ??
        data.finalAmount ??
        data.productPrice ??
        0
      );

    const finalPrice = adminFinal;

    // 최종 결제금액은 반드시 유효해야 함 (관리자 답변 기반)
    if (!Number.isFinite(finalPrice) || finalPrice <= 0 || finalPrice > 100000000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '유효한 결제 금액을 확인할 수 없습니다.' }) };
    }
 
    const name = String(data.productName ?? data.name ?? '상품').slice(0, 200);
    const origin = String(data.productOrigin ?? data.origin ?? '정보 없음').slice(0, 100);
    const method = (data.method === 'support' || data.purchaseMethod === 'support') ? 'support' : 'direct';
    const status = String(data.status || '').slice(0, 40);
 
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        name,
        origin,
        method,
        status,
        reqId,
        requestPrice: Number.isFinite(requestPrice) && requestPrice > 0 ? requestPrice : null,
        finalPrice,
      }),
    };
  } catch (e) {
    console.error('❌ payment-info error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '결제 정보를 불러오는 중 오류가 발생했습니다.' }) };
  }
};

