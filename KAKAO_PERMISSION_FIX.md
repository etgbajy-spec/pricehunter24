# 카카오 개발자 콘솔 동의항목 권한 문제 해결

## 🚨 문제 상황
카카오 개발자 콘솔에서 동의항목 설정 시 "권한이 없습니다" 오류 발생

## 🔍 원인 분석
- 카카오 앱이 **개발 단계**에 있어서 제한된 권한
- **사업자 인증**이 필요할 수 있음
- **앱 검토**가 필요한 동의항목

## ✅ 해결 방법

### 방법 1: 개발 단계에서 사용 가능한 동의항목만 설정

#### 현재 설정 가능한 동의항목:
1. **이름 (profile_nickname)** - ✅ 설정 가능
2. **프로필 사진 (profile_image)** - ✅ 설정 가능
3. **계정 (account_email)** - ⚠️ 제한적
4. **생년월일 (birthday)** - ❌ 권한 없음
5. **휴대폰번호 (phone_number)** - ❌ 권한 없음

#### 설정 방법:
1. **카카오 개발자 콘솔** 접속
2. **내 애플리케이션** → **프라이스헌터**
3. **카카오 로그인** → **동의항목**
4. **설정 가능한 항목만** 활성화:
   - [x] **이름 (profile_nickname)**: 필수
   - [x] **프로필 사진 (profile_image)**: 선택
   - [x] **계정 (account_email)**: 선택 (가능한 경우)

### 방법 2: 사업자 인증으로 권한 확장

#### 사업자 인증 절차:
1. **카카오 개발자 콘솔** → **내 애플리케이션**
2. **프라이스헌터** 앱 선택
3. **앱 설정** → **비즈니스 인증**
4. **사업자등록증** 업로드
5. **승인 대기** (1-3일)

#### 사업자 인증 후 사용 가능한 동의항목:
- [x] **이름 (profile_nickname)**
- [x] **생년월일 (birthday)**
- [x] **휴대폰번호 (phone_number)**
- [x] **계정 (account_email)**
- [x] **성별 (gender)**
- [x] **연령대 (age_range)**

### 방법 3: 임시 해결책 (개발용)

#### 현재 상황에서 가능한 설정:
```javascript
// index.html에서 카카오 로그인 시 수집 가능한 정보
const userData = {
  name: userInfo.profile?.nickname || '카카오 사용자',
  email: userInfo.email || `kakao_${res.id}@pricehunter.com`,
  phone: '', // 현재 수집 불가
  birth: '', // 현재 수집 불가
  loginType: 'kakao',
  kakaoId: res.id
};
```

#### 사용자에게 추가 정보 입력 요청:
```html
<!-- 카카오 로그인 후 추가 정보 입력 모달 -->
<div id="additional-info-modal" class="hidden">
  <h3>추가 정보 입력</h3>
  <input type="tel" placeholder="휴대폰번호" />
  <input type="date" placeholder="생년월일" />
  <button>저장</button>
</div>
```

## 🎯 권장 해결 순서

### 1단계: 즉시 가능한 설정
1. **이름 (profile_nickname)** 필수 설정
2. **계정 (account_email)** 선택 설정
3. **프로필 사진 (profile_image)** 선택 설정

### 2단계: 사업자 인증 진행
1. **사업자등록증** 준비
2. **비즈니스 인증** 신청
3. **승인 대기** (1-3일)

### 3단계: 추가 동의항목 설정
1. **생년월일 (birthday)** 필수 설정
2. **휴대폰번호 (phone_number)** 필수 설정
3. **기타 필요한 항목** 설정

## 🔧 코드 수정 (임시 해결책)

### 카카오 로그인 함수 수정:
```javascript
function performKakaoLogin() {
  Kakao.Auth.login({
    success: function(authObj) {
      Kakao.API.request({
        url: '/v2/user/me',
        success: function(res) {
          const userInfo = res.kakao_account;
          
          // 현재 수집 가능한 정보만 사용
          const userData = {
            name: userInfo.profile?.nickname || '카카오 사용자',
            email: userInfo.email || `kakao_${res.id}@pricehunter.com`,
            phone: '', // 나중에 사용자 입력으로 받기
            birth: '', // 나중에 사용자 입력으로 받기
            loginType: 'kakao',
            kakaoId: res.id,
            loginTime: Date.now()
          };
          
          // 추가 정보 입력 모달 표시 (필요한 경우)
          if (!userData.phone || !userData.birth) {
            showAdditionalInfoModal(userData);
          } else {
            completeLogin(userData);
          }
        }
      });
    }
  });
}

// 추가 정보 입력 모달
function showAdditionalInfoModal(userData) {
  const modal = document.getElementById('additional-info-modal');
  modal.classList.remove('hidden');
  
  // 사용자가 추가 정보 입력 후
  document.getElementById('save-additional-info').onclick = function() {
    userData.phone = document.getElementById('additional-phone').value;
    userData.birth = document.getElementById('additional-birth').value;
    completeLogin(userData);
    modal.classList.add('hidden');
  };
}
```

## 📋 체크리스트

### 현재 가능한 것:
- [x] 카카오 로그인 기본 기능
- [x] 이름 정보 수집
- [x] 이메일 정보 수집 (가능한 경우)
- [x] 프로필 사진 수집

### 사업자 인증 후 가능한 것:
- [ ] 생년월일 정보 수집
- [ ] 휴대폰번호 정보 수집
- [ ] 성별 정보 수집
- [ ] 연령대 정보 수집

## ⚠️ 주의사항

### 개발 단계 제한:
- **일일 사용자 제한**: 100명
- **제한된 동의항목**: 기본 정보만 수집 가능
- **테스트 목적**: 실제 서비스에는 사업자 인증 필요

### 운영 단계 필요사항:
- **사업자 인증**: 필수
- **앱 검토**: 필요할 수 있음
- **개인정보처리방침**: 필수

---

**🎯 목표**: 현재 상황에서 최대한 활용 가능한 카카오 로그인 구현
**⏰ 예상 소요 시간**: 30분 (임시 해결책)
**💰 예상 비용**: 무료 (사업자 인증 시 별도 비용 없음) 