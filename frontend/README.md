# YouTube DeepSearch Pro AI - 프론트엔드

시니어 특화 YouTube 콘텐츠 제작 AI 시스템의 React 기반 프론트엔드입니다.

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
cd D:\youtube\frontend
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 브라우저 접속
자동으로 `http://localhost:3000`이 열립니다.

## 🎯 주요 기능

### 📊 YouTube 검색 & 분석
- **고급 검색 필터**: 조회수, 업로드 기간, 동영상 길이 등
- **실시간 API 키 로테이션**: 여러 API 키 자동 관리
- **스마트 키워드 추천**: AI 기반 연관 키워드 분석

### 🤖 AI 콘텐츠 제작
- **시니어 특화 주제 생성**: 50대+ 타겟 맞춤 주제 추천
- **영상 스크립트 자동 생성**: 롱폼/숏폼별 완전한 스크립트
- **수익 예측 시스템**: 애드센스, 쿠팡파트너스 등 수익 계산

### 📈 데이터 분석 & 내보내기
- **엑셀 내보내기**: 선택된 검색 결과를 Excel 파일로 저장
- **실시간 트렌드 분석**: 급상승 키워드 및 계절성 분석
- **개인화 추천**: 사용자 검색 패턴 학습

## 🛠️ 기술 스택

- **React 18**: 최신 React 기능 활용
- **Vite**: 빠른 개발 환경
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **Lucide React**: 모던 아이콘 세트
- **SheetJS**: Excel 파일 생성

## 📱 시니어 친화적 디자인

### UX 특징
- **큰 글씨와 버튼**: 시력이 약한 사용자 배려
- **단순한 인터페이스**: 복잡하지 않은 직관적 디자인
- **명확한 피드백**: 로딩 상태와 결과를 명확히 표시
- **터치 친화적**: 모바일에서도 쉽게 사용 가능

### 컬러 시스템
- **고대비 색상**: 가독성 향상
- **색상별 의미**: 성공(녹색), 경고(노란색), 오류(빨간색)
- **시각적 구분**: 각 기능별 색상 구분

## 📁 프로젝트 구조

```
frontend/
├── src/
│   ├── YouTubeDeepSearch.jsx  # 메인 컴포넌트
│   ├── main.jsx              # 앱 엔트리 포인트
│   └── index.css             # 전역 스타일
├── package.json              # 의존성 및 스크립트
├── vite.config.js           # Vite 설정
├── tailwind.config.js       # Tailwind 설정
└── postcss.config.js        # PostCSS 설정
```

## 🔗 백엔드 연결

### 설정 방법
1. 백엔드 서버 URL 입력 (기본: `http://localhost:3001`)
2. YouTube Data API v3 키 입력
3. 검색 시작!

### API 통신
- **RESTful API**: JSON 기반 통신
- **에러 처리**: 자동 재시도 및 사용자 친화적 오류 메시지
- **로딩 상태**: 모든 비동기 작업에 대한 시각적 피드백

## 🎨 커스터마이징

### 테마 변경
`tailwind.config.js`에서 색상 팔레트 수정:

```javascript
colors: {
  primary: {
    500: '#your-color', // 메인 색상 변경
  }
}
```

### 컴포넌트 수정
- `YouTubeDeepSearch.jsx`: 메인 로직 및 UI
- `index.css`: 전역 스타일 및 커스텀 클래스

## 📊 성능 최적화

- **코드 분할**: 라이브러리별 청크 분리
- **이미지 최적화**: 썸네일 지연 로딩
- **메모화**: 불필요한 리렌더링 방지
- **번들 최적화**: Vite의 빠른 빌드 시스템

## 🚀 빌드 및 배포

### 프로덕션 빌드
```bash
npm run build
```

### 배포 옵션
- **Vercel**: `npm install -g vercel && vercel`
- **Netlify**: drag & drop `dist` 폴더
- **GitHub Pages**: GitHub Actions 사용

## 🔧 개발 팁

### 디버깅
- React DevTools 사용
- 브라우저 개발자 도구에서 네트워크 탭 확인
- 콘솔에서 API 응답 확인

### 성능 모니터링
- Lighthouse 점수 확인
- Core Web Vitals 측정
- 번들 크기 분석

## 📞 지원

문제가 발생하면:
1. 브라우저 콘솔 확인
2. 네트워크 연결 상태 확인
3. 백엔드 서버 상태 확인 (`/api/health`)
4. API 키 유효성 확인