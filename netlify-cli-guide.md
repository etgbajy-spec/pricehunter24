# 🚀 Netlify CLI 자동 배포 가이드

## 1단계: Netlify CLI 설치

### Node.js 설치 확인
```bash
node --version
npm --version
```

### Netlify CLI 설치
```bash
npm install -g netlify-cli
```

### 설치 확인
```bash
netlify --version
```

## 2단계: Netlify 로그인

### CLI로 로그인
```bash
netlify login
```

### 브라우저에서 인증 완료

## 3단계: 사이트 연결

### 현재 사이트 연결
```bash
# pricehunter-production 폴더로 이동
cd pricehunter-production

# 기존 사이트 연결
netlify link --name pricehunter24
```

### 또는 새 사이트 생성
```bash
netlify sites:create --name pricehunter24
```

## 4단계: 자동 배포 설정

### 배포 명령어
```bash
# 수동 배포
netlify deploy --prod

# 미리보기 배포 (프로덕션 배포 전 확인)
netlify deploy --dir=.
```

### 자동 배포 스크립트 생성
```bash
# deploy.bat 파일 생성 (Windows)
echo @echo off > deploy.bat
echo netlify deploy --prod >> deploy.bat
echo pause >> deploy.bat
```

### 또는 PowerShell 스크립트
```powershell
# deploy.ps1 파일 생성
Write-Host "Deploying to Netlify..." -ForegroundColor Green
netlify deploy --prod
Write-Host "Deployment completed!" -ForegroundColor Green
```

## 5단계: 고급 자동화

### 배포 전 빌드 스크립트
```bash
# build-and-deploy.bat
@echo off
echo Building and deploying PriceHunter...
echo.

echo Step 1: Checking files...
if not exist "index.html" (
    echo Error: index.html not found!
    pause
    exit /b 1
)

echo Step 2: Deploying to Netlify...
netlify deploy --prod

echo Step 3: Deployment completed!
echo Site URL: https://pricehunt24.com
pause
```

### 환경별 배포
```bash
# 개발 환경 배포
netlify deploy --dir=. --alias=dev-pricehunter24

# 프로덕션 배포
netlify deploy --prod
```

## 6단계: 배포 자동화 스크립트

### Windows 배치 파일 (deploy.bat)
```batch
@echo off
echo ========================================
echo    PriceHunter Website Deployer
echo ========================================
echo.

echo [1/4] Checking current directory...
if not exist "index.html" (
    echo ERROR: index.html not found!
    echo Please run this script from the website directory.
    pause
    exit /b 1
)

echo [2/4] Checking Netlify CLI...
netlify --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Netlify CLI not installed!
    echo Please install: npm install -g netlify-cli
    pause
    exit /b 1
)

echo [3/4] Deploying to Netlify...
netlify deploy --prod

if errorlevel 1 (
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo [4/4] Deployment completed successfully!
echo.
echo Site URL: https://pricehunt24.com
echo Netlify URL: https://pricehunter24.netlify.app
echo.
echo Press any key to exit...
pause >nul
```

### PowerShell 스크립트 (deploy.ps1)
```powershell
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    PriceHunter Website Deployer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check current directory
Write-Host "[1/4] Checking current directory..." -ForegroundColor Yellow
if (-not (Test-Path "index.html")) {
    Write-Host "ERROR: index.html not found!" -ForegroundColor Red
    Write-Host "Please run this script from the website directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Check Netlify CLI
Write-Host "[2/4] Checking Netlify CLI..." -ForegroundColor Yellow
try {
    $null = netlify --version
} catch {
    Write-Host "ERROR: Netlify CLI not installed!" -ForegroundColor Red
    Write-Host "Please install: npm install -g netlify-cli" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Deploy
Write-Host "[3/4] Deploying to Netlify..." -ForegroundColor Yellow
$result = netlify deploy --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 4: Success
Write-Host "[4/4] Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Site URL: https://pricehunt24.com" -ForegroundColor Cyan
Write-Host "Netlify URL: https://pricehunter24.netlify.app" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
```

## 7단계: 사용법

### 간단한 배포
```bash
# 배치 파일 실행 (Windows)
deploy.bat

# 또는 PowerShell 스크립트 실행
.\deploy.ps1

# 또는 직접 명령어
netlify deploy --prod
```

### 배포 상태 확인
```bash
# 배포 로그 확인
netlify status

# 사이트 정보 확인
netlify sites:list
```

## 8단계: 고급 기능

### 배포 전 테스트
```bash
# 로컬 서버 실행
netlify dev

# 브라우저에서 http://localhost:8888 확인
```

### 환경 변수 설정
```bash
# 환경 변수 설정
netlify env:set NODE_VERSION 18

# 환경 변수 확인
netlify env:list
```

### 배포 롤백
```bash
# 이전 배포로 롤백
netlify rollback

# 특정 배포로 롤백
netlify rollback --to=deploy-id
```

## 장점

### ✅ CLI의 장점
- **빠른 배포**: 명령어 하나로 즉시 배포
- **스크립트 자동화**: 배치 파일로 자동화
- **로컬 개발**: 로컬 서버로 미리 테스트
- **배포 관리**: 롤백, 상태 확인 등

### ✅ 사용 편의성
- **간단한 명령어**: `netlify deploy --prod`
- **배치 파일**: 더블클릭으로 배포
- **에러 처리**: 자동으로 오류 확인
- **상태 표시**: 진행 상황 실시간 확인

## 완료 후 사용법

### 일상적인 업데이트
1. 파일 수정
2. `deploy.bat` 더블클릭
3. 1-2분 후 배포 완료
4. 사이트에서 변경사항 확인

### 긴급 수정
1. 파일 수정
2. `netlify deploy --prod` 실행
3. 즉시 배포 완료

---

**이제 명령어 하나로 자동 배포됩니다!** 🚀 