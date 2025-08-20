# 카카오 개발자 설정 완료 가이드

## 📋 현재 상황 확인

### ✅ 완료된 것들:
- [x] 카카오 개발자 가입
- [x] 앱 생성 (프라이스헌터)
- [x] JavaScript 키 발급: `6917a034b74fafd0ac80ab855af5ed6d`
- [x] REST API 키 발급: `fd9b2a8858c4c90765143ea56546d386`
- [x] 리다이렉트 URI 설정

### 🔄 완료해야 할 것들:

## 1. 카카오 개발자 콘솔 설정

### 1.1 동의항목 설정
1. **카카오 개발자 콘솔** 접속: https://developers.kakao.com/
2. **내 애플리케이션** → **프라이스헌터** 선택
3. **카카오 로그인** → **동의항목** 탭
4. **필수 동의항목** 설정:
   - [x] **이름 (profile_nickname)**: 필수
   - [x] **생년월일 (birthday)**: 필수  
   - [x] **휴대폰번호 (phone_number)**: 필수
   - [x] **이메일 (account_email)**: 필수

### 1.2 보안 설정
1. **카카오 로그인** → **보안** 탭
2. **플랫폼** → **Web** 설정 확인
3. **사이트 도메인** 등록:
   - `http://localhost:3000` (개발용)
   - `https://yourdomain.com` (운영용)

### 1.3 앱 키 확인
- **JavaScript 키**: `6917a034b74fafd0ac80ab855af5ed6d`
- **REST API 키**: `fd9b2a8858c4c90765143ea56546d386`

## 2. 실제 서버 배포 옵션

### 옵션 1: Netlify (무료, 추천)
1. **Netlify 가입**: https://netlify.com/
2. **GitHub 연동** 또는 **직접 업로드**
3. **도메인 설정**: `https://your-app-name.netlify.app`
4. **자동 배포** 설정

### 옵션 2: Vercel (무료)
1. **Vercel 가입**: https://vercel.com/
2. **GitHub 연동**
3. **자동 배포** 설정

### 옵션 3: GitHub Pages (무료)
1. **GitHub 저장소** 생성
2. **GitHub Pages** 활성화
3. **도메인**: `https://username.github.io/repository-name`

## 3. 도메인 구매 (선택사항)

### 추천 도메인:
- `pricehunter.co.kr`
- `pricehunt24.com`
- `pricehunter.kr`

### 도메인 구매 사이트:
- **가비아**: https://www.gabia.com/
- **후이즈**: https://www.whois.com/
- **네임칩**: https://www.namecheap.com/

## 4. SSL 인증서 설정

### Netlify/Vercel:
- 자동으로 SSL 인증서 제공
- 별도 설정 불필요

### 직접 서버:
- **Let's Encrypt** 무료 SSL 인증서
- **Certbot** 사용

## 5. 카카오 개발자 콘솔 도메인 등록

### 실제 도메인 등록:
1. **카카오 개발자 콘솔** 접속
2. **내 애플리케이션** → **프라이스헌터**
3. **카카오 로그인** → **플랫폼** → **Web**
4. **사이트 도메인** 추가:
   ```
   https://yourdomain.com
   https://www.yourdomain.com
   ```

### 리다이렉트 URI 업데이트:
```
https://yourdomain.com/identity-verification-result.html
```

## 6. 코드 수정

### JavaScript 키 업데이트:
```javascript
// index.html에서
Kakao.init('6917a034b74fafd0ac80ab855af5ed6d');
```

### 도메인 URL 업데이트:
```javascript
// 모든 URL을 실제 도메인으로 변경
window.location.origin + '/result-search.html'
```

## 7. 테스트 체크리스트

### 로컬 테스트:
- [ ] `http://localhost:3000`에서 카카오 로그인 작동
- [ ] 사용자 정보 정상 수집
- [ ] 로그인/로그아웃 정상 작동

### 실제 서버 테스트:
- [ ] 실제 도메인에서 카카오 로그인 작동
- [ ] HTTPS 연결 정상
- [ ] 모든 기능 정상 작동

## 8. 문제 해결

### 자주 발생하는 문제:

#### 1. "Invalid JavaScript key" 오류
**해결**: JavaScript 키 확인 및 재설정

#### 2. "Invalid redirect URI" 오류
**해결**: 카카오 개발자 콘솔에서 리다이렉트 URI 확인

#### 3. "User denied authentication" 오류
**해결**: 동의항목 설정 확인

#### 4. HTTPS 오류
**해결**: SSL 인증서 설정 확인

## 9. 운영 준비

### 모니터링:
- [ ] 카카오 로그인 성공률 모니터링
- [ ] 사용자 피드백 수집
- [ ] 오류 로그 확인

### 보안:
- [ ] API 키 보안 관리
- [ ] 사용자 데이터 보호
- [ ] 정기 보안 업데이트

---

**🎯 목표**: 실제 서버에서 카카오 로그인 완전 작동
**⏰ 예상 소요 시간**: 1-2시간
**💰 예상 비용**: 도메인 구매 시 연 1-2만원 