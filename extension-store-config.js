/**
 * Chrome 웹스토어 배포 후 상세 URL을 여기에 넣으면 index.html 설치 링크가 자동 전환됩니다.
 * 예: https://chrome.google.com/webstore/detail/pricehunter/abcdefghijklmnop
 */
(function (global) {
  'use strict';
  global.PH_EXTENSION_STORE = {
    chromeWebStoreUrl: '',
    privacyPolicyUrl: 'https://pricehunt24.com/extension-privacy.html',
    devInstallGuideUrl: 'chrome-extension/README.md'
  };
})(typeof window !== 'undefined' ? window : this);
