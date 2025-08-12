# PriceHunter API 연동 가이드

## 📋 개요

PriceHunter 시스템의 실제 운영을 위해 필요한 API 연동 설정 가이드입니다.

## 🏦 1. 결제 시스템 (토스페이먼츠)

### 설정 파일: `payment.html`

#### 1.1 토스페이먼츠 계정 설정
1. [토스페이먼츠](https://pay.toss.im/) 가입
2. 상점 등록 및 승인
3. API 키 발급

#### 1.2 코드 수정
```javascript
// payment.html의 clientKey 변경
const clientKey = 'live_ck_...'; // 실제 운영 키로 변경
```

#### 1.3 웹훅 설정
- 성공 URL: `https://yourdomain.com/payment-success.html`
- 실패 URL: `https://yourdomain.com/payment-fail.html`

## 📱 2. SMS 알림 시스템 (네이버 클라우드)

### 설정 파일: `result-admin.html`

#### 2.1 네이버 클라우드 설정
1. [네이버 클라우드](https://www.ncloud.com/) 가입
2. SMS 서비스 활성화
3. API 키 발급

#### 2.2 코드 수정
```javascript
// result-admin.html의 SMS 설정 변경
const serviceId = 'ncp:sms:kr:123456789012:pricehunter'; // 실제 서비스 ID
const accessKey = 'YOUR_ACCESS_KEY'; // 실제 액세스 키
const secretKey = 'YOUR_SECRET_KEY'; // 실제 시크릿 키
```

#### 2.3 서버 사이드 API 구현
```javascript
// /api/send-sms 엔드포인트 구현 필요
app.post('/api/send-sms', async (req, res) => {
  const { phone, message, serviceId, accessKey, secretKey } = req.body;
  
  // 네이버 클라우드 SMS API 호출
  const response = await fetch('https://sens.apigw.ntruss.com/sms/v2/services/' + serviceId + '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ncp-apigw-timestamp': Date.now().toString(),
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': generateSignature(secretKey, timestamp)
    },
    body: JSON.stringify({
      type: 'SMS',
      from: '발신번호',
      content: message,
      messages: [{ to: phone }]
    })
  });
  
  res.json({ success: response.ok });
});
```

## 📞 3. 카카오톡 알림톡 (카카오 비즈니스)

### 설정 파일: `result-admin.html`

#### 3.1 카카오 비즈니스 설정
1. [카카오 비즈니스](https://business.kakao.com/) 가입
2. 알림톡 서비스 신청
3. 템플릿 등록 및 승인

#### 3.2 코드 수정
```javascript
// result-admin.html의 카카오톡 설정 변경
const apiKey = 'YOUR_KAKAO_API_KEY'; // 실제 API 키
const templateId = 'pricehunter_notification'; // 실제 템플릿 ID
```

#### 3.3 서버 사이드 API 구현
```javascript
// /api/send-kakao 엔드포인트 구현 필요
app.post('/api/send-kakao', async (req, res) => {
  const { phone, templateId, variables } = req.body;
  
  // 카카오 알림톡 API 호출
  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      message: {
        to: phone,
        from: '발신번호',
        kakaoOptions: {
          pfId: 'YOUR_PFID',
          templateId: templateId,
          variables: variables
        }
      }
    })
  });
  
  res.json({ success: response.ok });
});
```

## 🔐 4. 본인인증 시스템 (KG이니시스)

### 설정 파일: `index.html`

#### 4.1 KG이니시스 설정
1. [KG이니시스](https://www.inicis.com/) 가입
2. 본인인증 서비스 신청
3. 상점 ID 및 API 키 발급

#### 4.2 코드 수정
```javascript
// index.html의 본인인증 설정 변경
const merchantId = 'YOUR_MERCHANT_ID'; // 실제 상점 ID
const apiKey = 'YOUR_API_KEY'; // 실제 API 키
```

#### 4.3 서버 사이드 API 구현
```javascript
// /api/identity-verification/start 엔드포인트 구현 필요
app.post('/api/identity-verification/start', async (req, res) => {
  const { merchantId, userName, birthDate, phoneNumber, returnUrl } = req.body;
  
  // KG이니시스 본인인증 요청
  const response = await fetch('https://stdpay.inicis.com/stdjs/INIStdPay.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      merchantId: merchantId,
      userName: userName,
      birthDate: birthDate,
      phoneNumber: phoneNumber,
      returnUrl: returnUrl,
      popupYn: 'Y'
    })
  });
  
  res.json({ verificationUrl: response.url });
});

// /api/identity-verification/result 엔드포인트 구현 필요
app.post('/api/identity-verification/result', async (req, res) => {
  const { transactionId } = req.body;
  
  // KG이니시스 본인인증 결과 확인
  const response = await fetch('https://stdpay.inicis.com/stdjs/INIStdPay.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      merchantId: merchantId,
      transactionId: transactionId
    })
  });
  
  res.json({ success: response.ok, data: await response.json() });
});
```

## 🚀 5. 배포 및 운영

### 5.1 환경 변수 설정
```bash
# .env 파일 생성
TOSS_CLIENT_KEY=live_ck_...
NAVER_SMS_SERVICE_ID=ncp:sms:kr:...
NAVER_SMS_ACCESS_KEY=...
NAVER_SMS_SECRET_KEY=...
KAKAO_API_KEY=...
KG_MERCHANT_ID=...
KG_API_KEY=...
```

### 5.2 HTTPS 설정
- 모든 API 호출은 HTTPS를 통해야 합니다
- SSL 인증서 설정 필수

### 5.3 CORS 설정
```javascript
// 서버 사이드 CORS 설정
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

## 📊 6. 모니터링 및 로깅

### 6.1 로그 설정
```javascript
// API 호출 로깅
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

### 6.2 에러 핸들링
```javascript
// 전역 에러 핸들러
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

## 🔒 7. 보안 고려사항

### 7.1 API 키 보안
- API 키는 환경 변수로 관리
- 클라이언트 사이드에 노출 금지
- 정기적인 키 로테이션

### 7.2 입력값 검증
- 모든 사용자 입력값 검증
- SQL 인젝션 방지
- XSS 공격 방지

### 7.3 요청 제한
```javascript
// Rate Limiting 설정
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // 최대 100회 요청
});

app.use('/api/', limiter);
```

## 📞 8. 지원 및 문의

- 기술 지원: support@pricehunter.com
- API 문서: https://docs.pricehunter.com
- 개발자 커뮤니티: https://community.pricehunter.com

---

**⚠️ 중요**: 실제 운영 전에 모든 API 키와 설정을 업데이트하고, 테스트 환경에서 충분한 검증을 진행하세요. 