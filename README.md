# PriceHunter - 관리자 대시보드

PriceHunter는 가격 비교 및 구매 대행 서비스입니다. 이 프로젝트는 관리자 전용 대시보드를 포함하여 데이터 관리, 실시간 동기화, 그리고 보안이 강화된 시스템을 제공합니다.

## 🚀 주요 기능

### 1. 권한 체계
- **화이트리스트 기반**: `admin@pricehunter.com`, `manager@pricehunter.com`, `staff@pricehunter.com`
- **Custom Claims**: Firebase Admin SDK를 통한 역할 기반 권한 관리
- **실시간 권한 확인**: 로그인 시 자동 권한 검증 및 UI 제어

### 2. 실시간 데이터 관리
- **onSnapshot 리스너**: Firestore 데이터 변경 시 자동 화면 갱신
- **통계 대시보드**: 의뢰, 문의, 회원 수 실시간 표시
- **데이터 테이블**: 의뢰, 문의, 회원 목록 실시간 업데이트

### 3. 데이터 입력 방식
#### A) 수동 폼 입력
- 관리자 전용 의뢰 추가 폼
- 실시간 Firestore 저장
- 즉시 화면 반영

#### B) CSV 대량 업로드
- Netlify Functions를 통한 서버리스 처리
- Firebase Admin SDK로 안전한 일괄 쓰기
- 오류 로그 및 결과 리포트

#### C) 자동 동기화
- Netlify Scheduled Functions (30분 주기)
- Google Sheets, 외부 API 연동
- 중복 처리 및 매핑 규칙 지원

### 4. 보안 시스템
- **Firestore 보안 규칙**: 읽기/쓰기 권한 세분화
- **Storage 보안 규칙**: 파일 업로드 권한 제어
- **Netlify Functions 보안**: ID 토큰 검증 및 관리자 권한 확인
- **CSP 헤더**: XSS 공격 방지

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Tailwind CSS
- **Backend**: Netlify Functions (Node.js)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Deployment**: Netlify

## 📁 프로젝트 구조

```
pricehunter24/
├── admin-dashboard.html          # 관리자 대시보드 메인 페이지
├── firebase-config.js           # Firebase 설정
├── firestore.rules              # Firestore 보안 규칙
├── storage.rules                # Storage 보안 규칙
├── netlify.toml                 # Netlify 설정
├── package.json                 # 의존성 관리
├── netlify/
│   └── functions/
│       ├── upload-csv.js        # CSV 업로드 함수
│       ├── sync-data.js         # 자동 동기화 함수
│       └── grant-admin.js       # 관리자 권한 부여 함수
└── README.md                    # 프로젝트 문서
```

## 🔧 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. Firebase 설정
1. Firebase 프로젝트 생성
2. Firestore, Auth, Storage 활성화
3. `firebase-config.js`에 프로젝트 설정 추가

### 3. Netlify 환경변수 설정
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
GOOGLE_SHEETS_API_KEY=your-google-sheets-api-key
```

### 4. 보안 규칙 배포
```bash
firebase deploy --only firestore:rules,storage
```

## 🚀 배포

### Netlify 배포
1. GitHub 저장소 연결
2. 빌드 설정: `npm run build` (또는 빈 명령어)
3. 배포 디렉토리: `.` (루트)
4. 환경변수 설정

### 로컬 개발
```bash
npm run dev
```

## 📊 사용법

### 1. 관리자 로그인
- URL: `/admin-dashboard.html`
- 테스트 계정: `admin@pricehunter.com` / `admin1234`

### 2. 데이터 관리
- **수동 입력**: 의뢰 관리 섹션에서 새 의뢰 추가
- **CSV 업로드**: 데이터 관리 섹션에서 CSV 파일 업로드
- **자동 동기화**: 동기화 설정 섹션에서 설정 관리

### 3. 권한 관리
- **권한 부여**: `/.netlify/functions/grant-admin` 함수 사용
- **화이트리스트**: `admin-dashboard.html`의 `ADMIN_WHITELIST` 배열 수정

## 🔒 보안 고려사항

1. **환경변수 보안**: Firebase 서비스 계정 키는 절대 클라이언트에 노출하지 않음
2. **토큰 검증**: 모든 Netlify Functions에서 ID 토큰 검증 필수
3. **CSP 정책**: XSS 공격 방지를 위한 Content Security Policy 적용
4. **권한 최소화**: 필요한 최소 권한만 부여

## 📈 모니터링

- **감사 로그**: 모든 데이터 변경 작업 로깅
- **오류 추적**: CSV 업로드 및 동기화 오류 기록
- **성능 모니터링**: Firebase 콘솔에서 사용량 및 성능 확인

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해 주세요.
