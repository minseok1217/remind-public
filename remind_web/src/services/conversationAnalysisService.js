// 대화 분석 서비스
// 통화 대화 내용을 분석하여 인지 상태 지표를 계산합니다.

/**
 * 대명사 목록 (한국어)
 */
const PRONOUNS = [
  '나', '너', '저', '우리', '그', '그녀', '그것', '이것', '저것',
  '여기', '저기', '거기', '이', '그', '저', '뭐', '누구', '어디',
  '언제', '왜', '어떻게', '무엇', '아무', '자기', '본인', '당신'
];

/**
 * 감정 키워드 (긍정/부정)
 */
const EMOTION_KEYWORDS = {
  positive: ['좋아', '행복', '기쁘', '즐거', '감사', '사랑', '웃', '재미', '신나', '편안', '따뜻', '그립'],
  negative: ['슬프', '힘들', '아프', '걱정', '무서', '화나', '짜증', '외로', '우울', '불안', '싫']
};

/**
 * 대화 내용을 분석하여 인지 지표 계산
 * @param {Array} chatHistory - [{role: 'user'|'model', parts: [{text: string}]}]
 * @param {number} callDuration - 통화 시간 (초)
 * @returns {Object} 분석 결과
 */
export const analyzeConversation = (chatHistory, callDuration) => {
  // 사용자 발화만 추출
  const userMessages = chatHistory
    .filter(msg => msg.role === 'user')
    .map(msg => msg.parts[0]?.text || '')
    .filter(text => text.trim());

  const allUserText = userMessages.join(' ');
  const words = allUserText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  
  // AI 발화 추출 (주제 분석용)
  const aiMessages = chatHistory
    .filter(msg => msg.role === 'model')
    .map(msg => msg.parts[0]?.text || '')
    .filter(text => text.trim());

  // 1. 대명사 비율 (Pronoun Ratio)
  // 치매 환자는 구체적인 명사 대신 대명사를 많이 사용하는 경향
  const pronounCount = words.filter(word => 
    PRONOUNS.some(pronoun => word.includes(pronoun))
  ).length;
  const pronounRatio = totalWords > 0 ? (pronounCount / totalWords) * 100 : 0;

  // 2. 분당 단어 수 (Words Per Minute)
  // 발화 속도 측정 - 너무 느리거나 빠르면 주의 필요
  const durationMinutes = callDuration / 60;
  const wordsPerMinute = durationMinutes > 0 ? totalWords / durationMinutes : 0;

  // 3. 발화 유창성 (Fluency Score)
  // 문장 완성도, 반복, 머뭇거림 분석
  const fluencyScore = calculateFluencyScore(userMessages);

  // 4. 주제 이탈률 (Topic Deviation Rate)
  // AI 질문에 대한 관련성 분석
  const topicDeviationRate = calculateTopicDeviation(chatHistory);

  // 5. 감정 역동성 (Emotion Dynamics)
  // 긍정/부정 감정 키워드 분석
  const emotionAnalysis = analyzeEmotions(allUserText);

  // 6. 응답 길이 일관성
  const responseLengthVariance = calculateResponseVariance(userMessages);

  // 종합 점수 계산 (가중치 적용)
  const cognitiveScore = calculateCognitiveScore({
    pronounRatio,
    wordsPerMinute,
    fluencyScore,
    topicDeviationRate,
    emotionAnalysis,
    responseLengthVariance
  });

  // 개별 영역 점수
  const languageScore = calculateLanguageScore(pronounRatio, fluencyScore, wordsPerMinute);
  const memoryScore = calculateMemoryScore(topicDeviationRate, responseLengthVariance);
  const emotionScore = emotionAnalysis.score;

  return {
    // 원시 데이터
    totalWords,
    totalUtterances: userMessages.length,
    callDurationSeconds: callDuration,
    
    // 분석 지표
    metrics: {
      pronounRatio: Math.round(pronounRatio * 10) / 10,
      wordsPerMinute: Math.round(wordsPerMinute * 10) / 10,
      fluencyScore: Math.round(fluencyScore),
      topicDeviationRate: Math.round(topicDeviationRate),
      emotionPositiveRatio: emotionAnalysis.positiveRatio,
      emotionNegativeRatio: emotionAnalysis.negativeRatio,
      responseLengthVariance: Math.round(responseLengthVariance)
    },
    
    // 종합 점수
    scores: {
      cognitive: Math.round(cognitiveScore),
      language: Math.round(languageScore),
      memory: Math.round(memoryScore),
      emotion: Math.round(emotionScore)
    },
    
    // 상태 판정
    status: determineStatus(cognitiveScore),
    
    // 상세 메시지
    insights: generateInsights({
      pronounRatio,
      wordsPerMinute,
      fluencyScore,
      topicDeviationRate,
      emotionAnalysis
    })
  };
};

/**
 * 발화 유창성 점수 계산
 */
