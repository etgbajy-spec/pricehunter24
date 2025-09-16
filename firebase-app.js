// Firebase 설정 및 초기화 (Firebase 8.x 버전)
console.log('🔄 Firebase 앱 로딩 시작...');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDBZxKyMS7eeBTbPnbZkj0WWOZQHNldoL4",
  authDomain: "pricehunter-99a1b.firebaseapp.com",
  projectId: "pricehunter-99a1b",
  storageBucket: "pricehunter-99a1b.firebasestorage.app",
  messagingSenderId: "242265693919",
  appId: "1:242265693919:web:74234d942b82a51541136a",
  measurementId: "G-4BKLV4EVB9"
};

// Firebase 초기화 함수
function initializeFirebase() {
  try {
    // Firebase가 이미 로드되었는지 확인
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK가 로드되지 않았습니다.');
      return false;
    }

    // Firebase 앱 초기화
    if (!firebase.apps.length) {
      window.firebaseApp = firebase.initializeApp(firebaseConfig);
    } else {
      window.firebaseApp = firebase.app();
    }

    // Firestore 초기화
    window.firestore = firebase.firestore();
    
    // Auth 초기화
    window.auth = firebase.auth();

    console.log('✅ Firebase 초기화 완료!');
    console.log('app:', window.firebaseApp);
    console.log('db:', window.firestore);
    console.log('auth:', window.auth);
    
    return true;
  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error);
    return false;
  }
}

// Firebase 상태 확인 함수
function checkFirebaseStatus() {
  console.log('🔄 Firebase 상태 확인...');
  console.log('window.firebaseApp:', window.firebaseApp);
  console.log('window.firestore:', window.firestore);
  console.log('window.auth:', window.auth);
  
  if (window.firebaseApp && window.firestore && window.auth) {
    console.log('✅ Firebase 모든 서비스가 정상적으로 초기화되었습니다.');
    return true;
  } else {
    console.log('❌ Firebase 서비스가 일부 초기화되지 않았습니다.');
    return false;
  }
}

// 전역 함수로 노출
window.initializeFirebase = initializeFirebase;
window.checkFirebaseStatus = checkFirebaseStatus;

// Firebase 초기화 실행
console.log('🚀 Firebase 초기화 시작...');
initializeFirebase();

console.log('✅ Firebase 앱 파일 로딩 완료');
