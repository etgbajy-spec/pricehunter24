const express = require('express');
const path = require('path');
const app = express();
const port = 8000;

// 정적 파일 제공
app.use(express.static(__dirname));

// CSP 헤더 설정 - Firebase 및 Google 도메인 완전 허용
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' " +
    "https://www.gstatic.com " +
    "https://www.gstatic.com/firebasejs " +
    "https://apis.google.com " +
    "https://www.google.com " +
    "https://developers.kakao.com " +
    "https://t1.kakaocdn.net " +
    "https://cdn.tailwindcss.com " +
    "https://unpkg.com " +
    "https://cdn.jsdelivr.net " +
    "https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' " +
    "https://cdn.tailwindcss.com " +
    "https://fonts.googleapis.com; " +
    "font-src 'self' " +
    "https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: " +
    "https://www.gstatic.com " +
    "https:; " +
    "connect-src 'self' " +
    "https://firestore.googleapis.com " +
    "https://identitytoolkit.googleapis.com " +
    "https://securetoken.googleapis.com " +
    "https://firebasestorage.googleapis.com " +
    "https://content-firebaseappcheck.googleapis.com " +
    "https://www.googleapis.com " +
    "https://*.firebaseio.com " +
    "wss://*.firebaseio.com; " +
    "frame-src 'self' " +
    "https://www.google.com " +
    "https://recaptcha.google.com;"
  );
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
  console.log(`🌐 Firebase 도메인: pricehunt24.com`);
}); 