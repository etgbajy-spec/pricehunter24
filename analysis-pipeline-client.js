/**
 * 클라이언트용 AI 파이프라인 UI 헬퍼 (Phase 2)
 * 서버 API 호출 + localStorage Job + 폼 적용
 */
(function (global) {
  'use strict';

  function getApiBase() {
    if (global.location.hostname === 'localhost' || global.location.hostname === '127.0.0.1') {
      return global.location.origin;
    }
    return global.location.origin;
  }

  function getAdminApiKey() {
    return sessionStorage.getItem('ph_admin_api_key') || localStorage.getItem('ph_admin_api_key') || '';
  }

  function setAdminApiKey(key) {
    sessionStorage.setItem('ph_admin_api_key', key);
    localStorage.setItem('ph_admin_api_key', key);
  }

  function ensureAdminApiKey() {
    var key = getAdminApiKey();
    if (key) return key;
    key = prompt('관리자 API 키를 입력하세요.\n(서버 ADMIN_API_SECRET과 동일, 로컬 기본값: pricehunter-dev-admin)');
    if (!key) return null;
    setAdminApiKey(key.trim());
    return key.trim();
  }

  function jobKey(reqNum) {
    return 'analysisJob-' + reqNum;
  }

  function draftKey(reqNum) {
    return 'analysisDraft-' + reqNum;
  }

  function saveJob(reqNum, job) {
    localStorage.setItem(jobKey(reqNum), JSON.stringify(job));
  }

  function loadJob(reqNum) {
    try {
      return JSON.parse(localStorage.getItem(jobKey(reqNum)) || 'null');
    } catch (e) {
      return null;
    }
  }

  function saveDraft(reqNum, draft, meta) {
    localStorage.setItem(draftKey(reqNum), JSON.stringify({
      draft: draft,
      meta: meta || {},
      savedAt: new Date().toISOString()
    }));
  }

  function loadDraft(reqNum) {
    try {
      return JSON.parse(localStorage.getItem(draftKey(reqNum)) || 'null');
    } catch (e) {
      return null;
    }
  }

  function requestToPayload(req) {
    var urls = req.urls || (req.url ? [req.url] : []);
    return {
      name: req.name || '',
      description: req.description || req.desc || '',
      url: req.url || urls[0] || '',
      urls: urls,
      price: req.price || '',
      userName: req.userName || '',
      email: req.email || '',
      phone: req.phone || ''
    };
  }

  async function callPipelineApi(endpoint, body) {
    var apiKey = ensureAdminApiKey();
    if (!apiKey) throw new Error('관리자 API 키가 필요합니다.');

    var res = await fetch(getApiBase() + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': apiKey
      },
      body: JSON.stringify(body)
    });

    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || ('API 오류 (' + res.status + ')'));
    }
    return data;
  }

  async function runPipeline(req) {
    var reqNum = (req.key || '').replace('request-', '') || req.requestNumber || '';
    saveJob(reqNum, { status: 'running', step: 'collect', startedAt: new Date().toISOString() });

    try {
      var result = await callPipelineApi('/api/analysis/run-pipeline', {
        request: requestToPayload(req)
      });
      saveJob(reqNum, {
        status: 'ready',
        mode: result.mode,
        priceData: result.priceData,
        draft: result.draft,
        steps: result.steps,
        completedAt: new Date().toISOString()
      });
      saveDraft(reqNum, result.draft, { mode: result.mode, priceData: result.priceData });
      if (window.RequestDataSync) {
        RequestDataSync.updateAnalysisJob(reqNum, { status: 'ready', draft: true, mode: result.mode });
      }
      return result;
    } catch (err) {
      saveJob(reqNum, {
        status: 'error',
        error: err.message,
        failedAt: new Date().toISOString()
      });
      throw err;
    }
  }

  async function collectPricesOnly(req) {
    return callPipelineApi('/api/analysis/collect-prices', {
      request: requestToPayload(req)
    });
  }

  async function generateDraftOnly(req, priceData) {
    return callPipelineApi('/api/analysis/generate-draft', {
      request: requestToPayload(req),
      priceData: priceData
    });
  }

  function applyDraftToForm(draft) {
    if (!global.PurchaseReport) return false;
    PurchaseReport.populateAdminForm(draft);
    return true;
  }

  function renderDraftPreview(container, draft, priceData, mode) {
    if (!container) return;
    var html = '';
    if (mode) {
      html += '<div class="text-xs text-gray-500 mb-2">생성 방식: ' + escapeHtml(mode) + '</div>';
    }
    if (priceData && priceData.summary) {
      html += '<div class="mb-3 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800"><strong>가격 수집:</strong> ' + escapeHtml(priceData.summary) + '</div>';
    }
    if (global.PurchaseReport && draft) {
      html += PurchaseReport.renderPurchaseReportHTML(draft);
    }
    container.innerHTML = html || '<p class="text-gray-400 text-sm">미리보기 없음</p>';
    container.classList.remove('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function modeLabel(mode) {
    var labels = {
      openai: 'AI (OpenAI)',
      rule_based: '규칙 기반',
      rule_based_fallback: '규칙 기반 (AI fallback)'
    };
    return labels[mode] || mode || '알 수 없음';
  }

  async function syncReportToFirebase(reqNum, report, firebaseDocId) {
    return callPipelineApi('/api/admin/save-purchase-report', {
      reqNum: reqNum,
      report: report,
      firebaseDocId: firebaseDocId || null
    });
  }

  async function fetchPendingFromFirebase() {
    return fetchFirebaseRequests('pending');
  }

  async function fetchFirebaseRequests(scope) {
    var apiKey = ensureAdminApiKey();
    if (!apiKey) throw new Error('관리자 API 키가 필요합니다.');
    var qs = scope === 'all' ? '?scope=all' : '';
    var res = await fetch(getApiBase() + '/api/admin/pending-requests' + qs, {
      headers: { 'x-admin-api-key': apiKey }
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('API 오류 (' + res.status + ')'));
    return data.items || [];
  }

  global.AnalysisPipelineClient = {
    getAdminApiKey: getAdminApiKey,
    setAdminApiKey: setAdminApiKey,
    ensureAdminApiKey: ensureAdminApiKey,
    runPipeline: runPipeline,
    collectPricesOnly: collectPricesOnly,
    generateDraftOnly: generateDraftOnly,
    applyDraftToForm: applyDraftToForm,
    renderDraftPreview: renderDraftPreview,
    loadJob: loadJob,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    modeLabel: modeLabel,
    requestToPayload: requestToPayload,
    syncReportToFirebase: syncReportToFirebase,
    fetchPendingFromFirebase: fetchPendingFromFirebase,
    fetchFirebaseRequests: fetchFirebaseRequests
  };
})(typeof window !== 'undefined' ? window : this);
