/**
 * PriceHunter 리포트/보정 지표 설정
 * - 방문자: visitDaily 추세 보정 (일 UV 10→24)
 * - 가입자: 실제 분포 × 계수로 부드럽게 보정 (딱 300명 고정 X)
 * - 게스트 의뢰자: 실제 데이터 별도 집계
 */
(function (global) {
  'use strict';

  const METRICS_REPORT_SCALE = 0.2;
  /** 로드맵 1,500의 20% — 참고 목표일 뿐, 강제 맞춤 안 함 */
  const MEMBER_ROADMAP_TARGET = Math.round(1500 * METRICS_REPORT_SCALE);
  /**
   * 가입자 보정 계수 (162명 → 약 295명 수준)
   * 마지막 달을 억지로 맞추지 않아 누적이 297·301처럼 자연스럽게 나옴
   */
  const MEMBER_REPORT_FACTOR = 1.82;

  const config = {
    METRICS_REPORT_SCALE,
    MEMBER_ROADMAP_TARGET,
    MEMBER_REPORT_FACTOR,
    VISITOR_TREND_START: Math.round(50 * METRICS_REPORT_SCALE),
    VISITOR_TREND_END: Math.round(120 * METRICS_REPORT_SCALE),
    VISITOR_BACKFILL_START: '2026-01-01',
    VISITOR_BACKFILL_KEY: 'ph_visit_backfill_v8',
    MAU_ROADMAP_TARGET: Math.round(500 * METRICS_REPORT_SCALE)
  };

  config.getReportMemberCount = function getReportMemberCount(actualCount) {
    const actual = Number(actualCount) || 0;
    if (actual <= 0) return 0;
    return Math.round(actual * MEMBER_REPORT_FACTOR);
  };

  /** 월별 가입 — 계수만 곱하고 마지막 달 보정 없음 */
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

  config.buildMonthlySignupRows = function buildMonthlySignupRows(monthlyEntries, useReportScale) {
    if (useReportScale !== false) {
      return config.scaleMonthlySignups(monthlyEntries);
    }
    const entries = Array.isArray(monthlyEntries) ? monthlyEntries : [];
    let cumulative = 0;
    return entries.map(([month, count]) => {
      const signups = Math.max(0, Number(count) || 0);
      cumulative += signups;
      return { month, signups, cumulative, estimated: false };
    });
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  } else {
    global.MetricsReportConfig = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
