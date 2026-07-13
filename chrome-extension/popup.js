'use strict';

var product = null;
var currentTabUrl = '';

var CONTENT_SCRIPTS = [
  'lib/config.js',
  'content/extract.js',
  'lib/open-request.js'
];

var SUSPICIOUS_OPTION_RE =
  /다른\s*컬러|비슷한\s*상품|이\s*상품과\s*비슷|추천\s*상품|함께\s*본|컬러\s*[&＆]\s*디자인\s*상품|상품\s*바로가기|이\s*상품담기|선택해\s*주세요|옵션\s*선택|필수\s*옵션/i;

function formatPrice(num) {
  if (!num) return '—';
  return Number(num).toLocaleString('ko-KR') + '원';
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function isSuspiciousOption(option) {
  if (!option) return false;
  var t = String(option).trim();
  if (!t || t === '(옵션 없음 — 의뢰 시 입력)') return false;
  if (SUSPICIOUS_OPTION_RE.test(t)) return true;
  if (/상품\s*\d+\s*\/\s*\d+/i.test(t)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(t)) return true;
  return false;
}

function updateOptionWarning(option) {
  var warning = document.getElementById('option-warning');
  var collectHint = document.getElementById('option-collect-hint');
  var refreshBtn = document.getElementById('btn-refresh');
  var valueEl = document.getElementById('pv-option');
  var suspicious = isSuspiciousOption(option);
  var empty = !option || option === '(옵션 없음 — 의뢰 시 입력)';

  warning.classList.toggle('hidden', !suspicious);
  if (collectHint) collectHint.classList.toggle('hidden', !empty && !suspicious);
  if (refreshBtn) refreshBtn.classList.toggle('hidden', !empty && !suspicious);
  valueEl.classList.toggle('ph-value--warn', suspicious || empty);

  if (suspicious) {
    warning.textContent =
      '옵션이 정확하지 않을 수 있습니다. 상품 페이지에서 옵션을 선택한 뒤 「다시 읽기」를 눌러 주세요.';
  }
}

function renderPreview(data) {
  document.getElementById('preview').classList.remove('hidden');
  document.getElementById('pv-marketplace').textContent = data.marketplace || '—';
  document.getElementById('pv-name').textContent = data.productName || '(상품명 확인 중)';
  document.getElementById('pv-price').textContent = formatPrice(data.price);
  var optionText = data.option || '(옵션 없음 — 의뢰 시 입력)';
  document.getElementById('pv-option').textContent = optionText;
  updateOptionWarning(optionText);
}

function showCollectMode() {
  document.getElementById('preview').classList.remove('hidden');
  document.getElementById('manual-fallback').classList.add('hidden');
  document.getElementById('collect-actions').classList.remove('hidden');
}

function showManualOnlyMode(hint) {
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('manual-fallback').classList.remove('hidden');
  document.getElementById('collect-actions').classList.add('hidden');
  document.getElementById('fallback-hint').textContent = hint;
  enableButtons(false);
}

function openRequest(member) {
  if (!product) return;
  if (globalThis.PHOpenRequest && PHOpenRequest.openRequestPage) {
    PHOpenRequest.openRequestPage(product, member);
    return;
  }
  var url = PH_EXTENSION.buildRequestUrl(product, {
    siteBase: PH_EXTENSION.DEFAULT_SITE,
    member: member
  });
  chrome.tabs.create({ url: url });
}

function openManualEntry() {
  var p = isSupportedMallUrl(currentTabUrl)
    ? fallbackProductFromUrl(currentTabUrl)
    : { url: '', productName: '', price: null, option: '', marketplace: '' };
  openRequestWithProduct(p, false);
}

function openRequestWithProduct(p, member) {
  if (globalThis.PHOpenRequest && PHOpenRequest.openRequestPage) {
    PHOpenRequest.openRequestPage(p, member);
    return;
  }
  var url = PH_EXTENSION.buildRequestUrl(p, {
    siteBase: PH_EXTENSION.DEFAULT_SITE,
    member: member
  });
  chrome.tabs.create({ url: url });
}

function enableButtons(enabled) {
  document.getElementById('btn-guest').disabled = !enabled;
  document.getElementById('btn-member').disabled = !enabled;
}

function isSupportedMallUrl(url) {
  return /coupang\.com|smartstore\.naver|brand\.naver|shopping\.naver|11st\.co\.kr|gmarket\.co\.kr|auction\.co\.kr/i.test(url || '');
}

function detectMarketplaceFromUrl(url) {
  if (/coupang/i.test(url)) return '쿠팡';
  if (/smartstore|brand\.naver|shopping\.naver/i.test(url)) return '네이버';
  if (/11st/i.test(url)) return '11번가';
  if (/gmarket/i.test(url)) return 'G마켓';
  if (/auction/i.test(url)) return '옥션';
  return '쇼핑몰';
}

function fallbackProductFromUrl(url) {
  return {
    url: PH_EXTENSION.cleanProductUrl(url),
    productName: '',
    price: null,
    option: '',
    marketplace: detectMarketplaceFromUrl(url),
    isProductPage: true
  };
}

function mapExtractedProduct(data, url) {
  return {
    url: PH_EXTENSION.cleanProductUrl(data.url || url),
    productName: data.productName || data.title || '',
    price: data.price != null ? data.price : null,
    option: data.option || '',
    marketplace: data.marketplace || detectMarketplaceFromUrl(url),
    isProductPage: data.isProductPage !== false
  };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function injectContentScripts(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) return;
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: CONTENT_SCRIPTS
  });
}

