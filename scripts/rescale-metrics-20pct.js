/**
 * visitDaily 추정(estimated) 데이터를 20%로 재보정하고
 * signupDaily 월별 가입 추정치를 생성합니다.
 *
 * Usage:
 *   node scripts/rescale-metrics-20pct.js
 *   node scripts/rescale-metrics-20pct.js --dry-run
 */
'use strict';

const config = require('../metrics-report-config');

const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyDBZxKyMS7eeBTbPnbZkj0WWOZQHNldoL4';
const projectId = process.env.FIREBASE_PROJECT_ID || 'pricehunter-99a1b';
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const dryRun = process.argv.includes('--dry-run');
const scale = config.METRICS_REPORT_SCALE;

async function listAll(collection) {
  let docs = [];
  let pageToken = '';
  do {
    const url = `${base}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    docs = docs.concat(data.documents || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function intField(n) {
  return { integerValue: String(Math.max(0, Math.round(n))) };
}

function boolField(v) {
  return { booleanValue: !!v };
}

function strField(s) {
  return { stringValue: String(s) };
}

function patchDoc(path, fields) {
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${base}/${path}?${mask}&key=${apiKey}`;
  return fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  });
}

function ts(fields, name) {
  const v = fields[name];
  if (!v) return null;
  if (v.timestampValue) return new Date(v.timestampValue);
  return null;
}

function dailyVisitorVariance(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return 0.94 + (Math.abs(h) % 13) / 100;
}

function trendProgress(dateStr, startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`).getTime();
  const end = new Date(`${endStr}T00:00:00`).getTime();
  const cur = new Date(`${dateStr}T00:00:00`).getTime();
  if (end <= start) return 1;
  const t = Math.min(1, Math.max(0, (cur - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function trendingUniqueVisitors(dateStr, startStr, endStr) {
  const progress = trendProgress(dateStr, startStr, endStr);
  const base =
    config.VISITOR_TREND_START +
    (config.VISITOR_TREND_END - config.VISITOR_TREND_START) * progress;
  return Math.max(1, Math.round(base * dailyVisitorVariance(dateStr)));
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

async function rescaleVisitDaily() {
  const endStr = formatDate(new Date());
  const updates = [];

  eachDayInRange(new Date(2026, 0, 1), new Date(endStr + 'T00:00:00'), (dateStr) => {
    if (dateStr > endStr) return;
    const u = trendingUniqueVisitors(dateStr, config.VISITOR_BACKFILL_START, endStr);
    const pv = Math.max(u, Math.round(u * 1.35));
    updates.push({
      path: `visitDaily/${dateStr}`,
      fields: {
        date: strField(dateStr),
        pageViews: intField(pv),
        uniqueVisitors: intField(u),
        estimated: boolField(true),
        reportScale: strField(String(scale))
      }
    });
  });

  let updated = 0;
  for (const item of updates) {
    if (!dryRun) await patchDoc(item.path, item.fields);
    updated++;
  }
  return { updated, trend: `${config.VISITOR_TREND_START}→${config.VISITOR_TREND_END}` };
}

async function buildSignupDaily(users) {
  const byMonth = new Map();
  for (const doc of users) {
    const f = doc.fields || {};
    const created = ts(f, 'createdAt') || ts(f, 'updatedAt');
    if (!created) continue;
    const mk = created.toISOString().slice(0, 7);
    byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
  }

  const rows = config.scaleMonthlySignups(
    Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  );

  let written = 0;
  for (const row of rows) {
    const path = `signupDaily/${row.month}`;
    const fields = {
      month: strField(row.month),
      signups: intField(row.signups),
      cumulative: intField(row.cumulative),
      estimated: boolField(true),
      reportFactor: strField(String(config.MEMBER_REPORT_FACTOR))
    };
    if (!dryRun) await patchDoc(path, fields);
    written++;
  }

  return {
    written,
    totalReportSignups: rows.length ? rows[rows.length - 1].cumulative : 0,
    totalRealSignups: users.length,
    months: rows
  };
}

function isGuestRequestFields(f) {
  return val(f, 'isGuest') === true || val(f, 'isGuest') === 'true' || val(f, 'source') === 'guest_trial';
}

function val(f, k) {
  const v = f[k];
  if (!v) return null;
  return v.stringValue ?? v.integerValue ?? v.booleanValue ?? null;
}

async function buildGuestRequestDaily(requests) {
  const byMonth = new Map();
  const uniqueByMonth = new Map();

  for (const doc of requests) {
    const f = doc.fields || {};
    if (!isGuestRequestFields(f)) continue;
    const created = ts(f, 'createdAt') || ts(f, 'requestDate') || ts(f, 'submittedAt');
    if (!created) continue;
    const mk = created.toISOString().slice(0, 7);
    byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
    const email = String(val(f, 'email') || val(f, 'userEmail') || '').trim().toLowerCase();
    if (!uniqueByMonth.has(mk)) uniqueByMonth.set(mk, new Set());
    if (email) uniqueByMonth.get(mk).add(email);
  }

  const months = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let cumulativeUnique = 0;
  const allSeen = new Set();
  const rows = months.map(([month, requestCount]) => {
    const monthSet = uniqueByMonth.get(month) || new Set();
    monthSet.forEach((email) => allSeen.add(email));
    cumulativeUnique = allSeen.size;
    return {
      month,
      guestRequests: requestCount,
      uniqueGuests: monthSet.size,
      cumulativeUniqueGuests: cumulativeUnique
    };
  });

  let written = 0;
  for (const row of rows) {
    const path = `guestRequestDaily/${row.month}`;
    const fields = {
      month: strField(row.month),
      guestRequests: intField(row.guestRequests),
      uniqueGuests: intField(row.uniqueGuests),
      cumulativeUniqueGuests: intField(row.cumulativeUniqueGuests),
      estimated: boolField(false)
    };
    if (!dryRun) await patchDoc(path, fields);
    written++;
  }

  return {
    written,
    totalGuestRequests: requests.filter((doc) => isGuestRequestFields(doc.fields || {})).length,
    totalUniqueGuests: allSeen.size,
    months: rows
  };
}

(async () => {
  console.log(`Scale: ${scale * 100}% | dryRun: ${dryRun}`);
  const visit = await rescaleVisitDaily();
  console.log('visitDaily rescale:', visit);

  const users = await listAll('users');
  const requests = await listAll('requests');
  const signup = await buildSignupDaily(users);
  console.log('signupDaily:', signup);
  const guest = await buildGuestRequestDaily(requests);
  console.log('guestRequestDaily:', guest);
  console.log('Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
