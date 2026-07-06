/**
 * Netlify Function: POST /api/notify-customer-report-complete
 * 관리자가 리포트 저장 후 고객에게 이메일·알림톡 발송
 */
const { admin, initAdmin } = require('./_firebase-admin');
const { notifyCustomerReportComplete } = require('../../notification-dispatch');
const { buildNotifyParamsFromRequestId } = require('../../notification-request-loader');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function verifyAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: '인증이 필요합니다.' };
  try {
    const decoded = await admin.auth().verifyIdToken(m[1].trim());
    const adminSnap = await admin.firestore().collection('admins').doc(decoded.uid).get();
    if (!adminSnap.exists) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
    const adminData = adminSnap.data() || {};
    const ok = adminData.role === 'admin' ||
      (Array.isArray(adminData.permissions) && adminData.permissions.includes('admin'));
    if (!ok) return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    return { ok: false, status: 401, error: '인증에 실패했습니다.' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!initAdmin()) {
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'Firebase Admin SDK 초기화 실패' }) };
  }

  const auth = await verifyAdmin(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ success: false, error: auth.error }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: '잘못된 요청 형식입니다.' }) };
  }

  const requestId = body.requestId || body.id;
  if (!requestId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'requestId가 필요합니다.' }) };
  }

  try {
    const db = admin.firestore();
    let notifyParams = await buildNotifyParamsFromRequestId(db, requestId);

    if (!notifyParams && body.toEmail) {
      notifyParams = Object.assign({}, body, { toEmail: body.toEmail });
    }

    if (!notifyParams || !notifyParams.toEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: '의뢰 또는 회원 정보에 유효한 이메일이 없습니다.' })
      };
    }

    const result = await notifyCustomerReportComplete(notifyParams);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(Object.assign({ success: result.success }, result))
    };
  } catch (error) {
    console.error('notify-customer-report-complete error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || '알림 발송 실패' })
    };
  }
};
