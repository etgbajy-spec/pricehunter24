# 🌐 Netlify 배포 가이드

## 1단계: Netlify 계정 생성
1. https://netlify.com 접속
2. "Sign up" 클릭
3. GitHub, GitLab, Bitbucket 중 선택하여 로그인

## 2단계: 사이트 배포
### 방법 1: 드래그 앤 드롭 (가장 쉬움)
1. Netlify 대시보드에서 "Sites" 탭 클릭
2. `pricehunter-production` 폴더를 드래그하여 배포 영역에 드롭
3. 자동으로 배포 시작

### 방법 2: Git 연동
1. GitHub에 코드 업로드
2. Netlify에서 "New site from Git" 클릭
3. GitHub 저장소 선택
4. 빌드 설정:
   - Build command: (비워두기)
   - Publish directory: `.`
5. "Deploy site" 클릭

## 3단계: 도메인 설정
1. 배포 완료 후 "Domain settings" 클릭
2. "Add custom domain" 클릭
3. 도메인 입력 (예: pricehunter.kr)
4. DNS 설정 안내에 따라 도메인 업체에서 설정

## 4단계: SSL 인증서
1. Netlify에서 자동으로 Let's Encrypt SSL 제공
2. "HTTPS" 탭에서 상태 확인
3. 자동 갱신 설정 확인

## 5단계: 환경 변수 설정 (필요시)
1. "Site settings" → "Environment variables"
2. 필요한 환경 변수 추가

## 6단계: 폼 처리 설정 (필요시)
1. "Forms" 탭에서 폼 제출 확인
2. 스팸 방지 설정

## 7단계: 리다이렉트 설정
- netlify.toml 파일이 자동으로 처리됨
- SPA 라우팅 지원

## 8단계: 성능 최적화
1. "Site settings" → "Build & deploy"
2. 이미지 최적화 설정
3. 압축 설정 확인

## 배포 완료!
- 사이트 URL: https://your-site-name.netlify.app
- 커스텀 도메인: https://pricehunter.kr
- 자동 배포: Git 푸시 시 자동 업데이트 