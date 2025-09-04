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

// 대체 Firebase CDN 로드 함수 (강화된 버전)
function loadAlternativeFirebaseCDN() {
  console.log('🔄 대체 Firebase CDN 로드 시작...');
  
  // 여러 CDN 옵션 시도
  const cdnOptions = [
    // unpkg CDN (1순위)
    [
      'https://unpkg.com/firebase@8.10.1/dist/firebase-app.js',
      'https://unpkg.com/firebase@8.10.1/dist/firebase-firestore.js',
      'https://unpkg.com/firebase@8.10.1/dist/firebase-auth.js'
    ],
    // jsDelivr CDN (2순위)
    [
      'https://cdn.jsdelivr.net/npm/firebase@8.10.1/dist/firebase-app.js',
      'https://cdn.jsdelivr.net/npm/firebase@8.10.1/dist/firebase-firestore.js',
      'https://cdn.jsdelivr.net/npm/firebase@8.10.1/dist/firebase-auth.js'
    ],
    // cdnjs CDN (3순위)
    [
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-app.js',
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-firestore.js',
      'https://cdnjs.cloudflare.com/ajax/libs/firebase/8.10.1/firebase-auth.js'
    ]
  ];
  
  let currentCDNIndex = 0;
  
  function tryNextCDN() {
    if (currentCDNIndex >= cdnOptions.length) {
      console.error('❌ 모든 CDN 옵션 실패');
      return;
    }
    
    console.log(`🔄 CDN 옵션 ${currentCDNIndex + 1} 시도 중...`);
    const currentCDNs = cdnOptions[currentCDNIndex];
    
    let loadedCount = 0;
    let hasError = false;
    
    currentCDNs.forEach((cdn, index) => {
      const script = document.createElement('script');
      script.src = cdn;
      script.onload = () => {
        console.log(`✅ CDN ${currentCDNIndex + 1} - 스크립트 ${index + 1} 로드 완료:`, cdn);
        loadedCount++;
        
        if (loadedCount === currentCDNs.length && !hasError) {
          console.log(`🎉 CDN 옵션 ${currentCDNIndex + 1} 모든 스크립트 로드 완료!`);
          // Firebase 초기화 재시도
          setTimeout(() => {
            if (typeof firebase !== 'undefined') {
              console.log('🔄 대체 CDN으로 Firebase 초기화 재시도...');
              initializeFirebase();
            } else {
              console.log('❌ 대체 CDN 로드 후에도 Firebase SDK 없음, 다음 CDN 시도...');
              currentCDNIndex++;
              tryNextCDN();
            }
          }, 1000);
        }
      };
      script.onerror = () => {
        console.error(`❌ CDN ${currentCDNIndex + 1} - 스크립트 ${index + 1} 로드 실패:`, cdn);
        hasError = true;
        
        // 현재 CDN 옵션이 실패했으므로 다음 옵션 시도
        if (loadedCount === 0) {
          currentCDNIndex++;
          tryNextCDN();
        }
      };
      document.head.appendChild(script);
    });
  }
  
  // 첫 번째 CDN 옵션부터 시도
  tryNextCDN();
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

// 자동 복구 함수
function autoRecoverFirebase() {
  console.log('🔄 Firebase 자동 복구 시작...');
  
  if (typeof firebase === 'undefined') {
    console.log('❌ Firebase SDK 없음, 대체 CDN 시도...');
    loadAlternativeFirebaseCDN();
  } else if (!window.firebaseApp || !window.firestore || !window.auth) {
    console.log('❌ Firebase 서비스 일부 누락, 재초기화 시도...');
    initializeFirebase();
  } else {
    console.log('✅ Firebase 정상 작동 중');
  }
}

// 전역 함수로 노출
window.initializeFirebase = initializeFirebase;
window.checkFirebaseStatus = checkFirebaseStatus;
window.testFirebaseConnection = testFirebaseConnection;
window.loadAlternativeFirebaseCDN = loadAlternativeFirebaseCDN;
window.autoRecoverFirebase = autoRecoverFirebase;

console.log('✅ Firebase 설정 파일 로딩 완료');
