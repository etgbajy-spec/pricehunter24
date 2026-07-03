const express = require('express');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const csrf = require('csrf');
const { validateProductLinkUrl } = require('./url-safety');
const adminNotifyEmail = (() => {
  try { return require('./admin-notify-email'); } catch (e) { return null; }
})();
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
  allowedOrigins.push(
    'http://localhost:8080', 'http://localhost:3000', 'http://localhost:1000',
    'http://127.0.0.1:8080', 'http://127.0.0.1:3000', 'http://127.0.0.1:1000'
  );
}
app.use('/api/', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token, Authorization');
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
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net https://apis.google.com https://apis.google.com/js https://*.googleapis.com https://*.google.com https://cdn.jsdelivr.net https://*.jsdelivr.net https://js.tosspayments.com",
    "script-src-elem 'self' 'unsafe-inline' https://www.gstatic.com https://www.gstatic.com/firebasejs https://cdn.tailwindcss.com https://developers.kakao.com https://t1.kakaocdn.net https://apis.google.com https://apis.google.com/js https://*.googleapis.com https://*.google.com https://cdn.jsdelivr.net https://*.jsdelivr.net https://js.tosspayments.com",
    // 스타일 허용
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
    // 이미지 허용
    "img-src 'self' data: blob: https:",
    // 폰트 허용
    "font-src 'self' https://fonts.gstatic.com",
    // Firebase + Kakao API 연결 허용
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://www.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebase.googleapis.com https://developers.kakao.com https://kapi.kakao.com https://kauth.kakao.com https://*.firebaseapp.com https://*.cloudfunctions.net https://api.emailjs.com https://www.gstatic.com https://*.gstatic.com https://accounts.google.com https://oauth2.googleapis.com https://apis.google.com https://*.google.com https://*.googleapis.com https://cdn.jsdelivr.net https://*.jsdelivr.net https://api.tosspayments.com",
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
    const devBase = 85000;
    const devFee = Math.max(1, Math.round(devBase * 0.01));
    return res.status(200).json({
      name: '(개발) 상품',
      origin: '테스트',
      method: 'support',
      reqId,
      basePrice: devBase,
      supportFee: devFee,
      finalPrice: devBase + devFee,
      earnedPoints: Math.max(1, Math.round(devBase * 0.01)),
      _dev: true
    });
  }
  try {
    const db = admin.firestore();
    let data = null;
    const docSnap = await db.collection('requests').doc(reqId).get();
    if (docSnap.exists) data = docSnap.data();
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

    const queryMethod = (req.query.method || '').toString().trim();
    const method =
      queryMethod === 'support' ||
      data.method === 'support' ||
      data.purchaseMethod === 'support' ||
      data.purchaseDecision === 'support'
        ? 'support'
        : 'direct';

    const basePrice = Number(
      data.purchaseReport?.price ??
      data.adminResponse?.lowestPrice ??
      data.adminResponse?.totalCost ??
      data.productPrice ??
      data.price ??
      0
    );
    if (isNaN(basePrice) || basePrice <= 0 || basePrice > 100000000) {
      return res.status(400).json({ error: '유효한 결제 금액을 확인할 수 없습니다.' });
    }

    let supportFee = 0;
    let finalPrice = basePrice;
    if (method === 'support') {
      supportFee = computeSupportFee(basePrice);
      finalPrice = basePrice + supportFee;
    }
    const earnedPoints = method === 'support' ? computeSupportFee(basePrice) : 0;

    const name = String(data.productName ?? data.name ?? '상품').slice(0, 200);
    const origin = String(
      data.purchaseReport?.origin ??
      data.adminResponse?.seller ??
      data.productOrigin ??
      data.origin ??
      '정보 없음'
    ).slice(0, 100);
    const status = String(data.status || '').slice(0, 40);
    res.json({
      name,
      origin,
      method,
      status,
      reqId,
      basePrice,
      supportFee,
      finalPrice,
      earnedPoints,
      requestPrice: data.price ?? null
    });
  } catch (err) {
    console.error('❌ 결제 정보 조회 실패:', err);
    res.status(500).json({ error: '결제 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// ====== 구매대행(대행 결제) 정책 ======
// - 결제금액 기준: 관리자 답변 견적금액(모든 포함) = requests 문서의 totalAmount/productPrice/price 등에서 확정
// - 회계/세무 정리용: 결제금액의 1%를 "대행수수료 매출"로 잡고, 동일 금액을 "적립금"으로 지급(구매확정 후 확정)
const SUPPORT_FEE_RATE = 0.01;

/** 구매대행 배송·처리 단계 (관리자 업데이트) */
const FULFILLMENT_STATUSES = ['not_ordered', 'ordered', 'shipped', 'delivered'];
const PAID_LIKE_PAYMENT_STATUSES = ['paid', 'confirmed'];
const CANCELLED_PAYMENT_STATUSES = ['cancelled', 'partially_cancelled'];
const ADMIN_RELAX_FULFILLMENT = process.env.ADMIN_RELAX_FULFILLMENT === '1';

function sanitizeReqId(input) {
  let reqId = (input || '').toString().trim();
  if (reqId) reqId = reqId.replace(/^#+/, '');
  if (!reqId || reqId.length > 80) return '';
  return reqId;
}

function randomId(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function computeSupportFee(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n * SUPPORT_FEE_RATE));
}

async function requireAdmin(req, res, next) {
  if (!adminInitialized) return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다.' });
  try {
    const authHeader = String(req.headers.authorization || '');
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: '인증이 필요합니다.' });
    const idToken = m[1].trim();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const adminSnap = await db.collection('admins').doc(uid).get();
    if (!adminSnap.exists) return res.status(403).json({ error: '관리자 권한이 없습니다.' });
    const adminData = adminSnap.data() || {};
    const ok = adminData.role === 'admin' || (Array.isArray(adminData.permissions) && adminData.permissions.includes('admin'));
    if (!ok) return res.status(403).json({ error: '관리자 권한이 없습니다.' });
    req.adminUser = { uid, email: decoded.email || '' };
    return next();
  } catch (e) {
    console.error('requireAdmin error:', e);
    return res.status(401).json({ error: '인증에 실패했습니다.' });
  }
}

function normalizeFulfillmentStatus(v) {
  const s = String(v || '').trim();
  return FULFILLMENT_STATUSES.includes(s) ? s : 'not_ordered';
}

function normalizePaymentStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['paid', 'confirmed', 'done', '완료', '결제완료'].includes(s)) return 'paid';
  if (CANCELLED_PAYMENT_STATUSES.includes(s)) return s;
  if (['pending', 'created', 'ready'].includes(s)) return s;
  return s;
}

