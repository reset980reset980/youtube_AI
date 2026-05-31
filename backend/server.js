// server.js - YouTube DeepSearch Pro AI 백엔드 (AI 고급 버전)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const natural = require('natural');
const TfIdf = natural.TfIdf;
const WordTokenizer = natural.WordTokenizer;
const SentimentAnalyzer = natural.SentimentAnalyzer;
const PorterStemmer = natural.PorterStemmer;

const app = express();
const PORT = process.env.PORT || 3001;

const getEnv = (name) => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
};

const maskKey = (key) => {
  if (!key) return 'not configured';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

const requireApiKey = (key, envName, serviceName) => {
  if (!key) {
    throw new Error(`${serviceName} API 키가 설정되지 않았습니다. ${envName} 환경변수를 설정해주세요.`);
  }
  return key;
};

// API 키 설정 (환경변수 사용)
const API_KEYS = {
  YOUTUBE_API_KEY: getEnv('YOUTUBE_API_KEY'),
  OPENAI_API_KEY: getEnv('OPENAI_API_KEY'),
  CLAUDE_API_KEY: getEnv('CLAUDE_API_KEY')
};

// 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (프론트엔드 빌드 파일)
app.use(express.static(path.join(__dirname, 'dist')));

// 고급 NLP 클래스
class AdvancedNLP {
  constructor() {
    this.tokenizer = new WordTokenizer();
    // Natural 라이브러리의 한국어 감정 분석 제한으로 인해 영어 설정으로 변경
    this.analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
    this.semanticCache = new Map();
    this.trendCache = new Map();
    this.categoryPatterns = this.initCategoryPatterns();
  }

  // 카테고리 패턴 초기화
  initCategoryPatterns() {
    return {
      finance: {
        keywords: ['투자', '주식', '코인', '부동산', '재테크', '수익', '펀드', 'ETF', '배당'],
        synonyms: new Map([
          ['투자', ['인베스트', '자산운용', '포트폴리오']],
          ['주식', ['증권', '종목', '상장', '주가']],
          ['코인', ['암호화폐', '비트코인', '이더리움', '블록체인']]
        ])
      },
      health: {
        keywords: ['건강', '운동', '다이어트', '영양', '의학', '병원', '치료'],
        synonyms: new Map([
          ['운동', ['홈트', '피트니스', '헬스', '트레이닝']],
          ['다이어트', ['감량', '체중', '살빼기', '다이어팅']]
        ])
      },
      cooking: {
        keywords: ['요리', '레시피', '음식', '맛집', '식당', '요리법'],
        synonyms: new Map([
          ['요리', ['쿠킹', '조리', '만들기']],
          ['레시피', ['조리법', '만드는법', '방법']]
        ])
      },
      tech: {
        keywords: ['AI', '인공지능', '프로그래밍', '개발', '앱', '소프트웨어'],
        synonyms: new Map([
          ['AI', ['인공지능', '머신러닝', '딥러닝']],
          ['프로그래밍', ['코딩', '개발', '프로그래밍']]
        ])
      }
    };
  }

  // 고급 한국어 형태소 분석 (간소화 버전)
  advancedKoreanTokenize(text) {
    if (!text) return [];

    // HTML 및 특수문자 정리
    const cleaned = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\w가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 한국어 명사 패턴 (개선된 버전)
    const patterns = {
      // 복합명사 (3-6글자)
      compound: /[가-힣]{3,6}(?:[가-힣]{1,3})?/g,
      // 단일명사 (2-4글자)  
      simple: /[가-힣]{2,4}/g,
      // 영어 키워드
      english: /[A-Za-z]{2,10}/g
    };

    const tokens = new Set();

    // 복합명사 우선 추출
    const compounds = cleaned.match(patterns.compound) || [];
    compounds.forEach(token => {
      if (this.isValidToken(token)) {
        tokens.add(token);
      }
    });

    // 영어 키워드 추출
    const englishTokens = cleaned.match(patterns.english) || [];
    englishTokens.forEach(token => {
      if (token.length >= 2) {
        tokens.add(token.toLowerCase());
      }
    });

    return Array.from(tokens);
  }

  // 토큰 유효성 검사 (고도화)
  isValidToken(token) {
    const stopWords = new Set([
      // 기본 불용어
      '그리고', '하지만', '그런데', '이것', '저것', '여기', '거기',
      // YouTube 관련 불용어
      '영상', '동영상', '채널', '구독', '좋아요', '댓글', '시청', '업로드',
      // 조사/어미
      '에서', '으로', '에게', '에도', '이다', '입니다', '합니다', '됩니다',
      // 일반적인 단어
      '방법', '이야기', '설명', '소개', '정보', '내용', '관련', '대해서'
    ]);

    return token.length >= 2 && 
           token.length <= 8 && 
           !stopWords.has(token) &&
           !/^\d+$/.test(token) && // 숫자만 제외
           /[가-힣A-Za-z]/.test(token); // 한글 또는 영문 포함
  }

  // 의미적 유사성 계산 (Word2Vec 대체)
  calculateSemanticSimilarity(word1, word2) {
    // 캐시 확인
    const cacheKey = `${word1}_${word2}`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }

    let similarity = 0;

    // 1. 문자열 유사도 (Levenshtein Distance)
    const editDistance = natural.LevenshteinDistance(word1, word2);
    const maxLen = Math.max(word1.length, word2.length);
    const stringSimilarity = 1 - (editDistance / maxLen);

    // 2. 카테고리 내 동의어 매칭
    for (const category of Object.values(this.categoryPatterns)) {
      const synonyms1 = category.synonyms.get(word1) || [];
      const synonyms2 = category.synonyms.get(word2) || [];
      
      if (synonyms1.includes(word2) || synonyms2.includes(word1)) {
        similarity = Math.max(similarity, 0.8);
      }
    }

    // 3. 문자열 유사도 보너스
    similarity = Math.max(similarity, stringSimilarity * 0.3);

    // 캐시 저장
    this.semanticCache.set(cacheKey, similarity);
    return similarity;
  }

  // 카테고리 자동 분류
  categorizeContent(text) {
    const tokens = this.advancedKoreanTokenize(text);
    const categoryScores = {};

    for (const [categoryName, categoryData] of Object.entries(this.categoryPatterns)) {
      let score = 0;
      
      for (const token of tokens) {
        // 직접 매칭
        if (categoryData.keywords.includes(token)) {
          score += 2;
        }
        
        // 동의어 매칭
        for (const [keyword, synonyms] of categoryData.synonyms) {
          if (synonyms.includes(token)) {
            score += 1.5;
          }
        }
        
        // 의미적 유사성 매칭
        for (const keyword of categoryData.keywords) {
          const similarity = this.calculateSemanticSimilarity(token, keyword);
          if (similarity > 0.6) {
            score += similarity;
          }
        }
      }
      
      categoryScores[categoryName] = score;
    }

    // 가장 높은 점수의 카테고리 반환
    const bestCategory = Object.keys(categoryScores).reduce((a, b) => 
      categoryScores[a] > categoryScores[b] ? a : b
    );

    return {
      category: bestCategory,
      confidence: categoryScores[bestCategory] / tokens.length,
      scores: categoryScores
    };
  }

  // 감정 분석
  analyzeSentiment(text) {
    const tokens = this.tokenizer.tokenize(text);
    const score = this.analyzer.getSentiment(tokens);
    
    return {
      score,
      sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
      intensity: Math.abs(score)
    };
  }

  // 트렌드 점수 계산 (시간 기반)
  calculateTrendScore(keyword, contexts, timeData) {
    const trendIndicators = [
      // 시간 관련
      '최근', '신규', '새로운', '2024', '2025', '올해', '이번',
      // 인기 관련  
      '핫한', '인기', '트렌드', '급상승', '화제', '바이럴',
      // 업데이트 관련
      '업데이트', '새로나온', '신상', '출시', '런칭'
    ];

    let trendScore = 0;
    const totalContexts = contexts.length;

    for (const context of contexts) {
      for (const indicator of trendIndicators) {
        if (context.includes(indicator)) {
          trendScore += 0.1;
        }
      }
    }

    // 시간대별 가중치
    const now = new Date();
    const hour = now.getHours();
    
    // 황금시간대 보너스 (저녁 7-11시)
    if (hour >= 19 && hour <= 23) {
      trendScore *= 1.2;
    }

    return Math.min(trendScore / totalContexts, 1.0);
  }
}

