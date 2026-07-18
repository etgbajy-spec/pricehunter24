/**
 * Chrome 웹스토어 설치 URL — index.html CTA가 이 값을 사용합니다.
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
    chromeWebStoreUrl:
      stored ||
      'https://chromewebstore.google.com/detail/ladlnjgdboeacihmdloegaclfjkdcjnf',
    privacyPolicyUrl: 'https://pricehunt24.com/extension-privacy.html',
    devInstallGuideUrl: 'chrome-extension/README.md',
    manifestVersion: '1.8.0'
  };
})(typeof window !== 'undefined' ? window : this);
