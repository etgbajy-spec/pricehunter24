# Chrome 웹스토어 배포 가이드 (PriceHunter 확장)

## 준비 완료된 것

- `manifest.json` v1.3.0 (MV3)
- 아이콘 `icons/icon16.png`, `icon48.png`, `icon128.png`
- 개인정보처리방침: https://pricehunt24.com/privacy.html#chrome-extension
- 제출용 ZIP: 프로젝트 루트에서 아래 명령 실행

```powershell
cd chrome-extension
.\package-for-store.ps1
```

생성 파일: `dist/pricehunter-extension.zip`

---

## 1단계 — 개발자 계정 (최초 1회)

1. Google 계정으로 접속: https://chrome.google.com/webstore/devconsole
2. **개발자 등록** (일회성 **$5** 결제)
3. **새 항목** → **Chrome 확장 프로그램** 선택

---

## 2단계 — ZIP 업로드

1. `dist/pricehunter-extension.zip` 업로드
2. 자동으로 `manifest.json` 내용이 읽힘

> ZIP 안에 `chrome-extension` 폴더가 들어가면 안 됩니다.  
> `manifest.json`이 ZIP 최상위에 있어야 합니다. (`package-for-store.ps1`이 이 구조로 만듦)

---

## 3단계 — 스토어 등록 정보 (한국어)

### 이름
`PriceHunter — 구매판단 리포트`

### 요약 설명 (132자 이내)
```
쿠팡·네이버·11번가·G마켓 상품 페이지에서 가격·옵션을 읽어 구매판단 리포트 의뢰 폼을 자동으로 채웁니다.
```

### 상세 설명 (예시)
```
PriceHunter 크롬 확장 프로그램은 쇼핑몰 상품 페이지에서 링크·상품명·가격·선택 옵션을 읽어,
구매판단 리포트 의뢰 페이지(request-lite)를 자동으로 채워 줍니다.

【지원 쇼핑몰】
· 쿠팡 · 네이버 스마트스토어 · 11번가 · G마켓 · 옥션

【사용 방법】
1. 상품 페이지에서 옵션을 선택합니다.
2. 우측 하단 「구매판단 의뢰」 버튼 또는 툴바 아이콘을 클릭합니다.
3. PriceHunter 의뢰 페이지가 열리며 정보가 자동 입력됩니다.
4. 이메일을 입력하고 의뢰를 제출합니다.

【수집·전송 데이터】
· 사용자가 의뢰 버튼을 누를 때만 상품 URL, 상품명, 가격, 옵션을 pricehunt24.com 의뢰 페이지로 전달합니다.
· 쇼핑몰 페이지를 열었다고 해서 자동으로 서버에 전송하지 않습니다.

【개인정보처리방침】
https://pricehunt24.com/privacy.html#chrome-extension
```

### 카테고리
`쇼핑` 또는 `생산성`

### 언어
한국어

### 개인정보처리방침 URL (필수)
```
https://pricehunt24.com/privacy.html#chrome-extension
```

### 단일 용도 설명 (심사용, 영문 권장)
```
This extension reads product name, price, and selected options from supported Korean e-commerce product pages only when the user clicks the request button, then opens the PriceHunter request form with those fields prefilled. No data is sent without explicit user action.
```

---

## 4단계 — 스크린샷 (필수)

최소 **1장**, 권장 **3~5장** (1280×800 또는 640×400)

| # | 찍을 화면 | 팁 |
|---|----------|-----|
| 1 | 쿠팡/네이버 상품 페이지 + FAB 「구매판단 의뢰」 | 옵션 선택 후 |
| 2 | 확장 팝업 (상품 정보 미리보기) | 툴바 아이콘 클릭 |
| 3 | `request-lite.html` 자동 채워진 폼 | 확장에서 연 뒤 |
| 4 | (선택) 의뢰 완료 화면 | |

Windows: `Win + Shift + S`로 영역 캡처 후 그림판에서 1280px 너비로 리사이즈.

---

## 5단계 — 권한·데이터 공개 (대시보드)

심사 양식에서 아래처럼 기재:

| 항목 | 내용 |
|------|------|
| 호스트 권한 | 지원 쇼핑몰 + pricehunt24.com (의뢰 페이지 연동) |
| 수집 데이터 | 상품 URL, 상품명, 가격, 옵션 (버튼 클릭 시에만) |
| 용도 | 의뢰 폼 자동 입력 |
| 제3자 전송 | pricehunt24.com (사용자가 의뢰 제출 시) |
| storage | 연결 사이트 설정(운영/로컬) 저장 |

---

## 6단계 — 심사 제출

1. **패키지** 탭에서 ZIP 업로드 확인
2. **스토어 등록정보** 탭 작성 완료
3. **개인정보 보호** 탭 작성
4. **배포** → **비공개 테스트** 또는 **공개** 제출

심사는 보통 **1~3영업일** (첫 제출은 권한 질문이 올 수 있음).

---

## 7단계 — 승인 후 사이트 연동

1. 웹스토어에서 확장 **상세 URL** 복사  
   예: `https://chrome.google.com/webstore/detail/pricehunter/xxxxxxxx`
2. `extension-store-config.js` 수정:

```javascript
chromeWebStoreUrl: 'https://chrome.google.com/webstore/detail/pricehunter/xxxxxxxx',
```

3. 사이트 배포 (Netlify push) → 랜딩 「크롬 확장 설치」 링크가 웹스토어로 자동 전환

---

## 업데이트 배포

1. `manifest.json`의 `version` 올리기 (예: 1.3.0 → 1.3.1)
2. `package-for-store.ps1`로 새 ZIP 생성
3. 개발자 콘솔 → 해당 항목 → **패키지** → 새 ZIP 업로드 → 제출

> 사용자 브라우저는 웹스토어를 통해 자동 업데이트됩니다.  
> 개발자 모드로 설치한 경우에는 `chrome://extensions`에서 수동 새로고침이 필요합니다.

---

## 자주 거절되는 경우

- 개인정보처리방침 URL 404 → `privacy.html` 배포 확인
- 권한이 넓은데 설명 부족 → 「버튼 클릭 시에만 전송」 명시
- 스크린샷에 실제 기능 미표시 → FAB·팝업·의뢰 폼 3장 준비
- ZIP 구조 오류 → `package-for-store.ps1` 사용

문의: Chrome Web Store 개발자 대시보드 → 해당 항목 → **지원** 탭
