// CSP 오류 해결을 위한 스크립트
// 개발자 도구에서 소스맵 비활성화 안내

console.log(`
🔧 CSP 오류 해결 방법:

1. 개발자 도구 열기 (F12)
2. Settings (⚙️) 클릭
3. "Enable JavaScript source maps" 체크 해제
4. 페이지 새로고침

또는

1. 개발자 도구 열기 (F12)
2. Console 탭에서 다음 명령어 실행:
   // @sourceURL=disabled
   
이렇게 하면 Firebase source map 관련 CSP 오류가 사라집니다.
`);

// Source map 비활성화 (가능한 경우)
if (typeof window !== 'undefined') {
  // 개발 환경에서만 실행
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 개발 환경에서 source map 비활성화 시도...');
    
    // Source map 요청 차단
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      if (typeof url === 'string' && url.includes('.map')) {
        console.log('🚫 Source map 요청 차단:', url);
        return Promise.reject(new Error('Source map blocked by CSP'));
      }
      return originalFetch.call(this, url, options);
    };
  }
}
