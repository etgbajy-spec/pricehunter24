const express = require('express');
const path = require('path');
const app = express();
const port = 8000;

// 정적 파일 제공
app.use(express.static(__dirname));

// CSP 헤더 설정 - Firebase 완전 지원 정책
app.use((req, res, next) => {
  // Firebase 8.x SDK 완전 지원 CSP 정책
  const cspPolicy = [
    "default-src 'self'",
    // Firebase 스크립트 허용 (script-src와 script-src-elem 동일하게 설정)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com",
    "script-src-elem 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com",
    // 스타일 허용
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
    // 이미지 허용
    "img-src 'self' data: blob: https:",
    // 폰트 허용
    "font-src 'self' https://fonts.gstatic.com",
    // Firebase API 연결 허용 (모든 Firebase 서비스 포함)
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com",
    // iframe 허용 (reCAPTCHA, Google 로그인)
    "frame-src 'self' https://www.google.com https://recaptcha.google.com",
    // 보안 정책
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  // CSP 헤더 설정 (단일 헤더로 중복 방지)
  res.setHeader('Content-Security-Policy', cspPolicy);
  
  // 디버깅용 로그 (개발 환경에서만)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔒 CSP 헤더 설정됨:', cspPolicy.substring(0, 100) + '...');
  }
  
  next();
});

// 라우트 설정
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  console.log(`📁 프로젝트 디렉토리: ${__dirname}`);
  console.log(`🔒 CSP 헤더가 Firebase 8.x SDK를 완전 지원하도록 설정되었습니다.`);
  console.log(`🔥 Firebase 스크립트 출처: https://www.gstatic.com, https://www.gstatic.com/firebasejs`);
  console.log(`🌐 Firebase API 출처: firestore.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com`);
  console.log(`📋 관리자 대시보드: http://localhost:${port}/admin-dashboard`);
  console.log(`🧪 Firebase 연결 테스트를 위해 브라우저에서 접속 후 DevTools 콘솔을 확인하세요.`);
}); 