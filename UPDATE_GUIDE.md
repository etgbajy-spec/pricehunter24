# 🔄 PriceHunter 업데이트 가이드

## 📋 업데이트 전 필수 단계

### 1. 데이터 백업
업데이트 전 반드시 데이터를 백업하세요!

**방법 1: 관리자 대시보드에서 백업**
1. 관리자 대시보드 접속
2. "데이터 관리" 탭 클릭
3. "📤 모든 데이터 내보내기" 버튼 클릭
4. 백업 파일 다운로드 완료 확인

**방법 2: 수동 백업**
1. 브라우저 개발자 도구 열기 (F12)
2. 콘솔에서 다음 명령어 실행:
```javascript
// 전체 데이터 백업
const backupData = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  backupData[key] = localStorage.getItem(key);
}
const dataStr = JSON.stringify(backupData, null, 2);
const blob = new Blob([dataStr], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `pricehunter-backup-${new Date().toISOString().split('T')[0]}.json`;
link.click();
```

### 2. 업데이트 실행
1. 새로운 파일들로 기존 파일 교체
2. 브라우저 캐시 삭제 (Ctrl + F5)
3. 페이지 새로고침

### 3. 데이터 복원
**방법 1: 관리자 대시보드에서 복원**
1. 관리자 대시보드 접속
2. "데이터 관리" 탭 클릭
3. "📥 데이터 가져오기" 버튼 클릭
4. 백업 파일 선택하여 업로드

**방법 2: 수동 복원**
1. 브라우저 개발자 도구 열기 (F12)
2. 백업 파일을 텍스트 에디터로 열기
3. 콘솔에서 다음 명령어 실행:
```javascript
// 백업 데이터를 여기에 붙여넣기
const backupData = { /* 백업 데이터 */ };
Object.keys(backupData).forEach(key => {
  localStorage.setItem(key, backupData[key]);
});
location.reload();
```

## 🚀 자동화된 데이터 관리

### 자동 백업 설정
관리자 대시보드에서 "⚙️ 자동 백업 설정" 버튼을 클릭하면 매일 자정에 자동으로 백업이 생성됩니다.

### 데이터 마이그레이션
업데이트 후 "🔄 데이터 마이그레이션" 버튼을 클릭하면 데이터 구조를 자동으로 업데이트합니다.

## ⚠️ 주의사항

1. **업데이트 전 반드시 백업**: 데이터 손실 방지
2. **브라우저 캐시 삭제**: 새로운 파일 적용을 위해 필수
3. **백업 파일 안전 보관**: 여러 곳에 백업 파일 저장
4. **테스트 환경에서 먼저 시험**: 실제 운영 전 테스트

## 🔧 문제 해결

### 데이터가 사라진 경우
1. 백업 파일 확인
2. 관리자 대시보드 → "📥 데이터 가져오기" 실행
3. 여전히 문제가 있으면 "🔄 데이터 마이그레이션" 실행

### 업데이트 후 오류 발생
1. 브라우저 캐시 완전 삭제
2. 페이지 새로고침
3. "🔄 데이터 마이그레이션" 실행
4. 여전히 문제가 있으면 백업에서 복원

## 📞 지원

문제가 발생하면 다음 정보와 함께 문의해주세요:
- 브라우저 종류 및 버전
- 오류 메시지
- 백업 파일 (가능한 경우)
- 업데이트 전후 상황
