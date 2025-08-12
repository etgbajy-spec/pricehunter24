# 📊 Google Analytics 설정 가이드

## 1단계: Google Analytics 계정 생성

### 계정 생성
1. https://analytics.google.com 접속
2. "측정 시작" 클릭
3. 계정 정보 입력:
   - 계정명: PriceHunter
   - 데이터 공유 설정: 선택사항
4. 속성 정보 입력:
   - 속성명: PriceHunter Website
   - 보고 시간대: Asia/Seoul
   - 통화: KRW
5. 비즈니스 정보 입력
6. "만들기" 클릭

### 측정 ID 확인
- 생성 후 측정 ID 복사 (G-XXXXXXXXXX 형식)
- 예: G-ABC123DEF4

## 2단계: 추적 코드 설치

### 각 HTML 파일에 추가할 코드
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 파일별 설치 위치
- index.html (메인 페이지)
- request-v2.html (의뢰 페이지)
- result-search.html (결과 조회 페이지)
- contact.html (1:1 문의 페이지)
- payment.html (결제 페이지)
- orders.html (주문 목록 페이지)
- mypage.html (마이페이지)

## 3단계: 이벤트 추적 설정

### 주요 이벤트 추적
```javascript
// 회원가입 완료
gtag('event', 'sign_up', {
  'method': 'email'
});

// 의뢰 제출
gtag('event', 'submit_form', {
  'form_name': 'price_request'
});

// 결제 시작
gtag('event', 'begin_checkout', {
  'currency': 'KRW',
  'value': 50000
});

// 결제 완료
gtag('event', 'purchase', {
  'currency': 'KRW',
  'value': 50000,
  'transaction_id': 'PH-123456'
});
```

## 4단계: 실시간 데이터 확인

### 확인 방법
1. Google Analytics 대시보드 접속
2. "실시간" 메뉴 클릭
3. "개요" 확인
4. 현재 방문자 수 및 페이지뷰 확인

## 5단계: 목표 설정

### 전환 목표 설정
1. "관리" → "목표" → "새 목표"
2. 목표 유형 선택:
   - 회원가입 완료
   - 의뢰 제출 완료
   - 결제 완료
   - 문의 제출 완료

### 목표 값 설정
- 회원가입: 1회당 1,000원
- 의뢰 제출: 1회당 5,000원
- 결제 완료: 실제 결제 금액
- 문의 제출: 1회당 500원

## 6단계: 보고서 설정

### 주요 보고서
1. **사용자 획득**: 어디서 방문자가 오는지
2. **사용자 행동**: 어떤 페이지를 주로 보는지
3. **전환**: 목표 달성률
4. **실시간**: 현재 방문자 현황

### 대시보드 설정
1. "사용자 정의" → "대시보드" → "만들기"
2. 주요 지표 위젯 추가:
   - 세션 수
   - 사용자 수
   - 페이지뷰
   - 전환율
   - 수익

## 7단계: 테스트

### 추적 코드 테스트
1. 사이트 방문
2. 개발자 도구 → Network 탭
3. gtag 요청 확인
4. Google Analytics 실시간 데이터 확인

### 이벤트 테스트
1. 회원가입 진행
2. 의뢰 제출 진행
3. 결제 페이지 방문
4. 각 이벤트가 정상 추적되는지 확인

## 8단계: 알림 설정

### 알림 설정
1. "관리" → "속성" → "속성 설정"
2. "데이터 보존" 설정
3. "사용자 ID" 설정 (선택사항)
4. "데이터 수집" 설정

### 이메일 알림
1. "관리" → "계정" → "사용자 관리"
2. 알림 설정 구성
3. 주간/월간 보고서 자동 발송 설정

## 완료 확인 체크리스트

- [ ] Google Analytics 계정 생성
- [ ] 측정 ID 확인
- [ ] 추적 코드 모든 페이지에 설치
- [ ] 실시간 데이터 확인
- [ ] 목표 설정
- [ ] 이벤트 추적 테스트
- [ ] 보고서 설정
- [ ] 알림 설정

## 다음 단계

Google Analytics 설정 완료 후:
1. Google Search Console 설정
2. 사이트맵 제출
3. 성능 최적화
4. SEO 최적화 