// Firebase 설정 및 초기화 (Firebase 8.x 버전) - 단일 진실 소스
console.log('🔥 Firebase 설정 파일 로딩 시작...');

// Firebase 설정 - 단일 진실 소스
const firebaseConfig = {
  apiKey: "AIzaSyDBZxKyMS7eeBTbPnbZkj0WWOZQHNldoL4",
  authDomain: "pricehunter-99a1b.firebaseapp.com",
  projectId: "pricehunter-99a1b",
  storageBucket: "pricehunter-99a1b.firebasestorage.app",
  messagingSenderId: "242265693919",
  appId: "1:242265693919:web:74234d942b82a51541136a",
  measurementId: "G-4BKLV4EVB9"
};

// Firebase 초기화 상태 추적
let isInitializing = false;
let isInitialized = false;

// Firebase 초기화 함수 (개선된 버전)
function initializeFirebase() {
  // 이미 초기화 중이거나 완료된 경우
  if (isInitializing || isInitialized) {
    console.log('🔄 Firebase 이미 초기화 중이거나 완료됨');
    return isInitialized;
  }
  
  try {
    isInitializing = true;
    console.log('🔄 Firebase 초기화 시작...');
    console.log('🌐 현재 도메인:', window.location.hostname);
    console.log('🌐 현재 URL:', window.location.href);
    
    // Firebase SDK 로드 확인 (강화된 가드)
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK가 로드되지 않았습니다.');
      console.error('🔒 서버 CSP 헤더에서 다음 도메인들이 허용되어야 합니다:');
      console.error('- https://www.gstatic.com');
      console.error('- https://www.gstatic.com/firebasejs');
      console.error('📋 현재 CSP 정책을 확인하려면 브라우저 DevTools → Network → Response Headers를 확인하세요.');
      throw new Error('Firebase SDK not loaded - check server CSP headers');
    }

    console.log('✅ Firebase SDK 확인됨:', typeof firebase);
    console.log('Firebase 버전:', firebase.SDK_VERSION);

    // Firebase 앱 초기화 (중복 방지)
    if (!firebase.apps.length) {
      window.firebaseApp = firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase 앱 초기화 완료');
    } else {
      window.firebaseApp = firebase.app();
      console.log('✅ 기존 Firebase 앱 사용');
    }

    // Firestore 초기화
    window.firestore = firebase.firestore();
    console.log('✅ Firestore 초기화 완료');
    
    // Auth 초기화
    window.auth = firebase.auth();
    console.log('✅ Auth 초기화 완료');

    // 초기화 완료 표시
    isInitialized = true;
    isInitializing = false;
    
    console.log('🎉 Firebase 모든 서비스 초기화 완료!');
    console.log('app:', window.firebaseApp);
    console.log('db:', window.firestore);
    console.log('auth:', window.auth);
    
    return true;
  } catch (error) {
    isInitializing = false;
    console.error('❌ Firebase 초기화 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('에러 스택:', error.stack);
    
    // CSP 관련 오류인지 확인
    if (error.message.includes('CSP') || error.message.includes('Content Security Policy') || error.message.includes('server CSP')) {
      console.error('🔒 서버 CSP 헤더 오류로 인한 Firebase 로딩 실패');
      console.error('📋 해결 방법:');
      console.error('1. 서버의 CSP 헤더에 www.gstatic.com이 포함되어 있는지 확인');
      console.error('2. 브라우저 DevTools → Network → Response Headers에서 CSP 값 확인');
      console.error('3. 서버 재시작 후 새로고침');
    }
    
    return false;
  }
}

// Firebase 상태 확인 함수
function checkFirebaseStatus() {
  console.log('🔍 Firebase 상태 확인...');
  console.log('초기화 상태:', isInitialized);
  console.log('초기화 중:', isInitializing);
  console.log('window.firebaseApp:', window.firebaseApp);
  console.log('window.firestore:', window.firestore);
  console.log('window.auth:', window.auth);
  
  if (window.firebaseApp && window.firestore && window.auth && isInitialized) {
    console.log('✅ Firebase 모든 서비스가 정상적으로 초기화되었습니다.');
    return true;
  } else {
    console.log('❌ Firebase 서비스가 일부 초기화되지 않았습니다.');
    return false;
  }
}

// Firebase 연결 테스트 함수
function testFirebaseConnection() {
  console.log('🧪 Firebase 연결 테스트 시작...');
  
  if (typeof firebase === 'undefined') {
    alert('❌ Firebase SDK가 로드되지 않았습니다.\n\n서버 CSP 헤더에 www.gstatic.com이 포함되어 있는지 확인하세요.');
    return false;
  }
  
  if (window.firebaseApp && window.firestore && window.auth && isInitialized) {
    alert('✅ Firebase 연결 성공!\n\n모든 서비스가 정상적으로 작동합니다.');
    return true;
  } else {
    alert('❌ Firebase 연결 실패!\n\n초기화를 다시 시도해주세요.');
    return false;
  }
}

// 전역 함수로 노출
window.initializeFirebase = initializeFirebase;
window.checkFirebaseStatus = checkFirebaseStatus;
window.testFirebaseConnection = testFirebaseConnection;
window.firebaseConfig = firebaseConfig; // 설정값도 전역으로 노출 (디버깅용)

console.log('✅ Firebase 설정 파일 로딩 완료');