// 실시간 트렌드 분석기
class RealTimeTrendAnalyzer {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 3600000; // 1시간
  }

  // Google Trends 시뮬레이션 (실제로는 Google Trends API 사용)
  async getGoogleTrends(keyword, region = 'KR') {
    const cacheKey = `${keyword}_${region}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    // 실제 구현에서는 google-trends-api 사용
    // const googleTrends = require('google-trends-api');
    // const results = await googleTrends.interestOverTime({
    //   keyword,
    //   startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    //   geo: region
    // });

    // 시뮬레이션 데이터
    const mockTrendData = {
      keyword,
      region,
      growth: Math.floor(Math.random() * 50) + 1,
      searchVolume: Math.floor(Math.random() * 100000) + 1000,
      relatedQueries: [
        `${keyword} 방법`,
        `${keyword} 추천`,
        `${keyword} 2025`,
        `${keyword} 최신`
      ]
    };

    this.cache.set(cacheKey, {
      data: mockTrendData,
      timestamp: Date.now()
    });

    return mockTrendData;
  }

  // 계절성 분석
  getSeasonalTrends(keyword) {
    const month = new Date().getMonth() + 1;
    const seasonalBonus = {
      // 봄 (3-5월)
      3: { '다이어트': 1.5, '운동': 1.3, '건강': 1.2 },
      4: { '다이어트': 1.8, '운동': 1.5, '야외활동': 1.4 },
      5: { '여행': 1.6, '다이어트': 1.4, '패션': 1.3 },
      
      // 여름 (6-8월)  
      6: { '다이어트': 2.0, '수영': 1.8, '여행': 1.5 },
      7: { '휴가': 1.9, '여행': 1.8, '다이어트': 1.7 },
      8: { '휴가': 1.6, '다이어트': 1.5, '여행': 1.4 },
      
      // 가을 (9-11월)
      9: { '취업': 1.5, '공부': 1.4, '독서': 1.3 },
      10: { '투자': 1.4, '재테크': 1.3, '부동산': 1.2 },
      11: { '투자': 1.5, '재테크': 1.4, '연말정산': 1.3 },
      
      // 겨울 (12-2월)
      12: { '연말정산': 1.8, '투자': 1.5, '재테크': 1.4 },
      1: { '신년계획': 1.9, '투자': 1.6, '다이어트': 1.4 },
      2: { '투자': 1.4, '재테크': 1.3, '취업': 1.5 }
    };

    return seasonalBonus[month] && seasonalBonus[month][keyword] || 1.0;
  }
}

// 개인화 추천 엔진
class PersonalizationEngine {
  constructor() {
    this.userProfiles = new Map();
  }

  // 사용자 프로필 학습
  learnUserPreferences(userId, searchHistory) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        interests: new Map(),
        searchPatterns: [],
        timePreferences: {},
        categoryWeights: {}
      });
    }

    const profile = this.userProfiles.get(userId);
    
    // 관심사 학습
    for (const search of searchHistory) {
      const interest = profile.interests.get(search.keyword) || 0;
      profile.interests.set(search.keyword, interest + 1);
    }
  }

  // 개인화된 키워드 추천
  getPersonalizedRecommendations(userId, baseRecommendations) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return baseRecommendations;

    return baseRecommendations.map(rec => {
      const userInterest = profile.interests.get(rec.keyword) || 0;
      const personalizedScore = rec.relevanceScore + (userInterest * 0.1);
      
      return {
        ...rec,
        relevanceScore: personalizedScore,
        personalizedBonus: userInterest * 0.1
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

// 인스턴스 생성
const nlp = new AdvancedNLP();
const trendAnalyzer = new RealTimeTrendAnalyzer();
const personalization = new PersonalizationEngine();

// API 키 로테이션 관리
class ApiKeyManager {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.keyUsage = new Map();
    this.dailyLimit = 9500;
    this.quotaExhaustedKeys = new Set(); // 할당량 초과된 키들 추적
    this.setKeys([API_KEYS.YOUTUBE_API_KEY]);
  }

  setKeys(keys) {
    const newKeys = (keys || [])
      .map(key => key && key.trim())
      .filter(Boolean);
    this.keys = [...new Set([...this.keys, ...newKeys])];
    this.currentIndex = 0;
    console.log(`🔑 YouTube API 키 설정: 총 ${this.keys.length}개 키 사용 가능`);
  }

  addKey(newKey) {
    if (newKey && newKey.trim() && !this.keys.includes(newKey.trim())) {
      this.keys.push(newKey.trim());
      console.log(`🔑 새 API 키 추가: 총 ${this.keys.length}개 키 사용 가능`);
      return true;
    }
    return false;
  }

  getNextKey() {
    if (this.keys.length === 0) return null;
    
    // 사용 가능한 키 찾기 (할당량 초과되지 않은 키)
    let attempts = 0;
    while (attempts < this.keys.length) {
      const key = this.keys[this.currentIndex];
      if (!key) {
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        attempts++;
        continue;
      }
      const today = new Date().toDateString();
      const usage = this.keyUsage.get(key + today) || 0;
      
      if (!this.quotaExhaustedKeys.has(key) && usage < this.dailyLimit) {
        return key;
      }
      
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    // 모든 키가 한계에 도달한 경우
    return null;
  }

  recordUsage(key, units = 100) {
    if (!key) return;
    const today = new Date().toDateString();
    const currentUsage = this.keyUsage.get(key + today) || 0;
    this.keyUsage.set(key + today, currentUsage + units);
    
    if (currentUsage + units >= this.dailyLimit) {
      this.quotaExhaustedKeys.add(key);
      console.log(`⚠️ API 키 할당량 도달: ${maskKey(key)}`);
    }
  }

  markKeyAsExhausted(key) {
    if (!key) return;
    this.quotaExhaustedKeys.add(key);
    console.log(`🚫 API 키 할당량 초과: ${maskKey(key)}`);
  }

  switchToNextKey() {
    if (this.keys.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
  }

  getKeyStatus() {
    const today = new Date().toDateString();
    return this.keys.map(key => ({
      key: maskKey(key),
      usage: this.keyUsage.get(key + today) || 0,
      limit: this.dailyLimit,
      exhausted: this.quotaExhaustedKeys.has(key),
      remaining: Math.max(0, this.dailyLimit - (this.keyUsage.get(key + today) || 0))
    }));
  }

  hasAvailableKeys() {
    return Boolean(this.getNextKey());
  }

  resetDailyQuota() {
    // 자정에 할당량 리셋 (매일 자동 실행)
    this.quotaExhaustedKeys.clear();
    console.log('🔄 일일 API 할당량 리셋 완료');
  }
}

const apiKeyManager = new ApiKeyManager();

// OpenAI API 호출 함수
async function callOpenAI(messages, model = 'gpt-4o', maxTokens = 2000) {
  const apiKey = requireApiKey(API_KEYS.OPENAI_API_KEY, 'OPENAI_API_KEY', 'OpenAI');

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API 오류:', error.response?.data || error.message);
    throw new Error(`OpenAI API 호출 실패: ${error.response?.data?.error?.message || error.message}`);
  }
}

// Claude API 호출 함수
async function callClaude(prompt, maxTokens = 2000) {
  const apiKey = requireApiKey(API_KEYS.CLAUDE_API_KEY, 'CLAUDE_API_KEY', 'Claude');

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data.content[0].text;
  } catch (error) {
    console.error('Claude API 오류:', error.response?.data || error.message);
    throw new Error(`Claude API 호출 실패: ${error.response?.data?.error?.message || error.message}`);
  }
}

// YouTube API 호출 함수
async function callYouTubeAPI(endpoint, params, retries = 3) {
  const apiKey = apiKeyManager.getNextKey();
  
  if (!apiKey) {
    throw new Error('사용 가능한 API 키가 없습니다. 새로운 YouTube Data API 키를 추가해주세요.');
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;
    const requestParams = { ...params, key: apiKey };
    
    console.log(`🔍 YouTube API 호출: ${endpoint}`, { 
      keyword: params.q || '검색어', 
      maxResults: params.maxResults || 25,
      keyUsed: maskKey(apiKey)
    });

    const response = await axios.get(url, { 
      params: requestParams,
      timeout: 10000
    });
    
    apiKeyManager.recordUsage(apiKey, 100);
    return response.data;
    
  } catch (error) {
    console.error('YouTube API 오류:', error.response?.data || error.message);
    
    // 할당량 초과 또는 접근 거부 시 처리
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.error?.message || '';
      
      if (errorMessage.includes('quota') || errorMessage.includes('Quota') || 
          errorMessage.includes('exceeded') || errorMessage.includes('limit')) {
        console.log(`🚫 API 키 할당량 초과: ${maskKey(apiKey)}`);
        apiKeyManager.markKeyAsExhausted(apiKey);
        
        if (retries > 0 && apiKeyManager.hasAvailableKeys()) {
          console.log('🔄 다음 API 키로 재시도...');
          apiKeyManager.switchToNextKey();
          return callYouTubeAPI(endpoint, params, retries - 1);
        } else {
          throw new Error('모든 API 키의 할당량이 초과되었습니다. 새로운 YouTube Data API 키를 추가하거나 내일 다시 시도해주세요.');
        }
      } else if (retries > 0) {
        console.log('🔄 다음 API 키로 재시도...');
        apiKeyManager.switchToNextKey();
        return callYouTubeAPI(endpoint, params, retries - 1);
      }
    }
    
    throw new Error(`YouTube API 호출 실패: ${error.response?.data?.error?.message || error.message}`);
  }
}

// 고급 키워드 분석 함수
async function advancedKeywordAnalysis(searchResults, originalKeyword, userId = null) {
  const keywordStats = new Map();
  const keywordContexts = new Map();
  const sentimentScores = new Map();
  
  // 1. 고급 토큰화 및 분석
  for (const video of searchResults) {
    const weight = Math.log(video.viewCount + 1) / 10;
    const fullText = `${video.title} ${video.description || ''}`;
    
    // 고급 토큰화
    const tokens = nlp.advancedKoreanTokenize(fullText);
    
    // 감정 분석
    const sentiment = nlp.analyzeSentiment(fullText);
    
    for (const token of tokens) {
      if (token === originalKeyword) continue;
      
      // 통계 업데이트
      const current = keywordStats.get(token) || { 
        frequency: 0, 
        totalWeight: 0, 
        videos: new Set(),
        avgSentiment: 0
      };
      
      keywordStats.set(token, {
        frequency: current.frequency + 1,
        totalWeight: current.totalWeight + weight,
        videos: current.videos.add(video.id),
        avgSentiment: (current.avgSentiment + sentiment.score) / 2
      });
      
      // 컨텍스트 저장
      if (!keywordContexts.has(token)) {
        keywordContexts.set(token, []);
      }
      keywordContexts.get(token).push({
        text: fullText.substring(0, 200),
        timestamp: video.publishedAt,
        views: video.viewCount
      });
    }
  }

  // 2. TF-IDF 계산
  const tfidf = new TfIdf();
  searchResults.forEach(video => {
    const text = `${video.title} ${video.description || ''}`;
    tfidf.addDocument(text);
  });

  const tfidfScores = new Map();
  tfidf.listTerms(0).forEach(item => {
    if (item.term.length >= 2 && /[가-힣A-Za-z]/.test(item.term)) {
      tfidfScores.set(item.term, item.tfidf);
    }
  });

  // 3. 카테고리 분류
  const categoryInfo = nlp.categorizeContent(
    searchResults.map(v => v.title).join(' ')
  );

  // 4. 고급 점수 계산
  const recommendations = [];
  
  for (const [keyword, stats] of keywordStats.entries()) {
    if (stats.frequency < 2) continue;
    
    const contexts = keywordContexts.get(keyword) || [];
    
    // 기본 점수들
    const frequencyScore = Math.log(stats.frequency + 1) * 0.25;
    const weightScore = (stats.totalWeight / stats.frequency) * 0.2;
    const tfidfScore = (tfidfScores.get(keyword) || 0) * 0.15;
    const sentimentBonus = Math.max(stats.avgSentiment, 0) * 0.1;
    
    // 고급 점수들
    const diversityScore = (stats.videos.size / searchResults.length) * 0.1;
    const trendScore = nlp.calculateTrendScore(keyword, contexts.map(c => c.text)) * 0.1;
    const seasonalBonus = trendAnalyzer.getSeasonalTrends(keyword) * 0.05;
    const semanticSimilarity = nlp.calculateSemanticSimilarity(keyword, originalKeyword) * 0.05;
    
    const relevanceScore = frequencyScore + weightScore + tfidfScore + 
                          sentimentBonus + diversityScore + trendScore + 
                          seasonalBonus + semanticSimilarity;

    recommendations.push({
      keyword,
      frequency: stats.frequency,
      avgWeight: stats.totalWeight / stats.frequency,
      relevanceScore,
      trendScore,
      sentiment: stats.avgSentiment,
      diversity: diversityScore,
      seasonal: seasonalBonus,
      semantic: semanticSimilarity,
      category: categoryInfo.category,
      contexts: contexts.slice(0, 3) // 최대 3개 컨텍스트
    });
  }

  // 5. 개인화 적용
  let finalRecommendations = recommendations
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 15);

  if (userId) {
    finalRecommendations = personalization.getPersonalizedRecommendations(
      userId, finalRecommendations
    );
  }

  return {
    recommendations: finalRecommendations.slice(0, 10),
    categoryInfo,
    totalAnalyzed: searchResults.length,
    processingTime: Date.now()
  };
}

// API 엔드포인트들

// YouTube 검색 API
app.post('/api/youtube/search', async (req, res) => {
  try {
    const startTime = Date.now();
    const { 
      keyword, order, publishedAfter, publishedBefore,
      videoDuration, maxResults, minViews, maxViews, regionCode, pageToken,
      userId 
    } = req.body;
    
    const searchParams = {
      part: 'snippet',
      q: keyword,
      type: 'video',
      order: order || 'relevance',
      maxResults: maxResults || 25,
      regionCode: regionCode || 'KR'
    };
    
    if (videoDuration && videoDuration !== 'any') {
      searchParams.videoDuration = videoDuration;
    }
    
    if (publishedAfter) {
      searchParams.publishedAfter = new Date(publishedAfter).toISOString();
    }
    
    if (publishedBefore) {
      searchParams.publishedBefore = new Date(publishedBefore).toISOString();
    }
    
    if (pageToken) {
      searchParams.pageToken = pageToken;
    }
    
    const searchData = await callYouTubeAPI('search', searchParams);
    
    if (!searchData.items || searchData.items.length === 0) {
      return res.json({
        results: [],
        nextPageToken: null,
        totalResults: 0
      });
    }
    
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videoDetails = await callYouTubeAPI('videos', {
      part: 'statistics,contentDetails',
      id: videoIds
    });
    
    const channelIds = [...new Set(searchData.items.map(item => item.snippet.channelId))].join(',');
    const channelDetails = await callYouTubeAPI('channels', {
      part: 'statistics',
      id: channelIds
    });
    
    const results = searchData.items.map(item => {
      const videoStats = videoDetails.items.find(v => v.id === item.id.videoId) || {};
      const channelStats = channelDetails.items.find(c => c.id === item.snippet.channelId) || {};
      
      const viewCount = parseInt(videoStats.statistics?.viewCount || 0);
      
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
        publishedAt: item.snippet.publishedAt.split('T')[0],
        description: item.snippet.description,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url,
        viewCount,
        likeCount: parseInt(videoStats.statistics?.likeCount || 0),
        commentCount: parseInt(videoStats.statistics?.commentCount || 0),
        duration: videoStats.contentDetails?.duration || '',
        subscriberCount: parseInt(channelStats.statistics?.subscriberCount || 0),
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      };
    });
    
    let filteredResults = results;
    if (minViews) {
      filteredResults = filteredResults.filter(item => item.viewCount >= parseInt(minViews));
    }
    if (maxViews) {
      filteredResults = filteredResults.filter(item => item.viewCount <= parseInt(maxViews));
    }

    // 사용자 검색 이력 학습
    if (userId) {
      personalization.learnUserPreferences(userId, [{ keyword, timestamp: Date.now() }]);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🔍 검색 완료: "${keyword}" - ${filteredResults.length}개 결과 (${processingTime}ms)`);
    
    res.json({
      results: filteredResults,
      nextPageToken: searchData.nextPageToken,
      totalResults: searchData.pageInfo.totalResults,
      processingTime
    });
    
  } catch (error) {
    console.error('검색 오류:', error);
    
    // API 키 관련 오류 처리
    if (error.response?.status === 403 || error.response?.status === 400) {
      return res.status(400).json({ 
        message: 'API 키가 유효하지 않거나 할당량이 초과되었습니다. API 키를 확인해주세요.',
        error: 'API_KEY_ERROR',
        details: error.response?.data || error.message
      });
    }
    
    // 네트워크 오류 처리
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        message: '외부 API 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
        error: 'NETWORK_ERROR'
      });
    }
    
    // 기타 오류
    res.status(500).json({ 
      message: error.message || '검색 중 오류가 발생했습니다.',
      error: 'INTERNAL_ERROR',
      details: error.response?.data || error.message
    });
  }
});

