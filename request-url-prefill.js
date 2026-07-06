/**
 * URL 쿼리 · 확장 프로그램 → 의뢰 폼 자동 채우기
 */
(function (global) {
  'use strict';

  function getParams() {
    return new URLSearchParams(global.location.search);
  }

  function decodeParam(value) {
    if (value == null || value === '') return '';
    try {
      return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch (e) {
      return String(value);
    }
  }

  function setInputValue(id, value, force) {
    if (value == null || value === '') return false;
    var el = document.getElementById(id);
    if (!el) return false;
    if (!force && el.value) return false;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function showExtensionBanner(containerId) {
    var host = document.getElementById(containerId);
    if (!host || host.dataset.phExtBanner === '1') return;
    host.dataset.phExtBanner = '1';
    host.classList.remove('hidden');
  }

  function applyData(data, fields, opts) {
    fields = fields || {};
    opts = opts || {};
    var force = opts.force === true;
    if (!data || typeof data !== 'object') return { applied: false, fields: [] };

    var applied = [];
    var name = data.productName || data.name || '';
    var option = data.option || data.optionName || '';
    if (!option && opts.defaultOption) option = opts.defaultOption;

    if (setInputValue(fields.url || 'productUrl', data.url, force)) applied.push('url');
    if (setInputValue(fields.name || 'productName', name, force)) applied.push('name');
    if (setInputValue(fields.option || 'productOption', option, force)) applied.push('option');
    if (setInputValue(fields.price || 'productPrice', data.price, force)) applied.push('price');
    if (fields.desc && setInputValue(fields.desc, data.desc, force)) applied.push('desc');

    if (opts.showBanner && opts.bannerHostId) showExtensionBanner(opts.bannerHostId);
    return { applied: applied.length > 0, fields: applied };
  }

  function drainQueuedPrefill(fields, opts) {
    var queued = global.__PH_EXTENSION_PREFILL__;
    if (!queued) return null;
    global.__PH_EXTENSION_PREFILL__ = null;
    return applyData(queued, fields, {
      force: true,
      defaultOption: '단일옵션',
      showBanner: true,
      bannerHostId: (fields && fields.bannerHostId) || (opts && opts.bannerHostId)
    });
  }

  function apply(fields, opts) {
    fields = fields || {};
    opts = opts || {};
    var params = getParams();
    var fromExtension = params.get('from') === 'extension';
    if (!params.get('url') && !fromExtension) {
      return drainQueuedPrefill(fields, opts) || { applied: false, fromExtension: false };
    }

    var data = {
      url: decodeParam(params.get('url') || ''),
      name: decodeParam(params.get('name') || ''),
      option: decodeParam(params.get('option') || ''),
      price: decodeParam(params.get('price') || '')
    };

    var result = applyData(data, fields, {
      force: fromExtension,
      defaultOption: fromExtension ? '단일옵션' : '',
      showBanner: fromExtension,
      bannerHostId: fields.bannerHostId || opts.bannerHostId
    });

    var queued = drainQueuedPrefill(fields, opts);
    if (queued && queued.applied) {
      result = queued;
    }
    result.fromExtension = fromExtension;
    return result;
  }

  function bindExtensionListener(fields, opts) {
    fields = fields || {};
    opts = opts || {};

    function handlePrefill(e) {
      var detail = (e && e.detail) || {};
      applyData(detail, fields, {
        force: true,
        defaultOption: '단일옵션',
        showBanner: true,
        bannerHostId: fields.bannerHostId || opts.bannerHostId
      });
    }

    document.addEventListener('ph-extension-prefill', handlePrefill);
    drainQueuedPrefill(fields, opts);
  }

  global.RequestUrlPrefill = {
    apply: apply,
    applyData: applyData,
    showExtensionBanner: showExtensionBanner,
    bindExtensionListener: bindExtensionListener,
    drainQueuedPrefill: drainQueuedPrefill
  };
})(typeof window !== 'undefined' ? window : globalThis);
