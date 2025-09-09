// 메인 앱 모듈
import { auth, db } from './firebase.js';
import { 
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
  console.log('🚀 메인 앱 초기화 시작...');
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 인증 상태 감시
  onAuthStateChanged(auth, handleAuthStateChange);
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // 의뢰 폼
  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    requestForm.addEventListener('submit', handleRequestSubmit);
  }
  
  // 문의 폼
  const inquiryForm = document.getElementById('inquiryForm');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', handleInquirySubmit);
  }
}

// 인증 상태 변경 처리
function handleAuthStateChange(user) {
  console.log('🔄 인증 상태 변경:', user ? user.email : '로그아웃');
  
  if (user) {
    currentUser = user;
    showAuthenticatedUI(user);
    // 회원 정보 Firestore에 저장/업데이트
    upsertMemberData(user);
  } else {
    currentUser = null;
    showUnauthenticatedUI();
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

// 의뢰 제출 처리
async function handleRequestSubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    showErrorMessage('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(e.target);
  const requestData = {
    productName: formData.get('productName'),
    productUrl: formData.get('productUrl'),
    description: formData.get('description'),
    budget: formData.get('budget'),
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  try {
    console.log('🔄 의뢰 제출 시작...');
    
    // Firestore에 의뢰 저장
    const docRef = doc(db, 'requests', Date.now().toString());
    await setDoc(docRef, requestData);
    
    console.log('✅ 의뢰 제출 완료:', docRef.id);
    showSuccessMessage('의뢰가 성공적으로 제출되었습니다!');
    
    // 폼 초기화
    e.target.reset();
    
  } catch (error) {
    console.error('❌ 의뢰 제출 실패:', error);
    showErrorMessage('의뢰 제출에 실패했습니다: ' + error.message);
  }
}

// 문의 제출 처리
async function handleInquirySubmit(e) {
  e.preventDefault();
  
  if (!currentUser) {
    showErrorMessage('로그인이 필요합니다.');
    return;
  }
  
  const formData = new FormData(e.target);
  const inquiryData = {
    subject: formData.get('subject'),
    message: formData.get('message'),
    category: formData.get('category'),
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  try {
    console.log('🔄 문의 제출 시작...');
    
    // Firestore에 문의 저장
    const docRef = doc(db, 'inquiries', Date.now().toString());
    await setDoc(docRef, inquiryData);
    
    console.log('✅ 문의 제출 완료:', docRef.id);
    showSuccessMessage('문의가 성공적으로 제출되었습니다!');
    
    // 폼 초기화
    e.target.reset();
    
  } catch (error) {
    console.error('❌ 문의 제출 실패:', error);
    showErrorMessage('문의 제출에 실패했습니다: ' + error.message);
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

// UI 표시 함수들
function showAuthenticatedUI(user) {
  const loginSection = document.getElementById('loginSection');
  const userSection = document.getElementById('userSection');
  const requestSection = document.getElementById('requestSection');
  const inquirySection = document.getElementById('inquirySection');
  
  if (loginSection) loginSection.style.display = 'none';
  if (userSection) userSection.style.display = 'block';
  if (requestSection) requestSection.style.display = 'block';
  if (inquirySection) inquirySection.style.display = 'block';
  
  const userInfo = document.getElementById('userInfo');
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

function showUnauthenticatedUI() {
  const loginSection = document.getElementById('loginSection');
  const userSection = document.getElementById('userSection');
  const requestSection = document.getElementById('requestSection');
  const inquirySection = document.getElementById('inquirySection');
  
  if (loginSection) loginSection.style.display = 'block';
  if (userSection) userSection.style.display = 'none';
  if (requestSection) requestSection.style.display = 'none';
  if (inquirySection) inquirySection.style.display = 'none';
}

function showSuccessMessage(message) {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4';
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    // 3초 후 자동 숨김
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
}

function showErrorMessage(message) {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4';
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    
    // 5초 후 자동 숨김
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', init);

// 전역 export
export { init, upsertMemberData, handleRequestSubmit, handleInquirySubmit };
