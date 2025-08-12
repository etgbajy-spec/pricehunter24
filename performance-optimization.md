# ⚡ 성능 최적화 가이드

## 1단계: 현재 성능 확인

### Google PageSpeed Insights 테스트
1. https://pagespeed.web.dev 접속
2. URL 입력: `https://pricehunt24.com`
3. "분석" 클릭
4. 결과 확인:
   - 모바일 성능 점수
   - 데스크톱 성능 점수
   - 개선 제안사항

### 목표 점수
- 모바일: 90점 이상
- 데스크톱: 95점 이상

## 2단계: 이미지 최적화

### 이미지 압축
1. **온라인 도구 사용**:
   - TinyPNG: https://tinypng.com
   - Compressor.io: https://compressor.io
   - Squoosh: https://squoosh.app

2. **압축할 이미지**:
   - 메인 페이지 배경 이미지
   - 실구매사례 이미지
   - 아이콘 및 로고

### 이미지 형식 최적화
```html
<!-- WebP 형식 사용 (선택사항) -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="설명">
</picture>
```

### 지연 로딩 확인
```html
<!-- 이미지 지연 로딩 -->
<img src="image.jpg" alt="설명" loading="lazy">
```

## 3단계: CSS/JS 최적화

### CSS 최적화
1. **불필요한 CSS 제거**
2. **Critical CSS 인라인화**
3. **CSS 압축**

### JavaScript 최적화
1. **불필요한 JS 제거**
2. **JS 압축**
3. **비동기 로딩**

### 예시 코드
```html
<!-- CSS 최적화 -->
<link rel="stylesheet" href="style.css" media="print" onload="this.media='all'">

<!-- JS 최적화 -->
<script src="script.js" defer></script>
```

## 4단계: 캐시 설정

### Netlify 캐시 설정
```toml
# netlify.toml
[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "*.png"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "*.jpg"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

### 브라우저 캐시
```html
<!-- HTML 메타 태그 -->
<meta http-equiv="Cache-Control" content="max-age=31536000">
```

## 5단계: CDN 최적화

### Netlify CDN 활용
- 자동 CDN 제공
- 전 세계 엣지 서버
- 자동 압축

### 외부 리소스 최적화
```html
<!-- Google Fonts 최적화 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Tailwind CSS CDN 최적화 -->
<script src="https://cdn.tailwindcss.com" defer></script>
```

## 6단계: 코드 분할

### 페이지별 최적화
1. **메인 페이지**: 핵심 기능만 로드
2. **의뢰 페이지**: 폼 관련 기능만 로드
3. **관리자 페이지**: 관리 기능만 로드

### 예시 구조
```
index.html → 핵심 CSS/JS
request-v2.html → 폼 CSS/JS
result-admin.html → 관리자 CSS/JS
```

## 7단계: 서버 응답 시간 최적화

### Netlify 최적화
1. **자동 배포 최적화**
2. **이미지 최적화 활성화**
3. **압축 활성화**

### 설정 확인
```toml
# netlify.toml
[build.processing]
  skip_processing = false

[build.processing.images]
  compress = true
```

## 8단계: 모바일 최적화

### 뷰포트 설정
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 터치 타겟 크기
```css
/* 최소 44px x 44px */
button, a {
  min-height: 44px;
  min-width: 44px;
}
```

### 폰트 크기 최적화
```css
/* 모바일에서 최소 16px */
body {
  font-size: 16px;
}
```

## 9단계: Core Web Vitals 최적화

### LCP (Largest Contentful Paint) 최적화
1. **이미지 최적화**
2. **Critical CSS 인라인화**
3. **서버 응답 시간 개선**

### FID (First Input Delay) 최적화
1. **JavaScript 최적화**
2. **이벤트 리스너 최적화**
3. **메인 스레드 블로킹 방지**

### CLS (Cumulative Layout Shift) 최적화
1. **이미지 크기 명시**
2. **동적 콘텐츠 공간 확보**
3. **폰트 로딩 최적화**

## 10단계: 성능 모니터링

### 실시간 모니터링
1. **Google Analytics 실시간**
2. **Netlify 대시보드**
3. **사용자 피드백**

### 정기 성능 체크
1. **주 1회 PageSpeed Insights 테스트**
2. **월 1회 Core Web Vitals 확인**
3. **분기 1회 전체 성능 점검**

## 성능 최적화 체크리스트

### 이미지 최적화
- [ ] 모든 이미지 압축 완료
- [ ] WebP 형식 적용 (선택사항)
- [ ] 지연 로딩 적용
- [ ] 적절한 이미지 크기 설정

### 코드 최적화
- [ ] CSS 압축 완료
- [ ] JavaScript 압축 완료
- [ ] 불필요한 코드 제거
- [ ] Critical CSS 인라인화

### 캐시 설정
- [ ] Netlify 캐시 설정
- [ ] 브라우저 캐시 설정
- [ ] CDN 최적화
- [ ] 정적 리소스 캐시

### 모바일 최적화
- [ ] 뷰포트 설정
- [ ] 터치 타겟 크기
- [ ] 폰트 크기 최적화
- [ ] 반응형 디자인 확인

### 성능 테스트
- [ ] PageSpeed Insights 90점 이상
- [ ] Core Web Vitals 통과
- [ ] 모바일 성능 확인
- [ ] 실제 사용자 테스트

## 목표 성능 지표

### 로딩 속도
- **First Contentful Paint**: 1.5초 이내
- **Largest Contentful Paint**: 2.5초 이내
- **Time to Interactive**: 3.5초 이내

### 사용자 경험
- **First Input Delay**: 100ms 이내
- **Cumulative Layout Shift**: 0.1 이내
- **Total Blocking Time**: 300ms 이내

### 성능 점수
- **모바일**: 90점 이상
- **데스크톱**: 95점 이상
- **접근성**: 90점 이상
- **SEO**: 90점 이상

## 다음 단계

성능 최적화 완료 후:
1. SEO 최적화
2. 소셜 미디어 설정
3. 마케팅 전략 수립
4. 사용자 피드백 수집 