const calculateFluencyScore = (messages) => {
  if (messages.length === 0) return 50;
  
  let score = 100;
  
  messages.forEach(msg => {
    // 반복 단어 감지
    const words = msg.split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = words.length > 0 ? 1 - (uniqueWords.size / words.length) : 0;
    score -= repetitionRatio * 20;
    
    // 머뭇거림 패턴 감지 (어..., 음..., 그... 등)
    const hesitationPattern = /(어+\.*|음+\.*|그+\.*|아+\.*|에+\.*)$/g;
    const hesitations = (msg.match(hesitationPattern) || []).length;
    score -= hesitations * 5;
    
    // 문장 완성도 (마침표, 물음표 등으로 끝나는지)
    if (!/[.?!]$/.test(msg.trim())) {
      score -= 2;
    }
  });
  
  return Math.max(0, Math.min(100, score));
};

/**
 * 주제 이탈률 계산
 */
const calculateTopicDeviation = (chatHistory) => {
  let totalResponses = 0;
  let deviatedResponses = 0;
  
  for (let i = 0; i < chatHistory.length - 1; i++) {
    if (chatHistory[i].role === 'model' && chatHistory[i + 1].role === 'user') {
      totalResponses++;
      
      const question = chatHistory[i].parts[0]?.text || '';
      const answer = chatHistory[i + 1].parts[0]?.text || '';
      
      // 단순 키워드 매칭으로 관련성 확인
      const questionKeywords = extractKeywords(question);
      const answerKeywords = extractKeywords(answer);
      
      const commonKeywords = questionKeywords.filter(k => 
        answerKeywords.some(ak => ak.includes(k) || k.includes(ak))
      );
      
      // 공통 키워드가 없으면 이탈로 간주
      if (commonKeywords.length === 0 && questionKeywords.length > 0) {
        deviatedResponses++;
      }
    }
  }
  
  return totalResponses > 0 ? (deviatedResponses / totalResponses) * 100 : 0;
};

/**
 * 키워드 추출 (명사 중심)
 */
const extractKeywords = (text) => {
  // 조사, 접미사 제거 후 2글자 이상 단어 추출
  const words = text.split(/\s+/)
    .map(w => w.replace(/[을를이가은는에서로와과의도만]/g, ''))
    .filter(w => w.length >= 2);
  return [...new Set(words)];
};

/**
 * 감정 분석
 */
const analyzeEmotions = (text) => {
  let positiveCount = 0;
  let negativeCount = 0;
  
  EMOTION_KEYWORDS.positive.forEach(keyword => {
    const regex = new RegExp(keyword, 'g');
    positiveCount += (text.match(regex) || []).length;
  });
  
  EMOTION_KEYWORDS.negative.forEach(keyword => {
    const regex = new RegExp(keyword, 'g');
    negativeCount += (text.match(regex) || []).length;
  });
  
  const total = positiveCount + negativeCount;
  const positiveRatio = total > 0 ? (positiveCount / total) * 100 : 50;
  const negativeRatio = total > 0 ? (negativeCount / total) * 100 : 50;
  
  // 감정 점수: 긍정이 많을수록 높음, 중립도 괜찮음
  let score = 70; // 기본 점수
  if (total > 0) {
    score = 50 + (positiveRatio - negativeRatio) / 2;
  }
  
  return {
    positiveRatio: Math.round(positiveRatio),
    negativeRatio: Math.round(negativeRatio),
    score: Math.min(100, Math.max(0, score))
  };
};

/**
 * 응답 길이 분산 계산
 */
