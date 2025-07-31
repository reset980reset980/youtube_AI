import React, { useState, useEffect } from 'react';
import { Search, Download, TrendingUp, Sparkles, RefreshCw, Settings, AlertCircle, Loader, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';

const YouTubeDeepSearch = () => {
  // API 키 관리
  const [apiKeys, setApiKeys] = useState(['']);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001'); // 백엔드 서버 URL (고정)
  
  // 검색 옵션
  const [searchKeyword, setSearchKeyword] = useState('');
  const [order, setOrder] = useState('relevance');
  const [publishedAfter, setPublishedAfter] = useState('');
  const [publishedBefore, setPublishedBefore] = useState('');
  const [videoDuration, setVideoDuration] = useState('any');
  const [maxResults, setMaxResults] = useState('25');
  const [minViews, setMinViews] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [regionCode, setRegionCode] = useState('KR');
  
  // 상태 관리
  const [searchResults, setSearchResults] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState('');
  const [totalResults, setTotalResults] = useState(0);
  const [error, setError] = useState('');
  
  // 스마트 키워드 추천
  const [recommendedKeywords, setRecommendedKeywords] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  
  // AI 콘텐츠 제작
  const [generatedTopics, setGeneratedTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [generatedScript, setGeneratedScript] = useState(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [contentType, setContentType] = useState('longform'); // 'longform' or 'shortform'
  const [scriptStyle, setScriptStyle] = useState('educational'); // 'educational', 'entertainment', 'clickbait'

  // API 키 상태 관리
  const [keyStatus, setKeyStatus] = useState([]);
  const [newApiKey, setNewApiKey] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);

  // 백엔드 API 호출
  const callBackendAPI = async (endpoint, data) => {
    try {
      console.log(`API 호출: ${backendUrl}${endpoint}`, data);
      
      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      console.log(`응답 상태: ${response.status} ${response.statusText}`);

      // 응답이 비어있는지 확인
      const responseText = await response.text();
      console.log(`응답 내용: ${responseText}`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          throw new Error(`서버 응답 오류 (${response.status}): ${responseText || '빈 응답'}`);
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${responseText}`);
      }

      // 성공 응답 JSON 파싱
      try {
        return responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('성공 응답 JSON 파싱 오류:', parseError);
        throw new Error(`응답 파싱 실패: ${responseText}`);
      }
    } catch (error) {
      console.error('Backend API Error:', error);
      throw error;
    }
  };

  // YouTube 검색 실행
  const handleSearch = async (pageToken = '') => {
    if (!searchKeyword.trim()) {
      setError('검색 키워드를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const searchData = await callBackendAPI('/api/youtube/search', {
        keyword: searchKeyword,
        order,
        publishedAfter,
        publishedBefore,
        videoDuration,
        maxResults: parseInt(maxResults),
        minViews: minViews ? parseInt(minViews) : null,
        maxViews: maxViews ? parseInt(maxViews) : null,
        regionCode,
        pageToken
      });

      if (pageToken) {
        setSearchResults(prev => [...prev, ...searchData.results]);
      } else {
        setSearchResults(searchData.results);
        setSelectedVideos(new Set());
      }

      setNextPageToken(searchData.nextPageToken || '');
      setTotalResults(searchData.totalResults);

      // 검색 완료 후 자동으로 키워드 분석 시작
      if (searchData.results.length > 0) {
        await analyzeKeywords(searchData.results);
      }

    } catch (error) {
      setError(`검색 중 오류 발생: ${error.message}`);
      
      // 할당량 초과 메시지 확인
      if (error.message.includes('할당량') || error.message.includes('quota')) {
        // 상태 확인 후 사용자에게 새 키 추가 안내
        const status = await checkKeyStatus();
        if (status && !status.hasAvailableKeys) {
          const addMore = confirm('모든 API 키의 할당량이 초과되었습니다. 새로운 YouTube Data API 키를 추가하시겠습니까?');
          if (addMore) {
            // 새 키 추가 UI로 스크롤
            document.getElementById('api-key-section')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  // 스마트 키워드 분석
  const analyzeKeywords = async (results = searchResults) => {
    if (results.length === 0) return;

    setIsAnalyzing(true);
    
    try {
      const analysisData = await callBackendAPI('/api/keywords/analyze', {
        searchResults: results,
        originalKeyword: searchKeyword
      });

      setRecommendedKeywords(analysisData.recommendations);
      
      // 트렌딩 키워드도 함께 요청
      const trendingData = await callBackendAPI('/api/keywords/trending', {
        category: categorizeKeyword(searchKeyword),
        region: regionCode
      });
      
      setTrendingKeywords(trendingData.trending);

    } catch (error) {
      console.error('키워드 분석 오류:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 키워드 카테고리 추정
  const categorizeKeyword = (keyword) => {
    const categories = {
      '재테크|투자|주식|부동산|코인': 'finance',
      '요리|레시피|음식|맛집': 'cooking',
      '건강|운동|다이어트|의학': 'health',
      '게임|플레이|공략|리뷰': 'gaming',
      '뷰티|화장품|메이크업|패션': 'beauty'
    };

    for (const [pattern, category] of Object.entries(categories)) {
      if (new RegExp(pattern).test(keyword)) {
        return category;
      }
    }
    return 'general';
  };

  // 추천 키워드로 새 검색
  const searchWithRecommendedKeyword = (keyword) => {
    setSearchKeyword(keyword);
    setSearchResults([]);
    setRecommendedKeywords([]);
    setTimeout(() => handleSearch(), 100);
  };

  // AI 주제 생성
  const handleGenerateTopics = async () => {
    setIsGeneratingTopics(true);
    try {
      const topicsData = await callBackendAPI('/api/content/generate-topics', {
        keyword: searchKeyword,
        searchResults: searchResults.slice(0, 10),
        contentType,
        scriptStyle,
        targetAge: 'senior'
      });
      
      setGeneratedTopics(topicsData.topics);
      setSelectedTopic(null);
    } catch (error) {
      setError(`주제 생성 중 오류: ${error.message}`);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // AI 스크립트 생성
  const handleGenerateScript = async () => {
    if (!selectedTopic) return;
    
    setIsGeneratingScript(true);
    try {
      const scriptData = await callBackendAPI('/api/content/generate-script', {
        topic: selectedTopic,
        keyword: searchKeyword,
        contentType,
        scriptStyle,
        searchResults: searchResults.slice(0, 5)
      });
      
      setGeneratedScript(scriptData.script);
    } catch (error) {
      setError(`스크립트 생성 중 오류: ${error.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // 예상 수익 계산
  const calculateRevenueEstimate = async () => {
    try {
      const revenueData = await callBackendAPI('/api/content/revenue-estimate', {
        keyword: searchKeyword,
        searchResults: searchResults,
        contentType,
        targetAge: 'senior'
      });
      
      // 수익 정보를 모달이나 별도 섹션에 표시
      alert(`예상 월 수익: ${revenueData.estimatedMonthlyRevenue}\n애드센스: ${revenueData.adsense}\n쿠팡파트너스: ${revenueData.coupang}\n기타: ${revenueData.others}`);
      
    } catch (error) {
      setError(`수익 계산 중 오류: ${error.message}`);
    }
  };

  // 스크립트 다운로드
  const downloadScript = (script) => {
    const scriptText = `
제목: ${script.title}
길이: ${script.duration}
예상 수익: ${script.estimatedRevenue}

=== 스크립트 ===

${script.chapters?.map(chapter => `
${chapter.title} (${chapter.timeframe})
${chapter.content}
${chapter.cta ? `CTA: ${chapter.cta}` : ''}
`).join('\n')}

=== 수익화 팁 ===
${script.monetizationTips?.map(tip => `• ${tip}`).join('\n')}
    `;
    
    const blob = new Blob([scriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title.replace(/[^a-z0-9]/gi, '_')}_스크립트.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 클립보드 복사
  const copyToClipboard = (script) => {
    const scriptText = `${script.title}\n\n${script.chapters?.map(chapter => `${chapter.title}\n${chapter.content}`).join('\n\n')}`;
    navigator.clipboard.writeText(scriptText);
    alert('스크립트가 클립보드에 복사되었습니다!');
  };

  // 다음 페이지 로드
  const handleLoadMore = () => {
    if (nextPageToken && !isSearching) {
      handleSearch(nextPageToken);
    }
  };

  // 새 API 키 추가
  const handleAddNewKey = async () => {
    if (!newApiKey.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }

    setIsAddingKey(true);
    try {
      const response = await fetch(`${backendUrl}/api/keys/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: newApiKey.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        setNewApiKey('');
        await checkKeyStatus(); // 상태 새로고침
      } else {
        alert(data.error || 'API 키 추가 실패');
      }
    } catch (error) {
      console.error('API 키 추가 오류:', error);
      alert('API 키 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAddingKey(false);
    }
  };

  // API 키 상태 확인
  const checkKeyStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/keys/status`);
      const data = await response.json();
      
      if (response.ok) {
        setKeyStatus(data.keys || []);
        return data;
      }
    } catch (error) {
      console.error('API 키 상태 확인 오류:', error);
    }
    return null;
  };

  // API 키 관리
  const addApiKey = () => {
    setApiKeys([...apiKeys, '']);
  };

  const updateApiKey = (index, value) => {
    const newKeys = [...apiKeys];
    newKeys[index] = value;
    setApiKeys(newKeys);
  };

  const removeApiKey = (index) => {
    if (apiKeys.length > 1) {
      const newKeys = apiKeys.filter((_, i) => i !== index);
      setApiKeys(newKeys);
    }
  };

  // 체크박스 관리
  const handleSelectVideo = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === searchResults.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(searchResults.map(r => r.id)));
    }
  };

  // 엑셀 내보내기
  const handleExportToExcel = () => {
    const selectedData = searchResults.filter(result => 
      selectedVideos.has(result.id)
    );

    if (selectedData.length === 0) {
      alert('내보낼 항목을 선택해주세요.');
      return;
    }

    const exportData = selectedData.map(item => ({
      '제목': item.title,
      '채널명': item.channelTitle,
      '업로드 날짜': item.publishedAt,
      '조회수': item.viewCount,
      '좋아요': item.likeCount,
      '댓글수': item.commentCount,
      '구독자수': item.subscriberCount,
      'URL': item.url,
      '설명': item.description?.substring(0, 100) + '...'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'YouTube 검색 결과');
    
    const fileName = `YouTube_검색결과_${searchKeyword}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 날짜 필터 프리셋
  const setDatePreset = (preset) => {
    const now = new Date();
    const past = new Date();
    
    switch(preset) {
      case '1일':
        past.setDate(now.getDate() - 1);
        break;
      case '1주일':
        past.setDate(now.getDate() - 7);
        break;
      case '1개월':
        past.setMonth(now.getMonth() - 1);
        break;
      case '3개월':
        past.setMonth(now.getMonth() - 3);
        break;
      case '6개월':
        past.setMonth(now.getMonth() - 6);
        break;
      case '1년':
        past.setFullYear(now.getFullYear() - 1);
        break;
      default:
        setPublishedAfter('');
        setPublishedBefore('');
        return;
    }
    
    setPublishedAfter(past.toISOString().split('T')[0]);
    setPublishedBefore(now.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <Sparkles className="w-6 h-6 mr-2 text-blue-600" />
          YouTube DeepSearch Pro
        </h1>
        
        {/* 백엔드 서버 설정 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">백엔드 서버 URL</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:3001"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">백엔드 서버가 실행중인 URL을 입력하세요</p>
        </div>
        
        {/* API 키 관리 */}
        <div id="api-key-section" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">YouTube API Keys 관리</label>
            <button
              onClick={checkKeyStatus}
              className="text-sm text-green-600 hover:text-green-800 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              상태 확인
            </button>
          </div>

          {/* 기존 키 입력 (호환성) */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">임시 키 입력 (세션용)</label>
            {apiKeys.map((key, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="password"
                  value={key}
                  onChange={(e) => updateApiKey(index, e.target.value)}
                  placeholder={`YouTube Data API v3 키 ${index + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {apiKeys.length > 1 && (
                  <button
                    onClick={() => removeApiKey(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addApiKey}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-2"
            >
              <Settings className="w-4 h-4 mr-1" />
              임시 키 추가
            </button>
          </div>

          {/* 새 API 키 추가 (서버에 영구 저장) */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">새 API 키 추가 (영구 저장)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="YouTube Data API v3 키 입력"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && !isAddingKey && handleAddNewKey()}
              />
              <button
                onClick={handleAddNewKey}
                disabled={isAddingKey || !newApiKey.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
              >
                {isAddingKey ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  '추가'
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              할당량 초과 시 자동으로 다음 키로 전환됩니다.
            </p>
          </div>

          {/* API 키 상태 표시 */}
          {keyStatus.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">API 키 상태</h4>
              <div className="space-y-2">
                {keyStatus.map((key, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-600">{key.key}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        key.exhausted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {key.exhausted ? '한계 도달' : `${key.remaining.toLocaleString()} 남음`}
                      </span>
                      <span className="text-gray-500">
                        {key.usage.toLocaleString()}/{key.limit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 검색 옵션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* 검색 키워드 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">검색 키워드 *</label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="검색할 키워드를 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* 정렬 방식 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">정렬 방식</label>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="relevance">관련성</option>
              <option value="date">업로드 날짜</option>
              <option value="viewCount">조회수</option>
              <option value="rating">평점</option>
              <option value="title">제목</option>
            </select>
          </div>

          {/* 동영상 길이 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">동영상 길이</label>
            <select
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="any">전체</option>
              <option value="short">4분 미만</option>
              <option value="medium">4-20분</option>
              <option value="long">20분 초과</option>
            </select>
          </div>

          {/* 결과 개수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">결과 개수</label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10개</option>
              <option value="25">25개</option>
              <option value="50">50개</option>
            </select>
          </div>

          {/* 지역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
            <select
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="KR">한국</option>
              <option value="US">미국</option>
              <option value="JP">일본</option>
              <option value="GB">영국</option>
            </select>
          </div>
        </div>

        {/* 조회수 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">최소 조회수</label>
            <input
              type="number"
              value={minViews}
              onChange={(e) => setMinViews(e.target.value)}
              placeholder="예: 1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">최대 조회수</label>
            <input
              type="number"
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
              placeholder="예: 1000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 날짜 필터 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">업로드 기간</label>
          
          {/* 날짜 프리셋 */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['전체', '1일', '1주일', '1개월', '3개월', '6개월', '1년'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
          
          {/* 상세 날짜 설정 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">시작일</label>
              <input
                type="date"
                value={publishedAfter}
                onChange={(e) => setPublishedAfter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">종료일</label>
              <input
                type="date"
                value={publishedBefore}
                onChange={(e) => setPublishedBefore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 검색 버튼 */}
        <div className="flex space-x-4">
          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isSearching ? '검색 중...' : '검색'}
          </button>
          
          {searchResults.length > 0 && (
            <button
              onClick={() => analyzeKeywords()}
              disabled={isAnalyzing}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAnalyzing ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              키워드 재분석
            </button>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
            <span className="text-red-700">{error}</span>
          </div>
        )}
      </div>

      {/* AI 콘텐츠 제작 섹션 */}
      {searchResults.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-6">
            <Sparkles className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="text-xl font-bold text-gray-800">AI 콘텐츠 제작 도구</h3>
            <span className="ml-3 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">시니어 특화</span>
          </div>

          {/* 콘텐츠 타입 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">콘텐츠 형태</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="longform">롱폼 (5-15분)</option>
                <option value="shortform">숏폼 (30초-3분)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">영상 스타일</label>
              <select
                value={scriptStyle}
                onChange={(e) => setScriptStyle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="educational">교육/정보</option>
                <option value="experience">경험담/후기</option>
                <option value="lifestyle">생활정보</option>
                <option value="product">상품소개</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">수익화 목표</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="coupang">쿠팡파트너스</option>
                <option value="adsense">애드센스</option>
                <option value="smartstore">스마트스토어</option>
                <option value="course">유료강의</option>
              </select>
            </div>
          </div>

          {/* AI 제작 버튼들 */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={handleGenerateTopics}
              disabled={isGeneratingTopics}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isGeneratingTopics ? (
                <Loader className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              {isGeneratingTopics ? 'AI 주제 생성 중...' : 'AI 주제 생성'}
            </button>

            {selectedTopic && (
              <button
                onClick={handleGenerateScript}
                disabled={isGeneratingScript}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {isGeneratingScript ? (
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Edit className="w-5 h-5 mr-2" />
                )}
                {isGeneratingScript ? '스크립트 생성 중...' : '영상 스크립트 생성'}
              </button>
            )}

            <button
              onClick={calculateRevenueEstimate}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-lg"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              예상 수익 계산
            </button>
          </div>

          {/* 생성된 주제들 */}
          {generatedTopics.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">🎯 AI 추천 주제 ({generatedTopics.length}개)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedTopics.map((topic, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedTopic(topic)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedTopic?.title === topic.title
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 bg-white'
                    }`}
                  >
                    <h5 className="font-semibold text-gray-800 mb-2">{topic.title}</h5>
                    <p className="text-sm text-gray-600 mb-3">{topic.description}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                        예상 조회수: {topic.estimatedViews?.toLocaleString()}
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        수익화: {topic.monetization}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 생성된 스크립트 */}
          {generatedScript && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">📝 생성된 영상 스크립트</h4>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h5 className="text-xl font-bold text-gray-800">{generatedScript.title}</h5>
                  <div className="flex space-x-2">
                    <span className="bg-purple-100 text-purple-800 text-sm px-2 py-1 rounded">
                      {generatedScript.duration}
                    </span>
                    <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
                      예상 수익: {generatedScript.estimatedRevenue}
                    </span>
                  </div>
                </div>

                {/* 스크립트 챕터들 */}
                <div className="space-y-4">
                  {generatedScript.chapters?.map((chapter, index) => (
                    <div key={index} className="border-l-4 border-purple-500 pl-4">
                      <h6 className="font-semibold text-gray-800 mb-2">
                        {chapter.title} ({chapter.timeframe})
                      </h6>
                      <p className="text-gray-700 mb-2">{chapter.content}</p>
                      {chapter.cta && (
                        <p className="text-sm text-purple-600 font-medium">
                          💡 CTA: {chapter.cta}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* 수익화 팁 */}
                {generatedScript.monetizationTips && (
                  <div className="mt-6 p-4 bg-green-50 rounded-lg">
                    <h6 className="font-semibold text-green-800 mb-2">💰 수익화 팁</h6>
                    <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                      {generatedScript.monetizationTips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 스크립트 다운로드 */}
                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => downloadScript(generatedScript)}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    스크립트 다운로드
                  </button>
                  <button
                    onClick={() => copyToClipboard(generatedScript)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    복사하기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 스마트 키워드 추천 패널 */}
      {(recommendedKeywords.length > 0 || trendingKeywords.length > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Sparkles className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">스마트 키워드 추천</h3>
            {isAnalyzing && <Loader className="w-4 h-4 ml-2 animate-spin text-blue-600" />}
          </div>
          
          {/* 검색 결과 기반 추천 */}
          {recommendedKeywords.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                검색 결과 기반 추천 (AI 분석)
              </h4>
              <div className="flex flex-wrap gap-2">
                {recommendedKeywords.map((rec, index) => (
                  <button
                    key={index}
                    onClick={() => searchWithRecommendedKeyword(rec.keyword)}
                    className="px-3 py-1.5 bg-white border border-blue-200 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm group"
                  >
                    <span className="font-medium">{rec.keyword}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {rec.frequency}회 언급 | 관련도 {Math.round(rec.relevanceScore * 10)}
                    </span>
                    {rec.trend > 0.7 && (
                      <span className="ml-1 text-red-500">🔥</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 실시간 트렌딩 키워드 */}
          {trendingKeywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <RefreshCw className="w-4 h-4 mr-1" />
                실시간 트렌딩 키워드
              </h4>
              <div className="flex flex-wrap gap-2">
                {trendingKeywords.map((trend, index) => (
                  <button
                    key={index}
                    onClick={() => searchWithRecommendedKeyword(trend.keyword)}
                    className="px-3 py-1.5 bg-white border border-purple-200 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-colors text-sm"
                  >
                    <span className="font-medium">{trend.keyword}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      급상승 {trend.growth}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 검색 결과 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            검색 결과 총 {totalResults.toLocaleString()}개 (현재 {searchResults.length}개 표시)
          </h2>
          
          <div className="flex space-x-2">
            {nextPageToken && (
              <button
                onClick={handleLoadMore}
                disabled={isSearching}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                더 보기
              </button>
            )}
            
            {searchResults.length > 0 && (
              <button
                onClick={handleExportToExcel}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                엑셀 내보내기 ({selectedVideos.size})
              </button>
            )}
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={searchResults.length > 0 && selectedVideos.size === searchResults.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">썸네일</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">제목</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">채널</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">업로드</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">조회수</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">좋아요</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">구독자</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    {isSearching ? (
                      <div className="flex items-center justify-center">
                        <Loader className="w-5 h-5 animate-spin mr-2" />
                        검색 중입니다...
                      </div>
                    ) : (
                      '검색 결과가 없습니다. 키워드를 입력하고 검색해보세요.'
                    )}
                  </td>
                </tr>
              ) : (
                searchResults.map((result) => (
                  <tr key={result.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedVideos.has(result.id)}
                        onChange={() => handleSelectVideo(result.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <img 
                        src={result.thumbnailUrl} 
                        alt="썸네일" 
                        className="w-20 h-14 object-cover rounded shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium line-clamp-2 transition-colors"
                      >
                        {result.title}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.channelTitle}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.publishedAt}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.viewCount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.likeCount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.subscriberCount?.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default YouTubeDeepSearch;