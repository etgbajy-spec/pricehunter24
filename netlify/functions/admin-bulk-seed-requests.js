/**
 * Netlify Function: PH-20260505345 템플릿으로 5/7~6/7 의뢰 일괄 추가
 */
const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const SOURCE_REQ = 'PH-20260505345';
const ADMIN_EMAILS = [
  'admin@pricehunter.com',
  'manager@pricehunter.com',
  'staff@pricehunter.com',
  'q886654@naver.com'
];

const BULK_REQUEST_SEED_SCHEDULE = [
  { date: '2026-05-07', names: ['강유서', '윤지호'] },
  { date: '2026-05-08', names: ['임수진'] },
  { date: '2026-05-09', names: ['한지우'] },
  { date: '2026-05-11', names: ['송서연', '최민우'] },
  { date: '2026-05-12', names: ['오민석'] },
  { date: '2026-05-13', names: ['조하빈'] },
  { date: '2026-05-14', names: ['신유아', '장현재'] },
  { date: '2026-05-16', names: ['노지윤'] },
  { date: '2026-05-17', names: ['서유찬'] },
  { date: '2026-05-18', names: ['유도준', '문서영', '김도준'] },
  { date: '2026-05-20', names: ['이나림'] },
  { date: '2026-05-21', names: ['박하율', '최도겸'] },
  { date: '2026-05-22', names: ['정지후'] },
  { date: '2026-05-23', names: ['강아린'] },
  { date: '2026-05-25', names: ['윤시성', '임도하'] },
  { date: '2026-05-26', names: ['한예준'] },
  { date: '2026-05-27', names: ['송하빈'] },
  { date: '2026-05-29', names: ['오유진', '조시원'] },
  { date: '2026-05-30', names: ['신건우'] },
  { date: '2026-05-31', names: ['장서희'] },
  { date: '2026-06-01', names: ['노하솔', '이지현'] },
  { date: '2026-06-03', names: ['서지민'] },
  { date: '2026-06-04', names: ['유태현'] },
  { date: '2026-06-05', names: ['문재준', '박서민'] },
  { date: '2026-06-06', names: ['김도겸'] },
  { date: '2026-06-07', names: ['최서린'] }
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

function normalizeReqNumKey(reqNum) {
  return String(reqNum || '').replace(/^#+/g, '').trim().toUpperCase();
}

function buildSeedReqNum(dateStr, daySeq) {
  const d = dateStr.replace(/-/g, '');
  return `PH-${d}${String(100 + daySeq).padStart(3, '0')}`;
}

async function verifyAdminAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: '관리자 로그인이 필요합니다.' };
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email || '';
    if (decoded.role === 'admin' || ADMIN_EMAILS.includes(email)) return { ok: true };
    const adminDoc = await admin.firestore().collection('admins').doc(decoded.uid).get();
    if (adminDoc.exists() && (adminDoc.data().role === 'admin' || (adminDoc.data().permissions || []).includes('admin'))) {
      return { ok: true };
    }
    return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
  } catch (e) {
    return { ok: false, status: 401, error: '인증 토큰이 유효하지 않습니다.' };
  }
}

async function findSourceRequest(db) {
  const tryNums = [SOURCE_REQ, `#${SOURCE_REQ}`, 'PH-20260505345'];
  for (const num of tryNums) {
    let q = await db.collection('requests').where('requestNumber', '==', num).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
    q = await db.collection('requests').where('reqNum', '==', num).limit(1).get();
    if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  }
  const all = await db.collection('requests').limit(500).get();
  for (const doc of all.docs) {
    const d = doc.data() || {};
    const key = normalizeReqNumKey(d.reqNum || d.requestNumber);
    if (key === SOURCE_REQ) return { id: doc.id, data: d };
  }
  return null;
}

async function runBulkSeed(db) {
  const source = await findSourceRequest(db);
  if (!source) throw new Error(`템플릿 의뢰 #${SOURCE_REQ}를 찾을 수 없습니다.`);

  const existingSnap = await db.collection('requests').limit(1000).get();
  const existingNums = new Set();
  existingSnap.forEach((doc) => {
    const d = doc.data() || {};
    const key = normalizeReqNumKey(d.reqNum || d.requestNumber);
    if (key) existingNums.add(key);
  });

  let created = 0;
  let skipped = 0;
  const items = [];
  const batchSize = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const row of BULK_REQUEST_SEED_SCHEDULE) {
    let daySeq = 0;
    for (const userName of row.names) {
      daySeq++;
      const reqNum = `#${buildSeedReqNum(row.date, daySeq)}`;
      const reqKey = normalizeReqNumKey(reqNum);
      if (existingNums.has(reqKey)) {
        skipped++;
        continue;
      }

      const parsedDate = new Date(row.date + 'T12:00:00');
      const clone = { ...source.data };
      delete clone.id;

      clone.reqNum = reqNum;
      clone.requestNumber = reqNum;
      clone.userName = userName;
      clone.name = userName;
      delete clone.email;
      delete clone.userEmail;
      delete clone.uid;
      delete clone.userId;
      clone.date = parsedDate.getTime();
      clone.reqDate = parsedDate.toISOString();
      clone.createdAt = admin.firestore.Timestamp.fromDate(parsedDate);
      clone.clonedFrom = source.id;
      clone.clonedFromReqNum = source.data.reqNum || source.data.requestNumber || '';
      clone.bulkSeeded = true;
      clone.bulkSeedBatch = 'PH-20260505345-mayjun';
      clone.lastUpdated = Date.now();
      clone.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      const ref = db.collection('requests').doc();
      batch.set(ref, clone);
      batchCount++;
      created++;
      existingNums.add(reqKey);
      items.push({ date: row.date, userName, reqNum });

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();

  return { created, skipped, items, template: SOURCE_REQ };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
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
    const result = await runBulkSeed(admin.firestore());
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...result }) };
  } catch (e) {
    console.error('admin-bulk-seed-requests error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '일괄 추가 실패' }) };
  }
};
