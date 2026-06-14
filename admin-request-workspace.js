/**
 * 관리자 의뢰 통합 워크스페이스 — AI 분석 + 구매판단 리포트 + 고객 답변
 */
(function (global) {
  'use strict';

  var currentRequest = null;
  var lastPriceData = null;
  var lastPipelineDraft = null;
  var activeTab = 'ai';

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
    ['ai', 'report', 'notify'].forEach(function (name) {
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
      var needsAi = global.RequestDataSync && RequestDataSync.requestNeedsPipeline(request);
      setPipelineStatus(needsAi ? 'AI 분석 대기' : '대기', needsAi ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600');
      setPipelineMsg(
        needsAi
          ? '신규 의뢰입니다. 「전체 파이프라인 실행」으로 AI 초안을 생성하세요.'
          : '「전체 파이프라인 실행」으로 AI 초안을 생성할 수 있습니다.',
        'info'
      );
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

  function getAdminPresetContext() {
    if (!global.ReportPresets) return {};
    return ReportPresets.buildAdminFormContextFromRequest(currentRequest, {
      lowestPrice: adminFormVal('admin-price') || adminFormVal('admin-lowest-price'),
      requestedPrice: adminFormVal('admin-requested-price') || (currentRequest && currentRequest.price),
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
    var requestedEl = document.getElementById('admin-requested-price');
    if (requestedEl && !requestedEl.value) {
      var priceVal = request.originalPrice != null ? request.originalPrice : request.price;
      if (priceVal != null && priceVal !== '') requestedEl.value = priceVal;
    }
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

  async function handleRunPipeline() {
    if (!currentRequest) return;
    if (!ensureApiKeyBeforePipeline()) return;
    var btn = document.getElementById('admin-btn-run-pipeline');
    if (btn) btn.disabled = true;
    setPipelineStatus('실행 중…', 'bg-indigo-500 text-white');
    setPipelineMsg('가격 수집 및 AI 초안 생성 중… (10~30초)', 'info');
    try {
      var result = await AnalysisPipelineClient.runPipeline(requestForPipeline(currentRequest));
      lastPipelineDraft = result.draft;
      lastPriceData = result.priceData;
      setPipelineStatus('완료', 'bg-green-500 text-white');
      setPipelineMsg('✅ 파이프라인 완료. 초안을 검수한 뒤 「초안 폼에 적용」을 누르세요.', 'ok');
      showDraftPreview(result.draft, result.priceData, result.mode);
      switchWorkspaceTab('ai');
      refreshApiKeyUi(false);
    } catch (e) {
      handlePipelineError(e);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleCollectPrices() {
    if (!currentRequest) return;
    if (!ensureApiKeyBeforePipeline()) return;
    setPipelineStatus('수집 중…', 'bg-emerald-500 text-white');
    setPipelineMsg('참고 URL 및 의뢰가 분석 중…', 'info');
    try {
      var result = await AnalysisPipelineClient.collectPricesOnly(requestForPipeline(currentRequest));
      lastPriceData = result.priceData;
      var summaryEl = document.getElementById('admin-ai-collect-summary');
      if (summaryEl) {
        summaryEl.textContent = '💰 ' + (result.priceData.summary || '수집 완료');
        summaryEl.classList.remove('hidden');
      }
      setPipelineStatus('수집 완료', 'bg-emerald-500 text-white');
      setPipelineMsg('✅ 가격 수집 완료. 「AI 초안만」으로 리포트 초안을 생성할 수 있습니다.', 'ok');
      refreshApiKeyUi(false);
    } catch (e) {
      handlePipelineError(e);
    }
  }

  async function handleGenerateDraft() {
    if (!currentRequest) return;
    if (!ensureApiKeyBeforePipeline()) return;
    setPipelineStatus('생성 중…', 'bg-purple-500 text-white');
    setPipelineMsg('AI 초안 생성 중…', 'info');
    try {
      var result = await AnalysisPipelineClient.generateDraftOnly(requestForPipeline(currentRequest), lastPriceData);
      lastPipelineDraft = result.draft;
      if (result.priceData) lastPriceData = result.priceData;
      setPipelineStatus('초안 준비', 'bg-purple-500 text-white');
      setPipelineMsg('✅ AI 초안 생성. 검수 후 폼에 적용하세요.', 'ok');
      showDraftPreview(result.draft, lastPriceData, result.mode);
      var reqNum = getReqNum(currentRequest);
      AnalysisPipelineClient.saveDraft(reqNum, result.draft, { mode: result.mode, priceData: lastPriceData });
      refreshApiKeyUi(false);
    } catch (e) {
      handlePipelineError(e);
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
    setPipelineMsg('✅ API 키가 저장되었습니다. 이제 파이프라인을 실행할 수 있습니다.', 'ok');
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
    switchWorkspaceTab('ai');
    setPipelineMsg('⚠️ 파이프라인 실행 전 API 키를 입력하고 「저장」해 주세요.', 'err');
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
      switchWorkspaceTab('ai');
    }
  }

  function handleApplyDraft() {
    if (!lastPipelineDraft) {
      alert('적용할 초안이 없습니다. 먼저 파이프라인을 실행하세요.');
      return;
    }
    if (!confirm('AI 초안을 리포트 폼에 적용합니다.\n기존 입력 내용은 덮어씁니다. 계속할까요?')) return;
    AnalysisPipelineClient.applyDraftToForm(lastPipelineDraft);
    syncReportToCustomerForm(lastPipelineDraft);
    updateQaWarningsPanel(lastPipelineDraft);
    setPipelineMsg('✅ 초안이 적용되었습니다. 리포트 탭에서 검수 후 저장하세요.', 'ok');
    switchWorkspaceTab('report');
  }

  function onModalOpen(request) {
    currentRequest = request;
    lastPriceData = null;
    lastPipelineDraft = null;
    refreshApiKeyUi(false);
    loadReportForm(request);
    loadPipelineState(request);
    switchWorkspaceTab(
      global.RequestDataSync && RequestDataSync.requestNeedsPipeline(request) ? 'ai' : 'report'
    );

    var hasKey = global.AnalysisPipelineClient && AnalysisPipelineClient.getAdminApiKey();
    if (!hasKey) {
      switchWorkspaceTab('ai');
      setPipelineMsg('⚠️ AI 파이프라인 사용 전 API 키를 입력하고 「저장」해 주세요.', 'info');
      return;
    }

    if (global.RequestDataSync && RequestDataSync.requestNeedsPipeline(request)) {
      setTimeout(function () {
        if (confirm('🤖 AI 분석 대기 중인 의뢰입니다.\n\n지금 「전체 파이프라인 실행」을 시작할까요?')) {
          handleRunPipeline();
        }
      }, 500);
    } else if (!request.purchaseReport && !request.adminResponse && !request.response) {
      var st = String(request.status || '');
      if (!['completed', '답변완료', '완료'].includes(st)) {
        setTimeout(function () {
          if (confirm('🤖 아직 답변이 없는 의뢰입니다.\n\nAI 파이프라인을 실행할까요?')) {
            handleRunPipeline();
          }
        }, 500);
      }
    }
  }

  function bindEvents() {
    document.getElementById('admin-ws-tab-ai')?.addEventListener('click', function () { switchWorkspaceTab('ai'); });
    document.getElementById('admin-ws-tab-report')?.addEventListener('click', function () { switchWorkspaceTab('report'); });
    document.getElementById('admin-ws-tab-notify')?.addEventListener('click', function () { switchWorkspaceTab('notify'); });
    document.getElementById('admin-btn-run-pipeline')?.addEventListener('click', handleRunPipeline);
    document.getElementById('admin-btn-collect-prices')?.addEventListener('click', handleCollectPrices);
    document.getElementById('admin-btn-generate-draft')?.addEventListener('click', handleGenerateDraft);
    document.getElementById('admin-btn-apply-draft')?.addEventListener('click', handleApplyDraft);
    document.getElementById('admin-btn-sync-from-report')?.addEventListener('click', function () {
      if (global.PurchaseReport) syncReportToCustomerForm(PurchaseReport.collectFromAdminForm());
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
