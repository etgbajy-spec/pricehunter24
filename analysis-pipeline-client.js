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

  function getAdminApiKeyInputEl() {
    return document.getElementById('admin-api-key-input');
  }

  function getAdminApiKey() {
    var input = getAdminApiKeyInputEl();
    if (input && input.value.trim()) return input.value.trim();
    return sessionStorage.getItem('ph_admin_api_key') || localStorage.getItem('ph_admin_api_key') || '';
  }

  function setAdminApiKey(key) {
    var trimmed = String(key || '').trim();
    sessionStorage.setItem('ph_admin_api_key', trimmed);
    localStorage.setItem('ph_admin_api_key', trimmed);
    var input = getAdminApiKeyInputEl();
    if (input) input.value = trimmed;
    if (global.AdminRequestWorkspace && typeof global.AdminRequestWorkspace.refreshApiKeyUi === 'function') {
      global.AdminRequestWorkspace.refreshApiKeyUi();
    }
  }

  function clearAdminApiKey() {
    sessionStorage.removeItem('ph_admin_api_key');
    localStorage.removeItem('ph_admin_api_key');
    var input = getAdminApiKeyInputEl();
    if (input) {
      input.value = '';
      input.classList.add('ring-2', 'ring-red-400', 'border-red-400');
    }
    if (global.AdminRequestWorkspace && typeof global.AdminRequestWorkspace.refreshApiKeyUi === 'function') {
      global.AdminRequestWorkspace.refreshApiKeyUi(true);
    }
  }

  function maskAdminApiKey(key) {
    if (!key) return '미설정';
    if (key.length <= 6) return '••••••';
    return key.slice(0, 3) + '••••' + key.slice(-3);
  }

  function isAuthApiError(status, message) {
    if (status === 401 || status === 403) return true;
    var msg = String(message || '').toLowerCase();
    return msg.indexOf('인증') !== -1 || msg.indexOf('권한') !== -1 || msg.indexOf('api key') !== -1;
  }

  function focusAdminApiKeyInput(message) {
    var input = getAdminApiKeyInputEl();
    if (input) {
      input.classList.add('ring-2', 'ring-red-400', 'border-red-400');
      input.focus();
      input.select();
    }
    if (global.AdminRequestWorkspace && typeof global.AdminRequestWorkspace.switchWorkspaceTab === 'function') {
      global.AdminRequestWorkspace.switchWorkspaceTab('basics');
    }
    if (message && global.dispatchEvent) {
      global.dispatchEvent(new CustomEvent('ph-admin-api-key-invalid', { detail: { message: message } }));
    }
  }

  function ensureAdminApiKey(options) {
    options = options || {};
    var key = getAdminApiKey();
    if (key && !options.force) return key;

    var input = getAdminApiKeyInputEl();
    if (input) {
      focusAdminApiKeyInput(options.message || '관리자 API 키를 입력한 뒤 「저장」을 눌러주세요.');
      return null;
    }

    key = prompt(
      (options.message ? options.message + '\n\n' : '') +
      '관리자 API 키를 입력하세요.\n(서버 ADMIN_API_SECRET과 동일, 로컬 기본값: pricehunter-dev-admin)'
    );
    if (!key) return null;
    setAdminApiKey(key.trim());
    return key.trim();
  }

  function changeAdminApiKey() {
    clearAdminApiKey();
    return ensureAdminApiKey({ force: true, message: '새 관리자 API 키를 입력하세요.' });
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

  async function callPipelineApi(endpoint, body, attempt) {
    attempt = attempt || 0;
    var apiKey = ensureAdminApiKey();
    if (!apiKey) throw new Error('관리자 API 키가 필요합니다. AI 분석 탭에서 키를 입력·저장해 주세요.');

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
      var errMsg = data.error || ('API 오류 (' + res.status + ')');
      if (isAuthApiError(res.status, errMsg) && attempt < 1) {
        clearAdminApiKey();
        focusAdminApiKeyInput('API 키가 올바르지 않거나 만료되었습니다. 다시 입력해 주세요.');
        throw new Error('관리자 API 키 오류: ' + errMsg + '\n\n아래 입력란에 올바른 키를 입력한 뒤 다시 실행하세요.');
      }
      throw new Error(errMsg);
    }
    var input = getAdminApiKeyInputEl();
    if (input) input.classList.remove('ring-2', 'ring-red-400', 'border-red-400');
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

  async function generateDraftFromBasics(req, priceData) {
    var enriched = Object.assign({}, priceData, {
      referenceUrl: priceData.link || priceData.referenceUrl || req.url || '',
      referencePrice: priceData.lowestPrice,
      productName: req.name || req.productName || ''
    });
    return callPipelineApi('/api/analysis/generate-draft', {
      request: requestToPayload(req),
      priceData: enriched,
      options: { skipCollect: true, adminProvided: true }
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

  async function fetchFirebaseRequests(scope, attempt) {
    attempt = attempt || 0;
    var apiKey = ensureAdminApiKey();
    if (!apiKey) throw new Error('관리자 API 키가 필요합니다.');
    var qs = scope === 'all' ? '?scope=all' : '';
    var res = await fetch(getApiBase() + '/api/admin/pending-requests' + qs, {
      headers: { 'x-admin-api-key': apiKey }
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var errMsg = data.error || ('API 오류 (' + res.status + ')');
      if (isAuthApiError(res.status, errMsg) && attempt < 1) {
        clearAdminApiKey();
        focusAdminApiKeyInput('API 키가 올바르지 않습니다. 다시 입력해 주세요.');
        throw new Error('관리자 API 키 오류: ' + errMsg);
      }
      throw new Error(errMsg);
    }
    return data.items || [];
  }

  global.AnalysisPipelineClient = {
    getAdminApiKey: getAdminApiKey,
    setAdminApiKey: setAdminApiKey,
    clearAdminApiKey: clearAdminApiKey,
    maskAdminApiKey: maskAdminApiKey,
    changeAdminApiKey: changeAdminApiKey,
    focusAdminApiKeyInput: focusAdminApiKeyInput,
    ensureAdminApiKey: ensureAdminApiKey,
    runPipeline: runPipeline,
    collectPricesOnly: collectPricesOnly,
    generateDraftFromBasics: generateDraftFromBasics,
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
