# 카카오톡 알림톡 서비스 설정 가이드

## 📋 1단계: 카카오 비즈니스 가입 및 알림톡 신청

### 1.1 카카오 비즈니스 가입
1. **가입**: https://business.kakao.com/
2. **본인인증**: 휴대폰 인증
3. **사업자 인증**: 사업자등록증 업로드

### 1.2 알림톡 서비스 신청
1. **서비스 신청**:
   - "알림톡" 서비스 선택
   - 용도: `고객 서비스 알림`
   - 월 예상 발송량: `500건` (초기)
2. **발신 프로필 등록**:
   - 프로필명: `PriceHunter`
   - 프로필 이미지: 로고 업로드
   - 승인 대기: 1-3일

### 1.3 템플릿 등록
1. **템플릿 작성**:
   ```
   [PriceHunter] #{userName}님, 의뢰하신 상품의 최저가 정보가 준비되었습니다.
   
   상품명: #{productName}
   최저가: #{lowestPrice}
   쇼핑몰: #{shopName}
   
   자세한 내용은 PriceHunter에서 확인해주세요.
   #{requestUrl}
   ```
2. **변수 설정**:
   - `#{userName}`: 고객 이름
   - `#{productName}`: 상품명
   - `#{lowestPrice}`: 최저가
   - `#{shopName}`: 쇼핑몰명
   - `#{requestUrl}`: 의뢰 결과 URL

## 🔧 2단계: 코드 설정

### 2.1 result-admin.html 수정
**파일**: `pricehunter-production/result-admin.html`

```javascript
// 1180번째 줄 근처에서 변경
const apiKey = '실제_카카오_API_키';
const templateId = '실제_템플릿_ID';
```

### 2.2 알림톡 메시지 설정
**파일**: `pricehunter-production/result-admin.html`

```javascript
// 알림톡 내용 구성
const message = {
  phone: phone,
  templateId: templateId,
  variables: {
    userName: userName,
    productName: result.productName,
    lowestPrice: result.lowestPrice,
    shopName: result.shopName,
    requestUrl: `https://pricehunt24.com/result-search.html?req=${result.requestKey}`
  }
};
```

## 🧪 3단계: 테스트

### 3.1 테스트 발송
1. **관리자 페이지 접속**: `result-admin.html`
2. **의뢰 결과 입력**: 테스트 의뢰 생성
3. **알림톡 발송 테스트**: "알림 발송" 버튼 클릭
4. **수신 확인**: 카카오톡으로 수신 확인

### 3.2 발송 로그 확인
```javascript
// 브라우저 콘솔에서 확인
console.log('알림톡 발송 시도:', {
  phone: '010-1234-5678',
  templateId: 'pricehunter_notification'
});
```

## 💰 4단계: 요금 안내

### 4.1 알림톡 요금
- **알림톡**: 건당 15원
- **월 500건**: 7,500원
- **월 1,000건**: 15,000원

### 4.2 예상 월 비용
- **초기 (월 500건)**: 7,500원
- **성장기 (월 1,000건)**: 15,000원
- **안정기 (월 2,000건)**: 30,000원

## ⚠️ 주의사항

### 4.1 발신 프로필 제한
- **사업자등록증 필수**: 개인은 발신 프로필 등록 불가
- **승인 기간**: 1-3일 소요
- **용도 제한**: 마케팅 목적 사용 시 별도 승인 필요

### 4.2 발송 제한
- **시간 제한**: 오전 8시 ~ 오후 8시 권장
- **빈도 제한**: 동일 번호 1시간당 3건 이하
- **내용 제한**: 템플릿 승인 필수

### 4.3 카카오톡 연동
- **카카오톡 설치 필수**: 수신자에게 카카오톡 설치 필요
- **수신 거부**: 수신자가 거부할 수 있음
- **대체 발송**: 카카오톡 미설치 시 SMS로 대체 발송

## 🔍 문제 해결

### 자주 발생하는 문제

#### 1. 발신 프로필 미승인
```
Error: Invalid sender profile
```
**해결**: 사업자등록증 업로드 후 승인 대기

#### 2. 템플릿 미승인
```
Error: Invalid template
```
**해결**: 템플릿 내용 검토 후 재신청

#### 3. 카카오톡 미설치
```
Error: KakaoTalk not installed
```
**해결**: SMS로 대체 발송 설정

## 📊 5단계: 운영 모니터링

### 5.1 발송 통계
- **발송 성공률**: 목표 90% 이상
- **수신 확인률**: 목표 70% 이상
- **클릭률**: 목표 10% 이상

### 5.2 알림 설정
- **발송 실패 알림**: 즉시 관리자에게 알림
- **수신 거부 알림**: 수신 거부 시 알림
- **월 사용량 알림**: 월 사용량 초과 시 알림

## 📞 지원

- **카카오 비즈니스 고객센터**: 1544-3640
- **기술 문서**: https://developers.kakao.com/docs/latest/ko/kakaotalk-channel/common
- **가격 안내**: https://business.kakao.com/infra/billing

---

**✅ 완료 체크리스트**:
- [ ] 카카오 비즈니스 가입
- [ ] 알림톡 서비스 신청
- [ ] 발신 프로필 등록 및 승인
- [ ] 템플릿 등록 및 승인
- [ ] API 키 발급
- [ ] 코드 설정 완료
- [ ] 테스트 발송 성공 