async function requestExtract(tabId) {
  var lastError = null;
  for (var attempt = 0; attempt < 4; attempt++) {
    try {
      var response = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
      if (response && response.ok && response.product) return response;
      if (response && response.product) return { ok: true, product: response.product };
      lastError = new Error('empty_response');
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        try {
          await injectContentScripts(tabId);
        } catch (injectErr) { /* ignore */ }
      }
      if (attempt < 3) await sleep(350);
    }
  }
  throw lastError || new Error('extract_failed');
}

function bindOptionTip() {
  var btn = document.getElementById('option-tip-btn');
  var tip = document.getElementById('option-tip');
  if (!btn || !tip) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var pinned = tip.classList.toggle('ph-tip--pinned');
    btn.setAttribute('aria-expanded', pinned ? 'true' : 'false');
  });

  document.addEventListener('click', function () {
    tip.classList.remove('ph-tip--pinned');
    btn.setAttribute('aria-expanded', 'false');
  });
}

async function loadFromCurrentTab(tab) {
  currentTabUrl = tab.url || '';
  setStatus('페이지 정보를 읽는 중…');
  try {
    var response = await requestExtract(tab.id);
    product = mapExtractedProduct(response.product, tab.url);

    var rawOption = product.option;
    if (isSuspiciousOption(product.option)) {
      product.option = '';
    }

    showCollectMode();
    if (!product.isProductPage) {
      setStatus('상품 상세 페이지가 아닐 수 있습니다. 옵션을 확인한 뒤 의뢰해 주세요.');
    } else if (!product.option && rawOption) {
      setStatus('옵션을 다시 확인해 주세요. 상품 페이지에서 선택 후 「다시 읽기」를 눌러 주세요.');
    } else if (!product.option) {
      setStatus('옵션을 선택한 뒤 「다시 읽기」를 눌러 주세요.');
    } else {
      setStatus('아래 정보를 확인한 뒤 의뢰해 주세요.');
    }
    renderPreview(product);
    enableButtons(true);
  } catch (err) {
    showManualOnlyMode(
      '상품 정보를 자동으로 읽지 못했습니다. 의뢰 페이지에서 링크·옵션·가격을 직접 입력해 주세요.'
    );
    setStatus('자동 수집에 실패했습니다.');
  }
}

async function refreshFromTab() {
  var refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '읽는 중…';
  }
  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab || !tab.id) throw new Error('no_tab');
    await loadFromCurrentTab(tab);
  } catch (err) {
    setStatus('다시 읽기에 실패했습니다. 상품 페이지에서 옵션을 선택했는지 확인해 주세요.');
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '다시 읽기';
    }
  }
}

async function init() {
  bindOptionTip();
  document.getElementById('btn-guest').addEventListener('click', function () { openRequest(false); });
  document.getElementById('btn-member').addEventListener('click', function () { openRequest(true); });
  document.getElementById('btn-manual-entry').addEventListener('click', openManualEntry);
  var refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshFromTab);

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    currentTabUrl = (tab && tab.url) || '';

    if (!tab || !tab.id) {
      showManualOnlyMode('활성 탭을 찾을 수 없습니다. 의뢰 페이지에서 직접 입력해 주세요.');
      setStatus('탭 정보를 읽을 수 없습니다.');
      return;
    }

    if (!isSupportedMallUrl(tab.url)) {
      showManualOnlyMode(
        '지원 쇼핑몰 상품 페이지가 아닙니다. 의뢰 페이지에서 상품 링크와 옵션을 직접 입력해 주세요.'
      );
      setStatus('자동 수집을 지원하지 않는 페이지입니다.');
      return;
    }

    await loadFromCurrentTab(tab);
  } catch (err) {
    showManualOnlyMode('의뢰 페이지에서 링크·옵션·가격을 직접 입력해 주세요.');
    setStatus('자동 수집에 실패했습니다.');
  }
}

init();
