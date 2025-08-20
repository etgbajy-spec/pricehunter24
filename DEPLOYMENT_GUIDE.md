# PriceHunter 실제 서버 배포 가이드

## 🚀 빠른 배포 (Netlify 추천)

### 1단계: Netlify 배포
1. **Netlify 가입**: https://netlify.com/
2. **"New site from Git"** 클릭
3. **GitHub 연동** 또는 **"Deploy manually"** 선택
4. **pricehunter-production 폴더** 드래그 앤 드롭
5. **배포 완료** 후 도메인 확인 (예: `https://random-name.netlify.app`)

### 2단계: 카카오 개발자 콘솔 설정
1. **카카오 개발자 콘솔** 접속: https://developers.kakao.com/
2. **내 애플리케이션** → **프라이스헌터**
3. **카카오 로그인** → **플랫폼** → **Web**
4. **사이트 도메인** 추가:
   ```
   https://your-app-name.netlify.app
   ```
5. **리다이렉트 URI** 추가:
   ```
   https://your-app-name.netlify.app/identity-verification-result.html
   ```

### 3단계: 동의항목 설정
1. **카카오 로그인** → **동의항목** 탭
2. **필수 동의항목** 설정:
   - [x] **이름 (profile_nickname)**: 필수
   - [x] **생년월일 (birthday)**: 필수
   - [x] **휴대폰번호 (phone_number)**: 필수
   - [x] **이메일 (account_email)**: 필수

## 🔧 고급 배포 옵션

### 옵션 1: GitHub Pages
```bash
# GitHub 저장소 생성
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/pricehunter.git
git push -u origin main

# GitHub Pages 활성화
# Settings → Pages → Source: Deploy from a branch → main
```

### 옵션 2: Vercel
1. **Vercel 가입**: https://vercel.com/
2. **GitHub 연동**
3. **자동 배포** 설정

### 옵션 3: 직접 서버
```bash
# VPS 서버 설정
sudo apt update
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 파일 업로드
sudo cp -r pricehunter-production/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
```

## 🌐 도메인 설정

### 커스텀 도메인 구매 (선택사항)
1. **도메인 구매**: 가비아, 후이즈 등
2. **Netlify에서 도메인 연결**:
   - Site settings → Domain management
   - Add custom domain
   - DNS 설정 변경

### DNS 설정 예시:
```
Type: CNAME
Name: www
Value: your-app-name.netlify.app

Type: A
Name: @
Value: 75.2.60.5
```

## 🔒 SSL 인증서

### Netlify/Vercel:
- **자동 SSL** 제공
- 별도 설정 불필요

### 직접 서버:
```bash
# Let's Encrypt SSL 인증서
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📱 모바일 최적화

### PWA 설정 (선택사항)
```json
// manifest.json
{
  "name": "PriceHunter",
  "short_name": "PriceHunter",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 🔍 배포 후 테스트

### 기능 테스트:
- [ ] 메인 페이지 로딩
- [ ] 카카오 로그인 작동
- [ ] 회원가입/로그인
- [ ] 의뢰 요청
- [ ] 관리자 기능

### 성능 테스트:
- [ ] 페이지 로딩 속도
- [ ] 모바일 반응형
- [ ] 브라우저 호환성

### 보안 테스트:
- [ ] HTTPS 연결
- [ ] XSS 방지
- [ ] CSRF 방지

## 🚨 문제 해결

### 자주 발생하는 문제:

#### 1. 카카오 로그인 오류
```
Error: Invalid JavaScript key
```
**해결**: 카카오 개발자 콘솔에서 도메인 등록 확인

#### 2. HTTPS 오류
```
Mixed Content Error
```
**해결**: 모든 리소스를 HTTPS로 변경

#### 3. CORS 오류
```
Access to fetch at '...' from origin '...' has been blocked
```
**해결**: 카카오 개발자 콘솔에서 도메인 등록

#### 4. 404 오류
```
Page not found
```
**해결**: Netlify redirects 설정 확인

## 📊 모니터링

### Google Analytics 설정:
```html
<!-- index.html head 태그에 추가 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### 오류 모니터링:
- **Sentry**: JavaScript 오류 추적
- **LogRocket**: 사용자 세션 녹화
- **Hotjar**: 사용자 행동 분석

## 🔄 지속적 배포

### GitHub Actions (선택사항):
```yaml
# .github/workflows/deploy.yml
name: Deploy to Netlify
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: nwtgck/actions-netlify@v1.2
      with:
        publish-dir: './pricehunter-production'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 🎯 배포 체크리스트

### 사전 준비:
- [ ] 카카오 개발자 콘솔 설정 완료
- [ ] 동의항목 설정 완료
- [ ] 도메인 등록 완료

### 배포:
- [ ] Netlify 배포 완료
- [ ] 도메인 연결 완료
- [ ] SSL 인증서 설정 완료

### 테스트:
- [ ] 카카오 로그인 테스트
- [ ] 모든 기능 테스트
- [ ] 모바일 테스트

### 운영:
- [ ] Google Analytics 설정
- [ ] 오류 모니터링 설정
- [ ] 백업 설정

---

**🎯 목표**: 실제 서버에서 완전한 서비스 운영
**⏰ 예상 소요 시간**: 30분-1시간
**💰 예상 비용**: 무료 (도메인 구매 시 연 1-2만원) 