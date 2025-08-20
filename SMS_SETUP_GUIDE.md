# 네이버 클라우드 SMS 서비스 설정 가이드

## 📋 1단계: 네이버 클라우드 가입 및 SMS 서비스 신청

### 1.1 네이버 클라우드 가입
1. **가입**: https://www.ncloud.com/
2. **본인인증**: 휴대폰 인증
3. **결제 수단 등록**: 신용카드 등록

### 1.2 SMS 서비스 신청
1. **콘솔 접속**: https://console.ncloud.com/
2. **SMS 서비스 선택**: 
   - 메뉴 → AI·NAVER API → SMS
   - "SMS 서비스 신청" 클릭
3. **서비스 신청서 작성**:
   - 서비스명: `PriceHunter SMS`
   - 용도: `고객 알림 서비스`
   - 월 예상 발송량: `1000건` (초기)
4. **발신번호 등록**:
   - 사업자등록증 업로드
   - 발신번호: `02-1234-5678` (예시)
   - 승인 대기: 1-2일

### 1.3 API 키 발급
1. **IAM 서비스 접속**: https://console.ncloud.com/iam/
2. **Access Key 생성**:
   - "Access Key 관리" → "Access Key 생성"
   - Access Key ID 복사
   - Secret Access Key 다운로드 (한 번만 표시)
3. **SMS 서비스 ID 확인**:
   - SMS 콘솔에서 서비스 ID 확인
   - 형식: `ncp:sms:kr:123456789012:pricehunter`

## 🔧 2단계: 코드 설정

### 2.1 result-admin.html 수정
**파일**: `pricehunter-production/result-admin.html`

```javascript
// 1130번째 줄 근처에서 변경
const serviceId = 'ncp:sms:kr:실제_서비스_ID:pricehunter';
const accessKey = '실제_액세스_키_ID';
const secretKey = '실제_시크릿_액세스_키';
```

### 2.2 SMS 메시지 템플릿 설정
**파일**: `pricehunter-production/result-admin.html`

```javascript
// SMS 내용 구성 (1180번째 줄 근처)
const message = `[PriceHunter] ${userName}님, 의뢰하신 상품의 최저가 정보가 준비되었습니다.

상품명: ${result.productName}
최저가: ${result.lowestPrice}
쇼핑몰: ${result.shopName}

자세한 내용은 PriceHunter에서 확인해주세요.
https://pricehunt24.com/result-search.html?req=${result.requestKey}`;
```

## 🧪 3단계: 테스트

### 3.1 테스트 발송
1. **관리자 페이지 접속**: `result-admin.html`
2. **의뢰 결과 입력**: 테스트 의뢰 생성
3. **SMS 발송 테스트**: "알림 발송" 버튼 클릭
4. **수신 확인**: 실제 휴대폰으로 수신 확인

### 3.2 발송 로그 확인
```javascript
// 브라우저 콘솔에서 확인
console.log('SMS 발송 시도:', {
  phone: '010-1234-5678',
  message: '테스트 메시지'
});
```

## 💰 4단계: 요금 안내

### 4.1 SMS 요금
- **국내 SMS**: 건당 20원
- **월 1,000건**: 20,000원
- **월 10,000건**: 200,000원

### 4.2 예상 월 비용
- **초기 (월 1,000건)**: 20,000원
- **성장기 (월 5,000건)**: 100,000원
- **안정기 (월 10,000건)**: 200,000원

## ⚠️ 주의사항

### 4.1 발신번호 제한
- **사업자등록증 필수**: 개인은 발신번호 등록 불가
- **승인 기간**: 1-2일 소요
- **용도 제한**: 마케팅 목적 사용 시 별도 승인 필요

### 4.2 발송 제한
- **시간 제한**: 오전 8시 ~ 오후 8시 권장
- **빈도 제한**: 동일 번호 1시간당 5건 이하
- **내용 제한**: 스팸 필터링 주의

## 🔍 문제 해결

### 자주 발생하는 문제

#### 1. 발신번호 미승인
```
Error: Invalid sender number
```
**해결**: 사업자등록증 업로드 후 승인 대기

#### 2. API 키 오류
```
Error: Invalid access key
```
**해결**: Access Key ID와 Secret Key 확인

#### 3. 잔액 부족
```
Error: Insufficient balance
```
**해결**: 네이버 클라우드에 충전

## 📞 지원

- **네이버 클라우드 고객센터**: 1588-3820
- **기술 문서**: https://api.ncloud-docs.com/docs/ai-application-service-sms-sms
- **가격 안내**: https://www.ncloud.com/product/applicationService/sms

---

**✅ 완료 체크리스트**:
- [ ] 네이버 클라우드 가입
- [ ] SMS 서비스 신청
- [ ] 발신번호 등록 및 승인
- [ ] API 키 발급
- [ ] 코드 설정 완료
- [ ] 테스트 발송 성공 