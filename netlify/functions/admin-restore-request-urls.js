/**
 * 삭제·누락된 의뢰 상품 링크 복구 (관리자 전용)
 * - desc·purchaseReport 등에서 URL 추출 후 url/urls/customerProductUrl 복원
 */
const admin = require('firebase-admin');
const RequestUrlUtils = require('../../request-url-utils');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ADMIN_EMAILS = [
  'admin@pricehunter.com',
  'manager@pricehunter.com',
  'staff@pricehunter.com',
  'q886654@naver.com'
];

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
        private_key: privateKey,
        client_email: clientEmail
      }),
      projectId
    });
    return true;
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
    return false;
  }
}

async function verifyAdminAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: '관리자 로그인이 필요합니다.' };
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email || '';
    if (decoded.role === 'admin' || ADMIN_EMAILS.includes(email)) return { ok: true, email };
    const adminDoc = await admin.firestore().collection('admins').doc(decoded.uid).get();
    if (adminDoc.exists()) {
      const data = adminDoc.data() || {};
      if (data.role === 'admin' || (data.permissions || []).includes('admin')) return { ok: true, email };
    }
    return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
  } catch (e) {
    return { ok: false, status: 401, error: '인증 토큰이 유효하지 않습니다.' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!initAdmin()) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firebase Admin SDK 초기화 실패' }) };
  }

  const auth = await verifyAdminAuth(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }

  try {
    const db = admin.firestore();
    const snap = await db.collection('requests').get();
    let restored = 0;
    let skipped = 0;
    let notFound = 0;
    let batch = db.batch();
    let batchCount = 0;

    async function commitBatch() {
      if (batchCount === 0) return;
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      if (RequestUrlUtils.hasStoredRequestUrls(data)) {
        skipped += 1;
        continue;
      }
      const patch = RequestUrlUtils.buildUrlRestorePatch(data);
      if (!patch) {
        notFound += 1;
        continue;
      }
      batch.update(docSnap.ref, Object.assign({}, patch, {
        urlRestoredAt: admin.firestore.FieldValue.serverTimestamp(),
        urlRestoredFrom: 'derived'
      }));
      batchCount += 1;
      restored += 1;
      if (batchCount >= 400) await commitBatch();
    }

    await commitBatch();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        restored,
        skipped,
        notFound,
        total: snap.size
      })
    };
  } catch (e) {
    console.error('admin-restore-request-urls error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '복구 실패' }) };
  }
};
