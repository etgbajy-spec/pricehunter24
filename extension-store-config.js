/**
 * Chrome 웹스토어 배포 후 상세 URL을 넣으면 index.html 설치 링크가 자동 전환됩니다.
 *
 * 설정 방법:
 * 1) 스토어 게시 후 상세 페이지 URL을 chromeWebStoreUrl에 붙여넣기
 * 2) 또는 브라우저 콘솔에서 localStorage.setItem('ph_chrome_store_url', 'https://...')
 *
 * 예: https://chrome.google.com/webstore/detail/pricehunter/<ITEM_ID>
 */
(function (global) {
  'use strict';

  var stored = '';
  try {
    stored = (global.localStorage && global.localStorage.getItem('ph_chrome_store_url')) || '';
  } catch (e) {
    stored = '';
  }

  global.PH_EXTENSION_STORE = {
    // 스토어 게시 완료 시 아래에 실제 URL을 넣으세요.
    chromeWebStoreUrl: stored || '',
    privacyPolicyUrl: 'https://pricehunt24.com/extension-privacy.html',
    devInstallGuideUrl: 'chrome-extension/README.md',
    manifestVersion: '1.8.0'
  };
})(typeof window !== 'undefined' ? window : this);
