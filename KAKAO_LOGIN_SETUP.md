# 카카오톡 로그인 연동 설정 가이드

## 1. 카카오 개발자 계정 설정

### 1.1 개발자 계정 생성
1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 카카오 계정으로 로그인
3. "내 애플리케이션" → "애플리케이션 추가하기"

### 1.2 애플리케이션 정보 설정
```
앱 이름: PriceHunter
회사명: PriceHunter
사업자명: PriceHunter
```

### 1.3 플랫폼 설정
- **Web 플랫폼 추가**
  - 사이트 도메인: `http://localhost:8000` (개발용)
  - 사이트 도메인: `https://yourdomain.com` (운영용)

## 2. JavaScript SDK 연동

### 2.1 HTML에 SDK 추가
```html
<script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
```

### 2.2 초기화 코드
```javascript
// 카카오 SDK 초기화
Kakao.init('YOUR_JAVASCRIPT_KEY');

// 카카오 로그인 함수
function kakaoLogin() {
  Kakao.Auth.login({
    success: function(authObj) {
      // 로그인 성공 시 사용자 정보 요청
      Kakao.API.request({
        url: '/v2/user/me',
        success: function(res) {
          const user = {
            id: res.id,
            name: res.properties.nickname,
            email: res.kakao_account.email,
            profileImage: res.properties.profile_image,
            loginType: 'kakao'
          };
          
          // 회원가입 처리
          handleKakaoSignup(user);
        },
        fail: function(error) {
          console.error('사용자 정보 요청 실패:', error);
        }
      });
    },
    fail: function(err) {
      console.error('카카오 로그인 실패:', err);
    }
  });
}
```

### 2.3 회원가입 처리
```javascript
function handleKakaoSignup(user) {
  // 기존 회원인지 확인
  const existingUser = JSON.parse(localStorage.getItem('user') || 'null');
  
  if (existingUser && existingUser.id === user.id) {
    // 기존 회원 로그인
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('loggedIn', 'true');
    showToast('카카오톡으로 로그인되었습니다!', 'success');
    updateAuthUI();
  } else {
    // 신규 회원 가입
    const newUser = {
      ...user,
      joinDate: new Date().toISOString(),
      points: 50 // 신규 가입 보너스
    };
    
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('loggedIn', 'true');
    showToast('카카오톡으로 회원가입되었습니다! +50포인트 지급!', 'success');
    updateAuthUI();
  }
}
```

## 3. 보안 설정

### 3.1 도메인 제한
- 카카오 개발자 콘솔에서 허용 도메인 설정
- HTTPS 필수 (운영 환경)

### 3.2 앱 키 보안
- JavaScript 키는 공개되어도 안전
- Admin 키는 절대 클라이언트에 노출 금지

## 4. 사용자 동의 항목

### 4.1 필수 동의
- 닉네임 (profile_nickname)
- 프로필 사진 (profile_image)
- 이메일 (account_email)

### 4.2 선택 동의
- 성별 (gender)
- 연령대 (age_range)
- 생일 (birthday)

## 5. 에러 처리

### 5.1 일반적인 에러
```javascript
Kakao.Auth.login({
  success: function(authObj) {
    // 성공 처리
  },
  fail: function(err) {
    switch (err.error) {
      case 'access_denied':
        alert('사용자가 로그인을 취소했습니다.');
        break;
      case 'invalid_grant':
        alert('인증이 만료되었습니다. 다시 시도해주세요.');
        break;
      default:
        alert('로그인 중 오류가 발생했습니다.');
    }
  }
});
```

## 6. 테스트

### 6.1 개발 환경
- `http://localhost:8000`에서 테스트
- 카카오톡 앱 설치 필요

### 6.2 운영 환경
- HTTPS 도메인에서만 동작
- 실제 카카오 계정으로 테스트

## 7. 주의사항

1. **개인정보 처리**: 카카오에서 받은 정보는 개인정보처리방침에 명시
2. **회원 탈퇴**: 카카오 연동 해제 시 회원 탈퇴 처리
3. **데이터 동기화**: 카카오 프로필 변경 시 자동 업데이트 고려

## 8. 완성된 코드 예시

```javascript
// register.html에 추가할 코드
document.getElementById('kakao-login').addEventListener('click', function() {
  if (typeof Kakao !== 'undefined') {
    kakaoLogin();
  } else {
    alert('카카오 SDK가 로드되지 않았습니다.');
  }
});
```

이 가이드를 따라하면 카카오톡 간편가입 기능을 완벽하게 연동할 수 있습니다!
