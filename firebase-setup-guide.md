# 🔥 Firebase 설정 가이드 - PriceHunter

## 🌟 Firebase란?
Google에서 제공하는 무료 클라우드 서비스로, 데이터베이스, 인증, 호스팅 등을 제공합니다.

## 💰 무료 한도
- **저장소**: 1GB
- **다운로드**: 10GB/월
- **동시 연결**: 100개
- **문서 읽기/쓰기**: 50,000/일

## 📋 설정 단계

### 1. 🌐 Firebase 콘솔 접속
- [Firebase Console](https://console.firebase.google.com/) 접속
- Google 계정으로 로그인

### 2. 🆕 새 프로젝트 생성
- "프로젝트 추가" 클릭
- 프로젝트 이름: `PriceHunter` 입력
- Google Analytics 선택 (선택사항)
- "프로젝트 만들기" 클릭

### 3. 🔥 Firestore 데이터베이스 설정
- 왼쪽 메뉴에서 "Firestore Database" 선택
- "데이터베이스 만들기" 클릭
- "테스트 모드에서 시작" 선택
- 위치: `asia-northeast3 (서울)` 선택
- "사용 설정" 클릭

### 4. 📱 웹 앱 추가
- 프로젝트 개요에서 `</>` 아이콘 클릭
- 앱 닉네임: `PriceHunter Web` 입력
- "앱 등록" 클릭
- Firebase 호스팅 체크 해제
- "앱 등록" 클릭

### 5. 🔑 설정 정보 복사
- `firebaseConfig` 객체의 값들을 복사
- `admin-dashboard.html`의 `firebaseConfig`에 붙여넣기

### 6. 🔒 보안 규칙 설정
- Firestore Database → 규칙 탭
- 다음 규칙으로 수정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pricehunter_data/{document} {
      allow read, write: if true; // 테스트용 (나중에 보안 강화 필요)
    }
  }
}
```

## 📁 설정 파일 예시

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "pricehunter-xxxxx.firebaseapp.com",
  projectId: "pricehunter-xxxxx",
  storageBucket: "pricehunter-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## ✅ 설정 완료 후

1. **클라우드 연동 상태 확인** 버튼 클릭
2. **Firebase 설정** 버튼으로 설정 가이드 확인
3. **클라우드에 동기화** 버튼으로 데이터 업로드
4. **클라우드 데이터 확인** 버튼으로 업로드된 데이터 확인

## 🌍 장점

- **무료**: 1GB까지 무료 사용
- **실시간**: 데이터 변경 시 즉시 반영
- **접근성**: 모든 기기에서 데이터 접근 가능
- **백업**: 자동 백업 및 복구
- **확장성**: 필요시 유료 플랜으로 업그레이드

## ⚠️ 주의사항

- **보안**: 현재는 테스트 모드로 설정됨
- **백업**: 정기적으로 데이터 백업 권장
- **용량**: 무료 한도 초과 시 유료 과금
- **API 키**: 공개 저장소에 올리지 않도록 주의

## 🆘 문제 해결

### Firebase 초기화 실패
- API 키가 올바른지 확인
- 인터넷 연결 상태 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 데이터 동기화 실패
- Firestore 보안 규칙 확인
- 네트워크 연결 상태 확인
- 데이터 형식이 올바른지 확인

## 📞 지원

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Firebase 커뮤니티](https://firebase.google.com/community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase)
