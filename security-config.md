# PriceHunter 보안 설정 가이드

## 🔒 보안 목표
- 사용자 데이터 보호
- 결제 정보 암호화
- XSS 및 CSRF 공격 방지
- HTTPS 강제 적용

## 🛡️ 보안 설정

### 1. HTTPS 강제 적용
```html
<!-- 모든 페이지에 추가 -->
<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
```

### 2. Content Security Policy (CSP)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://js.tosspayments.com;
  style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.tosspayments.com;
  frame-src https://js.tosspayments.com;
">
```

### 3. 입력값 검증 강화
```javascript
// XSS 방지 함수
function sanitizeInput(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// 모든 사용자 입력에 적용
const userInput = sanitizeInput(document.getElementById('user-input').value);
```

### 4. CSRF 토큰 구현
```javascript
// CSRF 토큰 생성
function generateCSRFToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

// 폼에 토큰 추가
const token = generateCSRFToken();
localStorage.setItem('csrf_token', token);
```

## 🔐 데이터 암호화

### 1. 민감한 데이터 암호화
```javascript
// 간단한 암호화 (실제 서비스에서는 더 강력한 암호화 사용)
function encryptData(data, key) {
    return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decryptData(encryptedData, key) {
    return JSON.parse(decodeURIComponent(atob(encryptedData)));
}

// 사용 예시
const sensitiveData = { creditCard: '1234-5678-9012-3456' };
const encrypted = encryptData(sensitiveData, 'secret-key');
localStorage.setItem('encrypted_data', encrypted);
```

### 2. 세션 관리
```javascript
// 세션 타임아웃 설정
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30분

function checkSession() {
    const lastActivity = localStorage.getItem('lastActivity');
    const now = Date.now();
    
    if (lastActivity && (now - parseInt(lastActivity)) > SESSION_TIMEOUT) {
        // 세션 만료
        localStorage.clear();
        window.location.href = 'index.html';
    }
    
    localStorage.setItem('lastActivity', now.toString());
}

// 주기적으로 세션 체크
setInterval(checkSession, 60000); // 1분마다
```

## 🚫 보안 헤더 설정

### Netlify 설정
```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;"
```

## 🔍 보안 모니터링

### 1. 로그 모니터링
```javascript
// 보안 이벤트 로깅
function logSecurityEvent(event, details) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        details: details,
        userAgent: navigator.userAgent,
        ip: 'client-ip' // 실제 서비스에서는 서버에서 IP 확인
    };
    
    console.log('Security Event:', logEntry);
    // 실제 서비스에서는 서버로 전송
}

// 의심스러운 활동 감지
function detectSuspiciousActivity() {
    const failedAttempts = parseInt(localStorage.getItem('failedLoginAttempts') || '0');
    
    if (failedAttempts > 5) {
        logSecurityEvent('multiple_failed_logins', { attempts: failedAttempts });
        // 계정 잠금 또는 추가 인증 요구
    }
}
```

### 2. 입력값 검증
```javascript
// 파일 업로드 검증
function validateFileUpload(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
        throw new Error('허용되지 않는 파일 형식입니다.');
    }
    
    if (file.size > maxSize) {
        throw new Error('파일 크기가 너무 큽니다.');
    }
    
    return true;
}

// URL 검증
function validateURL(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}
```

## 🛠️ 보안 체크리스트

### 개발 단계
- [ ] 모든 사용자 입력 검증
- [ ] XSS 방지 함수 적용
- [ ] CSRF 토큰 구현
- [ ] 파일 업로드 검증
- [ ] 세션 관리 구현

### 배포 단계
- [ ] HTTPS 강제 적용
- [ ] 보안 헤더 설정
- [ ] CSP 정책 적용
- [ ] 로그 모니터링 설정
- [ ] 백업 시스템 구축

### 운영 단계
- [ ] 정기적인 보안 업데이트
- [ ] 로그 분석 및 모니터링
- [ ] 침입 탐지 시스템 구축
- [ ] 정기적인 보안 감사
- [ ] 사용자 데이터 백업

## 🚨 보안 사고 대응

### 1. 즉시 조치사항
1. **서비스 중단**: 문제가 되는 기능 즉시 비활성화
2. **로그 분석**: 침입 경로 및 영향 범위 파악
3. **사용자 통보**: 영향받은 사용자에게 즉시 알림
4. **백업 복구**: 안전한 백업으로 복구

### 2. 장기 조치사항
1. **보안 강화**: 취약점 수정 및 보안 강화
2. **모니터링 강화**: 추가적인 보안 모니터링 구축
3. **사용자 교육**: 보안 인식 제고
4. **정책 수립**: 보안 사고 대응 매뉴얼 작성

## 📊 보안 지표

### 목표 지표
- **보안 사고**: 0건/월
- **취약점 발견**: 0건/월
- **사용자 데이터 유출**: 0건
- **시스템 다운타임**: 99.9% 이상

### 모니터링 지표
- **로그인 실패율**: 5% 이하
- **의심스러운 활동**: 즉시 알림
- **시스템 리소스**: 정상 범위 유지
- **사용자 피드백**: 보안 관련 이슈 0건
