/**
 * Netlify Function: 카카오 OAuth → Firebase 커스텀 토큰
 * POST { code, redirectUri } 또는 { accessToken } 또는 { kakaoAccessToken, userData }
 */

const { admin, initAdmin } = require('./_firebase-admin');

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '1d998d95218190a7ee03d06314b49951';
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || '';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

async function exchangeCodeForToken(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: redirectUri,
    code,
  });
  if (KAKAO_CLIENT_SECRET) {
    params.set('client_secret', KAKAO_CLIENT_SECRET);
  }

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    let friendly = '';
    try {
      const parsed = JSON.parse(text);
      if (parsed.error_code === 'KOE010' || parsed.error === 'invalid_client') {
        friendly = '카카오 Client Secret 설정이 필요합니다. 카카오 콘솔(REST API 키)에서 Client Secret을 OFF로 바꾸거나, Netlify에 KAKAO_CLIENT_SECRET 환경변수를 등록해주세요.';
      }
    } catch (e) { /* ignore */ }
    throw new Error(friendly || `카카오 토큰 교환 실패 (${response.status}): ${text}`);
  }

  return response.json();
}

async function fetchKakaoUser(accessToken) {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('카카오 사용자 정보를 가져오지 못했습니다.');
  }

  return response.json();
}

function buildUserFromKakao(kakaoUser) {
  const email = kakaoUser.kakao_account?.email;
  if (!email) {
    throw new Error('카카오 계정 이메일 동의가 필요합니다. 카카오 로그인 동의항목에서 이메일을 필수로 설정해주세요.');
  }

  const uid = `kakao_${kakaoUser.id}`;
  return {
    uid,
    email,
    displayName:
      kakaoUser.properties?.nickname ||
      kakaoUser.kakao_account?.profile?.nickname ||
      '카카오 사용자',
    photoURL:
      kakaoUser.properties?.profile_image ||
      kakaoUser.kakao_account?.profile?.profile_image_url ||
      '',
    kakaoId: String(kakaoUser.id),
  };
}

async function resolveAccessToken(body) {
  if (body.code && body.redirectUri) {
    const tokenData = await exchangeCodeForToken(body.code, body.redirectUri);
    if (!tokenData.access_token) {
      throw new Error('카카오 액세스 토큰을 받지 못했습니다.');
    }
    return tokenData.access_token;
  }

  const accessToken = body.accessToken || body.kakaoAccessToken;
  if (accessToken) {
    return accessToken;
  }

  throw new Error('code+redirectUri 또는 accessToken이 필요합니다.');
}

async function checkExistingUser(user) {
  if (!initAdmin()) {
    return { isNewUser: true };
  }

  const db = admin.firestore();
  // 두 조회를 병렬 실행해 응답 지연 최소화
  const [uidDoc, emailSnap] = await Promise.all([
    db.collection('users').doc(user.uid).get(),
    db.collection('users').where('email', '==', user.email).limit(1).get(),
  ]);

  if (uidDoc.exists) {
    return { isNewUser: false };
  }

  if (!emailSnap.empty && emailSnap.docs[0].id !== user.uid) {
    const conflict = new Error('이 이메일은 이미 다른 방법으로 가입되어 있습니다. 해당 방법으로 로그인해주세요.');
    conflict.statusCode = 409;
    throw conflict;
  }

  return { isNewUser: true };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // 레거시: 클라이언트가 userData를 직접 전달하는 경우
    if (body.kakaoAccessToken && body.userData?.uid && body.userData?.email) {
      const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${body.kakaoAccessToken}` },
      });
      if (!kakaoUserResponse.ok) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: '카카오 인증에 실패했습니다.' }),
        };
      }

      if (!initAdmin()) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: '서버 인증 설정 오류' }),
        };
      }

      const customToken = await admin.auth().createCustomToken(body.userData.uid, {
        email: body.userData.email,
        name: body.userData.name || 'Unknown',
        picture: body.userData.profileImage || '',
        loginMethod: 'kakao',
        kakaoId: body.userData.id || '',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ customToken, success: true }),
      };
    }

    const accessToken = await resolveAccessToken(body);
    const kakaoUser = await fetchKakaoUser(accessToken);
    const user = buildUserFromKakao(kakaoUser);

    if (!initAdmin()) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '서버 인증 설정 오류' }),
      };
    }

    // 기존 회원 확인과 토큰 발급을 병렬 실행
    const [{ isNewUser }, customToken] = await Promise.all([
      checkExistingUser(user),
      admin.auth().createCustomToken(user.uid, {
        email: user.email,
        name: user.displayName,
        picture: user.photoURL,
        loginMethod: 'kakao',
        kakaoId: user.kakaoId,
      }),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        customToken,
        token: customToken,
        isNewUser,
        user,
      }),
    };
  } catch (error) {
    console.error('❌ 카카오 → Firebase 토큰 교환 실패:', error);
    const statusCode = error.statusCode || 500;
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: error.message || '서버 오류가 발생했습니다.',
      }),
    };
  }
};