const calculateResponseVariance = (messages) => {
  if (messages.length < 2) return 50;
  
  const lengths = messages.map(m => m.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
  
  // 분산이 클수록 일관성 낮음 (0-100 스케일로 변환)
  const normalizedVariance = Math.min(100, Math.sqrt(variance));
  return 100 - normalizedVariance; // 높을수록 일관성 좋음
};

/**
 * 종합 인지 점수 계산
 */
const calculateCognitiveScore = (metrics) => {
  const {
    pronounRatio,
    wordsPerMinute,
    fluencyScore,
    topicDeviationRate,
    emotionAnalysis,
    responseLengthVariance
  } = metrics;
  
  let score = 0;
  
  // 대명사 비율 (낮을수록 좋음) - 가중치 15%
  score += Math.max(0, 100 - pronounRatio * 2) * 0.15;
  
  // 분당 단어 수 (적정 범위: 80-150) - 가중치 15%
  if (wordsPerMinute >= 80 && wordsPerMinute <= 150) {
    score += 100 * 0.15;
  } else if (wordsPerMinute < 80) {
    score += (wordsPerMinute / 80) * 100 * 0.15;
  } else {
    score += Math.max(0, 100 - (wordsPerMinute - 150)) * 0.15;
  }
  
  // 유창성 - 가중치 25%
  score += fluencyScore * 0.25;
  
  // 주제 이탈률 (낮을수록 좋음) - 가중치 20%
  score += (100 - topicDeviationRate) * 0.20;
  
  // 감정 점수 - 가중치 15%
  score += emotionAnalysis.score * 0.15;
  
  // 응답 일관성 - 가중치 10%
  score += responseLengthVariance * 0.10;
  
  return Math.min(100, Math.max(0, score));
};

/**
 * 언어 능력 점수
 */
const calculateLanguageScore = (pronounRatio, fluencyScore, wordsPerMinute) => {
  let score = 0;
  
  // 대명사 비율 (낮을수록 좋음)
  score += Math.max(0, 100 - pronounRatio * 2) * 0.3;
  
  // 유창성
  score += fluencyScore * 0.4;
  
  // 발화 속도
  if (wordsPerMinute >= 80 && wordsPerMinute <= 150) {
    score += 100 * 0.3;
  } else {
    score += Math.min(100, wordsPerMinute) * 0.3;
  }
  
  return Math.min(100, score);
};

/**
 * 기억력 점수
 */
const calculateMemoryScore = (topicDeviationRate, responseLengthVariance) => {
  // 주제 유지 능력이 기억력과 관련
  const topicScore = (100 - topicDeviationRate) * 0.6;
  const consistencyScore = responseLengthVariance * 0.4;
  
  return Math.min(100, topicScore + consistencyScore);
};

/**
 * 상태 판정
 */
const determineStatus = (score) => {
  if (score >= 80) return { level: 'excellent', label: '매우 양호', color: '#41d17f' };
  if (score >= 65) return { level: 'good', label: '양호', color: '#4CAF50' };
  if (score >= 50) return { level: 'normal', label: '보통', color: '#FF9800' };
  if (score >= 35) return { level: 'caution', label: '주의 필요', color: '#FF5722' };
  return { level: 'warning', label: '관심 필요', color: '#f44336' };
};

/**
 * 인사이트 생성
 */
const generateInsights = (metrics) => {
  const insights = [];
  
  if (metrics.pronounRatio > 30) {
    insights.push('구체적인 명사 대신 대명사 사용이 많았습니다.');
  }
  
  if (metrics.wordsPerMinute < 50) {
    insights.push('발화 속도가 다소 느린 편입니다.');
  } else if (metrics.wordsPerMinute > 180) {
    insights.push('발화 속도가 빠른 편입니다.');
  }
  
  if (metrics.fluencyScore < 60) {
    insights.push('반복이나 머뭇거림이 관찰되었습니다.');
  } else if (metrics.fluencyScore >= 80) {
    insights.push('유창하게 대화를 이어가셨습니다.');
  }
  
  if (metrics.topicDeviationRate > 40) {
    insights.push('대화 주제가 자주 바뀌었습니다.');
  } else if (metrics.topicDeviationRate < 20) {
    insights.push('대화 주제를 잘 유지하셨습니다.');
  }
  
  if (metrics.emotionAnalysis.positiveRatio > 60) {
    insights.push('긍정적인 감정 표현이 많았습니다.');
  } else if (metrics.emotionAnalysis.negativeRatio > 60) {
    insights.push('부정적인 감정 표현이 관찰되었습니다.');
  }
  
  if (insights.length === 0) {
    insights.push('전반적으로 안정적인 대화를 나누셨습니다.');
  }
  
  return insights;
};

/**
 * 주간 트렌드 계산
 * @param {Array} callLogs - 최근 통화 기록 배열
 * @returns {Object} 트렌드 분석 결과
 */
export const calculateWeeklyTrend = (callLogs) => {
  if (!callLogs || callLogs.length === 0) {
    return {
      trend: [],
      averageScore: 0,
      improvement: 0,
      message: '아직 통화 기록이 없습니다.'
    };
  }
  
  // Firestore Timestamp 제대로 처리하면서 날짜순 정렬 (오래된 것 -> 최신 순)
  const sortedLogs = [...callLogs].sort((a, b) => {
    const dateA = a.callDate?.toDate?.() || new Date(a.callDate) || new Date(0);
    const dateB = b.callDate?.toDate?.() || new Date(b.callDate) || new Date(0);
    return dateA - dateB; // 오래된 것이 먼저 (왼쪽 = 오래된 통화, 오른쪽 = 최신 통화)
  });
  
  // 최근 7개 통화 기록으로 트렌드 생성 (왼쪽 = 오래된, 오른쪽 = 최신)
  const trend = sortedLogs.slice(-7).map(log => ({
    date: formatDate(log.callDate),
    value: log.analysis?.scores?.cognitive || log.cognitiveScore || 0
  }));
  
  console.log('📊 트렌드 데이터:', trend);
  
  // 평균 점수
  const scores = trend.map(t => t.value).filter(v => v > 0);
  const averageScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  // 개선도 (첫 날 대비 마지막 날)
  const improvement = scores.length >= 2 
    ? scores[scores.length - 1] - scores[0] 
    : 0;
  
  // 메시지 생성
  let message = '';
  if (improvement > 5) {
    message = '인지 상태가 개선되고 있습니다!';
  } else if (improvement < -5) {
    message = '최근 인지 점수가 다소 하락했습니다.';
  } else {
    message = '안정적인 상태를 유지하고 있습니다.';
  }
  
  return {
    trend,
    averageScore: Math.round(averageScore),
    improvement: Math.round(improvement),
    message
  };
};

/**
 * 날짜 포맷팅
 */
const formatDate = (dateInput) => {
  const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
};

export default {
  analyzeConversation,
  calculateWeeklyTrend
};
