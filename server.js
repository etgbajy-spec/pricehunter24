const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const app = express();
const port = process.env.PORT || 8000;

// 환경변수 로드 (dotenv 사용)
require('dotenv').config();

// Firebase Admin SDK 초기화 (환경변수 사용)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "pricehunter-99a1b",
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID || "61241fe6ae6b528cba19a4d0877b49a9b12f92e7",
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7OEnyTaUBswfI\nsSQk98jy5uFmnKJMou6HeZlaA69U12MtBadBbJ9lIkBbOteDBuXuja1owKTwRCz3\nsAaSsJ16jur0x1JT9Qv5xevz/bKg9bXysVjbyYud3zg2WPLurRI1sNOwam8smVka\nFJwTA5L8h5xNnAP3H9ALBp2Hw88Ci5HoF+bMFxwa3mfwEVZVM1+dHU3YxsebTyN/\nIwKvyeo8wZibAd4RmQJNmkAAOtLUkqtz4gtDhwtXyMfq52nFAV+I3El6wyFcpIgT\n/2d4fRSHDxy9MGHaSb0T+4vduNJFcTQs4E4qgLMZ8O7/4A5rk11pVGvG/cg96vwU\nhaxcEofpAgMBAAECggEAJ7DpTGtVniScc9nKNeQqQATeqGhwqBqqwyHudvztAOmg\n5vyZ1u72Y/R8/FpfMjIWMRrsNpcQ4LczaVdyLUswN7lw6nAPbik3Xr6tJU8VvbYZ\n2tfqZL430UJvomX9KsiaYbOZTX9jDmt8TmEsLYPGd68wXevDk3K1IoFGiG/kxT8A\ni5yr57qNvyNdSooRyQZO5i9DYVN0TS/2Z/n5HY1oe7maCWPgN45l2NVCOztNFTEi\nun8kVjTPCU0MywWgXyjuv/+8cNXK186RW4OfE6lpWXFECAWIpr3GVcypW80Tww2I\nB1psxPkuwpZGQDplBfEjGkRgsuL9O5t4BjgbMTrC+QKBgQDt9A8w78ZG1fFXuzLC\nks2Gf6FevT60uiGSO1Epja1tShlU7X3Vda0TIMyDtE5I9TRh7/pgwtgXDzvCtATB\n2Y3rF+ikhGz1BusxmwNx32zoZVqT61EXgpm02WuWKa4vEheleN1zk9FYuGIrR6Gj\nfYecte4DjTGz2xhDCT77vMtmbwKBgQDJazkHvCMJo69UtphCtIDl0cpSqqStMon1\nf84knJetrh0oiaACplbGUnHGKdiPUTttmT5lh9kgBdmYBnTHcv/uLYsXci/H7L94\naQv6ebHHn/GIGI8zthcxi8MpGeNc7KWYyK0G5Nh7qUlSpz5udhhDPGtmp54Dromx\nKe7sS5djJwKBgB9ihW5q8bf+F+r+Yd+QBVOsGdipFVA5DJyA/l+AtFMp5tVwzZwN\n/Vn8hX0JlxnAXbxdLqT8jgvckoFHxSjcTP+pE6I/ZS+cTgEo9PdcBL1SQPQpoXR8\nYVGdK7eOn87NkBjfLDZGVOJiz2/t7r/lmrFsvYvyX4/dYgHVgl0ptZo5AoGBALOm\ndSmW/tFcM8glTM1CXi2d3w24skTg7PgRVHaHTSpWQB+mERgL8R3W7y/Gpye9Vno8\n0tCQSHMthJT6PTKgOfHgoUz6Re/WFDl7yHlSDeV1nWK8NQ30fd9tP1brhkWdtV3+\nr4WUnBpANewIy8COiLl/rHPVUTULejiQpFASZCbFAoGASxGStF3ifcV2fbaOdymS\nqeeD5XgrEl2wFaQpVtztilAVNUgNxnsrqH3q67XzVo33sfS2f7nFiccjK4Fuz+mF\n7g9/8ZM3bJ5PKlLGwV3qBxgpE0SNFr6u4fTXK5+p0lZZMADW929tWTg6pDrsjlsi\ndCjF8QxDOZrZfItMqyCqiVg=\n-----END PRIVATE KEY-----\n",
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@pricehunter-99a1b.iam.gserviceaccount.com",
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID || "106064542976099664086",
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL || "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40pricehunter-99a1b.iam.gserviceaccount.com"
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

// JSON 파싱 미들웨어 (크기 제한)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 정적 파일 제공
app.use(express.static(__dirname));

