/**
 * 관리자 의뢰 통합 워크스페이스 — AI 분석 + 구매판단 리포트 + 고객 답변
 */
(function (global) {
  'use strict';

  var currentRequest = null;
  var lastPriceData = null;
  var lastPipelineDraft = null;
  var activeTab = 'basics';

  function formatRequestedPriceDisplay(val) {
    if (val == null || val === '') return '';
    if (global.PurchaseReport && PurchaseReport.formatPrice) return PurchaseReport.formatPrice(val);
    var n = parseInt(String(val).replace(/[^\d]/g, ''), 10);
    return n ? n.toLocaleString('ko-KR') + '원' : String(val);
  }

  function getReqNum(request) {
    if (!request) return '';
    if (global.RequestDataSync) {
      return RequestDataSync.normalizeReqNum(request.requestNumber || request.reqNum || request.id);
    }
    return String(request.requestNumber || request.reqNum || request.id || '').replace(/^#+/, '');
  }

  function requestForPipeline(request) {
    return {
      id: request.id,
      firebaseDocId: request.id,
      name: request.name || request.productName || '',
      productName: request.productName || request.name || '',
      description: request.description || request.desc || '',
      desc: request.desc || request.description || '',
      url: request.url || (request.urls && request.urls[0]) || '',
      urls: request.urls || (request.url ? [request.url] : []),
      price: request.originalPrice != null ? request.originalPrice : request.price,
      email: request.email || request.userEmail || '',
      userName: request.userName || request.memberName || '',
      phone: request.userPhone || request.phone || '',
      requestNumber: request.requestNumber || request.reqNum || '',
      reqNum: request.reqNum || request.requestNumber || ''
    };
  }

  function switchWorkspaceTab(tab) {
    activeTab = tab;
    ['basics', 'report', 'notify'].forEach(function (name) {
      var panel = document.getElementById('admin-ws-panel-' + name);
      var btn = document.getElementById('admin-ws-tab-' + name);
      if (panel) panel.classList.toggle('hidden', name !== tab);
      if (btn) {
        btn.classList.toggle('bg-indigo-600', name === tab);
        btn.classList.toggle('text-white', name === tab);
        btn.classList.toggle('bg-white', name !== tab);
        btn.classList.toggle('text-indigo-700', name !== tab);
      }
    });
  }

  function setPipelineStatus(text, colorClass) {
    var el = document.getElementById('admin-ai-pipeline-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'px-3 py-1 rounded-full text-xs font-bold ' + (colorClass || 'bg-gray-200 text-gray-600');
  }

  function setPipelineMsg(html, type) {
    var el = document.getElementById('admin-ai-pipeline-msg');
    if (!el) return;
    var colors = { ok: 'text-green-700', err: 'text-red-600', info: 'text-blue-700' };
    el.className = 'text-sm mb-3 ' + (colors[type] || 'text-gray-600');
    el.innerHTML = html;
  }

  function showDraftPreview(draft, priceData, mode) {
    var preview = document.getElementById('admin-ai-draft-preview');
    var summaryEl = document.getElementById('admin-ai-collect-summary');
    if (priceData && priceData.summary && summaryEl) {
      summaryEl.textContent = '💰 ' + priceData.summary;
      summaryEl.classList.remove('hidden');
    }
    if (global.AnalysisPipelineClient && preview) {
      AnalysisPipelineClient.renderDraftPreview(preview, draft, priceData, AnalysisPipelineClient.modeLabel(mode));
    }
    var applyBtn = document.getElementById('admin-btn-apply-draft');
    if (applyBtn) applyBtn.classList.remove('hidden');
  }

  function loadPipelineState(request) {
    lastPriceData = null;
    lastPipelineDraft = null;
    document.getElementById('admin-btn-apply-draft')?.classList.add('hidden');
    document.getElementById('admin-ai-collect-summary')?.classList.add('hidden');
    document.getElementById('admin-ai-draft-preview')?.classList.add('hidden');

    var reqNum = getReqNum(request);
    if (!global.AnalysisPipelineClient) {
      setPipelineStatus('클라이언트 없음', 'bg-red-100 text-red-700');
      setPipelineMsg('analysis-pipeline-client.js를 불러올 수 없습니다.', 'err');
      return;
    }

    var job = AnalysisPipelineClient.loadJob(reqNum);
    var saved = AnalysisPipelineClient.loadDraft(reqNum);

    if (job && job.status === 'ready' && job.draft) {
      lastPipelineDraft = job.draft;
      lastPriceData = job.priceData;
      setPipelineStatus('초안 준비됨', 'bg-green-500 text-white');
      setPipelineMsg('저장된 AI 초안이 있습니다. 「초안 폼에 적용」 후 검수하세요.', 'ok');
      showDraftPreview(job.draft, job.priceData, job.mode);
    } else if (saved && saved.draft) {
      lastPipelineDraft = saved.draft;
      lastPriceData = saved.meta && saved.meta.priceData ? saved.meta.priceData : null;
      setPipelineStatus('초안 저장됨', 'bg-emerald-500 text-white');
      showDraftPreview(saved.draft, lastPriceData, saved.meta && saved.meta.mode);
    } else if (job && job.status === 'error') {
      setPipelineStatus('오류', 'bg-red-500 text-white');
      setPipelineMsg('이전 실행 오류: ' + (job.error || '알 수 없음'), 'err');
    } else {
      setPipelineStatus('대기', 'bg-gray-200 text-gray-600');
      setPipelineMsg('① 검색 결과 탭에서 최저가·링크를 입력한 뒤 「AI 리포트 생성」을 눌러주세요.', 'info');
    }
  }

  function syncReportToCustomerForm(report) {
    if (!global.PurchaseReport) return;
    var data = PurchaseReport.normalizeResultData(report);
    function set(id, val) {
      var el = document.getElementById(id);
      if (el && val != null && val !== '') el.value = val;
    }
    set('response-lowest-price', data.price || (data.priceAnalysis && data.priceAnalysis.lowestPrice));
    set('response-seller', data.origin || (data.sellerAnalysis && data.sellerAnalysis.sellerName));
    set('response-seller-link', data.link);
    if (data.summary) set('response-additional-info', data.summary);
    else if (data.decision && data.decision.summary) set('response-additional-info', data.decision.summary);
  }

  function updateQaWarningsPanel(reportData) {
    var panel = document.getElementById('admin-qa-warnings-panel');
    var list = document.getElementById('admin-qa-warnings-list');
    if (!panel || !list || !global.PurchaseReport) return;
    var warnings = PurchaseReport.getQaWarnings(reportData || PurchaseReport.collectFromAdminForm());
    if (!warnings.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }
    panel.classList.remove('hidden');
    list.innerHTML = warnings.map(function (w) { return '<li>' + w + '</li>'; }).join('');
  }

  function adminFormVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function syncHiddenPriceFields() {
    function set(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val != null ? val : '';
    }
    var requested = adminFormVal('admin-requested-price-display') || adminFormVal('admin-requested-price');
    if (!requested && currentRequest) {
      requested = currentRequest.originalPrice != null ? currentRequest.originalPrice : currentRequest.price;
    }
    var found = adminFormVal('admin-price');
    set('admin-requested-price', requested);
    set('admin-lowest-price', found);
    set('admin-current-price', found);
    set('admin-avg-price', '');
  }

  function setRequestedPriceDisplay(request) {
    var displayEl = document.getElementById('admin-requested-price-display');
    var hiddenEl = document.getElementById('admin-requested-price');
    var priceVal = request && (request.originalPrice != null ? request.originalPrice : request.price);
    var formatted = formatRequestedPriceDisplay(priceVal);
    if (displayEl) displayEl.value = formatted || '';
    if (hiddenEl) hiddenEl.value = priceVal != null && priceVal !== '' ? String(priceVal) : '';
    syncHiddenPriceFields();
  }

  function validateAdminBasics() {
    syncHiddenPriceFields();
    var price = adminFormVal('admin-price');
    var link = adminFormVal('admin-link');
    if (!price) {
      alert('확인한 최저가를 입력해 주세요.');
      switchWorkspaceTab('basics');
      document.getElementById('admin-price')?.focus();
      return false;
    }
    if (!link) {
      alert('구매 링크를 입력해 주세요.');
      switchWorkspaceTab('basics');
      document.getElementById('admin-link')?.focus();
      return false;
    }
    return true;
  }

  function parsePriceNum(val) {
    if (typeof val === 'number') return val;
    return parseInt(String(val || '').replace(/[^\d]/g, ''), 10) || 0;
  }

  function buildAdminBasicsPriceData() {
    syncHiddenPriceFields();
    var found = adminFormVal('admin-price');
    var requested = adminFormVal('admin-requested-price') || adminFormVal('admin-requested-price-display');
    var origin = adminFormVal('admin-origin');
    var link = adminFormVal('admin-link');
    return {
      lowestPrice: parsePriceNum(found) || found,
      requestedPrice: parsePriceNum(requested) || requested,
      referencePrice: parsePriceNum(found) || found,
      referenceUrl: link,
      link: link,
      summary: '관리자 확인 · 최저가 ' + (found || '-') + ' · 의뢰가 ' + (formatRequestedPriceDisplay(requested) || '-'),
      adminProvided: true,
      sellerName: origin,
      productName: currentRequest && (currentRequest.name || currentRequest.productName)
    };
  }

  function getBasicsSnapshot() {
    return {
      price: adminFormVal('admin-price'),
      origin: adminFormVal('admin-origin'),
      link: adminFormVal('admin-link')
    };
  }

  function applyDraftPreservingBasics(draft) {
    var basics = getBasicsSnapshot();
    if (global.AnalysisPipelineClient) {
      AnalysisPipelineClient.applyDraftToForm(draft);
    } else if (global.PurchaseReport) {
      PurchaseReport.populateAdminForm(draft);
    }
    function set(id, val) {
      var el = document.getElementById(id);
      if (el && val != null) el.value = val;
    }
    set('admin-price', basics.price);
    set('admin-origin', basics.origin);
    set('admin-link', basics.link);
    syncHiddenPriceFields();
    syncReportToCustomerForm(global.PurchaseReport ? PurchaseReport.collectFromAdminForm() : draft);
    updateQaWarningsPanel(global.PurchaseReport ? PurchaseReport.collectFromAdminForm() : draft);
  }

  function getAdminPresetContext() {
    if (!global.ReportPresets) return {};
    return ReportPresets.buildAdminFormContextFromRequest(currentRequest, {
      lowestPrice: adminFormVal('admin-price') || adminFormVal('admin-lowest-price'),
      requestedPrice: adminFormVal('admin-requested-price') || adminFormVal('admin-requested-price-display') || (currentRequest && currentRequest.price),
      sellerName: adminFormVal('admin-origin'),
      link: adminFormVal('admin-link'),
      priceSummary: ''
    });
  }

  function loadReportForm(request) {
    if (!global.PurchaseReport) return;
    var report = null;
    if (request.purchaseReport) {
      report = PurchaseReport.normalizeResultData(request.purchaseReport);
    } else if (request.adminResponse && typeof request.adminResponse === 'object') {
      report = PurchaseReport.normalizeResultData({
        price: request.adminResponse.lowestPrice,
        origin: request.adminResponse.seller,
        summary: request.adminResponse.additionalInfo,
        link: request.adminResponse.sellerLink || request.adminResponse.link
      });
    }
    PurchaseReport.populateAdminForm(report || {});
    setRequestedPriceDisplay(request);
    if (report && report.price && !adminFormVal('admin-price')) {
      var priceEl = document.getElementById('admin-price');
      if (priceEl) priceEl.value = report.price;
    }
    syncHiddenPriceFields();
    updateQaWarningsPanel(report || PurchaseReport.collectFromAdminForm());
    syncReportToCustomerForm(report || PurchaseReport.collectFromAdminForm());
    if (request.adminResponse && typeof request.adminResponse === 'object') {
      var r = request.adminResponse;
      function setNotify(id, val) {
        var el = document.getElementById(id);
        if (el && val != null && val !== '') el.value = val;
      }
      setNotify('response-shipping-cost', r.shippingCost);
      setNotify('response-shipping-time', r.shippingTime);
      setNotify('response-total-cost', r.totalCost);
      if (r.lowestPrice) setNotify('response-lowest-price', r.lowestPrice);
      if (r.seller) setNotify('response-seller', r.seller);
      if (r.sellerLink) setNotify('response-seller-link', r.sellerLink);
      if (r.additionalInfo) setNotify('response-additional-info', r.additionalInfo);
    }
  }

  function buildUnifiedFirebaseUpdate(reportData, customerFormData) {
    if (!global.PurchaseReport) {
      return {
        adminResponse: customerFormData,
        status: '답변완료'
      };
    }
    var payload = PurchaseReport.toFirebasePayload(reportData);
    payload.adminResponse = Object.assign({}, payload.adminResponse, {
      sellerLink: reportData.link || customerFormData.sellerLink || '',
      shippingCost: customerFormData.shippingCost || '',
      shippingTime: customerFormData.shippingTime || '',
      totalCost: customerFormData.totalCost || ''
    });
    if (customerFormData.answerImages && customerFormData.answerImages.length) {
      payload.adminResponse.answerImages = customerFormData.answerImages;
    }
    if (customerFormData.additionalInfo) {
      payload.adminResponse.additionalInfo = customerFormData.additionalInfo;
    }
    payload.purchaseReport = reportData;
    payload.analysisStatus = 'published';
    return payload;
  }

  async function handleGenerateAiReport() {
    if (!currentRequest) return;
    if (!validateAdminBasics()) return;
    if (!ensureApiKeyBeforePipeline()) return;

    var priceData = buildAdminBasicsPriceData();
    lastPriceData = priceData;
    var btn = document.getElementById('admin-btn-generate-report');
    var btn2 = document.getElementById('admin-btn-regenerate-report');
    if (btn) btn.disabled = true;
    if (btn2) btn2.disabled = true;
    setPipelineStatus('생성 중…', 'bg-indigo-500 text-white');
    setPipelineMsg('입력하신 검색 결과를 바탕으로 AI 리포트를 작성 중… (10~30초)', 'info');

    try {
      var reqPayload = requestForPipeline(currentRequest);
      reqPayload.url = priceData.link || reqPayload.url;
      var result = await AnalysisPipelineClient.generateDraftFromBasics(reqPayload, priceData);
      lastPipelineDraft = result.draft;
      if (result.priceData) lastPriceData = result.priceData;

      applyDraftPreservingBasics(result.draft);

      var reqNum = getReqNum(currentRequest);
      AnalysisPipelineClient.saveDraft(reqNum, result.draft, { mode: result.mode, priceData: lastPriceData });

      setPipelineStatus('완료', 'bg-green-500 text-white');
      setPipelineMsg('✅ AI 리포트가 생성되었습니다. ② AI 리포트 탭에서 검수 후 저장하세요.', 'ok');
      showDraftPreview(result.draft, lastPriceData, result.mode);
      switchWorkspaceTab('report');
      refreshApiKeyUi(false);
    } catch (e) {
      handlePipelineError(e);
    } finally {
      if (btn) btn.disabled = false;
      if (btn2) btn2.disabled = false;
    }
  }

  function refreshApiKeyUi(invalid) {
    var input = document.getElementById('admin-api-key-input');
    var statusEl = document.getElementById('admin-api-key-status');
    var errorEl = document.getElementById('admin-api-key-error');
    if (!input || !statusEl) return;

    var stored = '';
    if (global.AnalysisPipelineClient) {
      stored = AnalysisPipelineClient.getAdminApiKey();
      if (!input.value && stored) input.value = stored;
    }

    var key = input.value.trim() || stored;
    if (invalid) {
      statusEl.textContent = '키 오류 · 다시 입력';
      statusEl.className = 'text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold';
      input.classList.add('ring-2', 'ring-red-400', 'border-red-400');
      if (errorEl) {
        errorEl.textContent = 'API 키가 올바르지 않습니다. 수정 후 「저장」을 누르고 파이프라인을 다시 실행하세요.';
        errorEl.classList.remove('hidden');
      }
    } else if (key) {
      statusEl.textContent = '저장됨 · ' + (global.AnalysisPipelineClient ? AnalysisPipelineClient.maskAdminApiKey(key) : '••••••');
      statusEl.className = 'text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700';
      input.classList.remove('ring-2', 'ring-red-400', 'border-red-400', 'ring-amber-300', 'border-amber-300');
      if (errorEl) errorEl.classList.add('hidden');
    } else {
      statusEl.textContent = '미설정 · 입력 필요';
      statusEl.className = 'text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold';
      input.classList.remove('ring-2', 'ring-red-400', 'border-red-400');
      input.classList.add('ring-2', 'ring-amber-300', 'border-amber-300');
      if (errorEl) errorEl.classList.add('hidden');
    }
  }

  function saveAdminApiKeyFromUi() {
    var input = document.getElementById('admin-api-key-input');
    if (!input) return;
    var key = input.value.trim();
    if (!key) {
      alert('API 키를 입력해 주세요.');
      input.focus();
      return;
    }
    if (global.AnalysisPipelineClient) AnalysisPipelineClient.setAdminApiKey(key);
    refreshApiKeyUi(false);
    setPipelineMsg('✅ API 키가 저장되었습니다. 이제 AI 리포트를 생성할 수 있습니다.', 'ok');
  }

  function bindApiKeyEvents() {
    document.getElementById('admin-api-key-save')?.addEventListener('click', saveAdminApiKeyFromUi);
    document.getElementById('admin-api-key-change')?.addEventListener('click', function () {
      var input = document.getElementById('admin-api-key-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      if (global.AnalysisPipelineClient) AnalysisPipelineClient.clearAdminApiKey();
      refreshApiKeyUi(false);
      setPipelineMsg('새 API 키를 입력한 뒤 「저장」을 눌러주세요.', 'info');
    });
    document.getElementById('admin-api-key-clear')?.addEventListener('click', function () {
      if (!confirm('저장된 API 키를 삭제할까요?')) return;
      if (global.AnalysisPipelineClient) AnalysisPipelineClient.clearAdminApiKey();
      refreshApiKeyUi(false);
      setPipelineMsg('API 키가 삭제되었습니다. 다시 입력해 주세요.', 'info');
    });
    document.getElementById('admin-api-key-toggle')?.addEventListener('click', function () {
      var input = document.getElementById('admin-api-key-input');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        this.textContent = '숨기기';
      } else {
        input.type = 'password';
        this.textContent = '보기';
      }
    });
    document.getElementById('admin-api-key-input')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveAdminApiKeyFromUi();
      }
    });
    document.addEventListener('ph-admin-api-key-invalid', function (e) {
      refreshApiKeyUi(true);
      if (e.detail && e.detail.message) {
        setPipelineMsg('❌ ' + e.detail.message, 'err');
      }
    });
  }

  function ensureApiKeyBeforePipeline() {
    var key = global.AnalysisPipelineClient ? AnalysisPipelineClient.getAdminApiKey() : '';
    if (key) return true;
    refreshApiKeyUi(false);
    switchWorkspaceTab('basics');
    setPipelineMsg('⚠️ AI 리포트 생성 전 API 키를 입력하고 「저장」해 주세요.', 'err');
    var input = document.getElementById('admin-api-key-input');
    if (input) input.focus();
    return false;
  }

  function handlePipelineError(e) {
    var msg = e && e.message ? e.message : String(e);
    setPipelineStatus('오류', 'bg-red-500 text-white');
    setPipelineMsg('❌ ' + msg.replace(/\n/g, '<br>'), 'err');
    if (msg.indexOf('API 키') !== -1 || msg.indexOf('인증') !== -1) {
      refreshApiKeyUi(true);
      switchWorkspaceTab('basics');
    }
  }

  function handleApplyDraft() {
    if (!lastPipelineDraft) {
      alert('적용할 AI 초안이 없습니다. 먼저 「AI 리포트 생성」을 실행하세요.');
      return;
    }
    if (!confirm('AI 초안을 리포트 폼에 적용합니다.\n검색 결과(최저가·링크)는 유지됩니다. 계속할까요?')) return;
    applyDraftPreservingBasics(lastPipelineDraft);
    setPipelineMsg('✅ AI 초안이 적용되었습니다. 검수 후 저장하세요.', 'ok');
    switchWorkspaceTab('report');
  }

  function onModalOpen(request) {
    currentRequest = request;
    lastPriceData = null;
    lastPipelineDraft = null;
    refreshApiKeyUi(false);
    loadReportForm(request);
    loadPipelineState(request);
    switchWorkspaceTab('basics');

    if (!global.AnalysisPipelineClient || !AnalysisPipelineClient.getAdminApiKey()) {
      setPipelineMsg('⚠️ API 키 저장 후, ① 검색 결과를 입력하고 AI 리포트를 생성하세요.', 'info');
      return;
    }
    setPipelineMsg('① 고객 의뢰가를 확인하고, 확인한 최저가·구매 링크를 입력한 뒤 AI 리포트를 생성하세요.', 'info');
  }

  function bindEvents() {
    document.getElementById('admin-ws-tab-basics')?.addEventListener('click', function () { switchWorkspaceTab('basics'); });
    document.getElementById('admin-ws-tab-report')?.addEventListener('click', function () { switchWorkspaceTab('report'); });
    document.getElementById('admin-ws-tab-notify')?.addEventListener('click', function () { switchWorkspaceTab('notify'); });
    document.getElementById('admin-btn-generate-report')?.addEventListener('click', handleGenerateAiReport);
    document.getElementById('admin-btn-regenerate-report')?.addEventListener('click', handleGenerateAiReport);
    document.getElementById('admin-btn-apply-draft')?.addEventListener('click', handleApplyDraft);
    document.getElementById('admin-btn-sync-from-report')?.addEventListener('click', function () {
      syncHiddenPriceFields();
      if (global.PurchaseReport) syncReportToCustomerForm(PurchaseReport.collectFromAdminForm());
    });

    ['admin-price', 'admin-origin', 'admin-link'].forEach(function (id) {
      document.getElementById(id)?.addEventListener('input', function () {
        syncHiddenPriceFields();
        syncReportToCustomerForm(global.PurchaseReport ? PurchaseReport.collectFromAdminForm() : {});
      });
    });

    var reportForm = document.getElementById('admin-report-form');
    if (reportForm) {
      reportForm.addEventListener('input', function () {
        if (global.PurchaseReport) updateQaWarningsPanel(PurchaseReport.collectFromAdminForm());
      });
    }

    document.getElementById('admin-verdict')?.addEventListener('change', function () {
      var verdict = this.value;
      if (!verdict || !global.ReportPresets) return;
      ReportPresets.applyVerdictToAdminForm(verdict, getAdminPresetContext());
      ReportPresets.applyAnalysisSectionsToAdminForm(getAdminPresetContext());
      if (global.PurchaseReport) updateQaWarningsPanel(PurchaseReport.collectFromAdminForm());
    });

    document.getElementById('admin-price-trend')?.addEventListener('change', function () {
      var trend = this.value;
      if (!trend || !global.ReportPresets) return;
      ReportPresets.applyTrendToAdminForm(trend, getAdminPresetContext());
      if (global.PurchaseReport) updateQaWarningsPanel(PurchaseReport.collectFromAdminForm());
    });

    document.getElementById('admin-domestic-import-preset')?.addEventListener('change', function () {
      var preset = this.value;
      if (!preset || !global.ReportPresets) return;
      ReportPresets.applyDomesticImportToAdminForm(preset, getAdminPresetContext());
      if (global.PurchaseReport) updateQaWarningsPanel(PurchaseReport.collectFromAdminForm());
    });

    document.getElementById('admin-domestic-import')?.addEventListener('input', function () {
      var presetEl = document.getElementById('admin-domestic-import-preset');
      if (!presetEl || !global.ReportPresets) return;
      var expected = ReportPresets.getDomesticImportPresetText(presetEl.value, getAdminPresetContext());
      if (presetEl.value && this.value.trim() !== expected.trim()) {
        presetEl.value = '';
      }
    });
  }

  function init() {
    bindApiKeyEvents();
    bindEvents();
    refreshApiKeyUi(false);
  }

  global.AdminRequestWorkspace = {
    init: init,
    onModalOpen: onModalOpen,
    buildUnifiedFirebaseUpdate: buildUnifiedFirebaseUpdate,
    updateQaWarningsPanel: updateQaWarningsPanel,
    switchWorkspaceTab: switchWorkspaceTab,
    refreshApiKeyUi: refreshApiKeyUi,
    getReqNum: getReqNum
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
