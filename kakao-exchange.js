import admin from 'firebase-admin';

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  try {
    console.log('🔄 Firebase Admin SDK 초기화 시작...');
    
    // 환경변수 검증
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ 누락된 환경변수:', missingVars);
      throw new Error(`누락된 환경변수: ${missingVars.join(', ')}`);
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        clientId: process.env.FIREBASE_CLIENT_ID,
      }),
    });
    
    console.log('✅ Firebase Admin SDK 초기화 완료');
  } catch (error) {
    console.error('❌ Firebase Admin SDK 초기화 실패:', error);
    console.error('❌ 오류 상세:', error.message);
  }
}

export const handler = async (event, context) => {
  console.log('🔄 kakao-exchange 함수 호출됨');
  console.log('🌐 요청 도메인:', event.headers.host);
  console.log('📤 요청 본문:', event.body);
  
  // 환경변수 확인
  console.log('🔍 환경변수 확인:');
  console.log('- FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '설정됨' : '미설정');
  console.log('- FIREBASE_PRIVATE_KEY_ID:', process.env.FIREBASE_PRIVATE_KEY_ID ? '설정됨' : '미설정');
  console.log('- FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '설정됨' : '미설정');
  console.log('- FIREBASE_CLIENT_ID:', process.env.FIREBASE_CLIENT_ID ? '설정됨' : '미설정');
  
  // CORS 헤더 설정 (운영 환경)
  const allowedOrigins = [
    'https://pricehunt24.com',
    'https://www.pricehunt24.com',
    'http://localhost:3000', // 개발 환경
    'http://localhost:8888'  // Netlify Dev
  ];
  
  const origin = event.headers.origin || event.headers.Origin;
  const isAllowedOrigin = allowedOrigins.includes(origin);
  
  const headers = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'https://pricehunt24.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };

  // OPTIONS 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { accessToken } = JSON.parse(event.body);
    
    if (!accessToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Access token is required' }),
      };
    }

    // 카카오 사용자 정보 조회
    const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!kakaoResponse.ok) {
      throw new Error(`Kakao API error: ${kakaoResponse.status}`);
    }

    const kakaoUser = await kakaoResponse.json();
    console.log('카카오 사용자 정보:', kakaoUser);

    // 사용자 정보 추출
    const email = kakaoUser.kakao_account?.email;
    const name = kakaoUser.properties?.nickname || '카카오 사용자';
    const profileImage = kakaoUser.properties?.profile_image || '';

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required from Kakao account' }),
      };
    }

    // Firebase 커스텀 토큰 생성 (UID는 email로 고정)
    const customToken = await admin.auth().createCustomToken(email, {
      email: email,
      name: name,
      provider: 'kakao',
      profileImage: profileImage,
    });

    // Firestore에 회원 정보 저장/업데이트 (서버사이드)
    try {
      console.log('📝 Firestore에 회원 정보 저장 시작...');
      
      const memberData = {
        email: email,
        name: name,
        provider: 'kakao',
        role: 'viewer',
        status: 'active',
        profileImage: profileImage,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('📝 저장할 회원 데이터:', memberData);
      
      // Firestore에 저장 (email을 UID로 사용)
      await admin.firestore().collection('members').doc(email).set(memberData, { merge: true });
      
      console.log('✅ Firestore 회원 정보 저장 완료:', email);
      
      // 저장 확인
      const savedDoc = await admin.firestore().collection('members').doc(email).get();
      if (savedDoc.exists) {
        console.log('✅ 저장 확인됨:', savedDoc.data());
      } else {
        console.error('❌ 저장 확인 실패: 문서가 존재하지 않음');
      }
      
    } catch (firestoreError) {
      console.error('❌ Firestore 저장 실패:', firestoreError);
      // Firestore 저장 실패해도 토큰은 반환 (클라이언트에서 재시도 가능)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token: customToken,
        user: {
          email: email,
          name: name,
          provider: 'kakao',
        },
      }),
    };

  } catch (error) {
    console.error('카카오 토큰 교환 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};
