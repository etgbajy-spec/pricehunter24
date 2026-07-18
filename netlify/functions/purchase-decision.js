/**
 * POST /api/purchase-decision
 * 회원: 직접구매(direct) / 구매지원(support) 선택 기록
 */
const { admin, verifyUserBearer, jsonHeaders } = require('./_admin-auth');
const { loadRequestByReqId, normalizeReqId } = require('./_request-loader');

const headers = jsonHeaders();

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = await verifyUserBearer(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) };
  }

  const reqId = normalizeReqId(body.reqId);
  const decision = String(body.decision || '').toLowerCase();
  if (!reqId || (decision !== 'direct' && decision !== 'support')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'reqId와 decision(direct|support)이 필요합니다.' }) };
  }

  try {
    const db = admin.firestore();
    const loaded = await loadRequestByReqId(db, reqId);
    if (!loaded) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: '해당 의뢰를 찾을 수 없습니다.' }) };
    }

    const data = loaded.data || {};
    const ownerUid = data.userId || data.uid || '';
    const ownerEmail = String(data.email || data.userEmail || '').toLowerCase();
    const authEmail = String(auth.email || '').toLowerCase();
    const owns =
      (ownerUid && ownerUid === auth.uid) ||
      (ownerEmail && authEmail && ownerEmail === authEmail);
    if (!owns) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: '본인 의뢰만 선택할 수 있습니다.' }) };
    }

    const status = String(data.status || '');
    if (status && status !== '답변완료' && status !== '완료' && status !== 'completed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '관리자 답변 완료 이후에만 최종 선택이 가능합니다.' })
      };
    }

    await db.collection('requests').doc(loaded.id).update({
      purchaseDecision: decision,
      purchaseDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('purchase-decision error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: '최종 선택 기록 중 오류가 발생했습니다.' }) };
  }
};
