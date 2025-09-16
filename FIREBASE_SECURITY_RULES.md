# Firebase Firestore 보안 규칙 설정 가이드

## 문제 상황
회원가입 및 문의 제출 시 "Missing or insufficient permissions" 오류가 발생하여 데이터가 Firebase에 저장되지 않는 문제가 있습니다.

## 해결 방법

### 1. Firebase 콘솔 접속
1. [Firebase 콘솔](https://console.firebase.google.com/)에 접속
2. `pricehunter-99a1b` 프로젝트 선택
3. 왼쪽 메뉴에서 **Firestore Database** 클릭
4. **규칙** 탭 클릭

### 2. 보안 규칙 수정
현재 보안 규칙을 다음으로 변경하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // users 컬렉션에 대한 규칙 (회원 데이터)
    match /users/{userId} {
      // 읽기: 모든 사용자 허용
      allow read: if true;
      // 쓰기: 모든 사용자 허용 (회원가입용)
      allow write: if true;
    }
    
    // inquiries 컬렉션에 대한 규칙 (문의 데이터)
    match /inquiries/{inquiryId} {
      // 읽기: 모든 사용자 허용
      allow read: if true;
      // 쓰기: 모든 사용자 허용 (문의 제출용)
      allow write: if true;
    }
    
    // 다른 컬렉션들에 대한 기본 규칙
    match /{document=**} {
      // 읽기: 모든 사용자 허용
      allow read: if true;
      // 쓰기: 모든 사용자 허용
      allow write: if true;
    }
  }
}
```

### 3. 규칙 게시
1. **게시** 버튼 클릭
2. 확인 대화상자에서 **게시** 클릭

### 4. 테스트
1. **회원가입 테스트**: 회원가입을 다시 시도하여 Firebase에 데이터가 정상적으로 저장되는지 확인
2. **문의 제출 테스트**: 문의 페이지에서 문의를 제출하여 Firebase에 저장되는지 확인
3. **관리자 페이지 확인**: 관리자 대시보드와 문의 관리 페이지에서 데이터가 표시되는지 확인

## 보안 고려사항

### 개발/테스트 환경용 (현재 권장)
위의 규칙은 모든 사용자에게 읽기/쓰기 권한을 부여합니다. 이는 개발 및 테스트 단계에서 적합합니다.

### 프로덕션 환경용 (향후 적용)
실제 서비스 운영 시에는 더 엄격한 보안 규칙을 적용해야 합니다:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // users 컬렉션에 대한 규칙
    match /users/{userId} {
      // 읽기: 인증된 사용자만 허용
      allow read: if request.auth != null;
      // 쓰기: 인증된 사용자만 허용
      allow write: if request.auth != null;
    }
  }
}
```

## 문제 해결

### 여전히 권한 오류가 발생하는 경우
1. Firebase 프로젝트 ID 확인: `pricehunter-99a1b`
2. Firestore 데이터베이스가 활성화되어 있는지 확인
3. 브라우저 캐시 삭제 후 재시도
4. Firebase 콘솔에서 규칙이 올바르게 게시되었는지 확인

### 추가 도움이 필요한 경우
- Firebase 문서: https://firebase.google.com/docs/firestore/security/get-started
- Firestore 보안 규칙: https://firebase.google.com/docs/firestore/security/rules-structure
