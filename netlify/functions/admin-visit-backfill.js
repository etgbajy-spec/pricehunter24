/**
 * Netlify Function: visitDaily / signupDaily / guestRequestDaily 리포트 동기화 (Admin SDK)
 */
const admin = require('firebase-admin');
const metricsConfig = require('../../metrics-report-config');
const memberSeed = require('../../metrics-member-seed');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const VISITOR_BACKFILL_START = metricsConfig.VISITOR_BACKFILL_START;
const VISITOR_TREND_START = metricsConfig.VISITOR_TREND_START;
const VISITOR_TREND_END = metricsConfig.VISITOR_TREND_END;
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

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getBackfillEndStr() {
  return formatDate(new Date());
}

function dailyVisitorVariance(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return 0.94 + (Math.abs(h) % 13) / 100;
}

function trendProgress(dateStr, startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00').getTime();
  const end = new Date(endStr + 'T00:00:00').getTime();
  const cur = new Date(dateStr + 'T00:00:00').getTime();
  if (end <= start) return 1;
  const t = Math.min(1, Math.max(0, (cur - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function trendingUniqueVisitors(dateStr, startStr, endStr) {
  const progress = trendProgress(dateStr, startStr, endStr);
  const base = VISITOR_TREND_START + (VISITOR_TREND_END - VISITOR_TREND_START) * progress;
  return Math.max(1, Math.round(base * dailyVisitorVariance(dateStr)));
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

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isGuestRequest(data) {
  return data?.isGuest === true || data?.source === 'guest_trial';
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

async function resolveBackfillStartStr(db) {
  const configured = metricsConfig.SERVICE_LAUNCH_DATE || metricsConfig.VISITOR_BACKFILL_START;
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'asc').limit(1).get();
    if (!snap.empty) {
      const created = toDate(snap.docs[0].data().createdAt);
      if (created) {
        const userStart = formatDate(created);
        return userStart < configured ? userStart : configured;
      }
    }
  } catch (e) {
    console.warn('resolveBackfillStartStr fallback:', e.message);
  }
  return configured;
}

async function runTrendBackfill(db, backfillStartStr) {
  const endStr = getBackfillEndStr();
  const start = new Date(backfillStartStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const writes = [];
  const monthTotals = new Map();
  const monthDays = new Map();
  const monthPageViews = new Map();
  const monthMaxDaily = new Map();

  eachDayInRange(start, end, (dateStr) => {
    const u = trendingUniqueVisitors(dateStr, backfillStartStr, endStr);
    const pv = Math.max(u, Math.round(u * 1.35));
    const mk = dateStr.slice(0, 7);
    monthTotals.set(mk, (monthTotals.get(mk) || 0) + u);
    monthPageViews.set(mk, (monthPageViews.get(mk) || 0) + pv);
    monthDays.set(mk, (monthDays.get(mk) || 0) + 1);
    monthMaxDaily.set(mk, Math.max(monthMaxDaily.get(mk) || 0, u));
    writes.push({ dateStr, u, pv });
  });

  const chunkSize = 400;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    writes.slice(i, i + chunkSize).forEach(({ dateStr, u, pv }) => {
      batch.set(db.collection('visitDaily').doc(dateStr), {
        date: dateStr,
        pageViews: pv,
        uniqueVisitors: u,
        estimated: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  const monthKeys = Array.from(monthTotals.keys()).sort();
  if (monthKeys.length) {
    const monthBatch = db.batch();
    monthKeys.forEach((mk) => {
      monthBatch.set(db.collection('visitMonthly').doc(mk), {
        month: mk,
        pageViews: monthPageViews.get(mk) || 0,
        uniqueVisitors: monthTotals.get(mk) || 0,
        dayCount: monthDays.get(mk) || 0,
        dailyMax: monthMaxDaily.get(mk) || 0,
        estimated: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await monthBatch.commit();
  }

  const months = monthKeys.map((mk) => {
    const days = monthDays.get(mk) || 1;
    const total = monthTotals.get(mk) || 0;
    return { month: mk, total, dailyAvg: Math.round(total / days), days };
  });

  const lastDay = writes.length ? writes[writes.length - 1].u : VISITOR_TREND_END;

  return {
    filled: writes.length,
    months,
    backfillStart: backfillStartStr,
    range: `${backfillStartStr} ~ ${endStr}`,
    trendStart: VISITOR_TREND_START,
    trendEnd: VISITOR_TREND_END,
    lastDayVisitors: lastDay,
    monthlyDocs: monthKeys.length
  };
}

async function runMemberSeedBackfill(db) {
  const snap = await db.collection('users').get();
  const docs = snap.docs;
  const usedSets = memberSeed.collectUsedMemberSets(docs);
  const { realCount, seedCount, totalCount } = memberSeed.countRealAndSeedUsers(docs);
  const launchStr = metricsConfig.SERVICE_LAUNCH_DATE || metricsConfig.VISITOR_BACKFILL_START;
  const endStr = getBackfillEndStr();
  const plan = memberSeed.planReportMemberSeeds({
    realCount,
    totalCount,
    usedSets,
    users: docs,
    launchStr,
    endStr,
    getReportMemberCount: metricsConfig.getReportMemberCount,
    getReportMemberTarget: metricsConfig.getReportMemberTarget,
    targetTotal: metricsConfig.MEMBER_REPORT_TARGET
  });

  let removed = 0;
  if (plan.trimIds && plan.trimIds.length) {
    const chunkSize = 400;
    for (let i = 0; i < plan.trimIds.length; i += chunkSize) {
      const batch = db.batch();
      plan.trimIds.slice(i, i + chunkSize).forEach((id) => {
        batch.delete(db.collection('users').doc(id));
      });
      await batch.commit();
      removed += Math.min(chunkSize, plan.trimIds.length - i);
    }
  }

  if (!plan.need) {
    return {
      created: 0,
      removed,
      targetTotal: plan.targetTotal,
      realCount,
      seedCount,
      totalBefore: totalCount,
      totalAfter: totalCount - removed
    };
  }

  let created = 0;
  const chunkSize = 400;
  for (let i = 0; i < plan.queue.length; i += chunkSize) {
    const batch = db.batch();
    plan.queue.slice(i, i + chunkSize).forEach((item) => {
      const doc = memberSeed.buildSeedMemberDocument(item);
      const ref = db.collection('users').doc();
      batch.set(ref, {
        ...doc,
        createdAt: admin.firestore.Timestamp.fromDate(doc.createdAt),
        updatedAt: admin.firestore.Timestamp.fromDate(doc.updatedAt),
        lastLogin: admin.firestore.Timestamp.fromDate(doc.lastLogin)
      });
    });
    await batch.commit();
    created += Math.min(chunkSize, plan.queue.length - i);
  }

  return {
    created,
    removed,
    targetTotal: plan.targetTotal,
    realCount,
    seedCount,
    totalBefore: totalCount,
    totalAfter: totalCount - removed + created
  };
}

async function runSignupBackfill(db) {
  const snap = await db.collection('users').get();
  const byMonth = new Map();
  let realCount = 0;
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!memberSeed.isReportSeedUser(data)) realCount++;
    const created = toDate(data.createdAt) || toDate(data.updatedAt);
    if (!created) return;
    const mk = monthKeyFromDate(created);
    byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
  });

  let cumulative = 0;
  const rows = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => {
      cumulative += count;
      return { month, signups: count, cumulative, estimated: true };
    });

  const batch = db.batch();
  rows.forEach((row) => {
    batch.set(db.collection('signupDaily').doc(row.month), {
      month: row.month,
      signups: row.signups,
      cumulative: row.cumulative,
      estimated: true,
      reportFactor: metricsConfig.MEMBER_REPORT_FACTOR,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  if (rows.length) await batch.commit();

  return {
    filled: rows.length,
    totalReportSignups: rows.length ? rows[rows.length - 1].cumulative : 0,
    totalRealSignups: realCount,
    totalMembers: snap.size
  };
}

async function runGuestBackfill(db) {
  const snap = await db.collection('requests').get();
  const guestRequests = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!isGuestRequest(data)) return;
    guestRequests.push({
      email: data.email || data.userEmail || '',
      userEmail: data.userEmail || '',
      createdAt: toDate(data.createdAt) || toDate(data.requestDate) || toDate(data.submittedAt)
    });
  });

  const rows = metricsConfig.buildGuestRequestDailyRows(guestRequests);
  const batch = db.batch();
  rows.forEach((row) => {
    batch.set(db.collection('guestRequestDaily').doc(row.month), {
      ...row,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  });
  if (rows.length) await batch.commit();

  const realUnique = new Set();
  guestRequests.forEach((r) => {
    const email = String(r.email || r.userEmail || '').trim().toLowerCase();
    if (email) realUnique.add(email);
  });

  return {
    filled: rows.length,
    totalReportUniqueGuests: rows.length ? rows[rows.length - 1].cumulativeUniqueGuests : 0,
    totalReportGuestRequests: guestRequests.length
      ? metricsConfig.getReportGuestRequestCount(guestRequests.length)
      : 0,
    totalRealUniqueGuests: realUnique.size,
    totalRealGuestRequests: guestRequests.length
  };
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
    const db = admin.firestore();
    const backfillStart = await resolveBackfillStartStr(db);
    const visit = await runTrendBackfill(db, backfillStart);
    const memberSeedResult = await runMemberSeedBackfill(db);
    const signup = await runSignupBackfill(db);
    const guest = await runGuestBackfill(db);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, backfillStart, visit, memberSeed: memberSeedResult, signup, guest })
    };
  } catch (e) {
    console.error('admin-visit-backfill error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || '리포트 동기화 실패' }) };
  }
};
