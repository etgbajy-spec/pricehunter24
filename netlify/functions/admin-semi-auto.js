/**
 * Netlify Function: 반자동 모드 Firebase 동기화
 */
const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-api-key, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

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

function verifyAdminApiKey(event) {
  const apiKey = (event.headers['x-admin-api-key'] || event.headers['X-Admin-Api-Key'] || '').trim();
  const expected = process.env.ADMIN_API_SECRET || '';
  if (!expected) return { ok: false, status: 503, error: 'ADMIN_API_SECRET이 설정되지 않았습니다.' };
  if (apiKey !== expected) return { ok: false, status: 401, error: '관리자 API 키가 올바르지 않습니다.' };
  return { ok: true };
}

function sanitizeReqId(input) {
  let reqId = (input || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, '');
  return reqId;
}

async function loadRequestByReqId(db, reqId) {
  const docSnap = await db.collection('requests').doc(reqId).get();
  if (docSnap.exists) return { id: docSnap.id, data: docSnap.data() };
  const withHash = reqId.startsWith('PH-') ? '#' + reqId : reqId;
  let q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const auth = verifyAdminApiKey(event);
  if (!auth.ok) {
    return { statusCode: auth.status, headers, body: JSON.stringify({ error: auth.error }) };
  }

  if (!initAdmin()) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firebase Admin SDK 초기화 실패' }) };
  }

  const db = admin.firestore();
  const path = event.path || '';

  try {
    if (event.httpMethod === 'GET' || path.includes('pending-requests')) {
      let snap;
      try {
        snap = await db.collection('requests').orderBy('createdAt', 'desc').limit(80).get();
      } catch (e) {
        snap = await db.collection('requests').limit(80).get();
      }
      const items = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        if (d.purchaseReport || d.adminResponse) return;
        const st = String(d.status || '');
        if (st === '답변완료' || st === 'complete' || st === 'completed') return;
        items.push({
          id: doc.id,
          requestNumber: d.requestNumber || d.reqNum || doc.id,
          name: d.name || '',
          email: d.email || '',
          price: d.price || '',
          url: (d.urls && d.urls[0]) || d.url || '',
          urls: d.urls || [],
          description: d.desc || d.description || '',
          createdAt: d.createdAt?.toDate?.()?.toISOString?.() || d.date || null
        });
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, items }) };
    }

    if (event.httpMethod === 'POST' && path.includes('save-purchase-report')) {
      const body = JSON.parse(event.body || '{}');
      const { firebaseDocId, reqNum, report } = body;
      if (!report || typeof report !== 'object') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'report 객체가 필요합니다.' }) };
      }
      let docRef = null;
      if (firebaseDocId) {
        const ref = db.collection('requests').doc(String(firebaseDocId));
        const snap = await ref.get();
        if (snap.exists) docRef = ref;
      }
      if (!docRef && reqNum) {
        const loaded = await loadRequestByReqId(db, sanitizeReqId(reqNum));
        if (loaded) docRef = db.collection('requests').doc(loaded.id);
      }
      if (!docRef) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Firebase 의뢰 문서를 찾을 수 없습니다.' }) };
      }
      await docRef.update({
        purchaseReport: report,
        reportVersion: report.reportVersion || 'v2',
        adminResponse: {
          lowestPrice: report.price || '',
          seller: report.origin || '',
          additionalInfo: report.summary || '',
          link: report.link || '',
          purchaseVerdict: report.decision?.verdict || '',
          purchaseSummary: report.decision?.summary || '',
          confidence: report.decision?.confidence || ''
        },
        status: '답변완료',
        analysisStatus: 'published',
        responseDate: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, docId: docRef.id }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    console.error('admin-semi-auto error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '서버 오류' }) };
  }
};
