# PriceHunter Chrome Extension

쿠팡·네이버(스마트·브랜드)·11번가·G마켓·옥션 상품 페이지에서 **링크·상품명·가격·옵션**을 읽어 의뢰 폼을 자동으로 채웁니다.

**현재 버전:** 1.7.5

## 일반 사용자 — Chrome 웹스토어 (승인 후)

심사가 끝나면 [PriceHunter 랜딩](https://pricehunt24.com/)의 **Chrome 웹스토어에서 설치** 링크로 설치할 수 있습니다.

## 개발자 모드 설치 (심사 전·로컬 테스트)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`chrome-extension`) 선택

## 사용법

1. 쇼핑몰 **상품 상세 페이지** 접속
2. **옵션을 먼저 선택**한 뒤 우측 하단 **구매판단 의뢰** 버튼 클릭  
   또는 툴바의 PriceHunter 아이콘 → 팝업에서 **무료 의뢰**
3. `request-lite.html`이 열리며 **링크·상품명·가격·옵션**이 자동 입력됨
4. 이메일 입력 후 의뢰

> 코드 수정 후 `chrome://extensions`에서 확장 **새로고침** 필요.

## 로컬 개발

팝업 **설정 → 연결 사이트 → localhost:1000** 선택 후 `npm start`로 서버 실행.

## 지원 쇼핑몰

| 쇼핑몰 | 상품명 | 가격 | 옵션 |
|--------|--------|------|------|
| 네이버 스마트스토어 | ✅ | ✅ | ✅ |
| G마켓 / 옥션 | ✅ | ✅ | ✅ |
| 쿠팡 | ✅ | ✅ | ✅ |
| 11번가 | ✅ | ✅ | ✅ |
| 기타 | △ | △ | △ og/meta fallback |

## Chrome 웹스토어 제출

자세한 절차·스토어 문구·스크린샷 가이드:

👉 **[CHROME_WEB_STORE.md](./CHROME_WEB_STORE.md)**

ZIP 생성:

```powershell
cd chrome-extension
.\package-for-store.ps1
```

→ `dist/pricehunter-extension.zip` 을 [개발자 콘솔](https://chrome.google.com/webstore/devconsole)에 업로드

승인 후 `extension-store-config.js`의 `chromeWebStoreUrl`에 스토어 URL을 넣고 사이트를 배포하세요.
