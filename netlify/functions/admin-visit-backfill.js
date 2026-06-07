/**
 * Netlify Function: visitDaily 1~5월 보정 (Firebase Admin SDK)
 */
const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const VISITOR_TARGET_DAILY = 100;
const VISITOR_BACKFILL_START = '2026-01-01';
const VISITOR_BACKFILL_END = '2026-05-31';
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

function dailyVisitorVariance(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return 0.92 + (Math.abs(h) % 17) / 100;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eachDayInRange(startDate, endDate, fn) {
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    fn(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
}

async function verifyAdminAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, status: 401, error: '관리자 로그인이 필요합니다.' };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email || '';
    if (decoded.role === 'admin' || ADMIN_EMAILS.includes(email)) {
      return { ok: true, email };
    }
    const adminDoc = await admin.firestore().collection('admins').doc(decoded.uid).get();
    if (adminDoc.exists()) {
      const data = adminDoc.data() || {};
      if (data.role === 'admin' || (data.permissions || []).includes('admin')) {
        return { ok: true, email };
      }
    }
    return { ok: false, status: 403, error: '관리자 권한이 없습니다.' };
  } catch (e) {
    return { ok: false, status: 401, error: '인증 토큰이 유효하지 않습니다.' };
  }
}

async function runJanMayBackfill(db) {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 4, 31);
  const writes = [];
  const monthTotals = new Map();

  eachDayInRange(start, end, (dateStr) => {
    const variance = dailyVisitorVariance(dateStr);
    const u = Math.round(VISITOR_TARGET_DAILY * variance);
    const pv = Math.max(u, Math.round(u * 1.3));
    const mk = dateStr.slice(0, 7);
    monthTotals.set(mk, (monthTotals.get(mk) || 0) + u);
    writes.push({ dateStr, u, pv });
  });

  const chunkSize = 400;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach(({ dateStr, u, pv }) => {
      const ref = db.collection('visitDaily').doc(dateStr);
      batch.set(ref, {
        date: dateStr,
        pageViews: pv,
        uniqueVisitors: u,
        estimated: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  const months = Array.from(monthTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mk, total]) => {
      const [y, m] = mk.split('-').map(Number);
      const days = new Date(y, m, 0).getDate();
      return { month: mk, total, dailyAvg: Math.round(total / days) };
    });

  return { filled: writes.length, months, targetDaily: VISITOR_TARGET_DAILY };
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
    const result = await runJanMayBackfill(admin.firestore());
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        range: `${VISITOR_BACKFILL_START} ~ ${VISITOR_BACKFILL_END}`,
        ...result
      })
    };
  } catch (e) {
    console.error('admin-visit-backfill error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '보정 실패' }) };
  }
};
