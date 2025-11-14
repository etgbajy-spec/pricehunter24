# PriceHunter 시스템 아키텍처 다이어그램

## 🏗️ 전체 시스템 구조

```mermaid
graph TB
    %% 사용자 인터페이스 레이어
    subgraph "Frontend Layer"
        WEB[웹 브라우저]
        MOBILE[모바일 브라우저]
    end

    %% 프론트엔드 애플리케이션
    subgraph "Frontend Application"
        INDEX[메인 페이지<br/>index.html]
        REQUEST[의뢰 페이지<br/>request-v2.html]
        PAYMENT[결제 페이지<br/>payment.html]
        ADMIN[관리자 대시보드<br/>admin-dashboard.html]
        REVIEWS[후기 페이지<br/>reviews.html]
        REGISTER[회원가입<br/>register.html]
    end

    %% 백엔드 서버
    subgraph "Backend Server (Node.js + Express)"
        SERVER[Express Server<br/>server.js]
        API1[결제 검증 API<br/>/api/validate-payment]
        API2[카카오 토큰 교환<br/>/api/kakao-exchange]
        API3[SMS 발송 API<br/>/api/send-sms]
        MIDDLEWARE[미들웨어<br/>CORS, CSP, 인증]
    end

    %% Firebase 서비스
    subgraph "Firebase Services"
        AUTH[Firebase Authentication<br/>사용자 인증]
        FIRESTORE[Cloud Firestore<br/>NoSQL 데이터베이스]
        ADMIN_SDK[Firebase Admin SDK<br/>서버 사이드 인증]
    end

    %% 외부 서비스
    subgraph "External Services"
        TOSS[토스페이먼츠<br/>결제 처리]
        KAKAO[카카오 로그인<br/>소셜 인증]
        NAVER_SMS[네이버 클라우드 SMS<br/>알림 발송]
        KG[KG이니시스<br/>본인인증]
    end

    %% 데이터베이스 컬렉션
    subgraph "Firestore Collections"
        USERS[users<br/>회원 정보]
        REQUESTS[requests<br/>의뢰 데이터]
        REVIEWS[reviews<br/>후기 데이터]
        INQUIRIES[inquiries<br/>문의 데이터]
        ORDERS[orders<br/>주문 데이터]
        PAYMENTS[payments<br/>결제 데이터]
        ADMIN_SETTINGS[adminSettings<br/>관리자 설정]
    end

    %% 연결 관계
    WEB --> INDEX
    WEB --> REQUEST
    WEB --> PAYMENT
    WEB --> ADMIN
    WEB --> REVIEWS
    WEB --> REGISTER

    INDEX --> SERVER
    REQUEST --> SERVER
    PAYMENT --> SERVER
    ADMIN --> SERVER
    REVIEWS --> SERVER
    REGISTER --> SERVER

    SERVER --> API1
    SERVER --> API2
    SERVER --> API3
    SERVER --> MIDDLEWARE

    API1 --> TOSS
    API2 --> KAKAO
    API3 --> NAVER_SMS

    SERVER --> ADMIN_SDK
    INDEX --> AUTH
    REQUEST --> AUTH
    PAYMENT --> AUTH
    ADMIN --> AUTH
    REVIEWS --> AUTH
    REGISTER --> AUTH

    AUTH --> FIRESTORE
    ADMIN_SDK --> FIRESTORE

    FIRESTORE --> USERS
    FIRESTORE --> REQUESTS
    FIRESTORE --> REVIEWS
    FIRESTORE --> INQUIRIES
    FIRESTORE --> ORDERS
    FIRESTORE --> PAYMENTS
    FIRESTORE --> ADMIN_SETTINGS

    %% 스타일링
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef firebase fill:#fff3e0
    classDef external fill:#e8f5e8
    classDef database fill:#fce4ec

    class WEB,MOBILE,INDEX,REQUEST,PAYMENT,ADMIN,REVIEWS,REGISTER frontend
    class SERVER,API1,API2,API3,MIDDLEWARE backend
    class AUTH,FIRESTORE,ADMIN_SDK firebase
    class TOSS,KAKAO,NAVER_SMS,KG external
    class USERS,REQUESTS,REVIEWS,INQUIRIES,ORDERS,PAYMENTS,ADMIN_SETTINGS database
```

## 🔄 데이터 흐름 다이어그램

```mermaid
sequenceDiagram
    participant U as 사용자
    participant F as Frontend
    participant S as Backend Server
    participant FB as Firebase
    participant T as 토스페이먼츠
    participant K as 카카오

    %% 회원가입/로그인 플로우
    Note over U,K: 1. 회원가입/로그인 플로우
    U->>F: 회원가입 요청
    F->>FB: Firebase Auth 회원가입
    FB-->>F: 사용자 토큰
    F-->>U: 로그인 완료

    %% 의뢰 생성 플로우
    Note over U,FB: 2. 의뢰 생성 플로우
    U->>F: 의뢰 정보 입력
    F->>FB: Firestore에 의뢰 저장
    FB-->>F: 저장 완료
    F-->>U: 의뢰 접수 완료

    %% 결제 플로우
    Note over U,T: 3. 결제 플로우
    U->>F: 결제 요청
    F->>S: 결제 정보 검증 요청
    S->>S: 결제 정보 유효성 검사
    S-->>F: 검증 완료
    F->>T: 토스페이먼츠 결제 요청
    T-->>F: 결제 결과
    F->>FB: 결제 정보 저장
    FB-->>F: 저장 완료
    F-->>U: 결제 완료

    %% 관리자 플로우
    Note over U,FB: 4. 관리자 플로우
    U->>F: 관리자 로그인
    F->>FB: Firebase Auth 인증
    FB-->>F: 관리자 토큰
    F->>FB: 의뢰/문의 데이터 조회
    FB-->>F: 데이터 반환
    F-->>U: 관리자 대시보드 표시
```

