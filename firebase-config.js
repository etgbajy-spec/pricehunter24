// Firebase 설정 및 초기화 (Firebase 8.x 버전)
console.log('🔥 Firebase 설정 파일 로딩 시작...');

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
    console.log('🔄 Firebase 초기화 시작...');
    
    // Firebase가 이미 로드되었는지 확인
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK가 로드되지 않았습니다.');
      
      // 대체 CDN 시도
      console.log('🔄 대체 Firebase CDN 시도...');
      loadAlternativeFirebaseCDN();
      return false;
    }

    console.log('✅ Firebase SDK 확인됨:', typeof firebase);
    console.log('Firebase 버전:', firebase.SDK_VERSION);

    // Firebase 앱 초기화
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

    console.log('🎉 Firebase 모든 서비스 초기화 완료!');
    console.log('app:', window.firebaseApp);
    console.log('db:', window.firestore);
    console.log('auth:', window.auth);
    
    return true;
  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error);
    console.error('에러 상세:', error.message);
    console.error('에러 스택:', error.stack);
    return false;
  }
}

// 대체 Firebase CDN 로드 함수
function loadAlternativeFirebaseCDN() {
  console.log('🔄 대체 Firebase CDN 로드 시작...');
  
  // unpkg CDN 사용
  const alternativeCDNs = [
    'https://unpkg.com/firebase@8.10.1/dist/firebase-app.js',
    'https://unpkg.com/firebase@8.10.1/dist/firebase-firestore.js',
    'https://unpkg.com/firebase@8.10.1/dist/firebase-auth.js'
  ];
  
  let loadedCount = 0;
  
  alternativeCDNs.forEach((cdn, index) => {
    const script = document.createElement('script');
    script.src = cdn;
    script.onload = () => {
      console.log(`✅ 대체 CDN ${index + 1} 로드 완료:`, cdn);
      loadedCount++;
      
      if (loadedCount === alternativeCDNs.length) {
        console.log('🎉 모든 대체 CDN 로드 완료!');
        // 다시 초기화 시도
        setTimeout(() => {
          if (typeof firebase !== 'undefined') {
            console.log('🔄 대체 CDN으로 Firebase 초기화 재시도...');
            initializeFirebase();
          }
        }, 1000);
      }
    };
    script.onerror = () => {
      console.error(`❌ 대체 CDN ${index + 1} 로드 실패:`, cdn);
    };
    document.head.appendChild(script);
  });
}

// Firebase 상태 확인 함수
function checkFirebaseStatus() {
  console.log('🔍 Firebase 상태 확인...');
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

// Firebase 연결 테스트 함수
function testFirebaseConnection() {
  console.log('🧪 Firebase 연결 테스트 시작...');
  
  if (typeof firebase === 'undefined') {
    alert('❌ Firebase SDK가 로드되지 않았습니다.\n\n대체 CDN을 시도합니다.');
    loadAlternativeFirebaseCDN();
    return false;
  }
  
  if (window.firebaseApp && window.firestore && window.auth) {
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
window.loadAlternativeFirebaseCDN = loadAlternativeFirebaseCDN;

console.log('✅ Firebase 설정 파일 로딩 완료');
