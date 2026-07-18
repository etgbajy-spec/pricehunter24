/**
 * POST /api/admin/purchase-confirm
 * 구매확정 → 적립금 available 전환
 */
const { admin, verifyAdminBearer, jsonHeaders } = require('./_admin-auth');

const headers = jsonHeaders();
const ADMIN_RELAX_FULFILLMENT = process.env.ADMIN_RELAX_FULFILLMENT === '1' || process.env.ADMIN_RELAX_FULFILLMENT === 'true';

function normalizeFulfillmentStatus(v) {
  const s = String(v || '').trim();
  return ['not_ordered', 'ordered', 'shipped', 'delivered'].includes(s) ? s : 'not_ordered';
}

function isPaidLike(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['paid', 'confirmed', 'done', '완료', '결제완료'].includes(s);
}

async function updatePointsLedgerForOrder(db, orderId) {
  const q = await db.collection('pointsLedger').where('orderId', '==', orderId).limit(50).get();
  if (q.empty) return 0;
  const batch = db.batch();
  q.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.type === 'EARN_PENDING' && data.status === 'pending') {
      batch.update(d.ref, {
        type: 'EARN_AVAILABLE',
        status: 'available',
        availableAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      batch.update(d.ref, { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
  return q.size;
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
  if (!orderId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'orderId가 필요합니다.' }) };
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
      return { statusCode: 400, headers, body: JSON.stringify({ error: '결제 완료 상태에서만 구매확정이 가능합니다.' }) };
    }
    if (pay.pointsStatus === 'available') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '이미 구매확정(적립금 확정) 처리된 주문입니다.' }) };
    }

    if (pay.requestDocId && !ADMIN_RELAX_FULFILLMENT) {
      const reqSnap = await db.collection('requests').doc(pay.requestDocId).get();
      const rd = reqSnap.exists ? reqSnap.data() || {} : {};
      if (normalizeFulfillmentStatus(rd.fulfillmentStatus) !== 'delivered') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: '배송완료(delivered) 단계로 올린 뒤에만 구매확정(적립금 확정)이 가능합니다.'
          })
        };
      }
    }

    const points = Number(pay.pointsPlanned || 0);
    await payRef.update({
      pointsStatus: 'available',
      pointsAvailableAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (pay.requestDocId) {
      await db.collection('requests').doc(pay.requestDocId).update({
        purchaseConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        pointsStatus: 'available',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await updatePointsLedgerForOrder(db, orderId);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, orderId, points }) };
  } catch (e) {
    console.error('purchase-confirm error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '구매확정 처리 중 오류가 발생했습니다.' }) };
  }
};