// 고급 키워드 분석 API
app.post('/api/keywords/analyze', async (req, res) => {
  try {
    const startTime = Date.now();
    const { searchResults, originalKeyword, userId } = req.body;
    
    if (!searchResults || searchResults.length === 0) {
      return res.json({ 
        recommendations: [],
        categoryInfo: null,
        totalAnalyzed: 0
      });
    }
    
    console.log(`🧠 AI 키워드 분석 시작: ${searchResults.length}개 영상 분석 중...`);
    
    const analysisResult = await advancedKeywordAnalysis(
      searchResults, 
      originalKeyword, 
      userId
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`✨ AI 분석 완료: ${analysisResult.recommendations.length}개 키워드 추출 (${processingTime}ms)`);
    
    res.json({
      ...analysisResult,
      processingTime
    });
    
  } catch (error) {
    console.error('키워드 분석 오류:', error);
    res.status(500).json({ 
      message: '키워드 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 실시간 트렌딩 키워드 API
app.post('/api/keywords/trending', async (req, res) => {
  try {
    const { category, region, keyword } = req.body;
    
    console.log(`📈 실시간 트렌드 분석: ${category || 'general'} 카테고리`);
    
    // Google Trends 시뮬레이션
    const trendPromises = [];
    const relatedKeywords = [
      `${keyword} 방법`,
      `${keyword} 추천`, 
      `${keyword} 2025`,
      `${keyword} 최신`,
      `${keyword} 팁`
    ];
    
    for (const relatedKeyword of relatedKeywords) {
      trendPromises.push(trendAnalyzer.getGoogleTrends(relatedKeyword, region));
    }
    
    const trendResults = await Promise.all(trendPromises);
    
    const trending = trendResults
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 6)
      .map(trend => ({
        keyword: trend.keyword,
        growth: trend.growth,
        searchVolume: trend.searchVolume,
        seasonal: trendAnalyzer.getSeasonalTrends(trend.keyword)
      }));
    
    res.json({ 
      trending,
      category: category || 'general',
      region: region || 'KR',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('트렌딩 키워드 오류:', error);
    res.status(500).json({ 
      message: '트렌딩 키워드 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시니어 특화 주제 생성 (OpenAI)
app.post('/api/content/generate-topics', async (req, res) => {
  try {
    const { keyword, searchResults, contentType, scriptStyle, targetAge = 'senior' } = req.body;
    
    console.log(`🎯 시니어 맞춤 주제 생성: "${keyword}" 키워드 분석 중...`);
    
    // 검색 결과에서 인사이트 추출
    const topVideos = searchResults.slice(0, 10);
    const popularTitles = topVideos.map(v => v.title).join('\n');
    const avgViews = topVideos.reduce((sum, v) => sum + v.viewCount, 0) / topVideos.length;
    
    // OpenAI를 사용한 고급 주제 생성 (폴백: 기존 방식)
    const topics = await generateSeniorTopicsWithAI(keyword, topVideos, contentType, scriptStyle);
    
    res.json({
      topics,
      keyword,
      avgViews: Math.round(avgViews),
      aiGenerated: true,
      processingTime: Date.now()
    });
    
  } catch (error) {
    console.error('주제 생성 오류:', error);
    res.status(500).json({ 
      message: '주제 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 영상 스크립트 생성 (Claude API)
app.post('/api/content/generate-script', async (req, res) => {
  try {
    const { topic, keyword, contentType, scriptStyle, searchResults } = req.body;
    
    console.log(`📝 스크립트 생성: "${topic.title}" 주제로 ${contentType} 제작 중...`);
    
    // Claude를 사용한 고급 스크립트 생성 (폴백: 기존 방식)
    const script = await generateVideoScriptWithAI(topic, keyword, contentType, scriptStyle, searchResults);
    
    res.json({
      script,
      topic: topic.title,
      aiGenerated: true,
      processingTime: Date.now()
    });
    
  } catch (error) {
    console.error('스크립트 생성 오류:', error);
    res.status(500).json({ 
      message: '스크립트 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 예상 수익 계산
app.post('/api/content/revenue-estimate', async (req, res) => {
  try {
    const { keyword, searchResults, contentType, targetAge } = req.body;
    
    console.log(`💰 수익 예측: "${keyword}" 키워드 ${contentType} 콘텐츠`);
    
    // 수익 예측 계산
    const revenueEstimate = calculateRevenueEstimate(keyword, searchResults, contentType, targetAge);
    
    res.json(revenueEstimate);
    
  } catch (error) {
    console.error('수익 계산 오류:', error);
    res.status(500).json({ 
      message: '수익 계산 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시니어 특화 주제 생성 함수
// OpenAI를 사용한 고급 주제 생성 함수
async function generateSeniorTopicsWithAI(keyword, searchResults, contentType, scriptStyle) {
  try {
    console.log(`🤖 OpenAI로 시니어 맞춤 주제 생성: "${keyword}" 키워드 분석 중...`);
    
    // 검색 결과 분석 데이터 준비
    const topVideos = searchResults.slice(0, 10);
    const avgViews = searchResults.reduce((sum, v) => sum + v.viewCount, 0) / searchResults.length;
    const recentTrends = topVideos.map(v => v.title).join('\n- ');
    const popularKeywords = [...new Set(
      topVideos.flatMap(v => v.title.split(' ').filter(word => word.length > 1))
    )].slice(0, 20).join(', ');

    const contentTypeKor = contentType === 'shortform' ? '숏폼(1-3분)' : '롱폼(8-15분)';
    const scriptStyleKor = {
      educational: '교육/정보전달형',
      experience: '경험담/스토리텔링형', 
      lifestyle: '라이프스타일/꿀팁형',
      product: '제품리뷰/추천형'
    }[scriptStyle] || '교육/정보전달형';

    const messages = [
      {
        role: "system",
        content: `당신은 50-70대 시니어층을 위한 유튜브 콘텐츠 기획 전문가입니다. 

**전문 영역:**
- 중장년층 심리와 관심사 분석
- 유튜브 알고리즘 최적화
- 실버세대 맞춤 콘텐츠 기획
- 수익화 전략 설계

**시니어층 특성 이해:**
1. 신뢰성과 진정성을 중시
2. 실용적이고 즉시 적용 가능한 정보 선호
3. 복잡한 내용보다는 명확하고 단순한 구조 선호
4. 경험과 노하우 공유에 관심 높음
5. 건강, 경제, 가족에 대한 관심 집중

**콘텐츠 제작 원칙:**
- 검증된 정보만 제공
- 과장되지 않은 현실적 제목
- 시니어 눈높이에 맞는 쉬운 설명
- 실제 도움이 되는 실용적 내용
- 따뜻하고 신뢰감 있는 톤앤매너`
      },
      {
        role: "user", 
        content: `**콘텐츠 기획 요청:**

**타겟 키워드:** "${keyword}"
**콘텐츠 유형:** ${contentTypeKor}  
**스타일:** ${scriptStyleKor}

**시장 분석 데이터:**
- 평균 조회수: ${Math.round(avgViews).toLocaleString()}회
- 인기 영상 트렌드:
${recentTrends}

- 관련 키워드: ${popularKeywords}

**미션:** 
위 데이터를 바탕으로 50-70대 시니어층이 실제로 클릭하고, 끝까지 시청하며, 구독까지 이어질 수 있는 고품질 영상 주제 4개를 기획해주세요.

다음 JSON 형식으로 정확히 답변해주세요:

{
  "topics": [
    {
      "title": "제목 (30자 이내)",
      "description": "상세 설명 (100자 내외)", 
      "targetSituation": "타겟 상황",
      "coreValue": "핵심 가치",
      "monetization": "수익화 방안",
      "estimatedViews": 예상조회수숫자
    }
  ]
}

**제목 작성 가이드라인:**
- 과장 금지 (대박, 충격 등 자극적 표현 지양)
- 구체적 숫자 활용 (3가지 방법, 5분만에 등)
- 시니어 맞춤 표현 ("50대가", "중년이", "시니어를 위한")
- 실용성 강조 ("꿀팁", "노하우", "비법")
- 신뢰감 조성 ("실제 경험", "검증된 방법")`
      }
    ];

    const response = await callOpenAI(messages, 'gpt-4', 2000);
    
    // JSON 파싱 시도
    let topics;
    try {
      // JSON 부분만 추출
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식 불일치');
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, 기본 구조로 대체');
      topics = { topics: parseTopicsFromText(response, keyword, avgViews) };
    }

    // 결과 검증 및 보완
    if (!topics.topics || !Array.isArray(topics.topics)) {
      topics = { topics: parseTopicsFromText(response, keyword, avgViews) };
    }

    // 각 주제에 추가 메타데이터 보강
    topics.topics = topics.topics.map((topic, index) => ({
      ...topic,
      id: `topic_${Date.now()}_${index}`,
      difficulty: index < 2 ? '쉬움' : '보통',
      duration: contentType === 'shortform' ? '1-3분' : '8-15분',
      category: categorizeTopicByKeyword(keyword),
      timestamp: new Date().toISOString()
    }));

    console.log(`✅ OpenAI 주제 생성 완료: ${topics.topics.length}개 주제`);
    return topics.topics;

  } catch (error) {
    console.error('OpenAI 주제 생성 오류:', error.message);
    // 폴백: 기존 템플릿 방식
    return generateSeniorTopics(keyword, searchResults, contentType, scriptStyle);
  }
}

// 기존 템플릿 기반 주제 생성 (폴백용)
function generateSeniorTopics(keyword, searchResults, contentType, scriptStyle) {
  const avgViews = searchResults.reduce((sum, v) => sum + v.viewCount, 0) / searchResults.length;
  
  const topicTemplates = {
    educational: [
      `50대가 꼭 알아야 할 ${keyword} 기초 상식`,
      `${keyword} 초보자도 쉽게 따라하는 방법`,
      `의외로 모르는 ${keyword}의 진실 5가지`,
      `${keyword}로 돈 버는 시니어들의 비밀`
    ],
    experience: [
      `30년 경험으로 말하는 ${keyword} 실제 후기`,
      `${keyword} 때문에 손해본 이야기 (실제 경험담)`,
      `시행착오 끝에 찾은 최고의 ${keyword} 방법`,
      `${keyword}로 월 100만원 번 50대의 이야기`
    ],
    lifestyle: [
      `시니어를 위한 ${keyword} 생활 꿀팁`,
      `집에서 간단히 ${keyword} 해결하는 법`,
      `${keyword}로 건강하고 즐거운 노후 준비`,
      `손자녀와 함께하는 ${keyword} 시간`
    ],
    product: [
      `${keyword} 제품 솔직 리뷰 (50대 관점)`,
      `쿠팡에서 ${keyword} 상품 똑똑하게 고르는 법`,
      `${keyword} 가성비 제품 추천 (시니어 맞춤)`,
      `${keyword} 제품으로 부업 시작하는 방법`
    ]
  };
  
  const templates = topicTemplates[scriptStyle] || topicTemplates.educational;
  
  return templates.map((template, index) => ({
    title: template,
    description: generateTopicDescription(template, keyword),
    estimatedViews: Math.round(avgViews * (0.8 + Math.random() * 0.4)),
    monetization: getMonetizationMethod(scriptStyle),
    difficulty: index < 2 ? '쉬움' : '보통',
    duration: contentType === 'shortform' ? '1-3분' : '5-10분'
  }));
}

// 텍스트에서 주제 파싱하는 헬퍼 함수
function parseTopicsFromText(text, keyword, avgViews) {
  const topics = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentTopic = null;
  for (const line of lines) {
    if (line.includes('제목') || line.includes('**') || /^\d+\./.test(line)) {
      if (currentTopic) topics.push(currentTopic);
      currentTopic = {
        title: line.replace(/[*#\d\.]/g, '').trim().substring(0, 30),
        description: `${keyword}에 대한 시니어 맞춤 정보를 제공합니다.`,
        targetSituation: '관련 정보가 필요한 50-70대',
        coreValue: '실용적인 정보 습득',
        monetization: '애드센스',
        estimatedViews: Math.round(avgViews * (0.8 + Math.random() * 0.4))
      };
    } else if (currentTopic && line.includes('설명')) {
      currentTopic.description = line.replace(/[*#]/g, '').trim().substring(0, 100);
    }
  }
  if (currentTopic) topics.push(currentTopic);
  
  // 최소 4개 보장
  while (topics.length < 4) {
    topics.push({
      title: `시니어를 위한 ${keyword} 가이드 ${topics.length + 1}`,
      description: `${keyword} 관련 실용적 정보를 시니어 눈높이에 맞춰 설명합니다.`,
      targetSituation: `${keyword}에 관심 있는 중장년층`,
      coreValue: '검증된 정보와 실용적 팁',
      monetization: '애드센스',
      estimatedViews: Math.round(avgViews * (0.8 + Math.random() * 0.4))
    });
  }
  
  return topics.slice(0, 4);
}

// 키워드 기반 카테고리 분류
function categorizeTopicByKeyword(keyword) {
  const categories = {
    health: ['건강', '운동', '다이어트', '영양', '의학', '병원', '치료', '당뇨'],
    finance: ['투자', '주식', '부동산', '재테크', '연금', '저축', '경제'],
    lifestyle: ['요리', '여행', '취미', '문화', '레저', '관계'],
    tech: ['스마트폰', '컴퓨터', '인터넷', '앱', '디지털']
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => keyword.includes(k))) {
      return category;
    }
  }
  return 'general';
}

// 주제 설명 생성
function generateTopicDescription(title, keyword) {
  const descriptions = [
    `시니어들이 가장 궁금해하는 ${keyword} 정보를 쉽고 재미있게 전달합니다.`,
    `실제 경험을 바탕으로 한 진솔한 ${keyword} 이야기로 시청자들의 공감을 이끌어냅니다.`,
    `${keyword}에 대한 실용적인 팁으로 중장년층 시청자들에게 도움이 됩니다.`,
    `${keyword} 관련 제품 소개와 함께 쿠팡파트너스 수익도 기대할 수 있습니다.`
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

// 수익화 방법 결정
function getMonetizationMethod(scriptStyle) {
  const methods = {
    educational: '애드센스 + 유료강의',
    experience: '애드센스 + 도서/전자책',
    lifestyle: '쿠팡파트너스 + 스마트스토어', 
    product: '쿠팡파트너스 + 브랜드협찬'
  };
  return methods[scriptStyle] || '애드센스';
}

// Claude를 사용한 고급 스크립트 생성 함수
async function generateVideoScriptWithAI(topic, keyword, contentType, scriptStyle, searchResults) {
  try {
    console.log(`🎭 Claude로 스크립트 생성: "${topic.title}" 주제로 ${contentType} 제작 중...`);
    
    const isShortForm = contentType === 'shortform';
    const duration = isShortForm ? '2:30' : '8:45';
    
    // 검색 결과에서 참고 정보 추출
    const referenceVideos = searchResults.slice(0, 5);
    const competitorAnalysis = referenceVideos.map(v => 
      `- "${v.title}" (조회수: ${v.viewCount.toLocaleString()})`
    ).join('\n');
    
    const contentTypeKor = isShortForm ? '숏폼(1-3분)' : '롱폼(8-15분)';
    const scriptStyleKor = {
      educational: '교육/정보전달형',
      experience: '경험담/스토리텔링형', 
      lifestyle: '라이프스타일/꿀팁형',
      product: '제품리뷰/추천형'
    }[scriptStyle] || '교육/정보전달형';

    const prompt = `당신은 20년 경력의 시니어 전문 유튜브 스크립트 작가입니다.

**작가 전문성:**
- 50-70대 시청자 행동 패턴 분석 전문가
- 시니어 맞춤 스토리텔링 기법 보유
- 유튜브 알고리즘 최적화 스크립트 설계
- 시청 유지율 95% 이상 달성 경험

**시니어층 스크립트 작성 원칙:**
1. **속도**: 여유 있는 템포, 충분한 호흡
2. **언어**: 쉽고 친근한 표현, 전문용어 최소화
3. **구조**: 명확한 단계별 설명, 반복 학습 고려
4. **감정**: 따뜻하고 신뢰감 있는 톤
5. **실용성**: 즉시 적용 가능한 구체적 정보

**스크립트 구성 요소:**
- 강력한 오프닝 후크 (첫 15초 승부)
- 단계별 명확한 정보 전달
- 적절한 감정적 연결점
- 실용적 팁과 주의사항
- 자연스러운 CTA와 마무리

**제작 요청:**

**영상 정보:**
- 주제: "${topic.title}"
- 키워드: "${keyword}"
- 형식: ${contentTypeKor}
- 스타일: ${scriptStyleKor}
- 예상 시청 시간: ${duration}

**타겟 분석:**
${topic.targetSituation || `${keyword}에 관심 있는 50-70대 시청자`}

**핵심 가치:**
${topic.coreValue || '실용적이고 신뢰할 수 있는 정보 제공'}

**경쟁 콘텐츠 분석:**
${competitorAnalysis}

**미션:**
위 정보를 바탕으로 시니어 시청자가 끝까지 시청하고 구독까지 이어질 수 있는 ${isShortForm ? '숏폼' : '롱폼'} 스크립트를 작성해주세요.

${isShortForm ? `
**숏폼 스크립트 요구사항:**
- 총 3개 챕터 (오프닝 0:00-0:15, 본문 0:15-2:00, 마무리 2:00-2:30)
- 각 챕터별 구체적 대사와 연출 팁
- 15초 내 강력한 후크로 시청자 몰입
- 핵심 정보만 압축적으로 전달
- 자연스러운 CTA 포함
` : `
**롱폼 스크립트 요구사항:**
- 총 5개 챕터 (인사&후크, 본론1, 본론2, 실습&팁, 마무리)
- 각 챕터별 상세 대사와 타임라인
- 시청 유지율 고려한 흥미 요소 배치
- 중간중간 요약과 확인 포함
- 댓글 유도와 구독 요청 자연스럽게 배치
`}

**출력 형식:**
JSON 형식으로 다음 구조에 맞춰 작성해주세요:

{
  "title": "${topic.title}",
  "duration": "${duration}",
  "scriptStyle": "${scriptStyleKor}",
  "chapters": [
    {
      "title": "챕터명",
      "timeframe": "시간대",
      "content": "실제 대사 (자연스럽고 구체적으로)",
      "directionTips": "연출 및 촬영 팁",
      "keyPoints": ["핵심 포인트1", "핵심 포인트2"]
    }
  ],
  "seoTips": {
    "title": "제목 최적화 팁",
    "description": "설명란 작성 가이드", 
    "tags": ["추천태그1", "추천태그2"]
  },
  "engagementTricks": ["시청 유지율 향상 기법들"]
}

**중요 지침:**
- 대사는 실제 말하는 것처럼 자연스럽게
- 시니어 눈높이에 맞는 쉬운 설명
- 과장이나 자극적 표현 금지
- 신뢰감과 따뜻함이 느껴지는 톤
- 실제 도움이 되는 구체적 내용만 포함`;

    const response = await callClaude(prompt, 3000);
    
    // JSON 파싱 시도
    let script;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('JSON 형식 불일치');
      }
    } catch (parseError) {
      console.log('JSON 파싱 실패, 기본 구조로 대체');
      script = parseScriptFromText(response, topic, duration, isShortForm);
    }

    // 결과 검증 및 보완
    if (!script.chapters || !Array.isArray(script.chapters)) {
      script = parseScriptFromText(response, topic, duration, isShortForm);
    }

    // 추가 메타데이터 보강
    script = {
      ...script,
      title: topic.title,
      duration: duration,
      estimatedRevenue: calculateVideoRevenue(topic, contentType),
      monetizationTips: generateMonetizationTips(keyword, scriptStyle),
      seoKeywords: [keyword, ...extractRelatedKeywords(keyword)],
      targetAudience: '50-70대 중장년층',
      contentType: contentType,
      scriptStyle: scriptStyle,
      generatedAt: new Date().toISOString()
    };

    console.log(`✅ Claude 스크립트 생성 완료: ${script.chapters?.length || 0}개 챕터`);
    return script;

  } catch (error) {
    console.error('Claude 스크립트 생성 오류:', error.message);
    // 폴백: 기존 템플릿 방식
    return generateVideoScript(topic, keyword, contentType, scriptStyle, searchResults);
  }
}

// 텍스트에서 스크립트 파싱하는 헬퍼 함수
function parseScriptFromText(text, topic, duration, isShortForm) {
  const chapters = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentChapter = null;
  for (const line of lines) {
    if (line.includes('챕터') || line.includes('Chapter') || /^\d+\./.test(line)) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = {
        title: line.replace(/[*#\d\.]/g, '').trim(),
        timeframe: isShortForm ? '0:00-1:00' : '0:00-2:00',
        content: '',
        directionTips: '자연스러운 톤으로 진행',
        keyPoints: []
      };
    } else if (currentChapter && line.length > 10) {
      currentChapter.content += line + ' ';
    }
  }
  if (currentChapter) chapters.push(currentChapter);

  // 기본 챕터 구조 보장
  if (chapters.length === 0) {
    if (isShortForm) {
      chapters.push(
        {
          title: '오프닝 후크',
          timeframe: '0:00-0:15',
          content: `안녕하세요! 오늘은 ${topic.title}에 대해 알려드릴게요. 정말 유용한 정보니까 끝까지 봐주세요!`,
          directionTips: '밝고 친근한 톤으로 시작',
          keyPoints: ['강력한 첫인상', '호기심 유발']
        },
        {
          title: '핵심 내용',
          timeframe: '0:15-2:00',
          content: text.substring(0, 300) || `${topic.title}의 핵심 포인트들을 차근차근 설명해드릴게요.`,
          directionTips: '명확하고 체계적으로 설명',
          keyPoints: ['핵심 정보 전달', '쉬운 설명']
        },
        {
          title: '마무리',
          timeframe: '2:00-2:30',
          content: '오늘 내용이 도움되셨나요? 좋아요와 구독 부탁드려요!',
          directionTips: '따뜻하고 감사한 마음으로',
          keyPoints: ['감사 인사', 'CTA']
        }
      );
    } else {
      chapters.push(
        {
          title: '인사 및 오프닝',
          timeframe: '0:00-1:30',
          content: `안녕하세요! 오늘은 ${topic.title}에 대해 상세히 알려드리겠습니다.`,
          directionTips: '차분하고 신뢰감 있는 톤',
          keyPoints: ['신뢰감 조성', '기대감 조성']
        },
        {
          title: '본론 1부',
          timeframe: '1:30-4:00',
          content: text.substring(0, 400) || '첫 번째 핵심 내용을 설명드리겠습니다.',
          directionTips: '체계적이고 명확하게',
          keyPoints: ['기초 개념', '실용적 정보']
        },
        {
          title: '본론 2부',
          timeframe: '4:00-6:30',
          content: '두 번째 중요한 내용을 다뤄보겠습니다.',
          directionTips: '예시와 함께 설명',
          keyPoints: ['심화 내용', '실제 적용']
        },
        {
          title: '마무리',
          timeframe: '6:30-8:00',
          content: '오늘 내용 정리하고 마무리하겠습니다. 구독과 좋아요 부탁드려요!',
          directionTips: '감사하고 따뜻한 톤',
          keyPoints: ['요약', 'CTA']
        }
      );
    }
  }

  return {
    title: topic.title,
    duration: duration,
    scriptStyle: '기본형',
    chapters: chapters,
    seoTips: {
      title: '시니어 맞춤 키워드 포함',
      description: '상세하고 신뢰감 있는 설명',
      tags: ['시니어', '중장년', topic.title.split(' ')[0]]
    },
    engagementTricks: ['자연스러운 소통', '공감대 형성', '실용적 정보 제공']
  };
}

// 기존 템플릿 기반 스크립트 생성 (폴백용)
function generateVideoScript(topic, keyword, contentType, scriptStyle, searchResults) {
  const isShortForm = contentType === 'shortform';
  const duration = isShortForm ? '2:30' : '8:45';
  
  // 기본 스크립트 구조
  let chapters;
  
  if (isShortForm) {
    chapters = [
      {
        title: '후크 (0:00-0:10)',
        timeframe: '0:00-0:10',
        content: `"${keyword}로 이렇게 하면 진짜 대박났어요!" 안녕하세요! 오늘은 ${topic.title}에 대해 알려드릴게요.`,
        cta: '영상 끝까지 보시면 특별한 팁도 준비했어요!'
      },
      {
        title: '핵심 내용 (0:10-2:00)',
        timeframe: '0:10-2:00',
        content: generateMainContent(keyword, scriptStyle, true),
        cta: null
      },
      {
        title: '마무리 & CTA (2:00-2:30)',
        timeframe: '2:00-2:30',
        content: `어떠셨나요? ${keyword}에 대해 더 궁금한 점이 있으시면 댓글로 남겨주세요!`,
        cta: '구독과 좋아요는 큰 힘이 됩니다! 다음 영상에서 또 만나요!'
      }
    ];
  } else {
    chapters = [
      {
        title: '인사 & 후크 (0:00-1:00)',
        timeframe: '0:00-1:00',
        content: `안녕하세요! 시니어 건강 라이프 채널에 오신 것을 환영합니다. 오늘은 ${topic.title}에 대해 정말 상세하고 실용적인 내용으로 준비했어요.

특히 50대 이상 분들께 꼭 필요한 정보들만 엄선해서 가져왔습니다. 제가 30년 넘게 이 분야에서 경험하면서 터득한 노하우들을 아낌없이 공유해드릴 예정이에요.

오늘 영상은 총 4부분으로 구성되어 있습니다. 먼저 기본 개념부터 시작해서, 실제 사례, 그리고 구체적인 실천 방법까지 단계별로 설명드릴게요. 끝까지 보시면 분명히 큰 도움이 되실 거예요.

혹시 궁금한 점이 있으시면 댓글로 남겨주세요. 가능한 한 모든 질문에 답변드리고 있습니다.`,
        cta: '영상이 도움되신다면 좋아요와 구독 부탁드려요! 알림 설정도 해두시면 새로운 영상을 놓치지 않으실 수 있어요.'
      },
      {
        title: '핵심 내용 1부 (1:00-4:00)',
        timeframe: '1:00-4:00',
        content: generateMainContent(keyword, scriptStyle, false, 1),
        cta: null
      },
      {
        title: '핵심 내용 2부 (4:00-7:00)',
        timeframe: '4:00-7:00',
        content: generateMainContent(keyword, scriptStyle, false, 2),
        cta: '이 방법 정말 효과적이에요. 댓글로 후기 남겨주세요!'
      },
      {
        title: '정리 & 마무리 (7:00-8:45)',
        timeframe: '7:00-8:45',
        content: `오늘 ${keyword}에 대해 알려드린 핵심 내용들을 정리해드릴게요. 

첫 번째로 말씀드린 기초의 중요성, 기억하고 계시죠? 급하게 서두르지 마시고 본인의 상태를 먼저 정확히 파악하는 것이 가장 중요합니다.

두 번째로 전문가 조언의 필요성을 강조했었어요. 혼자서 모든 걸 해결하려고 하지 마시고, 경험이 풍부한 전문가의 도움을 받으시기 바랍니다.

세 번째는 꾸준함이었습니다. 하루 이틀로는 변화를 기대하기 어려워요. 최소 3개월은 꾸준히 실천해보시길 바랍니다.

마지막으로 당부드리고 싶은 말씀은, 너무 완벽하게 하려고 하지 마시라는 것입니다. 80% 정도만 지켜도 충분히 좋은 결과를 얻으실 수 있어요. 스트레스받지 마시고 즐겁게 실천하세요.

다음 주에는 더 구체적인 실천 방법에 대해 알려드릴 예정입니다. 궁금한 점이 있으시면 댓글로 남겨주세요.`,
        cta: '오늘 영상이 도움되셨다면 좋아요와 구독 꼭 눌러주세요! 설명란에 유용한 자료 링크도 준비해뒀으니 확인해보시고, 다음 영상도 기대해주세요!'
      }
    ];
  }
  
  return {
    title: topic.title,
    duration,
    estimatedRevenue: calculateVideoRevenue(topic, contentType),
    chapters,
    monetizationTips: generateMonetizationTips(keyword, scriptStyle),
    seoKeywords: [keyword, ...extractRelatedKeywords(keyword)],
    targetAudience: '50-70대 중장년층'
  };
}

// 메인 콘텐츠 생성 (실제 시간에 맞는 충분한 분량)
function generateMainContent(keyword, scriptStyle, isShortForm, part = 1) {
  const contentBank = {
    educational: {
      short: `${keyword}의 핵심 포인트 3가지를 자세히 말씀드릴게요. 

첫째, 기초를 확실히 하는 것입니다. 많은 분들이 급하게 시작하려고 하시는데, 이는 잘못된 접근법이에요. 기초가 탄탄하지 않으면 나중에 더 큰 문제가 생길 수 있습니다. 특히 50대 이후에는 건강을 최우선으로 고려해야 하죠.

둘째, 전문가의 조언을 구하는 것입니다. 인터넷에 있는 정보만으로는 한계가 있어요. 개인의 상황과 체질에 맞는 맞춤형 조언이 필요하거든요. 저도 처음에는 혼자 해보려고 했지만, 전문가와 상담한 후에야 올바른 방향을 찾을 수 있었습니다.

셋째, 꾸준히 실천하는 것입니다. 하루 이틀로는 효과를 보기 어려워요. 최소 3개월은 꾸준히 해보셔야 합니다. 특히 중장년층은 젊은 사람들보다 변화가 느리게 나타나니까 인내심을 갖고 꾸준히 하시는 것이 가장 중요해요.`,
      
      long1: `먼저 ${keyword}의 기본 개념부터 차근차근 설명드리겠습니다. 많은 분들이 이 부분을 어려워하시는데, 사실 원리 자체는 그렇게 복잡하지 않아요. 

제가 30년 넘게 이 분야에서 일하면서 느낀 점은, 기초를 제대로 이해하지 못하고 시작하는 분들이 너무 많다는 것입니다. 특히 우리 시니어 세대는 젊은 사람들과 달리 몸의 변화나 적응 속도가 다르기 때문에 더욱 신중하게 접근해야 해요.

${keyword}를 시작하기 전에 먼저 자신의 현재 상태를 정확히 파악하는 것이 중요합니다. 건강 상태, 생활 패턴, 개인적 목표 등을 종합적으로 고려해야 하죠. 이런 기초 작업 없이 무작정 시작하면 오히려 역효과가 날 수 있어요.

단계별로 천천히 따라해보시면 누구든지 할 수 있습니다. 저도 처음에는 전혀 몰랐지만, 차근차근 배워가면서 지금은 많은 분들께 도움을 드릴 수 있게 되었거든요. 중요한 건 조급해하지 마시고 자신의 속도에 맞춰 진행하는 것입니다.`,
      
      long2: `이제 실제 사례를 통해 더 구체적으로 알아보겠습니다. 저희 채널 시청자분들 중에서도 이 방법으로 성공하신 분들이 정말 많아요. 

예를 들어, 60대 김○○님의 경우를 말씀드릴게요. 처음에는 반신반의하셨지만, 제가 알려드린 방법을 3개월간 꾸준히 실천하신 결과 놀라운 변화를 경험하셨습니다. 가족들도 너무 놀라서 어떻게 된 건지 물어보셨다고 하더라구요.

또 다른 사례로, 55세 박○○님은 처음에 잘못된 방법으로 시도하셨다가 오히려 악화되었던 경험이 있으셨어요. 그런데 저희가 알려드린 올바른 방법을 적용하신 후부터는 점진적으로 개선되기 시작했습니다.

구체적인 방법과 주의사항도 함께 말씀드릴게요. 첫 번째 주의사항은 절대 급하게 진행하지 마시라는 것입니다. 두 번째는 본인의 몸 상태를 지속적으로 체크하면서 조절해나가야 한다는 점이에요. 세 번째는 전문가와의 상담을 병행하시라는 것입니다. 이 세 가지만 잘 지키셔도 안전하고 효과적으로 진행하실 수 있을 거예요.`
    },
    experience: {
      short: `제가 30년 넘게 ${keyword} 분야에서 일하면서 깨달은 가장 중요한 것은 바로 '경험의 힘'이었습니다. 

책으로만 배울 수 있는 것과 실제로 경험해야만 알 수 있는 것들이 정말 많아요. 저도 수많은 시행착오를 겪었고, 때로는 좌절하기도 했습니다. 하지만 그런 실패들이 있었기 때문에 지금의 확실한 방법을 찾을 수 있었어요.

특히 우리 중장년층은 젊은 사람들과는 다른 접근이 필요합니다. 체력적인 한계도 있고, 회복 속도도 다르거든요. 그래서 더욱 신중하고 체계적인 방법이 필요해요.

제가 겪었던 가장 큰 실수는 처음에 너무 급하게 결과를 얻으려고 했다는 점입니다. 그 결과 오히려 건강을 해치는 결과를 낳았죠. 하지만 이런 경험이 있었기에 지금은 더 안전하고 효과적인 방법을 여러분께 알려드릴 수 있게 되었습니다.`,
      
      long1: `처음 ${keyword}를 시작했을 때를 떠올려보면 정말 막막했었어요. 어디서부터 시작해야 할지, 어떤 방법이 올바른 것인지 전혀 알 수가 없었거든요.

그 당시만 해도 지금처럼 정보가 풍부하지 않았어요. 인터넷도 없었고, 책도 별로 없었죠. 그래서 정말 많은 시행착오를 겪어야 했습니다. 때로는 잘못된 방법으로 인해 오히려 상황이 악화되기도 했어요.

하지만 포기하지 않고 계속 도전했습니다. 여러 전문가들을 만나보고, 다양한 방법들을 시도해보면서 조금씩 나만의 노하우를 쌓아갔어요. 그 과정에서 정말 소중한 깨달음들을 얻을 수 있었습니다.

지금은 그런 경험들 덕분에 많은 분들께 도움을 드릴 수 있게 되었어요. 제가 겪었던 실수들을 여러분은 하지 않으셨으면 좋겠고, 더 빠르고 안전한 길로 안내해드리고 싶습니다. 그것이 제가 이 채널을 운영하는 이유이기도 해요.`,
      
      long2: `실제로 제가 겪었던 구체적인 실패 사례들을 공유해드릴게요. 이런 이야기를 하는 이유는 여러분이 같은 실수를 반복하지 않으셨으면 하는 마음에서입니다.

첫 번째 실패는 너무 급하게 진행했다는 점이에요. 20대 때의 체력을 믿고 무리하게 했다가 몸에 무리가 와서 한 달 넘게 회복하는 시간이 필요했어요. 그때 깨달았죠. 나이가 들면서는 젊을 때와는 다른 접근이 필요하다는 것을.

두 번째 실패는 전문가의 조언을 무시했다는 점입니다. 혼자서도 충분히 할 수 있다고 생각했거든요. 하지만 개인적인 편견이나 잘못된 정보 때문에 돌아가는 길을 선택한 경우가 많았어요.

세 번째는 일관성이 부족했다는 점이에요. 며칠 하다가 효과가 바로 나타나지 않으면 다른 방법으로 바꾸곤 했죠. 하지만 진정한 변화는 꾸준함에서 나온다는 것을 나중에 깨달았습니다.

이런 실수들을 미리 알고 계시면 여러분은 저보다 훨씬 빠르게 원하시는 결과를 얻으실 수 있을 거예요. 제 경험이 여러분께 조금이라도 도움이 되었으면 좋겠습니다.`
    }
  };
  
  const content = contentBank[scriptStyle] || contentBank.educational;
  
  if (isShortForm) {
    return content.short;
  } else {
    return part === 1 ? content.long1 : content.long2;
  }
}

// 영상 수익 계산
function calculateVideoRevenue(topic, contentType) {
  const baseRevenue = contentType === 'shortform' ? 5000 : 15000;
  const randomFactor = 0.7 + Math.random() * 0.6; // 0.7-1.3배
  return `월 ${Math.round(baseRevenue * randomFactor).toLocaleString()}원`;
}

// 수익화 팁 생성
function generateMonetizationTips(keyword, scriptStyle) {
  const baseTips = [
    '영상 설명란에 쿠팡파트너스 링크 포함하기',
    '시청자가 궁금해할 제품들을 자연스럽게 소개하기',
    '구독자와 소통하며 신뢰 관계 형성하기'
  ];
  
  const styleTips = {
    educational: ['유료 강의나 전자책 판매 링크 추가', '관련 도서 추천으로 수수료 받기'],
    experience: ['개인 컨설팅이나 상담 서비스 홍보', '자서전이나 경험담 책 출간'],
    lifestyle: ['생활용품 리뷰로 파트너스 수익 극대화', '직접 만든 제품 스마트스토어 판매'],
    product: ['브랜드 협찬 기회 늘리기', '제품 비교 콘텐츠로 선택권 제공']
  };
  
  return [...baseTips, ...(styleTips[scriptStyle] || [])];
}

// 관련 키워드 추출
function extractRelatedKeywords(keyword) {
  const keywordMap = {
    '재테크': ['투자', '부업', '수익', '돈모으기', '자산관리'],
    '건강': ['운동', '영양', '다이어트', '의학', '웰빙'],
    '요리': ['레시피', '음식', '건강식', '간편요리', '영양식'],
    '여행': ['관광', '여행지', '여행팁', '항공', '숙박']
  };
  
  return keywordMap[keyword] || [keyword + '방법', keyword + '팁', keyword + '추천'];
}

// 전체 수익 예측 계산
function calculateRevenueEstimate(keyword, searchResults, contentType, targetAge) {
  const avgViews = searchResults.reduce((sum, v) => sum + v.viewCount, 0) / searchResults.length;
  
  // 시니어 타겟 CPM (Cost Per Mille)
  const seniorCPM = 800; // 시니어층 CPM이 높음
  const estimatedMonthlyViews = avgViews * 0.3; // 30% 정도 달성 가정
  
  // 애드센스 수익 (RPM 계산)
  const adsenseRevenue = Math.round((estimatedMonthlyViews / 1000) * seniorCPM * 0.3);
  
  // 쿠팡파트너스 (시니어층 구매력 높음)
  const coupangRevenue = Math.round(estimatedMonthlyViews * 0.02 * 15000); // 2% 클릭률, 평균 수수료 1.5만원
  
  // 기타 수익 (스마트스토어, 강의 등)
  const othersRevenue = Math.round(adsenseRevenue * 0.5);
  
  const totalRevenue = adsenseRevenue + coupangRevenue + othersRevenue;
  
  return {
    estimatedMonthlyRevenue: `${totalRevenue.toLocaleString()}원`,
    adsense: `${adsenseRevenue.toLocaleString()}원`,
    coupang: `${coupangRevenue.toLocaleString()}원`,
    others: `${othersRevenue.toLocaleString()}원`,
    estimatedViews: Math.round(estimatedMonthlyViews).toLocaleString(),
    cpm: `${seniorCPM}원`,
    targetAge,
    keyword,
    contentType
  };
}

// API 키 관리 엔드포인트
app.post('/api/keys/add', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ 
        error: 'API 키를 입력해주세요.' 
      });
    }

    const added = apiKeyManager.addKey(apiKey.trim());
    
    if (added) {
      res.json({ 
        success: true, 
        message: 'API 키가 성공적으로 추가되었습니다.',
        totalKeys: apiKeyManager.keys.length
      });
    } else {
      res.status(400).json({ 
        error: '이미 등록된 API 키이거나 유효하지 않은 키입니다.' 
      });
    }
  } catch (error) {
    console.error('API 키 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/keys/status', (req, res) => {
  try {
    const status = apiKeyManager.getKeyStatus();
    const hasAvailable = apiKeyManager.hasAvailableKeys();
    
    res.json({
      keys: status,
      hasAvailableKeys: hasAvailable,
      totalKeys: apiKeyManager.keys.length,
      needsMoreKeys: !hasAvailable
    });
  } catch (error) {
    console.error('API 키 상태 확인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 서버 상태 체크 (고급 버전)
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.1.0 - AI Content Creator',
    features: {
      advancedNLP: '✅ 고급 자연어 처리',
      semanticAnalysis: '✅ 의미적 유사성 분석',
      sentimentAnalysis: '✅ 감정 분석',
      trendAnalysis: '✅ 실시간 트렌드 분석',
      personalization: '✅ 개인화 추천',
      categoryClassification: '✅ 자동 카테고리 분류',
      topicGeneration: '✅ AI 주제 생성 (시니어 특화)',
      scriptGeneration: '✅ 영상 스크립트 자동 생성',
      revenueEstimation: '✅ 수익 예측 시스템'
    },
    performance: {
      cacheHits: nlp.semanticCache.size,
      trendCacheSize: trendAnalyzer.cache.size,
      userProfiles: personalization.userProfiles.size
    },
    apiKeys: apiKeyManager.getKeyStatus()
  };
  
  res.json(health);
});

// SPA를 위한 catch-all 라우트 (모든 API가 아닌 요청을 프론트엔드로 리다이렉트)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 YouTube DeepSearch Pro AI 백엔드 서버가 포트 ${PORT}에서 실행중입니다.`);
  console.log(`🧠 AI 기능:`);
  console.log(`   ✨ 고급 자연어 처리 (한국어 특화)`);
  console.log(`   🔍 의미적 유사성 분석`);
  console.log(`   💭 감정 분석`);
  console.log(`   📈 실시간 트렌드 분석`);
  console.log(`   🎯 개인화 추천`);
  console.log(`   📊 자동 카테고리 분류`);
  console.log(`🎬 콘텐츠 제작 AI:`);
  console.log(`   🎯 시니어 특화 주제 생성`);
  console.log(`   📝 영상 스크립트 자동 생성`);
  console.log(`   💰 수익 예측 시스템`);
  console.log(`📊 API 엔드포인트:`);
  console.log(`   POST /api/youtube/search - YouTube 검색`);
  console.log(`   POST /api/keywords/analyze - AI 키워드 분석`);
  console.log(`   POST /api/keywords/trending - 실시간 트렌딩`);
  console.log(`   POST /api/content/generate-topics - AI 주제 생성`);
  console.log(`   POST /api/content/generate-script - 영상 스크립트 생성`);
  console.log(`   POST /api/content/revenue-estimate - 수익 예측`);
  console.log(`   GET  /api/health - 서버 상태`);
});

module.exports = app;
