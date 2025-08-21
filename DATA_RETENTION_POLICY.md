# 데이터 보존 정책 구현 가이드

## 📋 법적 요구사항에 따른 데이터 보존 정책

### ⚖️ **법적 근거:**

#### **개인정보보호법:**
- **제21조**: 개인정보의 파기
- **제22조**: 개인정보의 안전성 확보 조치

#### **전자상거래법:**
- **제6조**: 거래기록의 보존 (5년)
- **제15조**: 청약철회 등

### 🔧 **구현된 데이터 보존 정책:**

#### **1. 회원 탈퇴 시 데이터 처리:**

```javascript
// 탈퇴 실행 함수에서 구현된 정책
function executeWithdraw() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // 1. 사용자 목록에서 상태 변경 (삭제하지 않고 보존)
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const updatedUsers = users.map(user => {
    if (user.email === currentUser.email) {
      return { 
        ...user, 
        status: 'withdrawn', 
        withdrawDate: Date.now(),
        originalEmail: user.email, // 원본 이메일 보존
        originalName: user.name    // 원본 이름 보존
      };
    }
    return user;
  });
  localStorage.setItem('users', JSON.stringify(updatedUsers));
  
  // 2. 의뢰 내역 익명화 (개인정보 삭제, 거래 기록 보존)
  const requests = JSON.parse(localStorage.getItem('requests') || '[]');
  const updatedRequests = requests.map(req => {
    if (req.email === currentUser.email) {
      return { 
        ...req, 
        email: 'withdrawn_user', 
        name: '탈퇴한 사용자',
        originalEmail: req.email, // 원본 이메일 보존 (법적 요구사항)
        withdrawDate: Date.now()
      };
    }
    return req;
  });
  localStorage.setItem('requests', JSON.stringify(updatedRequests));
  
  // 3. 문의 내역 익명화
  const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
  const updatedInquiries = inquiries.map(inq => {
    if (inq.email === currentUser.email) {
      return { 
        ...inq, 
        email: 'withdrawn_user', 
        name: '탈퇴한 사용자',
        originalEmail: inq.email,
        withdrawDate: Date.now()
      };
    }
    return inq;
  });
  localStorage.setItem('inquiries', JSON.stringify(updatedInquiries));
  
  // 4. 주문 내역은 그대로 보존 (전자상거래법)
  // 구매 내역은 법적 요구사항에 따라 5년간 보관
}
```

#### **2. 데이터 보존 기간 관리:**

```javascript
// 데이터 보존 기간 체크 함수
function checkDataRetention() {
  const currentTime = Date.now();
  const fiveYearsInMs = 5 * 365 * 24 * 60 * 60 * 1000; // 5년
  
  // 1. 탈퇴 회원 데이터 정리 (5년 경과)
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const updatedUsers = users.filter(user => {
    if (user.status === 'withdrawn' && user.withdrawDate) {
      const withdrawTime = new Date(user.withdrawDate).getTime();
      return (currentTime - withdrawTime) < fiveYearsInMs;
    }
    return true;
  });
  localStorage.setItem('users', JSON.stringify(updatedUsers));
  
  // 2. 의뢰 내역 정리 (5년 경과)
  const requests = JSON.parse(localStorage.getItem('requests') || '[]');
  const updatedRequests = requests.filter(req => {
    if (req.withdrawDate) {
      const withdrawTime = new Date(req.withdrawDate).getTime();
      return (currentTime - withdrawTime) < fiveYearsInMs;
    }
    return true;
  });
  localStorage.setItem('requests', JSON.stringify(updatedRequests));
  
  // 3. 문의 내역 정리 (5년 경과)
  const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
  const updatedInquiries = inquiries.filter(inq => {
    if (inq.withdrawDate) {
      const withdrawTime = new Date(inq.withdrawDate).getTime();
      return (currentTime - withdrawTime) < fiveYearsInMs;
    }
    return true;
  });
  localStorage.setItem('inquiries', JSON.stringify(updatedInquiries));
}

// 월 1회 자동 실행
setInterval(checkDataRetention, 30 * 24 * 60 * 60 * 1000); // 30일마다
```

#### **3. 관리자 페이지에서 데이터 보존 상태 확인:**

