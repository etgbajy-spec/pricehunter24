/**
 * POST /api/admin/fulfillment-status
 */
const { admin, verifyAdminBearer, jsonHeaders } = require('./_admin-auth');

const headers = jsonHeaders();
const FULFILLMENT_STATUSES = ['not_ordered', 'ordered', 'shipped', 'delivered'];

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

  const requestDocId = String(body.requestDocId || '').trim();
  const fulfillmentStatus = String(body.fulfillmentStatus || '').trim();
  if (!requestDocId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'requestDocId가 필요합니다.' }) };
  }
  if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'fulfillmentStatus는 not_ordered|ordered|shipped|delivered 중 하나여야 합니다.' })
    };
  }

  try {
    const db = admin.firestore();
    const ref = db.collection('requests').doc(requestDocId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '의뢰를 찾을 수 없습니다.' }) };
    }
    await ref.update({
      fulfillmentStatus,
      fulfillmentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, requestDocId, fulfillmentStatus })
    };
  } catch (e) {
    console.error('fulfillment-status error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '진행 단계 저장 중 오류가 발생했습니다.' }) };
  }
};
