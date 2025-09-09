// 관리자 대시보드 모듈
import { auth, db } from './firebase.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  where,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

// 관리자 화이트리스트
const ADMIN_WHITELIST = [
  'q886654@naver.com',
  'admin@pricehunter.com'
];

// DOM 요소
let loginForm, dashboard, membersTable, requestsTable, inquiriesTable;
let currentUser = null;

// 초기화
function init() {
  console.log('🚀 관리자 대시보드 초기화 시작...');
  
  // DOM 요소 가져오기
  loginForm = document.getElementById('loginForm');
  dashboard = document.getElementById('dashboard');
  membersTable = document.getElementById('membersTable');
  requestsTable = document.getElementById('requestsTable');
  inquiriesTable = document.getElementById('inquiriesTable');
  
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 인증 상태 감시
  onAuthStateChanged(auth, handleAuthStateChange);
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 로그인 폼
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// 인증 상태 변경 처리
async function handleAuthStateChange(user) {
  console.log('🔄 인증 상태 변경:', user ? user.email : '로그아웃');
  
  if (user) {
    currentUser = user;
    const isAdmin = await checkAdminPermission(user);
    
    if (isAdmin) {
      console.log('✅ 관리자 권한 확인됨');
      showDashboard();
      setupRealtimeListeners();
    } else {
      console.log('❌ 관리자 권한 없음');
      showLoginForm('관리자 권한이 없습니다.');
      await signOut(auth);
    }
  } else {
    currentUser = null;
    showLoginForm();
  }
}

// 관리자 권한 확인
async function checkAdminPermission(user) {
  try {
    // Custom Claims 확인
    const tokenResult = await user.getIdTokenResult();
    const role = tokenResult.claims.role;
    
    if (role === 'admin') {
      console.log('✅ Custom Claims에서 관리자 권한 확인');
      return true;
    }
    
    // 이메일 화이트리스트 확인
    if (ADMIN_WHITELIST.includes(user.email)) {
      console.log('✅ 이메일 화이트리스트에서 관리자 권한 확인');
      return true;
    }
    
    console.log('❌ 관리자 권한 없음');
    return false;
  } catch (error) {
    console.error('❌ 관리자 권한 확인 실패:', error);
    return false;
  }
}

// 로그인 처리
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    console.log('🔄 관리자 로그인 시도:', email);
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ 관리자 로그인 성공');
  } catch (error) {
    console.error('❌ 관리자 로그인 실패:', error);
    showLoginForm('로그인에 실패했습니다: ' + error.message);
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

// 로그인 폼 표시
function showLoginForm(message = '') {
  if (loginForm) loginForm.style.display = 'block';
  if (dashboard) dashboard.style.display = 'none';
  
  if (message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }
}

// 대시보드 표시
function showDashboard() {
  if (loginForm) loginForm.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';
  
  const errorDiv = document.getElementById('loginError');
  if (errorDiv) errorDiv.style.display = 'none';
}

// 실시간 리스너 설정
function setupRealtimeListeners() {
  console.log('🔄 실시간 리스너 설정 시작...');
  
  setupMembersListener();
  setupRequestsListener();
  setupInquiriesListener();
}

// 회원 데이터 리스너
function setupMembersListener() {
  console.log('👥 회원 데이터 리스너 설정...');
  
  const membersQuery = query(
    collection(db, 'members'),
    orderBy('createdAt', 'desc')
  );
  
  onSnapshot(membersQuery, (snapshot) => {
    console.log('📊 회원 데이터 수신:', snapshot.size, '개 문서');
    updateMembersTable(snapshot);
  }, (error) => {
    console.error('❌ 회원 데이터 리스너 오류:', error);
  });
}

// 의뢰 데이터 리스너
function setupRequestsListener() {
  console.log('📋 의뢰 데이터 리스너 설정...');
  
  const requestsQuery = query(
    collection(db, 'requests'),
    orderBy('createdAt', 'desc')
  );
  
  onSnapshot(requestsQuery, (snapshot) => {
    console.log('📊 의뢰 데이터 수신:', snapshot.size, '개 문서');
    updateRequestsTable(snapshot);
  }, (error) => {
    console.error('❌ 의뢰 데이터 리스너 오류:', error);
  });
}

// 문의 데이터 리스너
function setupInquiriesListener() {
  console.log('💬 문의 데이터 리스너 설정...');
  
  const inquiriesQuery = query(
    collection(db, 'inquiries'),
    orderBy('createdAt', 'desc')
  );
  
  onSnapshot(inquiriesQuery, (snapshot) => {
    console.log('📊 문의 데이터 수신:', snapshot.size, '개 문서');
    updateInquiriesTable(snapshot);
  }, (error) => {
    console.error('❌ 문의 데이터 리스너 오류:', error);
  });
}

// 회원 테이블 업데이트
function updateMembersTable(snapshot) {
  if (!membersTable) return;
  
  const tbody = membersTable.querySelector('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-200 hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-4 py-3">${data.email || 'N/A'}</td>
      <td class="px-4 py-3">${data.name || 'N/A'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${getProviderBadgeClass(data.provider)}">
          ${data.provider || 'N/A'}
        </span>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${getRoleBadgeClass(data.role)}">
          ${data.role || 'viewer'}
        </span>
      </td>
      <td class="px-4 py-3">${formatDate(data.createdAt)}</td>
      <td class="px-4 py-3">${formatDate(data.updatedAt)}</td>
    `;
    
    tbody.appendChild(row);
  });
  
  console.log('✅ 회원 테이블 업데이트 완료:', snapshot.size, '개 행');
}

// 의뢰 테이블 업데이트
function updateRequestsTable(snapshot) {
  if (!requestsTable) return;
  
  const tbody = requestsTable.querySelector('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-200 hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-4 py-3">${data.productName || 'N/A'}</td>
      <td class="px-4 py-3">${data.createdByEmail || 'N/A'}</td>
      <td class="px-4 py-3">${formatDate(data.createdAt)}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(data.status)}">
          ${data.status || 'pending'}
        </span>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  console.log('✅ 의뢰 테이블 업데이트 완료:', snapshot.size, '개 행');
}

// 문의 테이블 업데이트
function updateInquiriesTable(snapshot) {
  if (!inquiriesTable) return;
  
  const tbody = inquiriesTable.querySelector('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-200 hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="px-4 py-3">${data.subject || 'N/A'}</td>
      <td class="px-4 py-3">${data.createdByEmail || 'N/A'}</td>
      <td class="px-4 py-3">${formatDate(data.createdAt)}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(data.status)}">
          ${data.status || 'pending'}
        </span>
      </td>
    `;
    
    tbody.appendChild(row);
  });
  
  console.log('✅ 문의 테이블 업데이트 완료:', snapshot.size, '개 행');
}

// 유틸리티 함수들
function getProviderBadgeClass(provider) {
  const classes = {
    'kakao': 'bg-yellow-100 text-yellow-800',
    'google': 'bg-blue-100 text-blue-800',
    'email': 'bg-gray-100 text-gray-800'
  };
  return classes[provider] || 'bg-gray-100 text-gray-800';
}

function getRoleBadgeClass(role) {
  const classes = {
    'admin': 'bg-red-100 text-red-800',
    'viewer': 'bg-green-100 text-green-800',
    'user': 'bg-blue-100 text-blue-800'
  };
  return classes[role] || 'bg-gray-100 text-gray-800';
}

function getStatusBadgeClass(status) {
  const classes = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', init);

// 전역 export
export { init, checkAdminPermission, setupRealtimeListeners };