function isPaidLikePaymentStatus(v) {
  return PAID_LIKE_PAYMENT_STATUSES.includes(normalizePaymentStatus(v));
}

function isCancelledPaymentStatus(v) {
  return CANCELLED_PAYMENT_STATUSES.includes(normalizePaymentStatus(v));
}

async function updatePointsLedgerForOrder(db, orderId, updater) {
  const q = await db.collection('pointsLedger').where('orderId', '==', orderId).limit(50).get();
  if (q.empty) return 0;
  const batch = db.batch();
  q.docs.forEach(d => batch.update(d.ref, updater(d.data() || {})));
  await batch.commit();
  return q.size;
}

async function loadRequestByReqId(db, reqId) {
  // 1) doc(id) 우선
  const docSnap = await db.collection('requests').doc(reqId).get();
  if (docSnap.exists) return { id: docSnap.id, data: docSnap.data() };
  // 2) requestNumber / reqNum 호환
  const withHash = reqId.startsWith('PH-') ? '#' + reqId : reqId;
  let q = await db.collection('requests').where('requestNumber', '==', reqId).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  q = await db.collection('requests').where('requestNumber', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  q = await db.collection('requests').where('reqNum', '==', reqId).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  q = await db.collection('requests').where('reqNum', '==', withHash).limit(1).get();
  if (!q.empty) return { id: q.docs[0].id, data: q.docs[0].data() };
  return null;
}

// 사용자 최종 선택 기록 (직접구매 / 프헌 구매요청)
app.post('/api/purchase-decision', paymentLimiter, validateInput, async (req, res) => {
  const reqId = sanitizeReqId(req.body?.reqId);
  const decision = String(req.body?.decision || '').toLowerCase();
  if (!reqId || (decision !== 'direct' && decision !== 'support')) {
    return res.status(400).json({ error: 'reqId와 decision(direct|support)이 필요합니다.' });
  }
  if (!adminInitialized) {
    return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다.' });
  }
  try {
    const db = admin.firestore();
    const loaded = await loadRequestByReqId(db, reqId);
    if (!loaded) return res.status(404).json({ error: '해당 의뢰를 찾을 수 없습니다.' });
    const status = String(loaded.data.status || '');
    if (status && status !== '답변완료' && status !== '완료') {
      return res.status(400).json({ error: '관리자 답변 완료 이후에만 최종 선택이 가능합니다.' });
    }
    const updateData = {
      purchaseDecision: decision,
      purchaseDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('requests').doc(loaded.id).update(updateData);
    writeAuditLog('purchase_decision', 'user', loaded.id, { reqId, decision });
    return res.json({ ok: true });
  } catch (e) {
    console.error('purchase-decision error:', e);
    return res.status(500).json({ error: '최종 선택 기록 중 오류가 발생했습니다.' });
  }
});

// 토스 결제용 주문 생성 (금액은 서버에서 의뢰 데이터로 확정)
app.post('/api/toss/create-order', paymentLimiter, validateInput, async (req, res) => {
  const reqId = sanitizeReqId(req.body?.reqId);
  if (!reqId) return res.status(400).json({ error: 'reqId가 필요합니다.' });
  if (!adminInitialized) return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다.' });

  try {
    const db = admin.firestore();
    const loaded = await loadRequestByReqId(db, reqId);
    if (!loaded) return res.status(404).json({ error: '해당 의뢰를 찾을 수 없습니다.' });

    const requestData = loaded.data || {};
    const status = String(requestData.status || '');
    if (status && status !== '답변완료' && status !== '완료') {
      return res.status(400).json({ error: '관리자 답변 완료 이후에만 결제가 가능합니다.' });
    }

    const amount = Number(requestData.totalAmount ?? requestData.productPrice ?? requestData.price ?? 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      return res.status(400).json({ error: '유효한 결제 금액을 확인할 수 없습니다.' });
    }

    const ps = normalizePaymentStatus(requestData.paymentStatus);
    if (isPaidLikePaymentStatus(ps)) {
      return res.status(400).json({ error: '이미 결제가 완료된 의뢰입니다. 새 결제를 만들 수 없습니다.' });
    }

    const latest = requestData.latestOrderId ? String(requestData.latestOrderId) : '';
    if (latest) {
      const prevSnap = await db.collection('payments').doc(latest).get();
      if (prevSnap.exists) {
        const prev = prevSnap.data() || {};
        const st = normalizePaymentStatus(prev.status);
        if (isPaidLikePaymentStatus(st)) {
          return res.status(400).json({ error: '진행 중인 유효한 결제가 있습니다. 새 결제를 만들 수 없습니다.' });
        }
        if (st === 'created' || st === 'pending' || st === 'ready') {
          await prevSnap.ref.update({
            status: 'abandoned',
            abandonedReason: 'replaced_by_new_checkout',
            abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    const orderName = String(requestData.productName ?? requestData.name ?? '상품').slice(0, 100);
    const orderId = `PH${Date.now()}${randomId(8)}`.slice(0, 64);
    const supportFee = computeSupportFee(amount);

    const customer = {
      payerName: String(req.body?.payerName || '').slice(0, 50),
      payerEmail: String(req.body?.payerEmail || '').slice(0, 100),
      payerPhone: String(req.body?.payerPhone || '').slice(0, 30),
      recipientName: String(req.body?.recipientName || '').slice(0, 50),
      recipientPhone: String(req.body?.recipientPhone || '').slice(0, 30),
      shippingAddress: String(req.body?.shippingAddress || '').slice(0, 300),
      shippingNote: String(req.body?.shippingNote || '').slice(0, 500),
    };

    await db.collection('payments').doc(orderId).set({
      orderId,
      reqId,
      requestDocId: loaded.id,
      orderName,
      amount,
      currency: 'KRW',
      provider: 'tosspayments',
      status: 'created',
      supportFeeRate: SUPPORT_FEE_RATE,
      supportFeeAmount: supportFee,
      pointsPlanned: supportFee, // 구매 지원 수수료 전액 적립 (구매확정 후 확정)
      pointsStatus: 'planned',
      customer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 의뢰 문서에 결제 진행 정보 연결
    await db.collection('requests').doc(loaded.id).update({
      purchaseDecision: 'support',
      purchaseDecisionAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: 'pending',
      latestOrderId: orderId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    writeAuditLog('payment_create_order', 'user', orderId, { reqId, amount });
    return res.json({ orderId, orderName, amount });
  } catch (e) {
    console.error('create-order error:', e);
    return res.status(500).json({ error: '주문 생성 중 오류가 발생했습니다.' });
  }
});

// 토스 결제 승인 (successUrl에서 호출)
app.post('/api/toss/confirm', paymentLimiter, validateInput, async (req, res) => {
  const paymentKey = String(req.body?.paymentKey || '').trim();
  const orderId = String(req.body?.orderId || '').trim();
  const amount = Number(req.body?.amount);
  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'paymentKey, orderId, amount가 필요합니다.' });
  }

  const secretKey = (process.env.TOSS_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: '서버 결제 설정이 완료되지 않았습니다. (TOSS_SECRET_KEY)' });
  }
  if (!adminInitialized) return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다.' });

  try {
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossData = await tossRes.json().catch(() => ({}));
    if (!tossRes.ok) {
      console.error('Toss confirm failed:', tossData);
      return res.status(400).json({ error: '결제 승인에 실패했습니다.', detail: tossData });
    }

    const db = admin.firestore();
    const payRef = db.collection('payments').doc(orderId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) {
      return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    }
    const pay = paySnap.data() || {};

    // 금액 재검증
    if (Number(pay.amount) !== amount) {
      return res.status(400).json({ error: '결제 금액이 일치하지 않습니다.' });
    }

    await payRef.update({
      paymentKey,
      status: 'paid',
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      providerStatus: tossData.status || 'DONE',
      receipt: tossData.receipt || null,
      method: tossData.method || null,
      card: tossData.card || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 의뢰 업데이트: 결제 완료 → 적립금은 "구매확정 후 확정"이므로 지금은 예정만 기록
    await db.collection('requests').doc(pay.requestDocId).update({
      paymentStatus: 'paid',
      paymentOrderId: orderId,
      paymentKey,
      fulfillmentStatus: 'not_ordered',
      fulfillmentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 적립금 원장: 예정 적립(구매확정 시 available로 전환)
    const points = Number(pay.pointsPlanned || 0);
    if (points > 0) {
      await db.collection('pointsLedger').add({
        orderId,
        reqId: pay.reqId,
        requestDocId: pay.requestDocId,
        type: 'EARN_PENDING',
        points,
        status: 'pending',
        reason: '구매대행 결제 적립(구매확정 후 확정)',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    writeAuditLog('payment_confirm', 'payment_provider', orderId, { amount });
    return res.json({
      ok: true,
      orderId,
      amount,
      orderName: pay.orderName || '',
      method: tossData.method || '',
      approvedAt: tossData.approvedAt || null,
    });
  } catch (e) {
    console.error('confirm error:', e);
    return res.status(500).json({ error: '결제 승인 처리 중 오류가 발생했습니다.' });
  }
});

// ====== 관리자: 구매확정(적립금 확정) / 결제 취소 ======
app.post('/api/admin/purchase-confirm', paymentLimiter, validateInput, requireAdmin, async (req, res) => {
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId) return res.status(400).json({ error: 'orderId가 필요합니다.' });
  try {
    const db = admin.firestore();
    const payRef = db.collection('payments').doc(orderId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    const pay = paySnap.data() || {};
    if (!isPaidLikePaymentStatus(pay.status)) return res.status(400).json({ error: '결제 완료 상태에서만 구매확정이 가능합니다.' });
    if (pay.pointsStatus === 'available') return res.status(400).json({ error: '이미 구매확정(적립금 확정) 처리된 주문입니다.' });

    if (pay.requestDocId) {
      const reqSnap = await db.collection('requests').doc(pay.requestDocId).get();
      const rd = reqSnap.exists ? (reqSnap.data() || {}) : {};
      const fs = normalizeFulfillmentStatus(rd.fulfillmentStatus);
      if (fs !== 'delivered' && !ADMIN_RELAX_FULFILLMENT) {
        return res.status(400).json({
          error: '배송완료(delivered) 단계로 올린 뒤에만 구매확정(적립금 확정)이 가능합니다. (관리자 모달에서 진행 단계를 저장하세요.)',
        });
      }
    }

    const points = Number(pay.pointsPlanned || 0);
    await payRef.update({
      pointsStatus: 'available',
      pointsAvailableAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (pay.requestDocId) {
      await admin.firestore().collection('requests').doc(pay.requestDocId).update({
        purchaseConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        pointsStatus: 'available',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await updatePointsLedgerForOrder(db, orderId, (d) => {
      if (d.type === 'EARN_PENDING' && d.status === 'pending') {
        return {
          type: 'EARN_AVAILABLE',
          status: 'available',
          availableAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }
      return { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    });

    writeAuditLog('admin_purchase_confirm', req.adminUser?.email || req.adminUser?.uid || 'admin', orderId, { points });
    return res.json({ ok: true, orderId, points });
  } catch (e) {
    console.error('admin purchase-confirm error:', e);
    return res.status(500).json({ error: '구매확정 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/admin/payment-cancel', paymentLimiter, validateInput, requireAdmin, async (req, res) => {
  const orderId = String(req.body?.orderId || '').trim();
  const reason = String(req.body?.reason || '고객 요청').slice(0, 200);
  const cancelAmount = req.body?.cancelAmount != null && req.body?.cancelAmount !== '' ? Number(req.body.cancelAmount) : null;
  const force = req.body?.force === true || req.body?.force === 'true';
  if (!orderId) return res.status(400).json({ error: 'orderId가 필요합니다.' });
  if (cancelAmount != null && (!Number.isFinite(cancelAmount) || cancelAmount <= 0)) {
    return res.status(400).json({ error: 'cancelAmount가 유효하지 않습니다.' });
  }
  const secretKey = (process.env.TOSS_SECRET_KEY || '').trim();
  if (!secretKey) return res.status(500).json({ error: '서버 결제 설정이 완료되지 않았습니다. (TOSS_SECRET_KEY)' });

  try {
    const db = admin.firestore();
    const payRef = db.collection('payments').doc(orderId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    const pay = paySnap.data() || {};
    if (!pay.paymentKey) return res.status(400).json({ error: 'paymentKey가 없어 취소할 수 없습니다.' });
    if (!isPaidLikePaymentStatus(pay.status)) return res.status(400).json({ error: '결제 완료 상태에서만 취소가 가능합니다.' });

    if (pay.requestDocId) {
      const reqSnap = await db.collection('requests').doc(pay.requestDocId).get();
      const rd = reqSnap.exists ? (reqSnap.data() || {}) : {};
      const fs = normalizeFulfillmentStatus(rd.fulfillmentStatus);
      if (['ordered', 'shipped', 'delivered'].includes(fs) && !force) {
        return res.status(400).json({
          error: '외부몰 주문/배송이 진행된 건은 일반 취소가 제한됩니다. 정말 필요하면 프롬프트에서 강제 취소(force)를 허용하거나, 고객센터 정책에 따라 처리하세요.',
          needFulfillmentForce: true,
        });
      }
    }

    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(pay.paymentKey)}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(cancelAmount != null ? { cancelReason: reason, cancelAmount } : { cancelReason: reason }),
    });
    const tossData = await tossRes.json().catch(() => ({}));
    if (!tossRes.ok) {
      console.error('Toss cancel failed:', tossData);
      return res.status(400).json({ error: '결제 취소에 실패했습니다.', detail: tossData });
    }

    const cancelledTotal = (Array.isArray(tossData.cancels) ? tossData.cancels.reduce((s, c) => s + Number(c.cancelAmount || 0), 0) : 0);
    const totalAmount = Number(pay.amount || 0);
    const fullyCancelled = cancelledTotal >= totalAmount && totalAmount > 0;

    await payRef.update({
      status: fullyCancelled ? 'cancelled' : 'partially_cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelReason: reason,
      cancelAmount: cancelAmount != null ? cancelAmount : cancelledTotal,
      providerCancels: tossData.cancels || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (pay.requestDocId) {
      await db.collection('requests').doc(pay.requestDocId).update({
        paymentStatus: fullyCancelled ? 'cancelled' : 'partially_cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const points = Number(pay.pointsPlanned || 0);
    await updatePointsLedgerForOrder(db, orderId, (d) => {
      if ((d.type === 'EARN_PENDING' && d.status === 'pending') || (d.type === 'EARN_AVAILABLE' && d.status === 'available')) {
        return {
          type: 'EARN_REVERSED',
          status: 'reversed',
          reversedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
      }
      return { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    });
    if (points > 0) {
      await db.collection('pointsLedger').add({
        orderId,
        reqId: pay.reqId,
        requestDocId: pay.requestDocId,
        type: 'EARN_REVERSE_ADJUST',
        points: -points,
        status: 'done',
        reason: '결제 취소/환불로 적립금 회수',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    writeAuditLog('admin_payment_cancel', req.adminUser?.email || req.adminUser?.uid || 'admin', orderId, { fullyCancelled, cancelledTotal });
    return res.json({ ok: true, orderId, fullyCancelled, cancelledTotal });
  } catch (e) {
    console.error('admin payment-cancel error:', e);
    return res.status(500).json({ error: '결제 취소 처리 중 오류가 발생했습니다.' });
  }
});

// 관리자: 구매대행 진행 단계 (외부몰 주문 → 배송완료)
app.post('/api/admin/fulfillment-status', paymentLimiter, validateInput, requireAdmin, async (req, res) => {
  const requestDocId = String(req.body?.requestDocId || '').trim();
  const fulfillmentStatus = String(req.body?.fulfillmentStatus || '').trim();
  if (!requestDocId) return res.status(400).json({ error: 'requestDocId가 필요합니다.' });
  if (!FULFILLMENT_STATUSES.includes(fulfillmentStatus)) {
    return res.status(400).json({ error: 'fulfillmentStatus는 not_ordered|ordered|shipped|delivered 중 하나여야 합니다.' });
  }
  try {
    const db = admin.firestore();
    const ref = db.collection('requests').doc(requestDocId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: '의뢰를 찾을 수 없습니다.' });
    await ref.update({
      fulfillmentStatus,
      fulfillmentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    writeAuditLog('admin_fulfillment_status', req.adminUser?.email || req.adminUser?.uid || 'admin', requestDocId, { fulfillmentStatus });
    return res.json({ ok: true, requestDocId, fulfillmentStatus });
  } catch (e) {
    console.error('admin fulfillment-status error:', e);
    return res.status(500).json({ error: '진행 단계 저장 중 오류가 발생했습니다.' });
  }
});

// 주문 정보 조회 (성공/실패 페이지에서 표시용)
app.get('/api/order', paymentLimiter, async (req, res) => {
  const orderId = String(req.query.orderId || '').trim();
  if (!orderId) return res.status(400).json({ error: 'orderId가 필요합니다.' });
  if (!adminInitialized) return res.status(503).json({ error: 'Firebase Admin SDK가 초기화되지 않았습니다.' });
  try {
    const db = admin.firestore();
    const snap = await db.collection('payments').doc(orderId).get();
    if (!snap.exists) return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    const data = snap.data() || {};
    return res.json({
      orderId: data.orderId,
      orderName: data.orderName,
      amount: data.amount,
      status: data.status,
      method: data.method || null,
      createdAt: data.createdAt || null,
      customer: data.customer || null,
      reqId: data.reqId || null,
      pointsPlanned: data.pointsPlanned || 0,
      pointsStatus: data.pointsStatus || 'planned',
    });
  } catch (e) {
    console.error('order fetch error:', e);
    return res.status(500).json({ error: '주문 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 결제 금액 검증 API
app.post('/api/validate-payment', paymentLimiter, validateInput, async (req, res) => {
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
    if (adminInitialized && isPaidLikePaymentStatus(status)) {
      try {
        const db = admin.firestore();
        const payRef = db.collection('payments').doc(String(orderId));
        const paySnap = await payRef.get();
        if (paySnap.exists) {
          const payData = paySnap.data() || {};
          if (!isCancelledPaymentStatus(payData.status)) {
            await payRef.update({
              status: 'paid',
              providerStatus: String(status || ''),
              webhookReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          if (payData.requestDocId) {
            const reqRef = db.collection('requests').doc(payData.requestDocId);
            const reqSnap = await reqRef.get();
            if (reqSnap.exists) {
              const reqData = reqSnap.data() || {};
              if (!isCancelledPaymentStatus(reqData.paymentStatus)) {
                await reqRef.update({
                  paymentStatus: 'paid',
                  paymentOrderId: String(orderId),
                  fulfillmentStatus: normalizeFulfillmentStatus(reqData.fulfillmentStatus),
                  fulfillmentUpdatedAt: reqData.fulfillmentStatus
                    ? (reqData.fulfillmentUpdatedAt || admin.firestore.FieldValue.serverTimestamp())
                    : admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            }
          }
        }

        const orderRef = db.collection('orders').doc(String(orderId));
        const orderSnap = await orderRef.get();
        if (orderSnap.exists) {
          const orderData = orderSnap.data() || {};
          if (!isCancelledPaymentStatus(orderData.paymentStatus)) {
            await orderRef.update({
              paymentStatus: 'paid',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
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

// ===== AI 분석 파이프라인 (Phase 2) =====
const analysisPipeline = (() => {
  try { return require('./analysis-pipeline'); } catch (e) { return null; }
})();

async function requireAdminOrApiKey(req, res, next) {
  const apiKey = String(req.headers['x-admin-api-key'] || '').trim();
  const expected = process.env.ADMIN_API_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'pricehunter-dev-admin');
  if (expected && apiKey && apiKey === expected) {
    req.adminUser = { uid: 'api-key', email: 'admin@api-key' };
    return next();
  }
  return requireAdmin(req, res, next);
}

const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function validateAnalysisRequest(body) {
  const request = body?.request;
  if (!request || typeof request !== 'object') {
    return { error: 'request 객체가 필요합니다.' };
  }
  const name = String(request.name || request.productName || '').trim();
  if (!name || name.length > 200) {
    return { error: '유효한 제품명이 필요합니다.' };
  }
  return { request };
}

if (analysisPipeline) {
  app.post('/api/analysis/collect-prices', analysisLimiter, requireAdminOrApiKey, async (req, res) => {
    try {
      const validated = validateAnalysisRequest(req.body);
      if (validated.error) return res.status(400).json({ error: validated.error });
      const priceData = await analysisPipeline.collectPrices(validated.request);
      writeAuditLog('analysis_collect', req.adminUser?.uid || 'admin', validated.request.name?.slice(0, 50), { ok: true });
      return res.json({ ok: true, priceData });
    } catch (e) {
      console.error('collect-prices error:', e);
      return res.status(500).json({ error: e.message || '가격 수집 중 오류' });
    }
  });

  app.post('/api/analysis/generate-draft', analysisLimiter, requireAdminOrApiKey, async (req, res) => {
    try {
      const validated = validateAnalysisRequest(req.body);
      if (validated.error) return res.status(400).json({ error: validated.error });
      let priceData = req.body?.priceData;
      if (!priceData) {
        priceData = await analysisPipeline.collectPrices(validated.request);
      }
      const { draft, mode } = await analysisPipeline.generateDraft(validated.request, priceData, req.body?.options || {});
      writeAuditLog('analysis_draft', req.adminUser?.uid || 'admin', validated.request.name?.slice(0, 50), { mode });
      return res.json({ ok: true, draft, mode, priceData });
    } catch (e) {
      console.error('generate-draft error:', e);
      return res.status(500).json({ error: e.message || 'AI 초안 생성 중 오류' });
    }
  });

  app.post('/api/analysis/run-pipeline', analysisLimiter, requireAdminOrApiKey, async (req, res) => {
    try {
      const validated = validateAnalysisRequest(req.body);
      if (validated.error) return res.status(400).json({ error: validated.error });
      const result = await analysisPipeline.runAnalysisPipeline(validated.request, req.body?.options || {});
      writeAuditLog('analysis_pipeline', req.adminUser?.uid || 'admin', validated.request.name?.slice(0, 50), { mode: result.mode });
      return res.json(result);
    } catch (e) {
      console.error('run-pipeline error:', e);
      return res.status(500).json({ error: e.message || '분석 파이프라인 오류' });
    }
  });

  console.log('✅ AI 분석 파이프라인 API 등록 완료');
} else {
  console.warn('⚠️ analysis-pipeline.js 로드 실패 — AI API 비활성');
}

// ===== 반자동 모드: Firebase 리포트 동기화 =====
if (adminInitialized) {
  app.get('/api/admin/pending-requests', analysisLimiter, requireAdminOrApiKey, async (req, res) => {
    try {
      const scope = String(req.query.scope || 'pending');
      const limit = scope === 'all' ? 200 : 80;
      const db = admin.firestore();
      let snap;
      try {
        snap = await db.collection('requests').orderBy('createdAt', 'desc').limit(limit).get();
      } catch (e) {
        snap = await db.collection('requests').limit(limit).get();
      }
      const items = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        const st = String(d.status || '');
        const hasReport = !!(d.purchaseReport || d.adminResponse);
        const isAnswered = hasReport || st === '답변완료' || st === 'complete' || st === 'completed';
        if (scope !== 'all' && isAnswered) return;
        items.push({
          id: doc.id,
          requestNumber: d.requestNumber || d.reqNum || doc.id,
          name: d.name || d.productName || '',
          email: d.email || d.userEmail || '',
          isGuest: d.isGuest === true || d.source === 'guest_trial',
          source: d.source || '',
          price: d.price || '',
          url: (d.urls && d.urls[0]) || d.url || '',
          urls: d.urls || [],
          description: d.desc || d.description || '',
          createdAt: d.createdAt?.toDate?.()?.toISOString?.() || d.date || null,
          analysisStatus: d.analysisStatus || 'pending',
          status: st,
          hasReport: isAnswered,
          purchaseReport: d.purchaseReport || null,
          adminResponse: d.adminResponse || null
        });
      });
      items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return res.json({ ok: true, scope, items, total: items.length });
    } catch (e) {
      console.error('pending-requests error:', e);
      return res.status(500).json({ error: '의뢰 목록 조회 실패' });
    }
  });

  app.post('/api/admin/save-purchase-report', analysisLimiter, requireAdminOrApiKey, async (req, res) => {
    try {
      const { firebaseDocId, reqNum, report } = req.body || {};
      if (!report || typeof report !== 'object') {
        return res.status(400).json({ error: 'report 객체가 필요합니다.' });
      }
      const db = admin.firestore();
      let docRef = null;
      if (firebaseDocId) {
        docRef = db.collection('requests').doc(String(firebaseDocId));
        const snap = await docRef.get();
        if (!snap.exists) docRef = null;
      }
      if (!docRef && reqNum) {
        const loaded = await loadRequestByReqId(db, sanitizeReqId(reqNum));
        if (loaded) docRef = db.collection('requests').doc(loaded.id);
      }
      if (!docRef) {
        return res.status(404).json({ error: 'Firebase 의뢰 문서를 찾을 수 없습니다. firebaseDocId 또는 reqNum을 확인하세요.' });
      }
      const payload = {
        purchaseReport: report,
        reportVersion: report.reportVersion || 'v2',
        adminResponse: {
          lowestPrice: report.price || '',
          seller: report.origin || '',
          additionalInfo: report.summary || '',
          link: report.link || '',
          purchaseVerdict: report.decision?.verdict || '',
          purchaseSummary: report.decision?.summary || '',
          confidence: report.decision?.confidence || ''
        },
        status: '답변완료',
        analysisStatus: 'published',
        responseDate: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await docRef.update(payload);
      writeAuditLog('save_purchase_report', req.adminUser?.uid || 'admin', docRef.id, { reqNum: reqNum || '' });
      return res.json({ ok: true, docId: docRef.id });
    } catch (e) {
      console.error('save-purchase-report error:', e);
      return res.status(500).json({ error: e.message || 'Firebase 저장 실패' });
    }
  });
  console.log('✅ 반자동 Firebase 동기화 API 등록 완료');
}

// 게스트 1회 제한 (이메일·IP) — 테스트 완료 후 GUEST_TRIAL_STRICT_LIMITS=true 로 설정
const GUEST_TRIAL_STRICT_LIMITS = process.env.GUEST_TRIAL_STRICT_LIMITS === 'true';

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '';
}

// 게스트 체험 설정 (클라이언트 동기화용)
app.get('/api/guest-trial-config', (req, res) => {
  res.json({
    strictLimits: GUEST_TRIAL_STRICT_LIMITS,
    emailLimit: GUEST_TRIAL_STRICT_LIMITS,
    ipLimit: GUEST_TRIAL_STRICT_LIMITS
  });
});

// 운영자 신규 의뢰 알림 (서버 → EmailJS, 회원·게스트 공통)
app.post('/api/notify-admin-new-request', paymentLimiter, validateInput, async (req, res) => {
  if (!adminNotifyEmail) {
    return res.status(503).json({ success: false, error: '알림 모듈을 사용할 수 없습니다.' });
  }
  const body = req.body || {};
  if (!body.requestNumber) {
    return res.status(400).json({ success: false, error: 'requestNumber가 필요합니다.' });
  }
  try {
    const result = await adminNotifyEmail.sendAdminNewRequestEmail({
      requestNumber: body.requestNumber,
      requestType: body.requestType || '의뢰',
      customerEmail: body.customerEmail || '',
      productUrl: body.productUrl || '',
      productName: body.productName || '',
      productOption: body.productOption || '',
      productPrice: body.productPrice
    });
    console.log('✅ 운영자 신규 의뢰 알림 발송:', body.requestNumber);
    return res.json(result);
  } catch (error) {
    console.error('❌ 운영자 알림 발송 실패:', error.message || error);
    return res.status(500).json({ success: false, error: error.message || '알림 발송 실패' });
  }
});

// 게스트 1회 체험 의뢰 접수
app.post('/api/guest-request', paymentLimiter, validateInput, async (req, res) => {
  if (!adminInitialized) {
    return res.status(503).json({ error: '서버가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' });
  }

  const emailRaw = String(req.body.email || '').trim().toLowerCase();
  const url = String(req.body.url || '').trim();
  const priceRaw = req.body.price;
  const productName = String(req.body.productName || '').trim();
  const optionName = String(req.body.optionName || req.body.option || '').trim();
  const privacyAgree = req.body.privacyAgree === true || req.body.privacyAgree === 'true';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailRaw)) {
    return res.status(400).json({ error: '유효한 이메일 주소를 입력해주세요.' });
  }
  if (!url || url.length < 10) {
    return res.status(400).json({ error: '쇼핑몰 상품 링크를 입력해주세요.' });
  }

  const urlCheck = validateProductLinkUrl(url);
  if (!urlCheck.ok) {
    return res.status(400).json({ error: urlCheck.error });
  }
  const safeUrl = urlCheck.normalized;

  if (!privacyAgree) {
    return res.status(400).json({ error: '개인정보 수집·이용에 동의해주세요.' });
  }
  if (!optionName) {
    return res.status(400).json({ error: '옵션을 입력해주세요. 옵션이 없으면 "단일옵션"이라고 적어주세요.' });
  }

  let price = null;
  if (priceRaw != null && priceRaw !== '') {
    price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: '요청가 형식이 올바르지 않습니다.' });
    }
  }

  try {
    const db = admin.firestore();

    if (GUEST_TRIAL_STRICT_LIMITS) {
      const clientIp = getClientIp(req);
      const existingSnap = await db.collection('requests')
        .where('email', '==', emailRaw)
        .limit(20)
        .get();

      const alreadyUsedGuest = existingSnap.docs.some((doc) => {
        const d = doc.data() || {};
        return d.source === 'guest_trial' || d.isGuest === true;
      });

      if (alreadyUsedGuest) {
        return res.status(409).json({
          error: '이미 무료 체험 1회를 사용하셨습니다. 회원가입 후 추가 의뢰가 가능합니다.',
          code: 'GUEST_TRIAL_USED'
        });
      }

      if (clientIp) {
        const ipSnap = await db.collection('requests')
          .where('clientIp', '==', clientIp)
          .limit(20)
          .get();
        const ipAlreadyUsed = ipSnap.docs.some((doc) => {
          const d = doc.data() || {};
          return d.isGuest === true || d.source === 'guest_trial';
        });
        if (ipAlreadyUsed) {
          return res.status(409).json({
            error: '이 IP에서는 무료 체험을 이미 사용하셨습니다. 회원가입 후 추가 의뢰가 가능합니다.',
            code: 'GUEST_TRIAL_IP_USED'
          });
        }
      }
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 900) + 100);
    const reqNum = `#PH-${y}${m}${d}${rand}`;

    const requestData = {
      email: emailRaw,
      url: safeUrl,
      urls: [safeUrl],
      customerProductUrl: safeUrl,
      name: productName || '(링크로 확인 예정)',
      optionName,
      price,
      clientIp: getClientIp(req) || null,
      urlSafety: {
        flagged: urlCheck.flagged === true,
        flags: urlCheck.flags || [],
        hostname: urlCheck.hostname || ''
      },
      requestNumber: reqNum,
      reqNum,
      source: 'guest_trial',
      isGuest: true,
      status: 'pending',
      statusDetail: '게스트 체험 의뢰가 접수되었습니다. 검토 후 이메일로 결과를 보내드립니다.',
      progress: 10,
      estimatedTime: '24~48시간 내 이메일 발송',
      comparisonType: 'exact',
      reviewBoardAgree: false,
      date: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: Date.now()
    };

    const docRef = await db.collection('requests').add(requestData);

    await writeAuditLog('guest_request_created', emailRaw, reqNum, {
      firebaseDocId: docRef.id,
      url: safeUrl.slice(0, 200),
      urlFlagged: urlCheck.flagged === true
    });

    console.log('✅ 게스트 체험 의뢰 접수:', reqNum, emailRaw);

    let adminNotifySent = false;
    let adminNotifyError = null;
    if (adminNotifyEmail) {
      try {
        await adminNotifyEmail.sendAdminNewRequestEmail({
          requestNumber: reqNum,
          requestType: '게스트 체험 (1회)',
          customerEmail: emailRaw,
          productUrl: safeUrl,
          productOption: optionName,
          productPrice: price
        });
        adminNotifySent = true;
        console.log('✅ 게스트 의뢰 운영자 알림 발송:', reqNum);
      } catch (err) {
        adminNotifyError = err.message || String(err);
        console.warn('⚠️ 게스트 의뢰 운영자 알림(서버) 실패 — 브라우저에서 재시도 필요:', adminNotifyError);
      }
    }

    res.status(201).json({
      success: true,
      requestNumber: reqNum,
      firebaseDocId: docRef.id,
      adminNotifySent,
      adminNotifyError,
      message: '의뢰가 접수되었습니다. 결과는 이메일로 보내드립니다.'
    });
  } catch (error) {
    console.error('❌ 게스트 의뢰 접수 실패:', error);
    res.status(500).json({ error: '의뢰 접수 중 오류가 발생했습니다.' });
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