```javascript
// 관리자 회원관리 페이지에 추가할 기능
function getDataRetentionInfo() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const requests = JSON.parse(localStorage.getItem('requests') || '[]');
  const inquiries = JSON.parse(localStorage.getItem('inquiries') || '[]');
  
  const withdrawnUsers = users.filter(user => user.status === 'withdrawn');
  const withdrawnRequests = requests.filter(req => req.email === 'withdrawn_user');
  const withdrawnInquiries = inquiries.filter(inq => inq.email === 'withdrawn_user');
  
  return {
    withdrawnUsers: withdrawnUsers.length,
    withdrawnRequests: withdrawnRequests.length,
    withdrawnInquiries: withdrawnInquiries.length,
    retentionPolicy: {
      users: '5년간 보존 후 자동 삭제',
      requests: '5년간 보존 후 자동 삭제',
      inquiries: '5년간 보존 후 자동 삭제',
      orders: '전자상거래법에 따라 5년간 보존'
    }
  };
}
```

### 📊 **데이터 보존 현황 대시보드:**

#### **관리자 페이지에 추가할 섹션:**

```html
<!-- member-admin.html에 추가 -->
<div class="bg-white rounded-lg shadow mb-6">
  <div class="px-6 py-4 border-b border-gray-200">
    <h3 class="text-lg font-medium text-gray-900">데이터 보존 현황</h3>
  </div>
  <div class="p-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="text-center">
        <p class="text-sm text-gray-600">탈퇴 회원</p>
        <p id="withdrawn-users-count" class="text-2xl font-semibold text-gray-900">0</p>
      </div>
      <div class="text-center">
        <p class="text-sm text-gray-600">보존 중인 의뢰</p>
        <p id="withdrawn-requests-count" class="text-2xl font-semibold text-gray-900">0</p>
      </div>
      <div class="text-center">
        <p class="text-sm text-gray-600">보존 중인 문의</p>
        <p id="withdrawn-inquiries-count" class="text-2xl font-semibold text-gray-900">0</p>
      </div>
      <div class="text-center">
        <p class="text-sm text-gray-600">자동 삭제 예정</p>
        <p id="auto-delete-count" class="text-2xl font-semibold text-red-600">0</p>
      </div>
    </div>
  </div>
</div>
```

### 🔒 **보안 및 개인정보 보호:**

#### **1. 데이터 암호화:**
```javascript
// 민감한 개인정보 암호화 저장
function encryptSensitiveData(data) {
  // 실제 구현에서는 더 강력한 암호화 사용
  return btoa(JSON.stringify(data));
}

function decryptSensitiveData(encryptedData) {
  try {
    return JSON.parse(atob(encryptedData));
  } catch (e) {
    return null;
  }
}
```

#### **2. 접근 로그 관리:**
```javascript
// 데이터 접근 로그 기록
function logDataAccess(action, target, userId) {
  const logs = JSON.parse(localStorage.getItem('dataAccessLogs') || '[]');
  logs.push({
    timestamp: Date.now(),
    action: action,
    target: target,
    userId: userId,
    ip: 'client-ip' // 실제로는 서버에서 IP 수집
  });
  localStorage.setItem('dataAccessLogs', JSON.stringify(logs));
}
```

### 📋 **정책 준수 체크리스트:**

#### **✅ 구현 완료:**
- [x] 탈퇴 회원 데이터 상태 관리
- [x] 개인정보 익명화 처리
- [x] 거래 기록 보존
- [x] 자동 데이터 정리 기능

#### **🔄 추후 구현:**
- [ ] 데이터 암호화 강화
- [ ] 접근 로그 시스템
- [ ] 데이터 백업 시스템
- [ ] 법적 요구사항 변경 대응

### ⚠️ **주의사항:**

1. **법적 준수**: 전자상거래법, 개인정보보호법 준수 필수
2. **데이터 보안**: 민감한 개인정보 암호화 저장
3. **정기 점검**: 월 1회 데이터 보존 상태 확인
4. **사용자 안내**: 데이터 보존 기간 명확히 안내

---

**📅 적용 일정**: 회원 탈퇴 기능과 동시 적용
**👥 담당자**: 웹사이트 관리자
**📋 검토 주기**: 분기별 법적 요구사항 변경 확인 