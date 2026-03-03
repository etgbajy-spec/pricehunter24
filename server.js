const express = require('express');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const csrf = require('csrf');
const app = express();
const port = process.env.PORT || 1000;

// 환경변수 로드 (dotenv 있으면 사용, 없으면 무시)
try { require('dotenv').config(); } catch (e) { /* dotenv 미설치 시 무시 */ }

// Firebase Admin SDK 초기화: 1) JSON 파일 경로 → 2) 환경변수
function getServiceAccount() {
  const jsonPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    || path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (data.private_key && data.client_email) return data;
    } catch (e) {
      console.warn('⚠️ 서비스 계정 JSON 읽기 실패:', jsonPath, e.message);
    }
  }
  return {
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
}

const serviceAccount = getServiceAccount();

if (!serviceAccount.private_key || !serviceAccount.client_email) {
  console.warn('⚠️ Firebase Admin SDK 환경변수가 설정되지 않았습니다.');
  console.warn('⚠️ 프로젝트 폴더에 serviceAccountKey.json 을 두거나, 환경변수를 설정하세요.');
}

// Firebase Admin 초기화
let adminInitialized = false;
if (serviceAccount.private_key && serviceAccount.client_email) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "pricehunter-99a1b"
    });
    adminInitialized = true;
    console.log('✅ Firebase Admin SDK 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin SDK 초기화 실패:', error.message);
  }
} else {
  console.log('⚠️ Firebase Admin SDK가 없어 초기화를 건너뜁니다.');
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
  message: { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.', retryAfter: '15분 후에 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80, // 결제 페이지 로딩·새로고침·검증 등 정상 사용 시 여유 있게 (기존 30은 페이지 여러 번 열면 걸림)
  message: { error: '결제 관련 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', retryAfter: '15분 후에 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API 엔드포인트에만 Rate Limiting 적용 (정적 파일은 제외)
app.use('/api/', limiter);

// CORS 제한: 운영 도메인만 허용 (API 응답에 적용)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://pricehunt24.com,https://www.pricehunt24.com').split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000');
}
app.use('/api/', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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

// Audit Log (Firestore auditLogs 컬렉션, Admin SDK 전용 쓰기)
async function writeAuditLog(action, actor, target, details) {
  if (!adminInitialized) return;
  try {
    await admin.firestore().collection('auditLogs').add({
      action,
      actor: actor || 'system',
      target: target || '',
      details: typeof details === 'object' ? details : { message: String(details) },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Audit log write failed:', e.message);
  }
}

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

// 결제 정보 서버 조회 (req만 받고 금액·상품명·원산지는 Firestore/서버에서 확정)
app.get('/api/payment-info', paymentLimiter, async (req, res) => {
  let reqId = (req.query.req || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, ''); // URL에서 # 붙은 번호 지원 (예: #PH-xxx)
  if (!reqId) {
    return res.status(400).json({ error: '의뢰 번호(req)가 필요합니다.' });
  }
  if (reqId.length > 80) {
    return res.status(400).json({ error: '유효하지 않은 의뢰 번호입니다.' });
  }
  // Firebase 미연결 시 개발용 더미 응답 (로컬 테스트용, URL의 price/name은 절대 사용하지 않음)
  if (!adminInitialized) {
    const devPrice = 10000;
    return res.status(200).json({
      name: '(개발) 상품',
      price: devPrice,
      origin: '테스트',
      method: 'direct',
      reqId,
      _dev: true
    });
  }
  try {
    const db = admin.firestore();
    let data = null;
    const docSnap = await db.collection('requests').doc(reqId).get();
    if (docSnap.exists) {
      data = docSnap.data();
    }
    const withHash = reqId.startsWith('PH-') ? '#' + reqId : reqId;
    if (!data) {
      const q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
      if (!q.empty) data = q.docs[0].data();
    }
    if (!data) {
      const qHash = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
      if (!qHash.empty) data = qHash.docs[0].data();
    }
    if (!data) {
      const q2 = await db.collection('requests').where('reqNum', '==', reqId).limit(1).get();
      if (!q2.empty) data = q2.docs[0].data();
    }
    if (!data) {
      const q2Hash = await db.collection('requests').where('reqNum', '==', withHash).limit(1).get();
      if (!q2Hash.empty) data = q2Hash.docs[0].data();
    }
    if (!data) {
      return res.status(404).json({ error: '해당 의뢰 정보를 찾을 수 없습니다.' });
    }
    const price = Number(data.productPrice ?? data.price ?? data.totalAmount ?? 0);
    if (isNaN(price) || price < 0 || price > 100000000) {
      return res.status(400).json({ error: '유효한 결제 금액을 확인할 수 없습니다.' });
    }
    const name = String(data.productName ?? data.name ?? '상품').slice(0, 200);
    const origin = String(data.productOrigin ?? data.origin ?? '정보 없음').slice(0, 100);
    const method = (data.method === 'support' || data.purchaseMethod === 'support') ? 'support' : 'direct';
    res.json({ name, price, origin, method, reqId: reqId });
  } catch (err) {
    console.error('❌ 결제 정보 조회 실패:', err);
    res.status(500).json({ error: '결제 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 구매 대행 수수료·총액 계산 서버화 (ELP/가격 계산)
const FEE_RATE = 0.03;
app.get('/api/calculate-purchase-support', async (req, res) => {
  let reqId = (req.query.req || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, ''); // #PH-xxx 형식 지원
  const amountParam = req.query.amount;
  let basePrice = NaN;
  if (amountParam != null && amountParam !== '') {
    basePrice = Number(amountParam);
  }
  if ((!reqId && isNaN(basePrice)) || basePrice < 0) {
    return res.status(400).json({ error: 'req(의뢰번호) 또는 amount(금액)가 필요합니다. 예: ?amount=100000' });
  }
  if (reqId && isNaN(basePrice)) {
    if (!adminInitialized) {
      return res.status(400).json({
        error: 'Firebase가 연결되지 않아 의뢰 번호로 금액을 조회할 수 없습니다.',
        hint: 'amount 파라미터로 금액을 직접 넣어 테스트하세요. 예: ?amount=100000'
      });
    }
    try {
      const db = admin.firestore();
      const docSnap = await db.collection('requests').doc(reqId).get();
      let data = docSnap.exists ? docSnap.data() : null;
      if (!data) {
        const q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
        if (!q.empty) data = q.docs[0].data();
      }
      if (!data) {
        const q2 = await db.collection('requests').where('reqNum', '==', reqId).limit(1).get();
        if (!q2.empty) data = q2.docs[0].data();
      }
      if (data) basePrice = Number(data.finalPrice ?? data.productPrice ?? data.price ?? data.totalAmount ?? 0);
    } catch (e) {
      console.error('calculate-purchase-support 조회 실패:', e);
    }
  }
  if (isNaN(basePrice) || basePrice < 0 || basePrice > 100000000) {
    return res.status(400).json({
      error: '유효한 기준 금액을 확인할 수 없습니다.',
      hint: reqId
        ? '해당 의뢰가 없거나 금액이 등록되지 않았을 수 있습니다. 금액만 테스트하려면 ?amount=100000 처럼 넣어 보세요.'
        : 'req(의뢰번호) 또는 amount(금액)를 넣어 주세요. 예: ?amount=100000'
    });
  }
  const fee = Math.round(basePrice * FEE_RATE);
  const total = basePrice + fee;
  res.json({ basePrice, feeRate: FEE_RATE, fee, total });
});

// 결제 금액 검증 API
app.post('/api/validate-payment', paymentLimiter, generateCSRFToken, verifyCSRF, validateInput, async (req, res) => {
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

    // 결제 검증 성공 시 Audit Log (선택)
    writeAuditLog('payment_validate', req.body.orderId || 'client', 'validate-payment', { amount: numericAmount, productName: typeof productName === 'string' ? productName.slice(0, 50) : '' });
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

// Webhook: 결제 확정 (토스 등 결제사에서 호출)
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.post('/api/webhook/payment', express.json(), webhookLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId || body.paymentKey;
    const status = body.status || body.paymentStatus;
    const amount = body.amount || body.totalAmount;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId 또는 paymentKey 필요' });
    }
    writeAuditLog('payment_webhook', 'payment_provider', String(orderId), { status, amount, receivedAt: new Date().toISOString() });
    if (adminInitialized && (status === 'DONE' || status === 'paid' || body.status === '완료')) {
      try {
        const db = admin.firestore();
        const payRef = db.collection('payments').doc(String(orderId));
        const paySnap = await payRef.get();
        if (paySnap.exists) {
          await payRef.update({ status: 'confirmed', confirmedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        const orderRef = db.collection('orders').doc(String(orderId));
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
          await orderRef.update({ paymentStatus: 'confirmed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      } catch (e) {
        console.error('Webhook order/payment update failed:', e.message);
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: 'Internal error' });
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

// 서버 시작 (0.0.0.0으로 바인딩해 localhost 접속 가능하게)
app.listen(port, '0.0.0.0', () => {
  console.log('🚀 서버가 http://localhost:' + port + ' 에서 실행 중입니다.');
  console.log('   브라우저에서 http://localhost:' + port + ' 로 접속하세요.');
}); 