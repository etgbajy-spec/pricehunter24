/**
 * 의뢰/분석 Job localStorage 동기화 (반자동 모드)
 */
(function (global) {
  'use strict';

  function normalizeReqNum(reqNum) {
    return String(reqNum || '').trim().replace(/^#+/, '');
  }

  function localRequestKey(reqNum) {
    return 'request-' + normalizeReqNum(reqNum);
  }

  function resultKey(reqNum) {
    return 'result-' + normalizeReqNum(reqNum);
  }

  function analysisJobKey(reqNum) {
    return 'analysisJob-' + normalizeReqNum(reqNum);
  }

  function saveRequestLocally(reqNum, data) {
    var normalized = normalizeReqNum(reqNum);
    var payload = Object.assign({}, data, {
      requestNumber: data.requestNumber || data.reqNum || ('#PH-' + normalized.replace(/^PH-/, ''))
    });
    if (!payload.url && payload.urls && payload.urls[0]) {
      payload.url = payload.urls[0];
    }
    if (!payload.description && payload.desc) {
      payload.description = payload.desc;
    }
    var json = JSON.stringify(payload);
    localStorage.setItem(localRequestKey(normalized), json);
    if (normalized !== String(reqNum).replace(/^#+/, '')) {
      localStorage.setItem('request-' + String(reqNum).replace(/^#+/, ''), json);
    }
    return payload;
  }

  function createPendingAnalysisJob(reqNum, extra) {
    var normalized = normalizeReqNum(reqNum);
    var job = Object.assign({
      status: 'pending',
      step: 'awaiting_pipeline',
      reqNum: normalized,
      createdAt: new Date().toISOString(),
      message: 'AI 분석 대기 중'
    }, extra || {});
    localStorage.setItem(analysisJobKey(normalized), JSON.stringify(job));
    return job;
  }

  function loadAnalysisJob(reqNum) {
    try {
      return JSON.parse(localStorage.getItem(analysisJobKey(reqNum)) || 'null');
    } catch (e) {
      return null;
    }
  }

  function updateAnalysisJob(reqNum, patch) {
    var job = loadAnalysisJob(reqNum) || { reqNum: normalizeReqNum(reqNum) };
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    localStorage.setItem(analysisJobKey(normalizeReqNum(reqNum)), JSON.stringify(job));
    return job;
  }

  function markJobPublished(reqNum) {
    return updateAnalysisJob(reqNum, {
      status: 'published',
      step: 'complete',
      message: '리포트 발행 완료'
    });
  }

  function isPendingAnalysis(reqNum) {
    var job = loadAnalysisJob(reqNum);
    if (!job) return false;
    if (job.status === 'published' || job.status === 'complete') return false;
    var hasResult = !!localStorage.getItem(resultKey(reqNum));
    if (hasResult) return false;
    return job.status === 'pending' || job.status === 'ready' || job.status === 'error';
  }

  function requestNeedsPipeline(req) {
    var reqNum = normalizeReqNum((req.key || '').replace('request-', '') || req.reqNum || req.requestNumber);
    if (!reqNum) return false;
    if (localStorage.getItem(resultKey(reqNum))) return false;
    var job = loadAnalysisJob(reqNum);
    return !job || job.status === 'pending' || job.status === 'error';
  }

  global.RequestDataSync = {
    normalizeReqNum: normalizeReqNum,
    localRequestKey: localRequestKey,
    resultKey: resultKey,
    analysisJobKey: analysisJobKey,
    saveRequestLocally: saveRequestLocally,
    createPendingAnalysisJob: createPendingAnalysisJob,
    loadAnalysisJob: loadAnalysisJob,
    updateAnalysisJob: updateAnalysisJob,
    markJobPublished: markJobPublished,
    isPendingAnalysis: isPendingAnalysis,
    requestNeedsPipeline: requestNeedsPipeline
  };
})(typeof window !== 'undefined' ? window : this);
