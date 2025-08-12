# 🔄 Git 자동 배포 가이드

## 1단계: Git 저장소 생성

### GitHub 저장소 생성
1. https://github.com 접속
2. "New repository" 클릭
3. 저장소명: `pricehunter-website`
4. Public 선택
5. "Create repository" 클릭

### Git 초기화 및 파일 업로드
```bash
# 현재 디렉토리에서 Git 초기화
git init

# 모든 파일 추가
git add .

# 첫 번째 커밋
git commit -m "Initial commit: PriceHunter website"

# GitHub 저장소 연결
git remote add origin https://github.com/[사용자명]/pricehunter-website.git

# 메인 브랜치로 푸시
git branch -M main
git push -u origin main
```

## 2단계: Netlify Git 연동

### Netlify에서 Git 연동
1. Netlify 대시보드 접속
2. "New site from Git" 클릭
3. GitHub 선택
4. `pricehunter-website` 저장소 선택
5. 브랜치: `main` 선택
6. 빌드 설정:
   - Build command: 비워두기 (정적 사이트)
   - Publish directory: `.` (현재 디렉토리)
7. "Deploy site" 클릭

## 3단계: 자동 배포 설정

### 배포 설정 확인
- **Branch deploys**: 활성화
- **Auto publish**: 활성화
- **Build settings**: 정적 사이트이므로 빌드 명령 불필요

### 환경 변수 설정 (선택사항)
```
NODE_VERSION=18
```

## 4단계: 자동 배포 테스트

### 파일 수정 후 자동 배포 확인
```bash
# 파일 수정
# 예: index.html의 제목 변경

# Git에 변경사항 추가
git add .

# 커밋
git commit -m "Update website title"

# GitHub에 푸시
git push origin main
```

### 자동 배포 확인
1. Netlify 대시보드에서 배포 상태 확인
2. 1-2분 내에 자동 배포 완료
3. 사이트에서 변경사항 확인

## 5단계: 고급 설정

### 배포 알림 설정
1. Netlify 대시보드 → Site settings
2. "Notifications" 메뉴
3. Slack, Email, Webhook 등 설정

### 커스텀 도메인 설정
1. "Domain management" 메뉴
2. "Add custom domain" 클릭
3. `pricehunt24.com` 입력
4. DNS 설정 확인

## 6단계: 개발 워크플로우

### 로컬 개발
```bash
# 로컬에서 변경사항 테스트
# 브라우저에서 파일 열기

# 변경사항 확인 후 Git에 추가
git add .
git commit -m "Description of changes"
git push origin main
```

### 브랜치 기반 개발 (선택사항)
```bash
# 새로운 기능 브랜치 생성
git checkout -b feature/new-feature

# 개발 완료 후
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# GitHub에서 Pull Request 생성
# 코드 리뷰 후 main 브랜치에 머지
```

## 7단계: 문제 해결

### 배포 실패 시
1. Netlify 로그 확인
2. 빌드 오류 수정
3. 다시 푸시

### 파일 동기화 문제
```bash
# 로컬과 원격 저장소 동기화
git pull origin main

# 충돌 해결 후
git add .
git commit -m "Resolve conflicts"
git push origin main
```

## 장점

### ✅ 자동화의 장점
- **자동 배포**: 코드 변경 시 즉시 배포
- **버전 관리**: 모든 변경사항 추적
- **협업 가능**: 팀원과 함께 개발
- **백업**: 코드 안전하게 보관
- **롤백**: 이전 버전으로 쉽게 되돌리기

### ✅ 개발 효율성
- **즉시 반영**: 수정 후 바로 확인
- **테스트 용이**: 여러 환경에서 테스트
- **배포 안전성**: 자동화된 배포 프로세스

## 완료 후 사용법

### 일상적인 업데이트
1. 로컬에서 파일 수정
2. `git add . && git commit -m "메시지" && git push`
3. 1-2분 후 자동 배포 완료
4. 사이트에서 변경사항 확인

### 긴급 수정
1. GitHub에서 직접 파일 수정
2. 커밋 메시지 입력
3. 자동 배포 완료까지 대기

---

**이제 코드 수정 시 자동으로 배포됩니다!** 🚀 