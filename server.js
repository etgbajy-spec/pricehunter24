const express = require('express');
const path = require('path');
const app = express();
const port = 8000;

// 정적 파일 제공
app.use(express.static(__dirname));

// CSP 헤더 설정 - Firebase 최적화된 정책
app.use((req, res, next) => {
  // Firebase 및 필수 서비스에 최적화된 CSP 정책
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    "script-src-elem 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com",
    "frame-src 'self' https://www.google.com https://recaptcha.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspPolicy);
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
  console.log(`🔒 CSP 헤더가 Firebase 도메인을 허용하도록 설정되었습니다.`);
  console.log(`🔥 Firebase 스크립트 출처: https://www.gstatic.com`);
  console.log(`🌐 Firebase API 출처: firestore.googleapis.com, identitytoolkit.googleapis.com 등`);
  console.log(`📋 CSP 정책이 Firebase 8.x SDK와 호환되도록 최적화되었습니다.`);
}); 