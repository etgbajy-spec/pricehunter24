# PriceHunter 빠른 시작 가이드

## 🚀 5분 만에 서비스 시작하기

### 1. API 서비스 가입 (30분)

#### 토스페이먼츠 (결제)
1. https://pay.toss.im/ 가입
2. 사업자등록증 업로드
3. API 키 발급 (테스트 키 즉시 발급)

#### 네이버 클라우드 (SMS)
1. https://www.ncloud.com/ 가입
2. SMS 서비스 신청
3. API 키 발급

### 2. 코드 설정 (5분)

#### 2.1 결제 키 설정
**파일**: `payment.html` (67번째 줄)
```javascript
const clientKey = 'test_ck_여기에_테스트_키_입력';
```

#### 2.2 SMS 키 설정
**파일**: `result-admin.html` (1130번째 줄)
```javascript
const serviceId = 'ncp:sms:kr:실제_서비스_ID:pricehunter';
const accessKey = '실제_액세스_키';
const secretKey = '실제_시크릿_키';
```

### 3. 서버 설정 (10분)

#### 3.1 서버 준비
```bash
# Ubuntu/Debian 서버에서
sudo apt update
sudo apt install nginx nodejs npm
```

#### 3.2 파일 업로드
```bash
# pricehunter-production 폴더를 서버에 업로드
scp -r pricehunter-production/* user@your-server:/var/www/pricehunter-production/
```

#### 3.3 환경 변수 설정
```bash
# 서버에서 .env 파일 생성
cd /var/www/pricehunter-production
cp env.example .env
nano .env  # 실제 키 값들 입력
```

#### 3.4 패키지 설치 및 서버 시작
```bash
npm install
npm start
```

### 4. 도메인 설정 (5분)

#### 4.1 DNS 설정
```
A 레코드: @ → 서버 IP
CNAME: www → @
```

#### 4.2 SSL 인증서 설정
```bash
sudo apt-get install certbot
sudo certbot --nginx -d yourdomain.com
```

### 5. 테스트 (5분)

#### 5.1 기본 기능 테스트
- [ ] 홈페이지 접속
- [ ] 회원가입 (본인인증)
- [ ] 최저가 요청
- [ ] 결제 테스트 (1원)
- [ ] SMS 알림 테스트

#### 5.2 관리자 기능 테스트
- [ ] 관리자 로그인 (asdasd9123!@)
- [ ] 의뢰 결과 입력
- [ ] 알림 발송

## 📋 체크리스트

### 필수 설정
- [ ] API 서비스 가입 완료
- [ ] API 키 발급 완료
- [ ] 코드에 실제 키 입력
- [ ] 서버 환경 설정
- [ ] 도메인 연결
- [ ] SSL 인증서 설정

### 선택 설정
- [ ] 데이터베이스 연결
- [ ] 모니터링 설정
- [ ] 백업 설정
- [ ] 로그 설정

## 🆘 문제 해결

### 자주 발생하는 문제

#### 1. API 키 오류
```
Error: Invalid API key
```
**해결**: API 키가 올바르게 입력되었는지 확인

#### 2. CORS 오류
```
Error: CORS policy
```
**해결**: 서버의 CORS 설정 확인

#### 3. SSL 오류
```
Error: Mixed content
```
**해결**: 모든 리소스가 HTTPS로 로드되는지 확인

### 지원 연락처
- 기술 지원: tech@pricehunter.com
- 긴급 문의: 1588-1234

## 🎯 다음 단계

서비스가 정상 작동하면:
1. **운영 키로 변경**: 테스트 키 → 운영 키
2. **모니터링 설정**: 서버 상태 모니터링
3. **백업 설정**: 정기적인 데이터 백업
4. **성능 최적화**: 캐싱, 압축 등
5. **마케팅**: SEO, 광고 등

---

**⚠️ 중요**: 실제 운영 전에 충분한 테스트를 진행하세요! 