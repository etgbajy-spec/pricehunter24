# PriceHunter 실제 서비스 연결 가이드

## 📋 1단계: API 서비스 계정 생성

### 1.1 토스페이먼츠 (결제)
1. **가입**: https://pay.toss.im/
2. **상점 등록**: 
   - 사업자등록증 업로드
   - 은행 계좌 정보 입력
   - 승인 대기 (1-2일 소요)
3. **API 키 발급**:
   - 테스트 키: `test_ck_...`
   - 운영 키: `live_ck_...` (승인 후 발급)

### 1.2 네이버 클라우드 (SMS)
1. **가입**: https://www.ncloud.com/
2. **SMS 서비스 활성화**:
   - SMS 서비스 신청
   - 발신번호 등록 (사업자등록증 필요)
3. **API 키 발급**:
   - Access Key ID
   - Secret Access Key
   - Service ID (SMS 서비스 ID)

### 1.3 카카오 비즈니스 (알림톡)
1. **가입**: https://business.kakao.com/
2. **알림톡 서비스 신청**:
   - 사업자등록증 업로드
   - 발신 프로필 등록
3. **템플릿 등록**:
   - 알림톡 템플릿 작성
   - 승인 대기 (1-3일 소요)

### 1.4 KG이니시스 (본인인증)
1. **가입**: https://www.inicis.com/
2. **본인인증 서비스 신청**:
   - 사업자등록증 업로드
   - 서비스 신청서 제출
3. **API 키 발급**:
   - Merchant ID
   - API Key

## 🔧 2단계: 코드 설정 변경

### 2.1 결제 시스템 설정
**파일**: `payment.html`
```javascript
// 67번째 줄 근처에서 변경
const clientKey = 'live_ck_여기에_실제_키_입력'; // 테스트 키에서 운영 키로 변경
```

### 2.2 SMS 알림 설정
**파일**: `result-admin.html`
```javascript
// 1130번째 줄 근처에서 변경
const serviceId = 'ncp:sms:kr:실제_서비스_ID:pricehunter';
const accessKey = '실제_액세스_키';
const secretKey = '실제_시크릿_키';
```

### 2.3 카카오톡 알림 설정
**파일**: `result-admin.html`
```javascript
// 1180번째 줄 근처에서 변경
const apiKey = '실제_카카오_API_키';
const templateId = '실제_템플릿_ID';
```

### 2.4 본인인증 설정
**파일**: `index.html`
```javascript
// 1650번째 줄 근처에서 변경
const merchantId = '실제_상점_ID';
const apiKey = '실제_API_키';
```

## 🌐 3단계: 도메인 및 SSL 설정

### 3.1 도메인 설정
1. **도메인 구매**: 가비아, 후이즈 등에서 구매
2. **DNS 설정**:
   ```
   A 레코드: @ → 서버 IP
   CNAME: www → @
   ```

### 3.2 SSL 인증서 설정
1. **Let's Encrypt 무료 인증서**:
   ```bash
   sudo apt-get install certbot
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

## 🖥️ 4단계: 서버 설정

### 4.1 서버 선택
**추천 옵션**:
- **VPS**: AWS EC2, Google Cloud, DigitalOcean
- **호스팅**: 카페24, 호스팅케이알
- **클라우드**: 네이버 클라우드, AWS

### 4.2 서버 환경 설정
```bash
# Ubuntu/Debian 기준
sudo apt update
sudo apt install nginx nodejs npm

# Node.js 최신 버전 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4.3 Nginx 설정
```nginx
# /etc/nginx/sites-available/pricehunter
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/pricehunter-production;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    # API 프록시 설정
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔌 5단계: 백엔드 API 서버 구축

### 5.1 Node.js 서버 생성
**파일**: `server.js`
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// SMS 발송 API
app.post('/api/send-sms', async (req, res) => {
    // 네이버 클라우드 SMS API 호출
    // 구현 필요
});

// 카카오톡 알림톡 API
app.post('/api/send-kakao', async (req, res) => {
    // 카카오 알림톡 API 호출
    // 구현 필요
});

// 본인인증 API
app.post('/api/identity-verification/start', async (req, res) => {
    // KG이니시스 본인인증 API 호출
    // 구현 필요
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

### 5.2 패키지 설치
```bash
npm init -y
npm install express cors axios crypto
```

## 📱 6단계: 모바일 최적화

### 6.1 PWA 설정
**파일**: `manifest.json`
```json
{
  "name": "PriceHunter",
  "short_name": "PriceHunter",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### 6.2 Service Worker 설정
**파일**: `sw.js`
```javascript
// 오프라인 캐싱 설정
const CACHE_NAME = 'pricehunter-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/payment.html',
  // 기타 필요한 파일들
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

## 🔒 7단계: 보안 설정

### 7.1 환경 변수 설정
**파일**: `.env`
```bash
TOSS_CLIENT_KEY=live_ck_...
NAVER_SMS_SERVICE_ID=ncp:sms:kr:...
NAVER_SMS_ACCESS_KEY=...
NAVER_SMS_SECRET_KEY=...
KAKAO_API_KEY=...
KG_MERCHANT_ID=...
KG_API_KEY=...
```

### 7.2 보안 헤더 설정
**Nginx 설정에 추가**:
```nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

## 📊 8단계: 모니터링 설정

### 8.1 로그 설정
```javascript
// 로그 파일 설정
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 8.2 성능 모니터링
- **Google Analytics**: 사용자 행동 분석
- **Google PageSpeed Insights**: 성능 측정
- **Uptime Robot**: 서버 가동률 모니터링

## 🚀 9단계: 배포 및 테스트

### 9.1 파일 업로드
```bash
# 서버에 파일 업로드
scp -r pricehunter-production/* user@your-server:/var/www/pricehunter-production/
```

### 9.2 서비스 시작
```bash
# PM2로 Node.js 서버 관리
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

### 9.3 테스트 체크리스트
- [ ] 결제 테스트 (실제 카드로 1원 결제)
- [ ] SMS 발송 테스트
- [ ] 카카오톡 알림톡 테스트
- [ ] 본인인증 테스트
- [ ] 모바일 반응형 테스트
- [ ] 보안 테스트

## 📞 10단계: 고객 지원

### 10.1 고객센터 설정
- **전화**: 1588-1234
- **이메일**: support@pricehunter.com
- **카카오톡**: @pricehunter

### 10.2 FAQ 페이지
- 결제 관련 FAQ
- 본인인증 관련 FAQ
- 서비스 이용 관련 FAQ

---

## ⚠️ 중요 주의사항

1. **API 키 보안**: 절대 클라이언트 사이드에 노출하지 마세요
2. **테스트**: 충분한 테스트 후 실제 서비스 시작
3. **백업**: 정기적인 데이터 백업 필수
4. **모니터링**: 24시간 서버 모니터링 설정
5. **법적 요구사항**: 개인정보처리방침, 이용약관 필수

## 📞 지원

문제가 발생하면 다음으로 문의하세요:
- 기술 지원: tech@pricehunter.com
- 비즈니스 문의: business@pricehunter.com 