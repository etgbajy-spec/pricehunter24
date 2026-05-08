/**
 * Netlify Function: PortOne(아임포트) 결제 검증
 * - payment-success.html 에서 /api/portone/verify?imp_uid=...&merchant_uid=... 로 호출
 * - (권장) Firestore의 의뢰 최종금액과 PortOne 결제금액을 대조
 *
 * 필요 환경변수:
 * - FIREBASE_ADMIN_* (payment-info.js와 동일)
 * - PORTONE_IMP_KEY / PORTONE_IMP_SECRET   (아임포트 REST API 키/시크릿)
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

async function loadRequest(db, reqId) {
  const docSnap = await db.collection('requests').doc(reqId).get();
  if (docSnap.exists) return { id: docSnap.id, data: docSnap.data() || {} };

  const withHash = reqId.startsWith('PH-') ? `#${reqId}` : reqId;
  let q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };

  q = await db.collection('requests').where('reqNum', '==', reqId).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };
  q = await db.collection('requests').where('reqNum', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() || {} };

  return null;
}

function parseReqIdFromMerchantUid(merchantUid) {
  const s = String(merchantUid || '');
  // payment.html에서 PH__<REQID>__<timestamp> 포맷으로 생성
  const m = s.match(/^PH__([^_]+)__(\d{8,})$/);
  if (!m) return '';
  return normalizeReqId(m[1]);
}

async function portOneGetToken(impKey, impSecret) {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: impKey, imp_secret: impSecret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.response?.access_token) {
    const msg = data?.message || '포트원 토큰 발급 실패';
    const code = data?.code || res.status;
    throw new Error(`${msg} (code=${code})`);
  }
  return data.response.access_token;
}

async function portOneGetPayment(accessToken, impUid) {
  const res = await fetch(`https://api.iamport.kr/payments/${encodeURIComponent(impUid)}`, {
    method: 'GET',
    headers: { 'Authorization': accessToken },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.response) {
    const msg = data?.message || '포트원 결제 조회 실패';
    const code = data?.code || res.status;
    throw new Error(`${msg} (code=${code})`);
  }
  return data.response;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const impUid = String(event.queryStringParameters?.imp_uid || '').trim();
  const merchantUid = String(event.queryStringParameters?.merchant_uid || '').trim();
  if (!impUid || !merchantUid) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'imp_uid와 merchant_uid가 필요합니다.' }) };
  }

  const impKey = String(process.env.PORTONE_IMP_KEY || '').trim();
  const impSecret = String(process.env.PORTONE_IMP_SECRET || '').trim();
  if (!impKey || !impSecret) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: '서버 결제 설정이 완료되지 않았습니다. (PORTONE_IMP_KEY/PORTONE_IMP_SECRET)' }) };
  }

  const ok = initAdmin();
  if (!ok) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: '서버 설정이 완료되지 않았습니다. (FIREBASE_ADMIN_*)' }) };
  }

  try {
    const accessToken = await portOneGetToken(impKey, impSecret);
    const payment = await portOneGetPayment(accessToken, impUid);

    // 기본 검증: 결제 매칭
    if (String(payment.merchant_uid || '') !== merchantUid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'merchant_uid가 일치하지 않습니다.' }) };
    }
    if (String(payment.status || '') !== 'paid') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '결제가 완료(paid) 상태가 아닙니다.', status: payment.status }) };
    }

    // 의뢰 최종 금액과 대조 (가능한 경우)
    const reqId = parseReqIdFromMerchantUid(merchantUid);
    const db = admin.firestore();
    let expectedAmount = null;
    let reqDocId = null;
    if (reqId) {
      const loaded = await loadRequest(db, reqId);
      if (loaded) {
        reqDocId = loaded.id;
        const rd = loaded.data || {};
        const finalPrice = Number(rd.totalAmount ?? rd.finalPrice ?? rd.finalAmount ?? rd.productPrice ?? rd.price ?? 0);
        if (Number.isFinite(finalPrice) && finalPrice > 0) expectedAmount = finalPrice;
      }
    }

    const paidAmount = Number(payment.amount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '유효한 결제 금액을 확인할 수 없습니다.' }) };
    }
    if (expectedAmount != null && paidAmount !== expectedAmount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '결제 금액이 의뢰 최종금액과 일치하지 않습니다.', paidAmount, expectedAmount }),
      };
    }

    // 배송/통관 정보 저장(가능한 경우): custom_data는 결제 객체에 포함될 수 있음
    const custom = payment.custom_data && typeof payment.custom_data === 'object' ? payment.custom_data : null;
    if (reqDocId && custom) {
      const update = {
        paymentStatus: 'paid',
        portone: {
          impUid,
          merchantUid,
          paidAmount,
          paidAt: payment.paid_at || null,
          pgProvider: payment.pg_provider || null,
          payMethod: payment.pay_method || null,
        },
        shipping: {
          recipientName: custom.recipientName || null,
          recipientPhone: custom.recipientPhone || null,
          shippingAddress: custom.shippingAddress || null,
          shippingNote: custom.shippingNote || null,
          customsId: custom.customsId || null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('requests').doc(reqDocId).update(update).catch(() => {});
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        impUid,
        merchantUid,
        paidAmount,
        expectedAmount,
        reqId: reqId || null,
        name: payment.name || null,
        payMethod: payment.pay_method || null,
        pgProvider: payment.pg_provider || null,
        buyerName: payment.buyer_name || null,
      }),
    };
  } catch (e) {
    console.error('❌ portone-verify error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '결제 검증 중 오류가 발생했습니다.' }) };
  }
};

