/**
 * Netlify Function: 카카오 액세스 토큰을 Firebase 커스텀 토큰으로 교환
 * Express 서버의 /api/kakao-to-firebase-token 엔드포인트를 서버리스 함수로 변환
 */

const admin = require('firebase-admin');

// Firebase Admin 초기화 (한 번만 실행)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || 'pricehunter-99a1b',
        private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
      }),
      projectId: 'pricehunter-99a1b',
    });
    console.log('✅ Firebase Admin SDK 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin SDK 초기화 실패:', error.message);
  }
}

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // 요청 본문 파싱
    const body = JSON.parse(event.body || '{}');
    const { kakaoAccessToken, userData } = body;

    // 입력 데이터 검증
    if (!kakaoAccessToken || !userData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '필수 데이터가 누락되었습니다.' }),
      };
    }

    if (typeof kakaoAccessToken !== 'string' || kakaoAccessToken.length > 500) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 토큰입니다.' }),
      };
    }

    if (!userData.uid || !userData.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '사용자 정보가 올바르지 않습니다.' }),
      };
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '유효하지 않은 이메일 형식입니다.' }),
      };
    }

    // 카카오 사용자 정보 검증
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${kakaoAccessToken}`,
      },
    });

    if (!kakaoUserResponse.ok) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '인증에 실패했습니다.' }),
      };
    }

    const kakaoUser = await kakaoUserResponse.json();

    // Firebase 커스텀 토큰 생성
    const customToken = await admin.auth().createCustomToken(userData.uid, {
      email: userData.email,
      name: userData.name || 'Unknown',
      picture: userData.profileImage || '',
      loginMethod: 'kakao',
      kakaoId: userData.id || '',
    });

    console.log('✅ Firebase 커스텀 토큰 생성 완료:', userData.email);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ customToken }),
    };
  } catch (error) {
    console.error('❌ 카카오 → Firebase 토큰 교환 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
    };
  }
};

