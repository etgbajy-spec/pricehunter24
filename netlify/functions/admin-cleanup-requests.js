/**
 * 의뢰(requests) 참고 URL 제거 · additionalInfo 통일 (관리자 전용)
 */
const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const UNIFIED_ADDITIONAL_INFO =
  'PriceHunter 검증팀이 의뢰하신 제품의 가격과 구매 조건을 검토한 결과입니다.\n\n' +
  '최저가·제품·배송·판매처·주의사항을 리포트에서 확인하신 뒤 구매를 검토해 주세요. ' +
  '동일 제품·동일 조건 여부와 배송·구성품은 최종 구매 전 판매처 페이지에서 한 번 더 확인하시는 것을 권장합니다.';

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

function stripReferenceUrlLines(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .split('\n')
    .filter((line) => !/^\s*참고\s*URL\s*:/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildUpdates(data) {
  const updates = {};
  if (Array.isArray(data.urls) && data.urls.length > 0) updates.urls = [];
  if (data.url) updates.url = admin.firestore.FieldValue.delete();

  ['description', 'productDescription'].forEach((field) => {
    if (!data[field]) return;
    const cleaned = stripReferenceUrlLines(data[field]);
    if (cleaned !== data[field]) updates[field] = cleaned || '—';
  });

  if (data.adminResponse && typeof data.adminResponse === 'object') {
    const next = { ...data.adminResponse, additionalInfo: UNIFIED_ADDITIONAL_INFO };
    if (JSON.stringify(next) !== JSON.stringify(data.adminResponse)) updates.adminResponse = next;
  }

  if (data.purchaseReport && typeof data.purchaseReport === 'object') {
    const pr = { ...data.purchaseReport };
    let prChanged = false;
    if (pr.evidenceNotes) {
      const cleanedNotes = stripReferenceUrlLines(pr.evidenceNotes);
      if (cleanedNotes !== pr.evidenceNotes) {
        pr.evidenceNotes = cleanedNotes;
        prChanged = true;
      }
    }
    if (prChanged) updates.purchaseReport = pr;
  }

  return updates;
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
    let updated = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      const updates = buildUpdates(docSnap.data());
      if (!Object.keys(updates).length) continue;
      batch.update(docSnap.ref, updates);
      batchCount += 1;
      updated += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount) await batch.commit();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, updated, total: snap.size })
    };
  } catch (e) {
    console.error('admin-cleanup-requests error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '정리 실패' }) };
  }
};
