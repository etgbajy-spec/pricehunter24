// Firebase v9+ 모듈 API 초기화
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBvQvQvQvQvQvQvQvQvQvQvQvQvQvQvQvQ",
  authDomain: "pricehunter-99a1b.firebaseapp.com",
  projectId: "pricehunter-99a1b",
  storageBucket: "pricehunter-99a1b.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnopqrstuv"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Auth 인스턴스
const auth = getAuth(app);

// Firestore 인스턴스
const db = getFirestore(app);

// 개발 환경에서 에뮬레이터 연결 (선택사항)
if (import.meta.env.DEV) {
  // connectAuthEmulator(auth, "http://localhost:9099");
  // connectFirestoreEmulator(db, 'localhost', 8080);
}

// 전역 export
export { app, auth, db };
export default { app, auth, db };
