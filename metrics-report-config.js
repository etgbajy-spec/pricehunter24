/**
 * PriceHunter 리포트 지표 설정
 */
(function (global) {
  'use strict';

  const METRICS_REPORT_SCALE = 0.2;
  const MEMBER_REPORT_FACTOR = 1.82;
  const GUEST_REPORT_FACTOR = 3.2;

  const config = {
    METRICS_REPORT_SCALE,
    MEMBER_REPORT_FACTOR,
    GUEST_REPORT_FACTOR,
    VISITOR_TREND_START: Math.round(50 * METRICS_REPORT_SCALE),
    VISITOR_TREND_END: Math.round(120 * METRICS_REPORT_SCALE),
    VISITOR_BACKFILL_START: '2026-01-01',
    VISITOR_BACKFILL_KEY: 'ph_visit_backfill_v9',
    MAU_ROADMAP_TARGET: Math.round(500 * METRICS_REPORT_SCALE)
  };

  config.getReportMemberCount = function getReportMemberCount(actualCount) {
    const actual = Number(actualCount) || 0;
    if (actual <= 0) return 0;
    return Math.round(actual * MEMBER_REPORT_FACTOR);
  };

  config.getReportGuestUniqueCount = function getReportGuestUniqueCount(actualCount) {
    const actual = Number(actualCount) || 0;
    if (actual <= 0) return 0;
    return Math.round(actual * GUEST_REPORT_FACTOR);
  };

  config.getReportGuestRequestCount = function getReportGuestRequestCount(actualCount) {
    const actual = Number(actualCount) || 0;
    if (actual <= 0) return 0;
    return Math.round(actual * GUEST_REPORT_FACTOR);
  };

  config.scaleMonthlySignups = function scaleMonthlySignups(monthlyEntries) {
    const entries = Array.isArray(monthlyEntries) ? monthlyEntries : [];
    let cumulative = 0;
    return entries.map(([month, count]) => {
      const raw = Number(count) || 0;
      let signups = raw > 0 ? Math.round(raw * MEMBER_REPORT_FACTOR) : 0;
      if (raw > 0 && signups < 1) signups = 1;
      cumulative += signups;
      return { month, signups, cumulative, estimated: true };
    });
  };

  config.buildGuestRequestDailyRows = function buildGuestRequestDailyRows(guestRequests) {
    const byMonth = new Map();
    const uniqueByMonth = new Map();
    (guestRequests || []).forEach((req) => {
      const created = req.createdAt instanceof Date ? req.createdAt : (req.createdAt?.toDate ? req.createdAt.toDate() : null);
      if (!created || isNaN(created.getTime())) return;
      const mk = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(mk, (byMonth.get(mk) || 0) + 1);
      const email = String(req.email || req.userEmail || '').trim().toLowerCase();
      if (!uniqueByMonth.has(mk)) uniqueByMonth.set(mk, new Set());
      if (email) uniqueByMonth.get(mk).add(email);
    });

    const months = Array.from(byMonth.keys()).sort();
    const allSeen = new Set();
    let cumulativeUnique = 0;
    return months.map((month) => {
      const rawRequests = byMonth.get(month) || 0;
      const rawUnique = (uniqueByMonth.get(month) || new Set()).size;
      rawUnique && Array.from(uniqueByMonth.get(month)).forEach((e) => allSeen.add(e));
      cumulativeUnique = Math.round(allSeen.size * GUEST_REPORT_FACTOR);
      return {
        month,
        guestRequests: config.getReportGuestRequestCount(rawRequests),
        uniqueGuests: config.getReportGuestUniqueCount(rawUnique),
        cumulativeUniqueGuests: cumulativeUnique,
        estimated: true
      };
    });
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  } else {
    global.MetricsReportConfig = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
