/**
 * POST /api/admin/payment-cancel
 * PortOne(아임포트) 우선, Toss 결제건은 TOSS_SECRET_KEY 사용
 */
const { admin, verifyAdminBearer, jsonHeaders } = require('./_admin-auth');

const headers = jsonHeaders();

function isPaidLike(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['paid', 'confirmed', 'done', '완료', '결제완료'].includes(s);
}

function normalizeFulfillmentStatus(v) {
  const s = String(v || '').trim();
  return ['not_ordered', 'ordered', 'shipped', 'delivered'].includes(s) ? s : 'not_ordered';
}

async function portOneGetToken(impKey, impSecret) {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: impKey, imp_secret: impSecret })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.response?.access_token) {
    throw new Error(data?.message || '포트원 토큰 발급 실패');
  }
  return data.response.access_token;
}

async function portOneCancel(accessToken, impUid, reason, cancelAmount) {
  const body = { reason };
  if (cancelAmount != null) body.amount = cancelAmount;
  const res = await fetch(`https://api.iamport.kr/payments/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: accessToken
    },
    body: JSON.stringify({
      imp_uid: impUid,
      reason,
      ...(cancelAmount != null ? { amount: cancelAmount } : {})
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 0) {
    throw new Error(data?.message || '포트원 결제 취소 실패');
  }
  return data.response || {};
}

async function tossCancel(paymentKey, reason, cancelAmount) {
  const secretKey = (process.env.TOSS_SECRET_KEY || '').trim();
  if (!secretKey) throw new Error('TOSS_SECRET_KEY가 없습니다.');
  const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(
      cancelAmount != null ? { cancelReason: reason, cancelAmount } : { cancelReason: reason }
    )
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || '토스 결제 취소 실패');
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = await verifyAdminBearer(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) };
  }

  const orderId = String(body.orderId || '').trim();
  const reason = String(body.reason || '고객 요청').slice(0, 200);
  const cancelAmount =
    body.cancelAmount != null && body.cancelAmount !== '' ? Number(body.cancelAmount) : null;
  const force = body.force === true || body.force === 'true';
  if (!orderId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'orderId가 필요합니다.' }) };
  }
  if (cancelAmount != null && (!Number.isFinite(cancelAmount) || cancelAmount <= 0)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'cancelAmount가 유효하지 않습니다.' }) };
  }

  try {
    const db = admin.firestore();
    const payRef = db.collection('payments').doc(orderId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '주문 정보를 찾을 수 없습니다.' }) };
    }
    const pay = paySnap.data() || {};
    if (!isPaidLike(pay.status)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '결제 완료 상태에서만 취소가 가능합니다.' }) };
    }

    if (pay.requestDocId) {
      const reqSnap = await db.collection('requests').doc(pay.requestDocId).get();
      const rd = reqSnap.exists ? reqSnap.data() || {} : {};
      const fs = normalizeFulfillmentStatus(rd.fulfillmentStatus);
      if (['ordered', 'shipped', 'delivered'].includes(fs) && !force) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: '외부몰 주문/배송이 진행된 건은 일반 취소가 제한됩니다.',
            needFulfillmentForce: true
          })
        };
      }
    }

    const provider = String(pay.provider || '').toLowerCase();
    const impUid = pay.impUid || pay.portone?.impUid || '';
    let cancelResult = null;
    let fullyCancelled = true;
    let cancelledTotal = cancelAmount != null ? cancelAmount : Number(pay.amount || 0);

    if (provider === 'portone' || impUid) {
      const impKey = String(process.env.PORTONE_IMP_KEY || '').trim();
      const impSecret = String(process.env.PORTONE_IMP_SECRET || '').trim();
      if (!impKey || !impSecret) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({ error: 'PORTONE_IMP_KEY/PORTONE_IMP_SECRET이 필요합니다.' })
        };
      }
      if (!impUid) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'impUid가 없어 취소할 수 없습니다.' }) };
      }
      const token = await portOneGetToken(impKey, impSecret);
      cancelResult = await portOneCancel(token, impUid, reason, cancelAmount);
      cancelledTotal = Number(cancelResult.cancel_amount || cancelledTotal);
      fullyCancelled = cancelledTotal >= Number(pay.amount || 0);
    } else if (pay.paymentKey) {
      cancelResult = await tossCancel(pay.paymentKey, reason, cancelAmount);
      cancelledTotal = Array.isArray(cancelResult.cancels)
        ? cancelResult.cancels.reduce((s, c) => s + Number(c.cancelAmount || 0), 0)
        : cancelledTotal;
      fullyCancelled = cancelledTotal >= Number(pay.amount || 0) && Number(pay.amount || 0) > 0;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '취소 가능한 결제 식별자(impUid/paymentKey)가 없습니다.' })
      };
    }

    await payRef.update({
      status: fullyCancelled ? 'cancelled' : 'partially_cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelReason: reason,
      cancelAmount: cancelledTotal,
      providerCancel: cancelResult || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (pay.requestDocId) {
      await db.collection('requests').doc(pay.requestDocId).update({
        paymentStatus: fullyCancelled ? 'cancelled' : 'partially_cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, orderId, fullyCancelled, cancelledTotal })
    };
  } catch (e) {
    console.error('payment-cancel error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message || '결제 취소 처리 중 오류가 발생했습니다.' })
    };
  }
};
