// 회원가입 모듈
import { auth, db } from './firebase.js';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

// DOM 요소
let currentUser = null;

// 초기화
function init() {
  console.log('🚀 회원가입 페이지 초기화 시작...');
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 인증 상태 감시
  onAuthStateChanged(auth, handleAuthStateChange);
  
  // 카카오 로그인 초기화
  initKakaoLogin();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 이메일 회원가입 폼
  const emailForm = document.getElementById('emailSignupForm');
  if (emailForm) {
    emailForm.addEventListener('submit', handleEmailSignup);
  }
  
  // 이메일 로그인 폼
  const emailLoginForm = document.getElementById('emailLoginForm');
  if (emailLoginForm) {
    emailLoginForm.addEventListener('submit', handleEmailLogin);
  }
  
  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// 인증 상태 변경 처리
function handleAuthStateChange(user) {
  console.log('🔄 인증 상태 변경:', user ? user.email : '로그아웃');
  
  if (user) {
    currentUser = user;
    showUserDashboard(user);
    // 회원 정보 Firestore에 저장/업데이트
    upsertMemberData(user);
  } else {
    currentUser = null;
    showLoginForms();
  }
}

// 이메일 회원가입 처리
async function handleEmailSignup(e) {
  e.preventDefault();
  
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const name = document.getElementById('signupName').value;
  
  try {
    console.log('🔄 이메일 회원가입 시도:', email);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ 이메일 회원가입 성공:', user.uid);
    
    // 회원 정보 Firestore에 저장
    await upsertMemberData(user, { name, provider: 'email' });
    
    showSuccessMessage('회원가입이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 이메일 회원가입 실패:', error);
    showErrorMessage('회원가입에 실패했습니다: ' + error.message);
  }
}

// 이메일 로그인 처리
async function handleEmailLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    console.log('🔄 이메일 로그인 시도:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ 이메일 로그인 성공:', user.uid);
    
    // 회원 정보 Firestore에 업데이트
    await upsertMemberData(user);
    
  } catch (error) {
    console.error('❌ 이메일 로그인 실패:', error);
    showErrorMessage('로그인에 실패했습니다: ' + error.message);
  }
}

// 로그아웃 처리
async function handleLogout() {
  try {
    await signOut(auth);
    console.log('✅ 로그아웃 완료');
  } catch (error) {
    console.error('❌ 로그아웃 실패:', error);
  }
}

// 회원 정보 Firestore에 저장/업데이트
async function upsertMemberData(user, additionalData = {}) {
  try {
    console.log('📝 회원 정보 Firestore 저장 시작:', user.uid);
    
    const memberData = {
      email: user.email,
      name: additionalData.name || user.displayName || user.email.split('@')[0],
      provider: additionalData.provider || 'email',
      role: 'viewer',
      status: 'active',
      profileImage: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('📝 저장할 회원 데이터:', memberData);
    
    // Firestore에 저장 (uid를 문서 ID로 사용)
    await setDoc(doc(db, 'members', user.uid), memberData, { merge: true });
    
    console.log('✅ 회원 정보 Firestore 저장 완료:', user.uid);
    
    // 저장 확인
    const savedDoc = await getDoc(doc(db, 'members', user.uid));
    if (savedDoc.exists()) {
      console.log('✅ 저장 확인됨:', savedDoc.data());
    } else {
      console.error('❌ 저장 확인 실패: 문서가 존재하지 않음');
    }
    
  } catch (error) {
    console.error('❌ 회원 정보 Firestore 저장 실패:', error);
    showErrorMessage('회원 정보 저장에 실패했습니다: ' + error.message);
  }
}

// 카카오 로그인 초기화
function initKakaoLogin() {
  if (typeof Kakao === 'undefined') {
    console.log('⏳ Kakao SDK 로딩 대기...');
    setTimeout(initKakaoLogin, 1000);
    return;
  }
  
  try {
    Kakao.init('6917a034b74fafd0ac80ab855af5ed6d');
    console.log('✅ Kakao SDK 초기화 완료');
    
    // 카카오 로그인 버튼 이벤트
    const kakaoBtn = document.getElementById('kakaoLoginBtn');
    if (kakaoBtn) {
      kakaoBtn.addEventListener('click', handleKakaoLogin);
    }
    
  } catch (error) {
    console.error('❌ Kakao SDK 초기화 실패:', error);
  }
}

// 카카오 로그인 처리
function handleKakaoLogin() {
  try {
    console.log('🔄 카카오 로그인 시작...');
    
    Kakao.Auth.login({
      success: function(authObj) {
        console.log('✅ 카카오 로그인 성공:', authObj);
        exchangeKakaoToken(authObj.access_token);
      },
      fail: function(err) {
        console.error('❌ 카카오 로그인 실패:', err);
        showErrorMessage('카카오 로그인에 실패했습니다: ' + err.error_description);
      }
    });
    
  } catch (error) {
    console.error('❌ 카카오 로그인 오류:', error);
    showErrorMessage('카카오 로그인 중 오류가 발생했습니다.');
  }
}

// 카카오 토큰을 Firebase 커스텀 토큰으로 교환
async function exchangeKakaoToken(accessToken) {
  try {
    console.log('🔄 카카오 토큰 교환 시작...');
    
    // Netlify Functions 사용 (배포 환경) 또는 Express 서버 사용 (로컬 환경)
    // netlify.toml에서 /api/kakao-to-firebase-token을 Netlify Functions로 리다이렉트함
    const apiUrl = '/api/kakao-to-firebase-token';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        accessToken: accessToken // 서버에서 카카오 API로 사용자 정보를 가져옴
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 카카오 토큰 교환 성공');
      console.log('📝 교환된 사용자 정보:', data.user);
      
      // Firebase 커스텀 토큰으로 로그인
      await signInWithCustomToken(auth, data.customToken || data.token);
      
      showSuccessMessage('카카오 로그인이 완료되었습니다!');
      
    } else {
      throw new Error(data.error || '토큰 교환에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('❌ 카카오 토큰 교환 실패:', error);
    showErrorMessage('카카오 로그인에 실패했습니다: ' + error.message);
  }
}

// UI 표시 함수들
function showLoginForms() {
  const signupSection = document.getElementById('signupSection');
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  
  if (signupSection) signupSection.style.display = 'block';
  if (loginSection) loginSection.style.display = 'block';
  if (dashboardSection) dashboardSection.style.display = 'none';
}

function showUserDashboard(user) {
  const signupSection = document.getElementById('signupSection');
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const userInfo = document.getElementById('userInfo');
  
  if (signupSection) signupSection.style.display = 'none';
  if (loginSection) loginSection.style.display = 'none';
  if (dashboardSection) dashboardSection.style.display = 'block';
  
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="text-center">
        <h3 class="text-lg font-semibold text-gray-800">환영합니다!</h3>
        <p class="text-gray-600">${user.email}</p>
        <p class="text-sm text-gray-500">${user.displayName || '사용자'}</p>
      </div>
    `;
  }
}

function showSuccessMessage(message) {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4';
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
  }
}

function showErrorMessage(message) {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
  }
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', init);

// 전역 export
export { init, upsertMemberData, handleKakaoLogin };
