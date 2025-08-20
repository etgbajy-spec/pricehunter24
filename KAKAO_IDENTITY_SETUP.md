# 카카오 본인인증 서비스 설정 가이드

## 📋 1단계: 카카오 개발자 가입 및 본인인증 신청

### 1.1 카카오 개발자 가입
1. **가입**: https://developers.kakao.com/
2. **본인인증**: 휴대폰 인증
3. **이메일 인증**: 이메일 주소 확인

### 1.2 본인인증 서비스 신청
1. **서비스 신청**:
   - "내 애플리케이션" → "애플리케이션 추가하기"
   - 앱 이름: `PriceHunter`
   - 회사명: `PriceHunter`
   - 사업자등록번호: [실제 사업자등록번호]
2. **본인인증 서비스 선택**:
   - "플랫폼" → "Web" 추가
   - "카카오 로그인" 활성화
   - "본인인증" 서비스 신청
3. **사업자등록증 업로드**:
   - 사업자등록증 사본 업로드
   - 승인 대기: 1-2일

### 1.3 API 키 발급
1. **JavaScript 키 확인**:
   - "앱 키" 탭에서 JavaScript 키 복사
   - 형식: `1234567890abcdef1234567890abcdef`
2. **REST API 키 확인**:
   - "앱 키" 탭에서 REST API 키 복사
   - 형식: `1234567890abcdef1234567890abcdef`

## 🔧 2단계: 코드 설정

### 2.1 index.html 수정
**파일**: `pricehunter-production/index.html`

```javascript
// 카카오 SDK 추가 (head 태그 내)
<script src="https://developers.kakao.com/sdk/js/kakao.js"></script>

// 카카오 초기화 (body 태그 끝)
<script>
Kakao.init('실제_JavaScript_키');
</script>
```

### 2.2 본인인증 함수 수정
**파일**: `pricehunter-production/index.html`

```javascript
// 본인인증 함수 수정 (기존 함수 대체)
function startIdentityVerification(name, birth, phone) {
  // 카카오 본인인증 시도
  Kakao.Auth.login({
    success: function(authObj) {
      // 본인인증 팝업 열기
      Kakao.Auth.authorize({
        redirectUri: window.location.origin + '/identity-verification-result.html',
        throughTalk: false
      });
    },
    fail: function(err) {
      console.error('카카오 로그인 실패:', err);
      showToast('카카오 로그인에 실패했습니다. 다시 시도해주세요.', 'error');
    }
  });
}
```

### 2.3 identity-verification-result.html 생성
**파일**: `pricehunter-production/identity-verification-result.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>본인인증 결과 - PriceHunter</title>
    <script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <div class="text-center">
                <div id="success-content" class="hidden">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                        <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">본인인증 성공</h3>
                    <p class="text-sm text-gray-500 mb-4">인증이 완료되었습니다.</p>
                    <div id="user-info" class="text-left bg-gray-50 p-4 rounded-lg mb-4">
                        <p><strong>이름:</strong> <span id="verified-name"></span></p>
                        <p><strong>생년월일:</strong> <span id="verified-birth"></span></p>
                        <p><strong>휴대폰:</strong> <span id="verified-phone"></span></p>
                    </div>
                </div>
                
                <div id="error-content" class="hidden">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">본인인증 실패</h3>
                    <p class="text-sm text-gray-500 mb-4" id="error-message">인증에 실패했습니다.</p>
                </div>
                
                <button onclick="closeWindow()" class="w-full bg-pink-600 text-white py-2 px-4 rounded-lg hover:bg-pink-700 transition-colors">
                    확인
                </button>
            </div>
        </div>
    </div>

    <script>
        // 카카오 초기화
        Kakao.init('실제_JavaScript_키');
        
        // URL 파라미터에서 인증 결과 확인
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (code) {
            // 인증 성공
            Kakao.Auth.setAccessToken(code);
            getUserInfo();
        } else if (error) {
            // 인증 실패
            showError(error);
        }
        
        function getUserInfo() {
            Kakao.API.request({
                url: '/v2/user/me',
                success: function(res) {
                    const userInfo = res.kakao_account;
                    document.getElementById('verified-name').textContent = userInfo.name;
                    document.getElementById('verified-birth').textContent = userInfo.birthday;
                    document.getElementById('verified-phone').textContent = userInfo.phone_number;
                    document.getElementById('success-content').classList.remove('hidden');
                    
                    // 부모 창에 결과 전달
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'identity-verification-success',
                            data: {
                                name: userInfo.name,
                                birth: userInfo.birthday,
                                phone: userInfo.phone_number
                            }
                        }, '*');
                    }
                },
                fail: function(err) {
                    console.error('사용자 정보 조회 실패:', err);
                    showError('사용자 정보를 가져올 수 없습니다.');
                }
            });
        }
        
        function showError(message) {
            document.getElementById('error-message').textContent = message;
            document.getElementById('error-content').classList.remove('hidden');
        }
        
        function closeWindow() {
            window.close();
        }
    </script>
</body>
</html>
```

## 🧪 3단계: 테스트

### 3.1 테스트 환경 설정
1. **도메인 설정**:
   - 카카오 개발자 콘솔에서 도메인 등록
   - `http://localhost:3000` (개발용)
   - `https://yourdomain.com` (운영용)

2. **리다이렉트 URI 설정**:
   - `http://localhost:3000/identity-verification-result.html`
   - `https://yourdomain.com/identity-verification-result.html`

### 3.2 테스트 진행
1. **회원가입 페이지** 접속
2. **본인인증 버튼** 클릭
3. **카카오 로그인** 진행
4. **본인인증** 완료
5. **결과 확인**

## 💰 4단계: 요금 안내

### 4.1 본인인증 요금
- **건당 비용**: 50원
- **월 1,000건**: 5만원
- **월 5,000건**: 25만원

### 4.2 예상 월 비용
- **초기 (월 500건)**: 2.5만원
- **성장기 (월 1,000건)**: 5만원
- **안정기 (월 2,000건)**: 10만원

## ⚠️ 주의사항

### 4.1 사용자 요구사항
- **카카오톡 설치**: 수신자에게 카카오톡 설치 필요
- **카카오 계정**: 카카오 계정 보유 필요
- **본인인증 동의**: 사용자 본인인증 동의 필요

### 4.2 기술적 제한
- **브라우저 지원**: 최신 브라우저 권장
- **모바일 지원**: iOS/Android 지원
- **네트워크**: 안정적인 인터넷 연결 필요

## 🔍 문제 해결

### 자주 발생하는 문제

#### 1. JavaScript 키 오류
```
Error: Invalid JavaScript key
```
**해결**: 올바른 JavaScript 키 사용 확인

#### 2. 도메인 미등록
```
Error: Invalid redirect URI
```
**해결**: 카카오 개발자 콘솔에서 도메인 등록

#### 3. 본인인증 거부
```
Error: User denied authentication
```
**해결**: 사용자에게 본인인증 필요성 설명

## 📞 지원

- **카카오 개발자 고객센터**: https://developers.kakao.com/support
- **기술 문서**: https://developers.kakao.com/docs/latest/ko/kakaologin/common
- **가격 안내**: https://developers.kakao.com/pricing

---

**✅ 완료 체크리스트**:
- [ ] 카카오 개발자 가입
- [ ] 본인인증 서비스 신청
- [ ] 사업자등록증 업로드 및 승인
- [ ] API 키 발급
- [ ] 코드 설정 완료
- [ ] 도메인 및 리다이렉트 URI 설정
- [ ] 테스트 완료 