# 🔍 Google Search Console 설정 가이드

## 1단계: Google Search Console 계정 생성

### 계정 생성
1. https://search.google.com/search-console 접속
2. Google 계정으로 로그인
3. "속성 추가" 클릭

### 도메인 등록
1. 도메인 입력: `pricehunt24.com`
2. "계속" 클릭
3. 소유권 확인 방법 선택

## 2단계: 소유권 확인

### HTML 태그 방식 (추천)
1. "HTML 태그" 탭 선택
2. 제공된 태그 복사
3. `index.html`의 `<head>` 섹션에 추가
4. 사이트에 변경사항 배포
5. "확인" 클릭

### 제공된 태그 예시
```html
<meta name="google-site-verification" content="ABC123DEF456GHI789" />
```

## 3단계: 사이트맵 제출

### 사이트맵 URL
```
https://pricehunt24.com/sitemap.xml
```

### 제출 방법
1. Search Console 대시보드 접속
2. "사이트맵" 메뉴 클릭
3. "새 사이트맵 추가" 클릭
4. 사이트맵 URL 입력
5. "제출" 클릭

## 4단계: 검색 성과 확인

### 주요 지표
1. **클릭 수**: 검색 결과에서 클릭한 횟수
2. **노출 수**: 검색 결과에 노출된 횟수
3. **CTR**: 클릭률 (클릭 수 / 노출 수)
4. **평균 위치**: 검색 결과에서의 평균 순위

### 확인 방법
1. "성과" 메뉴 클릭
2. 날짜 범위 설정
3. 쿼리, 페이지, 국가별 필터링
4. 데이터 확인

## 5단계: 색인 생성 요청

### URL 검사
1. "URL 검사" 도구 사용
2. 주요 페이지 URL 입력
3. 색인 생성 요청
4. 상태 확인

### 주요 페이지
- https://pricehunt24.com/
- https://pricehunt24.com/request-v2.html
- https://pricehunt24.com/result-search.html
- https://pricehunt24.com/contact.html

## 6단계: 모바일 사용성 확인

### 모바일 사용성 테스트
1. "모바일 사용성" 메뉴 클릭
2. 자동 테스트 실행
3. 문제점 확인 및 수정
4. 재테스트

### 주요 확인 사항
- 페이지 로딩 속도
- 터치 타겟 크기
- 텍스트 가독성
- 뷰포트 설정

## 7단계: 보안 및 수동 조치

### 보안 문제 확인
1. "보안 및 수동 조치" 메뉴 클릭
2. 보안 문제 확인
3. 수동 조치 확인
4. 문제 해결

### 일반적인 문제
- 해킹된 콘텐츠
- 스팸 링크
- 악성 소프트웨어
- 사용자 생성 스팸

## 8단계: 구조화된 데이터

### 구조화된 데이터 추가
1. "향상된 기능" 메뉴 클릭
2. 구조화된 데이터 확인
3. 누락된 데이터 추가
4. 테스트 실행

### 추가할 구조화된 데이터
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "PriceHunter",
  "url": "https://pricehunt24.com",
  "logo": "https://pricehunt24.com/logo.png",
  "description": "최저가 찾기 서비스",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+82-2-1234-5678",
    "contactType": "customer service"
  }
}
```

## 9단계: 알림 설정

### 알림 설정
1. "설정" → "기본 설정"
2. 이메일 알림 설정
3. 알림 유형 선택:
   - 색인 생성 오류
   - 보안 문제
   - 수동 조치
   - 모바일 사용성

## 10단계: 성능 최적화

### Core Web Vitals 확인
1. "Core Web Vitals" 메뉴 클릭
2. 성능 지표 확인:
   - LCP (Largest Contentful Paint)
   - FID (First Input Delay)
   - CLS (Cumulative Layout Shift)
3. 개선 사항 확인

### 성능 개선
1. 이미지 최적화
2. CSS/JS 압축
3. 캐시 설정
4. CDN 활용

## 완료 확인 체크리스트

- [ ] Google Search Console 계정 생성
- [ ] 도메인 소유권 확인
- [ ] 사이트맵 제출
- [ ] 색인 생성 요청
- [ ] 모바일 사용성 확인
- [ ] 보안 문제 확인
- [ ] 구조화된 데이터 추가
- [ ] 알림 설정
- [ ] 성능 최적화

## 다음 단계

Google Search Console 설정 완료 후:
1. 성능 최적화
2. SEO 최적화
3. 소셜 미디어 설정
4. 마케팅 전략 수립 