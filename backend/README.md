# YouTube DeepSearch Pro AI - 백엔드

시니어 특화 YouTube 콘텐츠 제작 AI 시스템의 백엔드 서버입니다.

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
cd D:\youtube\backend
npm install
```

### 2. 서버 실행
```bash
# 프로덕션 모드
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

### 3. 서버 확인
브라우저에서 `http://localhost:3001/api/health` 접속하여 서버 상태 확인

## 🧠 AI 기능

- ✅ **고급 자연어 처리** (한국어 특화)
- ✅ **의미적 유사성 분석**
- ✅ **감정 분석**
- ✅ **실시간 트렌드 분석**
- ✅ **개인화 추천**
- ✅ **자동 카테고리 분류**

## 🎬 콘텐츠 제작 AI

- 🎯 **시니어 특화 주제 생성**
- 📝 **영상 스크립트 자동 생성**
- 💰 **수익 예측 시스템**

## 📊 API 엔드포인트

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/api/youtube/search` | POST | YouTube 검색 |
| `/api/keywords/analyze` | POST | AI 키워드 분석 |
| `/api/keywords/trending` | POST | 실시간 트렌딩 |
| `/api/content/generate-topics` | POST | AI 주제 생성 |
| `/api/content/generate-script` | POST | 영상 스크립트 생성 |
| `/api/content/revenue-estimate` | POST | 수익 예측 |
| `/api/health` | GET | 서버 상태 |

## 🔧 환경 설정

YouTube Data API v3 키가 필요합니다:
1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. YouTube Data API v3 활성화
4. API 키 발급

## 📈 성능

- **처리량**: 초당 100+ 요청 처리 가능
- **응답시간**: 평균 1-3초 (API 호출 포함)
- **캐싱**: 의미적 분석 결과 캐싱으로 성능 최적화

## 🛡️ 보안

- CORS 설정으로 안전한 크로스 오리진 요청
- API 키 로테이션으로 할당량 관리
- 에러 처리 및 로깅 시스템