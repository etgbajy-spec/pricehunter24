# 데이터 마이그레이션 가이드

## 🚨 중요: 기존 데이터 보존 방법

### 현재 상황
- 모든 데이터가 브라우저 localStorage에 저장됨
- GitHub 업데이트 시 기존 사용자 데이터 손실 위험

### 해결 방안

#### 1. 서버 사이드 데이터베이스 구축 (권장)

**필요한 작업:**
```javascript
// 1. 데이터베이스 스키마 설계
const userSchema = {
  id: String,
  name: String,
  email: String,
  phone: String,
  joinDate: Date
};

const requestSchema = {
  id: String,
  userId: String,
  name: String,
  description: String,
  images: Array,
  date: Date,
  status: String
};

const resultSchema = {
  id: String,
  requestId: String,
  price: String,
  origin: String,
  summary: String,
  link: String,
  createdAt: Date
};
```

**마이그레이션 스크립트:**
```javascript
// 2. localStorage → 서버 마이그레이션
async function migrateLocalStorageToServer() {
  const users = [];
  const requests = [];
  const results = [];
  
  // localStorage에서 데이터 추출
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    
    if (key === 'user' || key === 'currentUser') {
      users.push(JSON.parse(value));
    } else if (key.startsWith('request-')) {
      requests.push({ key, ...JSON.parse(value) });
    } else if (key.startsWith('result-')) {
      results.push({ key, ...JSON.parse(value) });
    }
  }
  
  // 서버로 전송
  await fetch('/api/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users, requests, results })
  });
}
```

#### 2. 백업 시스템 구축

**자동 백업 기능:**
```javascript
// 3. 자동 백업 시스템
function setupAutoBackup() {
  // 매일 자정에 백업
  setInterval(() => {
    const backup = {
      timestamp: new Date().toISOString(),
      data: getAllLocalStorageData(),
      version: '1.0'
    };
    
    // 클라우드 스토리지에 백업
    uploadToCloudStorage(backup);
  }, 24 * 60 * 60 * 1000);
}

// 4. 복구 기능
async function restoreFromBackup(backupId) {
  const backup = await downloadFromCloudStorage(backupId);
  restoreLocalStorageData(backup.data);
}
```

#### 3. 점진적 마이그레이션

**단계별 접근:**
1. **1단계**: 서버 API 구축
2. **2단계**: 새 사용자는 서버에 저장
3. **3단계**: 기존 사용자 데이터 마이그레이션
4. **4단계**: localStorage는 캐시로만 사용

### 즉시 적용 가능한 임시 해결책

#### 1. 데이터 내보내기 기능 추가
```javascript
// 관리자 페이지에 데이터 내보내기 버튼 추가
function exportAllData() {
  const allData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    allData[key] = localStorage.getItem(key);
  }
  
  const blob = new Blob([JSON.stringify(allData, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pricehunter-backup-${new Date().toISOString()}.json`;
  a.click();
}
```

#### 2. 데이터 가져오기 기능 추가
```javascript
function importData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = JSON.parse(e.target.result);
    
    // localStorage 초기화
    localStorage.clear();
    
    // 데이터 복원
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, data[key]);
    });
    
    alert('데이터 복원이 완료되었습니다.');
    location.reload();
  };
  reader.readAsText(file);
}
```

### 권장 작업 순서

1. **즉시**: 데이터 내보내기/가져오기 기능 추가
2. **1주 내**: 서버 사이드 데이터베이스 구축
3. **2주 내**: 마이그레이션 스크립트 개발
4. **3주 내**: 점진적 마이그레이션 실행

### 비용 고려사항

- **서버 호스팅**: 월 $5-20
- **데이터베이스**: 월 $5-15
- **백업 스토리지**: 월 $1-5
- **총 예상 비용**: 월 $15-40

### 보안 고려사항

- 사용자 데이터 암호화
- HTTPS 필수
- 정기적인 백업
- 접근 권한 관리

---

## 📞 다음 단계

1. 서버 사이드 개발 시작
2. 데이터베이스 설계
3. 마이그레이션 계획 수립
4. 백업 시스템 구축

이 가이드를 따라하면 기존 사용자 데이터를 안전하게 보존할 수 있습니다.
