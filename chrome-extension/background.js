/**
 * PriceHunter 확장 — 백그라운드 서비스 워커
 */
'use strict';

var pendingPrefills = new Map();

chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.sync.get(['siteMode'], function (data) {
    if (!data.siteMode) {
      chrome.storage.sync.set({ siteMode: 'production' });
    }
  });
});

function deliverPrefill(tabId, product, attempt) {
  attempt = attempt || 0;
  chrome.tabs.sendMessage(tabId, { action: 'applyPrefill', product: product }, function () {
    if (chrome.runtime.lastError && attempt < 8) {
      setTimeout(function () {
        deliverPrefill(tabId, product, attempt + 1);
      }, 250);
    }
  });
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (!message || message.action !== 'openRequestPage') return;

  chrome.tabs.create({ url: message.url }, function (tab) {
    if (tab && tab.id != null && message.product) {
      pendingPrefills.set(tab.id, message.product);
    }
    sendResponse({ ok: true, tabId: tab && tab.id });
  });
  return true;
});

chrome.tabs.onUpdated.addListener(function (tabId, info) {
  if (info.status !== 'complete') return;
  if (!pendingPrefills.has(tabId)) return;
  var product = pendingPrefills.get(tabId);
  pendingPrefills.delete(tabId);
  deliverPrefill(tabId, product, 0);
});
