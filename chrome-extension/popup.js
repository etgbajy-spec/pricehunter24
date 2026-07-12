'use strict';

var product = null;

var CONTENT_SCRIPTS = [
  'lib/config.js',
  'content/extract.js',
  'lib/open-request.js'
];

function formatPrice(num) {
  if (!num) return '—';
  return Number(num).toLocaleString('ko-KR') + '원';
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function renderPreview(data) {
  document.getElementById('preview').classList.remove('hidden');
  document.getElementById('pv-marketplace').textContent = data.marketplace || '—';
  document.getElementById('pv-name').textContent = data.productName || '(상품명 확인 중)';
  document.getElementById('pv-price').textContent = formatPrice(data.price);
  document.getElementById('pv-option').textContent = data.option || '(옵션 없음 — 의뢰 시 입력)';
}

function openRequest(member) {
  if (!product) return;
  if (globalThis.PHOpenRequest && PHOpenRequest.openRequestPage) {
    PHOpenRequest.openRequestPage(product, member);
    return;
  }
  chrome.storage.sync.get(['siteMode'], function (storage) {
    var siteBase = storage.siteMode === 'local' ? PH_EXTENSION.LOCAL_SITE : PH_EXTENSION.DEFAULT_SITE;
    var url = PH_EXTENSION.buildRequestUrl(product, { siteBase: siteBase, member: member });
    chrome.tabs.create({ url: url });
  });
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

function fallbackProduct(tab) {
  return {
    url: tab.url,
    productName: '',
    price: null,
    option: '',
    marketplace: detectMarketplaceFromUrl(tab.url),
    isProductPage: true
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

async function init() {
  var siteSelect = document.getElementById('site-mode');
  chrome.storage.sync.get(['siteMode'], function (data) {
    siteSelect.value = data.siteMode === 'local' ? 'local' : 'production';
  });
  siteSelect.addEventListener('change', function () {
    chrome.storage.sync.set({ siteMode: siteSelect.value });
  });

  document.getElementById('btn-guest').addEventListener('click', function () { openRequest(false); });
  document.getElementById('btn-member').addEventListener('click', function () { openRequest(true); });

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];
    if (!tab || !tab.id) {
      setStatus('활성 탭을 찾을 수 없습니다.');
      return;
    }

    if (!isSupportedMallUrl(tab.url)) {
      setStatus('쿠팡·네이버·11번가·G마켓 상품 페이지에서 열어주세요.');
      return;
    }

    try {
      var response = await requestExtract(tab.id);
      product = response.product;
    } catch (err) {
      product = fallbackProduct(tab);
      setStatus('일부 정보만 읽었습니다. 링크는 자동 입력되며, 의뢰 페이지에서 확인해 주세요.');
      renderPreview(product);
      enableButtons(true);
      return;
    }

    if (!product.isProductPage) {
      setStatus('상품 상세 페이지가 아닐 수 있습니다. 그래도 의뢰는 가능합니다.');
    } else {
      setStatus('아래 정보를 확인한 뒤 의뢰해 주세요.');
    }

    renderPreview(product);
    enableButtons(true);
  } catch (err) {
    setStatus('지원 쇼핑몰 상품 페이지에서 확장 아이콘을 눌러주세요.');
    enableButtons(false);
  }
}

init();
