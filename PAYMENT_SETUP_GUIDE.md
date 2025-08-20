# 토스페이먼츠 결제 시스템 설정 가이드

## 📋 1단계: 토스페이먼츠 가입 및 상점 등록

### 1.1 토스페이먼츠 가입
1. **가입**: https://pay.toss.im/
2. **본인인증**: 휴대폰 인증
3. **이메일 인증**: 이메일 주소 확인

### 1.2 상점 등록
1. **상점 등록 신청**:
   - "상점 등록" 클릭
   - 사업자등록증 업로드
   - 은행 계좌 정보 입력
   - 상점명: `PriceHunter`
   - 업종: `전자상거래`
2. **승인 대기**: 1-2일 소요
3. **승인 완료 후**: 운영 키 발급

### 1.3 API 키 발급
1. **테스트 키**: 가입 즉시 발급
   - 형식: `test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq`
2. **운영 키**: 상점 승인 후 발급
   - 형식: `live_ck_...`

## 🔧 2단계: 코드 설정

### 2.1 payment.html 수정
**파일**: `pricehunter-production/payment.html`

```javascript
// 67번째 줄 근처에서 변경
const clientKey = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'; // 테스트 키
// 상점 승인 후 운영 키로 변경
// const clientKey = 'live_ck_실제_운영_키';
```

### 2.2 웹훅 URL 설정
**토스페이먼츠 콘솔에서 설정**:
- **성공 URL**: `https://yourdomain.com/payment-success.html`
- **실패 URL**: `https://yourdomain.com/payment-fail.html`

### 2.3 결제 금액 설정
**파일**: `pricehunter-production/payment.html`

```javascript
// 결제 정보 설정 (300번째 줄 근처)
const paymentData = {
  amount: parseInt(document.getElementById('product-price').textContent.replace(/[^0-9]/g, '')),
  orderId: orderNumber,
  orderName: document.getElementById('product-name').textContent,
  customerName: document.getElementById('payer-name').value,
  customerEmail: document.getElementById('payer-email').value,
  customerMobilePhone: document.getElementById('payer-phone').value,
  successUrl: window.location.origin + '/payment-success.html?order=' + orderNumber,
  failUrl: window.location.origin + '/payment-fail.html?order=' + orderNumber,
  windowTarget: 'iframe'
};
```

## 🧪 3단계: 테스트

### 3.1 테스트 결제
1. **테스트 카드 정보**:
   - 카드번호: `4111-1111-1111-1111`
   - 유효기간: `12/25`
   - CVC: `123`
   - 비밀번호: `00`

2. **테스트 결제 진행**:
   - 상품 선택
   - 결제 정보 입력
   - 테스트 카드로 결제
   - 성공/실패 페이지 확인

### 3.2 결제 로그 확인
```javascript
// 브라우저 콘솔에서 확인
console.log('결제 요청:', {
  amount: 1000,
  orderId: 'PH-1234567890',
  orderName: '테스트 상품'
});
```

## 💰 4단계: 수수료 및 정산

### 4.1 수수료 구조
- **신용카드**: 2.8% + 부가세
- **간편결제**: 2.5% + 부가세
- **계좌이체**: 0.5% + 부가세

### 4.2 정산 일정
- **T+2**: 결제일로부터 2일 후 정산
- **정산 계좌**: 상점 등록 시 입력한 계좌
- **정산 금액**: 결제 금액 - 수수료

### 4.3 예상 수수료 (10만원 결제 기준)
- **신용카드**: 2,800원 + 280원 = 3,080원
- **간편결제**: 2,500원 + 250원 = 2,750원
- **계좌이체**: 500원 + 50원 = 550원

## ⚠️ 주의사항

### 4.1 법적 요구사항
- **사업자등록증 필수**: 개인은 상점 등록 불가
- **전자상거래법 준수**: 환불, 교환 정책 필수
- **개인정보처리방침**: 결제 정보 보호 정책

### 4.2 보안 요구사항
- **HTTPS 필수**: 모든 결제 페이지 HTTPS
- **PCI DSS 준수**: 카드 정보 보안 표준
- **웹훅 검증**: 결제 상태 실시간 확인

### 4.3 운영 주의사항
- **테스트 모드**: 개발 중에는 테스트 키 사용
- **운영 모드**: 실제 서비스 시 운영 키 사용
- **모니터링**: 결제 실패율, 성공률 모니터링

## 🔍 문제 해결

### 자주 발생하는 문제

#### 1. 상점 미승인
```
Error: Store not approved
```
**해결**: 사업자등록증 업로드 후 승인 대기

#### 2. API 키 오류
```
Error: Invalid client key
```
**해결**: 올바른 API 키 사용 확인

#### 3. 웹훅 오류
```
Error: Webhook failed
```
**해결**: 웹훅 URL 설정 확인

#### 4. 결제 실패
```
Error: Payment failed
```
**해결**: 카드 정보, 잔액 확인

## 📊 5단계: 운영 모니터링

### 5.1 결제 대시보드
- **일일 결제 건수**: 실시간 모니터링
- **결제 성공률**: 목표 95% 이상
- **평균 결제 금액**: 고객 구매 패턴 분석

### 5.2 알림 설정
- **결제 실패 알림**: 즉시 관리자에게 알림
- **대금 정산 알림**: 정산 완료 시 알림
- **수수료 알림**: 월 수수료 정산 시 알림

## 📞 지원

- **토스페이먼츠 고객센터**: 1661-4055
- **기술 문서**: https://docs.tosspayments.com/
- **개발자 포럼**: https://forum.tosspayments.com/

---

**✅ 완료 체크리스트**:
- [ ] 토스페이먼츠 가입
- [ ] 상점 등록 및 승인
- [ ] API 키 발급 (테스트/운영)
- [ ] 코드 설정 완료
- [ ] 웹훅 URL 설정
- [ ] 테스트 결제 성공
- [ ] 운영 모드 전환 준비 