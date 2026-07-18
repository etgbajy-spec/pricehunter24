/**
 * Netlify Function: PortOne(아임포트) 결제 검증
 */
const admin = require('firebase-admin');
const { computePaymentAmounts, parseReqIdFromMerchantUid, computeSupportFee } = require('../../payment-amount');
const { loadRequestByReqId } = require('./_request-loader');

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

async function portOneGetToken(impKey, impSecret) {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: impKey, imp_secret: impSecret })
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
    headers: { Authorization: accessToken }
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
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const impUid = String(event.queryStringParameters?.imp_uid || '').trim();
  const merchantUid = String(event.queryStringParameters?.merchant_uid || '').trim();
  if (!impUid || !merchantUid) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'imp_uid와 merchant_uid가 필요합니다.' }) };
  }

  const impKey = String(process.env.PORTONE_IMP_KEY || '').trim();
  const impSecret = String(process.env.PORTONE_IMP_SECRET || '').trim();
  if (!impKey || !impSecret) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: '서버 결제 설정이 완료되지 않았습니다. (PORTONE_IMP_KEY/PORTONE_IMP_SECRET)' })
    };
  }

  if (!initAdmin()) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: '서버 설정이 완료되지 않았습니다. (FIREBASE_ADMIN_*)' })
    };
  }

  try {
    const accessToken = await portOneGetToken(impKey, impSecret);
    const payment = await portOneGetPayment(accessToken, impUid);

    if (String(payment.merchant_uid || '') !== merchantUid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'merchant_uid가 일치하지 않습니다.' }) };
    }
    if (String(payment.status || '') !== 'paid') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '결제가 완료(paid) 상태가 아닙니다.', status: payment.status })
      };
    }

    let custom = null;
    if (payment.custom_data && typeof payment.custom_data === 'object') {
      custom = payment.custom_data;
    } else if (typeof payment.custom_data === 'string') {
      try {
        custom = JSON.parse(payment.custom_data);
      } catch (e) {
        custom = null;
      }
    }

    const reqId =
      parseReqIdFromMerchantUid(merchantUid) ||
      (custom && custom.reqId ? String(custom.reqId).replace(/^#+/, '') : '');
    const db = admin.firestore();
    let expectedAmount = null;
    let reqDocId = null;
    let amounts = null;
    if (reqId) {
      const loaded = await loadRequestByReqId(db, reqId);
      if (loaded) {
        reqDocId = loaded.id;
        const methodHint = (custom && custom.method) || (loaded.data.purchaseDecision === 'support' ? 'support' : 'support');
        amounts = computePaymentAmounts(loaded.data || {}, methodHint);
        if (Number.isFinite(amounts.finalPrice) && amounts.finalPrice > 0) {
          expectedAmount = amounts.finalPrice;
        }
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
        body: JSON.stringify({
          error: '결제 금액이 의뢰 최종금액과 일치하지 않습니다.',
          paidAmount,
          expectedAmount
        })
      };
    }

    const supportFee = amounts ? amounts.supportFee : computeSupportFee(Math.round(paidAmount / 1.01));
    const pointsPlanned = amounts ? amounts.earnedPoints : supportFee;

    await db.collection('payments').doc(merchantUid).set(
      {
        orderId: merchantUid,
        reqId: reqId || null,
        requestDocId: reqDocId,
        orderName: payment.name || '',
        amount: paidAmount,
        currency: 'KRW',
        provider: 'portone',
        status: 'paid',
        impUid,
        merchantUid,
        supportFeeAmount: supportFee,
        pointsPlanned,
        pointsStatus: 'planned',
        payMethod: payment.pay_method || null,
        pgProvider: payment.pg_provider || null,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    if (reqDocId) {
      const update = {
        paymentStatus: 'paid',
        paymentOrderId: merchantUid,
        latestOrderId: merchantUid,
        purchaseDecision: 'support',
        fulfillmentStatus: 'not_ordered',
        fulfillmentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        portone: {
          impUid,
          merchantUid,
          paidAmount,
          paidAt: payment.paid_at || null,
          pgProvider: payment.pg_provider || null,
          payMethod: payment.pay_method || null
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (custom) {
        update.shipping = {
          recipientName: custom.recipientName || null,
          recipientPhone: custom.recipientPhone || null,
          shippingAddress: custom.shippingAddress || null,
          shippingNote: custom.shippingNote || null,
          customsId: custom.customsId || null
        };
      }
      await db.collection('requests').doc(reqDocId).update(update).catch(() => {});

      if (pointsPlanned > 0) {
        const existing = await db.collection('pointsLedger').where('orderId', '==', merchantUid).limit(1).get();
        if (existing.empty) {
          await db.collection('pointsLedger').add({
            orderId: merchantUid,
            reqId: reqId || null,
            requestDocId: reqDocId,
            type: 'EARN_PENDING',
            points: pointsPlanned,
            status: 'pending',
            reason: '구매대행 결제 적립(구매확정 후 확정)',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
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
        buyerName: payment.buyer_name || null
      })
    };
  } catch (e) {
    console.error('❌ portone-verify error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '결제 검증 중 오류가 발생했습니다.' }) };
  }
};
