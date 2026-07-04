/**
 * PriceHunter 공통 방문 로그 (모든 고객-facing 페이지에서 로드)
 * - visitDaily 컬렉션: 일별 pageViews / uniqueVisitors 집계 (리포트용)
 * - visits 상세 로그는 쓰지 않음 (Firestore 읽기·쓰기 절약)
 */
(function () {
  'use strict';

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function waitForFirebase(maxAttempts = 80) {
    for (let i = 0; i < maxAttempts; i++) {
      if (window.firebaseDb && window.firebaseFirestoreFunctions) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  async function logVisit() {
    if (window.__phVisitLogging) return;
    window.__phVisitLogging = true;

    try {
      if (!(await waitForFirebase())) return;

      const page = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
      const dateStr = formatDate(new Date());
      const sessionKey = `ph_visit_${dateStr}_${page}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');

      let sessionId = localStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        localStorage.setItem('analytics_session_id', sessionId);
      }

      const fns = window.firebaseFirestoreFunctions;
      const db = window.firebaseDb;
      const { doc, setDoc, getDoc, serverTimestamp } = fns;

      const dailyRef = doc(db, 'visitDaily', dateStr);
      const snap = await getDoc(dailyRef);
      const prev = snap.exists() ? snap.data() : {};
      const sessions = { ...(prev.sessionIds || {}) };
      sessions[sessionId] = true;
      const uniqueVisitors = Object.keys(sessions).length;
      const pageViews = (prev.pageViews || 0) + 1;

      await setDoc(dailyRef, {
        date: dateStr,
        pageViews,
        uniqueVisitors,
        sessionIds: sessions,
        estimated: prev.estimated === true ? true : false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('방문 로그 기록 실패:', e);
    } finally {
      window.__phVisitLogging = false;
    }
  }

  function scheduleLog() {
    setTimeout(logVisit, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleLog);
  } else {
    scheduleLog();
  }
})();
