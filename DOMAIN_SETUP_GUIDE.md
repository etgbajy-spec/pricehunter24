# 🌐 pricehunt24.com 도메인 설정 가이드

## 🔍 문제 진단

테스트 환경(`localhost:3000`)에서는 정상 작동하지만 실제 도메인(`pricehunt24.com`)에서는 작동하지 않는 문제입니다.

## 📋 확인해야 할 설정들

### 1. Firebase Console 설정

#### **Authentication → Settings → Authorized domains**
```
✅ pricehunt24.com 추가 필요
✅ www.pricehunt24.com 추가 필요 (선택사항)
```

#### **Firestore → Rules**
```
현재 규칙이 올바르게 배포되었는지 확인
```

#### **Project Settings → General**
```
✅ Web API Key가 올바른지 확인
✅ Project ID가 pricehunter-99a1b인지 확인
```

### 2. Netlify 설정

#### **Site Settings → Environment Variables**
```
FIREBASE_PROJECT_ID = pricehunter-99a1b
FIREBASE_PRIVATE_KEY_ID = [실제 값]
FIREBASE_PRIVATE_KEY = [실제 값]
FIREBASE_CLIENT_EMAIL = [실제 값]
FIREBASE_CLIENT_ID = [실제 값]
```

#### **Site Settings → Domain Management**
```
✅ pricehunt24.com이 올바르게 연결되었는지 확인
✅ SSL 인증서가 유효한지 확인
```

### 3. 카카오 개발자 콘솔 설정

#### **내 애플리케이션 → 앱 설정 → 플랫폼**
```
✅ Web 플랫폼에 https://pricehunt24.com 추가
✅ Web 플랫폼에 https://www.pricehunt24.com 추가 (선택사항)
```

#### **내 애플리케이션 → 제품 설정 → 카카오 로그인**
```
✅ Redirect URI에 https://pricehunt24.com/register.html 추가
✅ Redirect URI에 https://www.pricehunt24.com/register.html 추가 (선택사항)
```

## 🧪 도메인별 테스트 방법

### 1. 도메인별 디버깅 페이지 사용
```
https://pricehunt24.com/domain-debug.html
```

### 2. 확인할 항목들
- ✅ Firebase 초기화 상태
- ✅ Netlify Functions 응답
- ✅ Firestore 읽기/쓰기 권한
- ✅ 네트워크 요청 상태

### 3. 브라우저 콘솔 확인
```
F12 → Console 탭에서 오류 메시지 확인
```

## 🚨 일반적인 문제들

### 1. CORS 오류
```
Access to fetch at 'https://...' from origin 'https://pricehunt24.com' has been blocked by CORS policy
```
**해결방법**: Netlify Functions CORS 설정 확인

### 2. Firebase Auth 도메인 오류
```
This domain is not authorized for OAuth operations
```
**해결방법**: Firebase Console → Authentication → Settings → Authorized domains에 도메인 추가

### 3. 카카오 로그인 오류
```
Invalid redirect_uri
```
**해결방법**: 카카오 개발자 콘솔에서 Redirect URI 설정 확인

### 4. Firestore 권한 오류
```
Missing or insufficient permissions
```
**해결방법**: Firestore 보안 규칙 배포 확인

## 🔧 단계별 해결 방법

### 1단계: Firebase Console 설정
1. Firebase Console → Authentication → Settings
2. Authorized domains에 `pricehunt24.com` 추가
3. 저장 후 확인

### 2단계: 카카오 개발자 콘솔 설정
1. 카카오 개발자 콘솔 → 내 애플리케이션
2. 앱 설정 → 플랫폼 → Web 플랫폼에 도메인 추가
3. 제품 설정 → 카카오 로그인 → Redirect URI 추가

### 3단계: Netlify 환경변수 확인
1. Netlify 대시보드 → Site Settings → Environment Variables
2. Firebase Admin SDK 키들이 올바르게 설정되었는지 확인

### 4단계: 테스트 및 확인
1. `https://pricehunt24.com/domain-debug.html` 접속
2. 모든 테스트 항목이 성공하는지 확인
3. 브라우저 콘솔에서 오류 메시지 확인

## 📞 추가 지원

문제가 지속되면 다음 정보를 제공해주세요:
1. `domain-debug.html`의 테스트 결과
2. 브라우저 콘솔의 오류 메시지
3. Network 탭의 실패한 요청들
4. Firebase Console의 설정 스크린샷

---

**🎯 목표**: `pricehunt24.com`에서도 `localhost:3000`과 동일하게 작동하도록 설정
