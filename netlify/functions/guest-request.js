/**
 * Netlify Function: POST /api/guest-request
 */
const { admin, initAdmin } = require('./_firebase-admin');
const { validateProductLinkUrl } = require('../../url-safety');
const { sendAdminNewRequestEmail } = require('../../admin-notify-email');

const GUEST_TRIAL_STRICT_LIMITS = process.env.GUEST_TRIAL_STRICT_LIMITS === 'true';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getClientIp(event) {
  const forwarded = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return event.headers['client-ip'] || '';
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!initAdmin()) {
    return json(503, { error: '서버가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: '잘못된 요청 형식입니다.' });
  }

  const emailRaw = String(body.email || '').trim().toLowerCase();
  const url = String(body.url || '').trim();
  const priceRaw = body.price;
  const productName = String(body.productName || '').trim();
  const optionName = String(body.optionName || body.option || '').trim();
  const privacyAgree = body.privacyAgree === true || body.privacyAgree === 'true';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailRaw)) {
    return json(400, { error: '유효한 이메일 주소를 입력해주세요.' });
  }
  if (!url || url.length < 10) {
    return json(400, { error: '쇼핑몰 상품 링크를 입력해주세요.' });
  }

  const urlCheck = validateProductLinkUrl(url);
  if (!urlCheck.ok) {
    return json(400, { error: urlCheck.error });
  }
  const safeUrl = urlCheck.normalized;

  if (!privacyAgree) {
    return json(400, { error: '개인정보 수집·이용에 동의해주세요.' });
  }
  if (!optionName) {
    return json(400, { error: '옵션을 입력해주세요. 옵션이 없으면 "단일옵션"이라고 적어주세요.' });
  }

  let price = null;
  if (priceRaw != null && priceRaw !== '') {
    price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      return json(400, { error: '요청가 형식이 올바르지 않습니다.' });
    }
  }

  try {
    const db = admin.firestore();

    if (GUEST_TRIAL_STRICT_LIMITS) {
      const clientIp = getClientIp(event);
      const existingSnap = await db.collection('requests')
        .where('email', '==', emailRaw)
        .limit(20)
        .get();

      const alreadyUsedGuest = existingSnap.docs.some((doc) => {
        const d = doc.data() || {};
        return d.source === 'guest_trial' || d.isGuest === true;
      });

      if (alreadyUsedGuest) {
        return json(409, {
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
          return json(409, {
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
      clientIp: getClientIp(event) || null,
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

    let adminNotifySent = false;
    let adminNotifyError = null;
    try {
      await sendAdminNewRequestEmail({
        requestNumber: reqNum,
        requestType: '게스트 체험 (1회)',
        customerEmail: emailRaw,
        productUrl: safeUrl,
        productOption: optionName,
        productPrice: price
      });
      adminNotifySent = true;
    } catch (err) {
      adminNotifyError = err.message || String(err);
      console.warn('Guest admin notify failed:', adminNotifyError);
    }

    return json(201, {
      success: true,
      requestNumber: reqNum,
      firebaseDocId: docRef.id,
      adminNotifySent,
      adminNotifyError,
      message: '의뢰가 접수되었습니다. 결과는 이메일로 보내드립니다.'
    });
  } catch (error) {
    console.error('guest-request error:', error);
    return json(500, { error: '의뢰 접수 중 오류가 발생했습니다.' });
  }
};
