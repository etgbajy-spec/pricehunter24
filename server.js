const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const csrf = require('csrf');
const app = express();
const port = process.env.PORT || 8000;

// 환경변수 로드 (dotenv 사용)
require('dotenv').config();

// Firebase Admin SDK 초기화 (환경변수 사용)
// ⚠️ 보안: Firebase Admin SDK 키는 환경변수로만 관리해야 합니다.
// 배포 플랫폼(Netlify/Vercel)의 환경변수 설정에서 설정하세요.
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "pricehunter-99a1b",
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL
};

// 환경변수 검증
if (!serviceAccount.private_key || !serviceAccount.client_email) {
  console.warn('⚠️ Firebase Admin SDK 환경변수가 설정되지 않았습니다.');
  console.warn('⚠️ 카카오 → Firebase 토큰 교환 기능이 비활성화됩니다.');
  console.warn('⚠️ 배포 플랫폼의 환경변수 설정에서 Firebase Admin SDK 키를 설정하세요.');
}

// Firebase Admin 초기화
let adminInitialized = false;
if (serviceAccount.private_key && serviceAccount.client_email) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "pricehunter-99a1b"
    });
    adminInitialized = true;
    console.log('✅ Firebase Admin SDK 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin SDK 초기화 실패:', error.message);
    console.log('⚠️ 카카오 → Firebase 토큰 교환 기능이 비활성화됩니다.');
  }
} else {
  console.log('⚠️ Firebase Admin SDK 환경변수가 없어 초기화를 건너뜁니다.');
}

// 세션 설정 (CSRF 보호용)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS에서만 전송
    httpOnly: true, // XSS 방지
    maxAge: 24 * 60 * 60 * 1000 // 24시간
  }
}));

// JSON 파싱 미들웨어 (크기 제한)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CSRF 토큰 생성 미들웨어
const tokens = new csrf();
function generateCSRFToken(req, res, next) {
  const secret = req.session.csrfSecret || tokens.secretSync();
  req.session.csrfSecret = secret;
  req.csrfToken = tokens.create(secret);
  res.locals.csrfToken = req.csrfToken;
  next();
}

// CSRF 검증 미들웨어 (API 엔드포인트용)
function verifyCSRF(req, res, next) {
  const secret = req.session.csrfSecret;
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!secret || !token) {
    return res.status(403).json({ error: 'CSRF 토큰이 없습니다.' });
  }
  
  if (!tokens.verify(secret, token)) {
    return res.status(403).json({ error: '유효하지 않은 CSRF 토큰입니다.' });
  }
  
  next();
}

// Rate Limiting 설정 (DDoS 방지 및 비용 절감)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100개 요청
  message: {
    error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '15분 후에 다시 시도해주세요.'
  },
  standardHeaders: true, // `RateLimit-*` 헤더 반환
  legacyHeaders: false, // `X-RateLimit-*` 헤더 비활성화
});

// API 엔드포인트에만 Rate Limiting 적용 (정적 파일은 제외)
app.use('/api/', limiter);

// 정적 파일 제공
app.use(express.static(__dirname));

// 보안 헤더 설정 미들웨어
app.use((req, res, next) => {
  // CSP 헤더 설정 - Firebase 완전 지원 정책 (unsafe-eval 제거)
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
    // Firebase + Kakao API 연결 허용
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://developers.kakao.com https://kapi.kakao.com https://kauth.kakao.com https://*.firebaseapp.com https://*.cloudfunctions.net https://api.emailjs.com https://www.gstatic.com https://*.gstatic.com https://accounts.google.com https://oauth2.googleapis.com https://apis.google.com https://*.google.com https://*.googleapis.com https://cdn.jsdelivr.net https://*.jsdelivr.net",
    // iframe 허용 (reCAPTCHA, Google 로그인, Kakao, Firebase)
    "frame-src 'self' https://www.google.com https://accounts.google.com https://recaptcha.google.com https://kauth.kakao.com https://pricehunter-99a1b.firebaseapp.com https://*.firebaseapp.com https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://*.google.com",
    // 보안 정책 강화
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  // 보안 헤더 설정
  res.setHeader('Content-Security-Policy', cspPolicy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS 헤더 (HTTPS 환경에서만)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // 브라우저 캐시 무효화 (CSP 변경사항 즉시 적용)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // 디버깅용 로그 (개발 환경에서만)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔒 보안 헤더 설정됨');
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

// 입력 데이터 검증 및 sanitization 미들웨어
function validateInput(req, res, next) {
  // 기본 입력 검증
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        const value = req.body[key];
        
        // 길이 제한 검증
        if (value.length > 10000) {
          return res.status(400).json({ error: `입력 데이터(${key})가 너무 깁니다.` });
        }
        
        // 기본 HTML 태그 제거 (XSS 방지)
        req.body[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
  }
  
  next();
}

// CSRF 토큰 발급 API (클라이언트에서 사용)
app.get('/api/csrf-token', generateCSRFToken, (req, res) => {
  res.json({ csrfToken: req.csrfToken });
});

// 결제 금액 검증 API
app.post('/api/validate-payment', generateCSRFToken, verifyCSRF, validateInput, async (req, res) => {
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
app.post('/api/kakao-to-firebase-token', generateCSRFToken, verifyCSRF, validateInput, async (req, res) => {
  if (!adminInitialized) {
    return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다. 환경변수를 확인하세요.' });
  }
  
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