## 🗄️ 데이터베이스 스키마

```mermaid
erDiagram
    USERS {
        string userId PK
        string email
        string name
        string phone
        timestamp createdAt
        string kakaoId
    }

    REQUESTS {
        string requestId PK
        string userId FK
        string productName
        string category
        number originalPrice
        string description
        string status
        timestamp createdAt
    }

    REVIEWS {
        string reviewId PK
        string userId FK
        string requestId FK
        string productName
        number savingsAmount
        number savingsRate
        string content
        string image
        timestamp createdAt
    }

    INQUIRIES {
        string inquiryId PK
        string userId FK
        string subject
        string content
        string status
        timestamp createdAt
    }

    ORDERS {
        string orderId PK
        string userId FK
        string requestId FK
        string productName
        number amount
        string status
        timestamp createdAt
    }

    PAYMENTS {
        string paymentId PK
        string orderId FK
        string method
        number amount
        string status
        timestamp createdAt
    }

    ADMIN_SETTINGS {
        string settingId PK
        string type
        json data
        timestamp updatedAt
    }

    USERS ||--o{ REQUESTS : "creates"
    USERS ||--o{ REVIEWS : "writes"
    USERS ||--o{ INQUIRIES : "submits"
    USERS ||--o{ ORDERS : "places"
    REQUESTS ||--o{ REVIEWS : "generates"
    REQUESTS ||--o{ ORDERS : "triggers"
    ORDERS ||--|| PAYMENTS : "has"
```

## 🔐 보안 및 인증 플로우

```mermaid
graph TD
    subgraph "Authentication Flow"
        A[사용자 접속] --> B{로그인 상태?}
        B -->|No| C[로그인 페이지]
        B -->|Yes| D[메인 페이지]
        
        C --> E{로그인 방식}
        E -->|일반| F[이메일/비밀번호]
        E -->|카카오| G[카카오 로그인]
        
        F --> H[Firebase Auth]
        G --> I[카카오 API]
        I --> J[토큰 교환]
        J --> H
        
        H --> K{인증 성공?}
        K -->|Yes| L[Firebase 토큰 발급]
        K -->|No| M[에러 메시지]
        
        L --> N[사용자 정보 저장]
        N --> D
    end

    subgraph "Authorization Flow"
        D --> O{관리자 권한?}
        O -->|Yes| P[관리자 대시보드]
        O -->|No| Q[일반 사용자]
        
        P --> R[Firestore Rules 검증]
        R --> S{권한 확인}
        S -->|Pass| T[관리자 기능 접근]
        S -->|Fail| U[접근 거부]
    end
```

## 📊 주요 API 엔드포인트

### Backend Server APIs
- `POST /api/validate-payment` - 결제 정보 검증
- `POST /api/kakao-exchange` - 카카오 토큰을 Firebase 토큰으로 교환
- `POST /api/send-sms` - SMS 알림 발송
- `GET /admin-dashboard` - 관리자 대시보드

### Firebase Services
- **Authentication**: 사용자 인증 및 토큰 관리
- **Firestore**: 실시간 데이터베이스
- **Admin SDK**: 서버 사이드 인증 및 관리

### External APIs
- **토스페이먼츠**: 결제 처리 및 웹훅
- **카카오 로그인**: 소셜 인증
- **네이버 클라우드 SMS**: 알림 발송
- **KG이니시스**: 본인인증

## 🔧 기술 스택

### Frontend
- **HTML5/CSS3/JavaScript (ES6+)**
- **Tailwind CSS** - 스타일링
- **Firebase v9 SDK** - 클라이언트 사이드 Firebase 연동

### Backend
- **Node.js + Express** - 서버 프레임워크
- **Firebase Admin SDK** - 서버 사이드 Firebase 연동
- **CORS, CSP** - 보안 미들웨어

### Database
- **Cloud Firestore** - NoSQL 실시간 데이터베이스
- **Firestore Security Rules** - 데이터 접근 제어

### External Services
- **토스페이먼츠** - 결제 처리
- **카카오 로그인** - 소셜 인증
- **네이버 클라우드 SMS** - 알림 서비스
- **KG이니시스** - 본인인증

## 🚀 배포 및 호스팅

- **Frontend**: Netlify (정적 호스팅)
- **Backend**: Vercel Functions (서버리스)
- **Database**: Firebase (Google Cloud)
- **CDN**: Netlify CDN

## 📈 모니터링 및 로깅

- **Firebase Analytics** - 사용자 행동 분석
- **Firebase Performance** - 성능 모니터링
- **Console Logging** - 서버 사이드 로깅
- **Error Tracking** - 에러 추적 및 알림