// CSP 헤더 설정 - Firebase 완전 지원 정책
app.use((req, res, next) => {
  // 강화된 CSP 정책 (unsafe-eval 제거)
  const cspPolicy = [
    "default-src 'self'",
    // Firebase + Kakao 스크립트 허용 (unsafe-eval 제거로 보안 강화)
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net https://apis.google.com https://apis.google.com/js https://*.googleapis.com https://*.google.com https://cdn.jsdelivr.net https://*.jsdelivr.net",
    "script-src-elem 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net https://apis.google.com https://apis.google.com/js https://*.googleapis.com https://*.google.com https://cdn.jsdelivr.net https://*.jsdelivr.net",
    // 스타일 허용
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
    // 이미지 허용
    "img-src 'self' data: blob: https:",
    // 폰트 허용
    "font-src 'self' https://fonts.gstatic.com",
    // Firebase + Kakao API 연결 허용 (Chart.js 소스맵 포함)
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://developers.kakao.com https://kapi.kakao.com https://kauth.kakao.com https://*.firebaseapp.com https://*.cloudfunctions.net https://api.emailjs.com https://www.gstatic.com https://*.gstatic.com https://accounts.google.com https://oauth2.googleapis.com https://apis.google.com https://*.google.com https://*.googleapis.com https://cdn.jsdelivr.net https://*.jsdelivr.net",
    // iframe 허용 (reCAPTCHA, Google 로그인, Kakao, Firebase)
    "frame-src 'self' https://www.google.com https://accounts.google.com https://recaptcha.google.com https://kauth.kakao.com https://pricehunter-99a1b.firebaseapp.com https://*.firebaseapp.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.google.com",
    // 보안 정책 강화
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  // CSP 헤더 설정 (단일 헤더로 중복 방지)
  res.setHeader('Content-Security-Policy', cspPolicy);
  
  // 브라우저 캐시 무효화 (CSP 변경사항 즉시 적용)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
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

// 입력 데이터 검증 미들웨어
function validateInput(req, res, next) {
  // 기본 입력 검증
  if (req.body && typeof req.body === 'object') {
    // HTML 태그 제거
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/<[^>]*>/g, '');
      }
    });
    
    // 길이 제한 검증
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string' && req.body[key].length > 1000) {
        return res.status(400).json({ error: '입력 데이터가 너무 깁니다.' });
      }
    });
  }
  
  next();
}

// 결제 금액 검증 API
app.post('/api/validate-payment', validateInput, async (req, res) => {
  try {
    const { productName, amount, orderId } = req.body;
    
    // 입력 데이터 검증
    if (!productName || !amount || !orderId) {
      return res.status(400).json({ error: '필수 결제 정보가 누락되었습니다.' });
    }

    // 금액 검증
    const numericAmount = parseInt(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 10000000) {
      return res.status(400).json({ error: '유효하지 않은 결제 금액입니다.' });
    }

    // 상품명 검증
    if (typeof productName !== 'string' || productName.length > 100) {
      return res.status(400).json({ error: '유효하지 않은 상품명입니다.' });
    }

    // 주문번호 검증
    if (typeof orderId !== 'string' || orderId.length > 50) {
      return res.status(400).json({ error: '유효하지 않은 주문번호입니다.' });
    }

    // 결제 검증 성공
    res.json({ 
      valid: true, 
      amount: numericAmount,
      message: '결제 정보가 유효합니다.' 
    });
    
  } catch (error) {
    console.error('❌ 결제 검증 실패:', error);
    res.status(500).json({ error: '결제 검증 중 오류가 발생했습니다.' });
  }
});

// 카카오 액세스 토큰을 Firebase 커스텀 토큰으로 교환
app.post('/api/kakao-to-firebase-token', validateInput, async (req, res) => {
  try {
    const { kakaoAccessToken, userData } = req.body;
    
    // 입력 데이터 검증
    if (!kakaoAccessToken || !userData) {
      return res.status(400).json({ error: '필수 데이터가 누락되었습니다.' });
    }

    if (typeof kakaoAccessToken !== 'string' || kakaoAccessToken.length > 500) {
      return res.status(400).json({ error: '유효하지 않은 토큰입니다.' });
    }

    if (!userData.uid || !userData.email) {
      return res.status(400).json({ error: '사용자 정보가 올바르지 않습니다.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({ error: '유효하지 않은 이메일 형식입니다.' });
    }

    // 카카오 사용자 정보 검증
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${kakaoAccessToken}`
      }
    });

    if (!kakaoUserResponse.ok) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    const kakaoUser = await kakaoUserResponse.json();
    
    // Firebase 커스텀 토큰 생성
    const customToken = await admin.auth().createCustomToken(userData.uid, {
      email: userData.email,
      name: userData.name || 'Unknown',
      picture: userData.profileImage || '',
      loginMethod: 'kakao',
      kakaoId: userData.id || ''
    });

    console.log('✅ Firebase 커스텀 토큰 생성 완료:', userData.email);
    
    res.json({ customToken });
  } catch (error) {
    console.error('❌ 카카오 → Firebase 토큰 교환 실패:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중입니다.`);
  console.log(`📁 프로젝트 디렉토리: ${__dirname}`);
  console.log(`🔒 CSP 헤더가 Firebase v9 SDK + Kakao를 지원하도록 설정되었습니다.`);
  console.log(`🔥 Firebase 스크립트 출처: https://www.gstatic.com, https://www.gstatic.com/firebasejs`);
  console.log(`🌐 Firebase API 출처: firestore.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com`);
  console.log(`💬 Kakao API 출처: developers.kakao.com, kapi.kakao.com, kauth.kakao.com`);
  console.log(`🛡️ 보안 강화: 'unsafe-eval' 제거로 eval() 사용 방지`);
  console.log(`📋 관리자 대시보드: http://localhost:${port}/admin-dashboard`);
  console.log(`🧪 Firebase 연결 테스트를 위해 브라우저에서 접속 후 DevTools 콘솔을 확인하세요.`);
}); 