'use strict';

var product = null;

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

    var response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
    if (!response || !response.ok) {
      setStatus('이 페이지에서는 상품 정보를 읽을 수 없습니다. 쿠팡·네이버 등 상품 상세 페이지에서 열어주세요.');
      return;
    }

    product = response.product;
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
