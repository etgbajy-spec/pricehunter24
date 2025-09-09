// 메인 인덱스 모듈
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';

// 초기화
function init() {
  console.log('🚀 메인 인덱스 페이지 초기화 시작...');
  
  // 인증 상태 감시
  onAuthStateChanged(auth, handleAuthStateChange);
  
  // 이벤트 리스너 설정
  setupEventListeners();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 네비게이션 링크들
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', handleNavClick);
  });
  
  // CTA 버튼들
  const ctaButtons = document.querySelectorAll('.cta-button');
  ctaButtons.forEach(button => {
    button.addEventListener('click', handleCTAClick);
  });
}

// 인증 상태 변경 처리
function handleAuthStateChange(user) {
  console.log('🔄 인증 상태 변경:', user ? user.email : '로그아웃');
  
  if (user) {
    showAuthenticatedNav(user);
  } else {
    showUnauthenticatedNav();
  }
}

// 네비게이션 클릭 처리
function handleNavClick(e) {
  const href = e.target.getAttribute('href');
  
  // 로그인이 필요한 페이지들
  const protectedPages = ['/request.html', '/inquiry.html', '/member-dashboard.html'];
  
  if (protectedPages.includes(href)) {
    e.preventDefault();
    
    if (!auth.currentUser) {
      showLoginModal();
    } else {
      window.location.href = href;
    }
  }
}

// CTA 버튼 클릭 처리
function handleCTAClick(e) {
  const action = e.target.getAttribute('data-action');
  
  if (action === 'register') {
    window.location.href = '/register.html';
  } else if (action === 'request') {
    if (!auth.currentUser) {
      showLoginModal();
    } else {
      window.location.href = '/request.html';
    }
  }
}

// 로그인 모달 표시
function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'block';
  }
}

// 로그인 모달 숨김
function hideLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 인증된 네비게이션 표시
function showAuthenticatedNav(user) {
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  
  if (loginLink) loginLink.style.display = 'none';
  if (registerLink) registerLink.style.display = 'none';
  if (userMenu) userMenu.style.display = 'block';
  if (userName) userName.textContent = user.displayName || user.email.split('@')[0];
}

// 비인증 네비게이션 표시
function showUnauthenticatedNav() {
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  const userMenu = document.getElementById('userMenu');
  
  if (loginLink) loginLink.style.display = 'block';
  if (registerLink) registerLink.style.display = 'block';
  if (userMenu) userMenu.style.display = 'none';
}

// DOM 로드 완료 시 초기화
document.addEventListener('DOMContentLoaded', init);

// 전역 export
export { init, showLoginModal, hideLoginModal };
