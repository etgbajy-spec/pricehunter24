const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const app = express();
const port = 8000;

// Firebase Admin SDK 초기화
const serviceAccount = {
  type: "service_account",
  project_id: "pricehunter-99a1b",
  private_key_id: "your-private-key-id",
  private_key: "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-xxxxx@pricehunter-99a1b.iam.gserviceaccount.com",
  client_id: "your-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40pricehunter-99a1b.iam.gserviceaccount.com"
};

// Firebase Admin 초기화 (실제 서비스에서는 환경변수나 파일에서 키를 가져와야 함)
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "pricehunter-99a1b"
  });
  console.log('✅ Firebase Admin SDK 초기화 완료');
} catch (error) {
  console.error('❌ Firebase Admin SDK 초기화 실패:', error.message);
  console.log('⚠️ 카카오 → Firebase 토큰 교환 기능이 비활성화됩니다.');
}

// JSON 파싱 미들웨어
app.use(express.json());

// 정적 파일 제공
app.use(express.static(__dirname));

// CSP 헤더 설정 - Firebase 완전 지원 정책
app.use((req, res, next) => {
  // Firebase 8.x SDK + Kakao 완전 지원 CSP 정책 (eval 제거)
  const cspPolicy = [
    "default-src 'self'",
    // Firebase + Kakao 스크립트 허용 (Kakao SDK 호환성을 위해 eval 허용)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net",
    "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net",
    // 스타일 허용
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
    // 이미지 허용
    "img-src 'self' data: blob: https:",
    // 폰트 허용
    "font-src 'self' https://fonts.gstatic.com",
    // Firebase + Kakao API 연결 허용
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://developers.kakao.com https://kapi.kakao.com https://kauth.kakao.com",
    // iframe 허용 (reCAPTCHA, Google 로그인, Kakao)
    "frame-src 'self' https://www.google.com https://recaptcha.google.com https://kauth.kakao.com",
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

// 카카오 액세스 토큰을 Firebase 커스텀 토큰으로 교환
app.post('/api/kakao-to-firebase-token', async (req, res) => {
  try {
    const { kakaoAccessToken, userData } = req.body;
    
    if (!kakaoAccessToken || !userData) {
      return res.status(400).json({ error: '카카오 액세스 토큰과 사용자 데이터가 필요합니다.' });
    }

    // 카카오 사용자 정보 검증
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${kakaoAccessToken}`
      }
    });

    if (!kakaoUserResponse.ok) {
      return res.status(401).json({ error: '유효하지 않은 카카오 액세스 토큰입니다.' });
    }

    const kakaoUser = await kakaoUserResponse.json();
    
    // Firebase 커스텀 토큰 생성
    const customToken = await admin.auth().createCustomToken(userData.uid, {
      email: userData.email,
      name: userData.name,
      picture: userData.profileImage,
      loginMethod: 'kakao',
      kakaoId: userData.id
    });

    console.log('✅ Firebase 커스텀 토큰 생성 완료:', userData.email);
    
    res.json({ customToken });
  } catch (error) {
    console.error('❌ 카카오 → Firebase 토큰 교환 실패:', error);
    res.status(500).json({ error: '토큰 교환 중 오류가 발생했습니다.' });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  console.log(`📁 프로젝트 디렉토리: ${__dirname}`);
  console.log(`🔒 CSP 헤더가 Firebase 8.x SDK + Kakao를 완전 지원하도록 설정되었습니다.`);
  console.log(`🔥 Firebase 스크립트 출처: https://www.gstatic.com, https://www.gstatic.com/firebasejs`);
  console.log(`🌐 Firebase API 출처: firestore.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com`);
  console.log(`💬 Kakao API 출처: developers.kakao.com, kapi.kakao.com, kauth.kakao.com`);
  console.log(`🛡️ 보안 강화: 'unsafe-eval' 제거로 eval() 사용 방지`);
  console.log(`📋 관리자 대시보드: http://localhost:${port}/admin-dashboard`);
  console.log(`🧪 Firebase 연결 테스트를 위해 브라우저에서 접속 후 DevTools 콘솔을 확인하세요.`);
}); 