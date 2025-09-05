# 🔍 PriceHunter 디버깅 가이드

## 📋 8가지 확인사항 점검 결과

### ✅ 1. Firebase 로그 및 Firestore 데이터 저장 확인
- **상태**: 완료
- **개선사항**: 
  - 카카오 로그인 후 Firestore 저장 시 상세한 로깅 추가
  - 저장 시도/성공/실패 로그 구분
  - 저장된 데이터 내용 로깅

### ✅ 2. 카카오 로그인 후 Firestore 저장 확인
- **상태**: 완료
- **구현**: `signInWithCustomToken` 성공 후 `members/{uid}`에 데이터 저장
- **로깅**: 저장 시도/성공/실패 모든 단계 로깅

### ✅ 3. signInWithCustomToken 함수 사용 확인
- **상태**: 완료
- **구현**: 카카오 → Netlify Function → Firebase Custom Token → `signInWithCustomToken`
- **로깅**: 각 단계별 상세 로깅 추가

### ✅ 4. 관리자 대시보드 리스너 확인
- **상태**: 완료
- **구현**: 관리자 권한 확인 후 `onSnapshot` 리스너 시작
- **로깅**: 받은 문서 수, 첫 문서 정보, 처리된 데이터 로깅

### ✅ 5. 보안 규칙 확인
- **상태**: 완료
- **규칙**: 
  - `members/{uid}`: 본인 create/read, 관리자 모든 작업
  - `members/{document=**}`: 관리자 전체 조회 가능
  - `requests/inquiries`: 로그인 사용자 create, 작성자/관리자 read/update/delete

### ✅ 6. CORS 및 네트워크 관련 문제 확인
- **상태**: 완료
- **수정**: Netlify Functions CORS를 개발용으로 `*` 허용
- **확인사항**: Network 탭에서 `batchWrite 200` 확인 필요

### ✅ 7. 브라우저 localStorage 확인
- **상태**: 완료
- **구현**: Firestore 저장 후 localStorage에 호환성 데이터 저장
- **로깅**: localStorage 저장 내용 로깅

### ✅ 8. simulateKakaoLogin 제거 및 실제 카카오 로그인 사용 확인
- **상태**: 완료
- **확인**: `simulateKakaoLogin` 함수 완전 제거됨
- **구현**: 실제 카카오 로그인 플로우 사용

## 🧪 실시간 테스트 가이드

### 1단계: 디버깅 페이지 확인 (30초)
```
http://localhost:3000/debug.html
```
**확인사항**:
- ✅ Firebase 초기화 상태
- ✅ 프로젝트 ID 일치
- ✅ 현재 로그인 사용자
- ✅ 실시간 데이터 수신

### 2단계: 카카오 로그인 테스트 (1분)
1. **`register.html` → 카카오톡 간편가입**
2. **브라우저 콘솔 확인**:
   ```
   🔄 Netlify Function으로 커스텀토큰 요청 중...
   📡 커스텀토큰 응답 상태: 200
   📋 커스텀토큰 응답 데이터: {success: true, token: "..."}
   🔥 Firebase 커스텀토큰으로 로그인 시도 중...
   ✅ Firebase 로그인 성공: {uid: "...", email: "...", displayName: "..."}
   📝 카카오 회원 정보 Firestore 저장 시도: {uid: "...", memberData: {...}}
   ✅ 카카오 회원 정보 Firestore 저장/업데이트 완료: {uid}
   ✅ 저장된 데이터: {...}
   💾 localStorage에 사용자 정보 저장: {...}
   ```

3. **Network 탭 확인**:
   - ✅ `kapi.kakao.com/v2/user/me` **200**
   - ✅ `/.netlify/functions/kakao-exchange` **200**
   - ✅ Firebase `verifyCustomToken` **200**
   - ✅ `firestore.googleapis.com` → `batchWrite` **200**

### 3단계: 이메일 회원가입 테스트 (1분)
1. **`register.html` → 일반 회원가입**
2. **브라우저 콘솔 확인**:
   ```
   ✅ 이메일 회원 정보 Firestore 저장/업데이트 완료: {uid}
   ```

3. **Network 탭 확인**:
   - ✅ Firebase Auth 회원가입 **200**
   - ✅ `firestore.googleapis.com` → `batchWrite` **200**

### 4단계: 의뢰/문의 제출 테스트 (30초)
1. **`request-v2.html` → 의뢰 제출**
2. **`contact.html` → 문의 제출**
3. **브라우저 콘솔 확인**:
   ```
   ✅ 의뢰 정보 Firestore 저장 완료
   ✅ 문의 정보 Firestore 저장 완료
   ```

### 5단계: 관리자 대시보드 확인 (30초)
1. **`admin-dashboard.html` (관리자 계정으로 로그인)**
2. **브라우저 콘솔 확인**:
   ```
   🔍 admin-dashboard.html Firebase 프로젝트 ID: {projectId}
   ✅ 관리자 권한 확인됨 - 리스너 시작
   👥 회원 데이터 수신: X개 문서
   📊 회원 데이터 상세: [...]
   📄 첫 번째 회원 문서: {id: "...", data: {...}}
   📋 처리된 회원 데이터: [...]
   ```

### 6단계: Firebase 콘솔 직접 확인 (30초)
1. **Firebase 콘솔 → Firestore → members 컬렉션**
2. **확인사항**:
   - ✅ `members/{uid}` 문서 존재
   - ✅ 문서 내용: `email`, `name`, `provider`, `role`, `status`, `createdAt`, `updatedAt`
   - ✅ 문서 ID가 Firebase Auth UID와 일치

## 🚨 문제 발생 시 체크리스트

### 문제 1: 카카오 로그인 후 데이터가 저장되지 않음
**확인사항**:
1. 콘솔에서 `✅ Firebase 로그인 성공` 로그가 나오는가?
2. 콘솔에서 `📝 카카오 회원 정보 Firestore 저장 시도` 로그가 나오는가?
3. Network 탭에서 `batchWrite 200`이 보이는가?
4. Firebase 콘솔에서 `members/{uid}` 문서가 생성되었는가?

### 문제 2: 관리자 대시보드에 데이터가 표시되지 않음
**확인사항**:
1. 관리자 계정으로 로그인했는가?
2. 콘솔에서 `✅ 관리자 권한 확인됨 - 리스너 시작` 로그가 나오는가?
3. 콘솔에서 `👥 회원 데이터 수신: X개 문서` 로그가 나오는가?
4. Firebase 프로젝트 ID가 모든 페이지에서 동일한가?

### 문제 3: 보안 규칙 오류
**확인사항**:
1. Firebase 콘솔 → Firestore → 보안 규칙이 배포되었는가?
2. 콘솔에서 `permission-denied` 오류가 나오는가?
3. 사용자가 로그인되어 있는가?

### 문제 4: CORS 오류
**확인사항**:
1. Network 탭에서 `CORS` 오류가 나오는가?
2. Netlify Functions가 정상 작동하는가?
3. `/.netlify/functions/kakao-exchange` 응답이 200인가?

## 📞 추가 지원

문제가 지속되면 다음 정보를 제공해주세요:
1. 브라우저 콘솔의 전체 로그
2. Network 탭의 실패한 요청들
3. Firebase 콘솔의 Firestore 데이터 상태
4. 사용한 브라우저 및 버전

---

**🎯 목표**: 모든 테스트가 통과하여 회원가입 → Firestore 저장 → 관리자 대시보드 즉시 반영이 완벽하게 작동하는 것
