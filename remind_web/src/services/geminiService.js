// Gemini API Service
// 우선순위: 1) 로컬/원격 프록시 서버로 요청 -> 2) 클라이언트에서 직접 Gemini 호출(환경변수 필요)
const BACKEND_PROXY = import.meta.env.VITE_GEMINI_PROXY || '/api/gemini/analyze';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

const readProxyJson = async (resp) => {
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Gemini proxy returned non-JSON response');
  }
  return resp.json();
};

const sanitizeGeminiHistory = (history = []) =>
  (Array.isArray(history) ? history : [])
    .map((item) => {
      const role = item?.role === 'model' ? 'model' : 'user';
      const text = item?.parts?.[0]?.text;
      if (typeof text !== 'string' || !text.trim()) return null;
      return { role, parts: [{ text }] };
    })
    .filter(Boolean);

export const CALL_END_MINUTES = 7;
export const REFLECTION_START_MINUTES = 5;

const normalizeCaptionCategories = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      category: String(item.category || '').trim(),
      value: String(item.value || '').trim(),
    }))
    .filter((item) => item.category && item.value);

const formatCaptionCategoriesForPrompt = (items = []) => {
  const normalized = normalizeCaptionCategories(items);
  if (normalized.length === 0) return '정보 없음';
  return normalized.map((item) => `- ${item.category}: ${item.value}`).join('\n');
};

const buildPromptText = (userDescription) => `당신은 치매 OO님과의 회상 치료 대화를 돕는 AI 분석가입니다. 사진과 보호자 설명을 분석하여 OO님과 자연스러운 대화를 나눌 수 있는 정보를 추출해주세요.

보호자 설명: ${userDescription || '(설명 없음)'}

다음 JSON 형식으로 반환해주세요:
{
  "keywords": ["키워드1", "키워드2", ...],
  "detailedDescription": "사진에 대한 상세하고 따뜻한 설명 (2-3문장)",
  "people": ["인물1", "인물2"],
  "location": "장소",
  "emotion": "감정",
  "situation": "상황 설명",
  "conversationStarters": ["질문1", "질문2", "질문3"]
}

주의사항:
- 따뜻하고 존중하는 톤으로 작성
- OO님의 기억을 자극할 수 있는 구체적인 세부사항 포함
- conversationStarters는 "예/아니오"가 아닌 열린 질문으로`;

export const analyzeImageWithGemini = async (imageBase64, userDescription) => {
  // 1) 프록시 엔드포인트가 설정되어 있으면 프록시로 요청 (권장)
  if (BACKEND_PROXY) {
    try {
      const resp = await fetch(BACKEND_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, userDescription }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Proxy error: ${err}`);
      }
      const json = await resp.json();
      return json.text || json.result || '';
    } catch (e) {
      console.warn('Proxy call failed, falling back to client-side call:', e);
      // fallback to client-side call below
    }
  }

  // 2) 클라이언트에서 직접 호출 (비권장: API 키 필요)
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured (client-side) and proxy failed');
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: buildPromptText(userDescription) },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content?.parts?.[0]?.text || '';
    }
    throw new Error('No response from Gemini API');
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
};

export const extractKeywordsFromPhoto = async (imageFile, userDescription) => {
  // Convert File to Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64String = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        const response = await analyzeImageWithGemini(base64String, userDescription);
        
        // Parse JSON response to extract photo analysis
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // 전체 분석 객체 반환
            resolve({
              keywords: parsed.keywords || [],
              detailedDescription: parsed.detailedDescription || '',
              people: parsed.people || [],
              location: parsed.location || '',
              emotion: parsed.emotion || '',
              situation: parsed.situation || '',
              conversationStarters: parsed.conversationStarters || []
            });
          } else {
            // Fallback: 키워드만 추출
            const keywords = response.split(',').map(k => k.trim()).filter(k => k);
            resolve({ keywords, detailedDescription: '', people: [], location: '', emotion: '', situation: '', conversationStarters: [] });
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON, using fallback method:', parseError);
          const keywords = response.split(',').map(k => k.trim()).filter(k => k);
          resolve({ keywords, detailedDescription: '', people: [], location: '', emotion: '', situation: '', conversationStarters: [] });
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(imageFile);
  });
};

export const generatePhotoDescription = async (imageFile) => {
  // Convert File to Base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64String = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        const description = await analyzeImageWithGemini(base64String, '');
        resolve(description);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(imageFile);
  });
};

// ──────────────────────────────────────────────────────────
// 하이브리드 캡션 시스템 (Step1 구조화 입력 + Step2 AI 후속 질문)
// ──────────────────────────────────────────────────────────

// 이미지 + 완전 커스텀 프롬프트로 Gemini 호출
const callGeminiWithCustomPrompt = async (imageBase64, customPrompt) => {
  // 전용 프록시 엔드포인트 시도
  try {
    const resp = await fetch('/api/gemini/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, customPrompt }),
    });
    if (resp.ok) {
      const json = await resp.json();
      return json.text || json.result || '';
    }
  } catch {
    // 무시하고 클라이언트 직접 호출로 폴백
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key가 설정되지 않았습니다.');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: customPrompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API 오류: ${error.error?.message || '알 수 없는 오류'}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// Step1 데이터를 텍스트 요약으로 변환
const summarizeStep1 = (step1Data) => {
  if (!step1Data) return '(보호자가 정보 입력을 건너뛰었습니다)';
  const parts = [];
  if (step1Data.year) parts.push(`찍은 연도: ${step1Data.year}`);
  if (step1Data.people?.length) parts.push(`함께한 사람: ${step1Data.people.join(', ')}`);
  if (step1Data.location) parts.push(`장소: ${step1Data.location}`);
  if (step1Data.freeText) parts.push(`추가 메모: ${step1Data.freeText}`);
  if (step1Data.captionCategories?.length) {
    parts.push(`보호자 지정 평가 카테고리:\n${formatCaptionCategoriesForPrompt(step1Data.captionCategories)}`);
  }
  return parts.length ? parts.join('\n') : '(선택된 정보 없음)';
};

// Step2: AI 후속 질문 1~2개 생성
export const generateFollowUpQuestions = async (imageBase64, step1Data) => {
  const summary = summarizeStep1(step1Data);
  const excludedQuestionTargets = [
    step1Data?.year ? `- 연도/시기: ${step1Data.year}` : null,
    step1Data?.people?.length ? `- 함께한 사람: ${step1Data.people.join(', ')}` : null,
    step1Data?.location ? `- 장소: ${step1Data.location}` : null,
  ].filter(Boolean);
  const excludedText = excludedQuestionTargets.length
    ? excludedQuestionTargets.join('\n')
    : '없음';
  const prompt = `당신은 치매 OO님의 추억 사진 캡션 작성을 돕는 AI 도우미입니다.
보호자가 이 사진에 대해 제공한 정보:
${summary}

이 사진을 분석하여, 캡션 작성에 필요한 추가 정보를 수집하기 위해 보호자에게 물어볼 질문을 1~2개 한국어로 만들어주세요.
- 질문 대상은 반드시 보호자입니다. OO님에게 묻는 것이 아닙니다.
- 이미 제공된 정보는 다시 묻지 마세요
- 보호자가 이미 입력한 아래 항목은 AI 추가 질문에서 제외하세요.
${excludedText}
- 특히 연도/시기, 함께한 사람, 장소가 이미 제공되어 있으면 해당 값을 확인하거나 다시 묻는 질문을 만들지 마세요.
- 대신 사진 속 상황, 관계의 맥락, 당시 감정, 특별한 사건, 보호자가 알고 있는 구체적인 배경처럼 아직 비어 있는 정보만 물어보세요.
- 보호자가 알고 있을 법한 구체적인 정보를 물어보세요
- "OO님께서 기억하시나요?" 같은 표현은 절대 사용하지 마세요
- 예시는 참고만 하되, 이미 제공된 연도/함께한 사람/장소를 다시 묻는 예시는 사용하지 마세요.
- 좋은 예: "이 날 특별히 기억나는 일이 있었나요?", "사진 속 분위기가 어땠는지 알려주실 수 있나요?", "이때 가족분들 사이에 어떤 이야기가 있었나요?"

다음 JSON 형식으로만 반환하세요 (다른 텍스트 없이):
{"questions": ["질문1", "질문2"]}`;

  try {
    const response = await callGeminiWithCustomPrompt(imageBase64, prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.questions || []).slice(0, 2);
    }
    return [];
  } catch (error) {
    console.error('후속 질문 생성 실패:', error);
    return [];
  }
};

// 텍스트 전용 Gemini 호출 (이미지 없이 텍스트만)
const callGeminiTextOnly = async (prompt) => {
  try {
    const resp = await fetch('/api/gemini/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt }),
    });
    if (resp.ok) {
      const json = await resp.json();
      return json.text || json.result || '';
    }
  } catch {
    // 프록시 실패 시 직접 호출로 폴백
  }

  if (!GEMINI_API_KEY) throw new Error('Gemini API key가 설정되지 않았습니다.');

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API 오류: ${error.error?.message || '알 수 없는 오류'}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// 사진 + 캡션을 함께 분석해서 통화 평가용 정답 키워드 추출 (멀티모달)
const normalizeCallLogForPrompt = (log) => {
  if (!log) return null;
  return {
    id: log.id || null,
    callDate: log.callDate?.toDate?.()?.toISOString?.() || log.callDate || null,
    createdAt: log.createdAt?.toDate?.()?.toISOString?.() || log.createdAt || null,
    callDuration: log.callDuration ?? null,
    status: log.status || log.analysis?.status?.label || null,
    cognitiveScore: log.cognitiveScore ?? log.analysis?.scores?.cognitive ?? null,
    totalUtterances: log.totalUtterances ?? null,
    totalWords: log.totalWords ?? null,
    hasPhoto: log.hasPhoto ?? null,
    photoContext: log.photoContext || null,
    preCallCheck: log.preCallCheck || null,
    conversation: log.conversation || '',
    analysis: log.analysis || null,
    summary: log.summary || null,
    changesFromPrevious: log.changesFromPrevious || null
  };
};

const buildFallbackInsightLines = (currentCallLog, previousCallLog) => {
  const currentScore = currentCallLog?.cognitiveScore ?? currentCallLog?.analysis?.scores?.cognitive ?? 0;
  const currentWords = currentCallLog?.totalWords ?? 0;
  const currentTopicRate = currentCallLog?.analysis?.metrics?.topicDeviationRate ?? 0;

  if (!previousCallLog) {
    return [
      `오늘 통화는 인지 점수 ${Math.round(currentScore)}점으로 기록되었습니다.`,
      `총 ${currentCallLog?.totalUtterances ?? 0}회 발화했고 ${currentWords}개의 단어를 사용했습니다.`,
      `주제 이탈률은 ${Math.round(currentTopicRate)}%로 나타났습니다.`
    ];
  }

  const previousScore = previousCallLog.cognitiveScore ?? previousCallLog.analysis?.scores?.cognitive ?? 0;
  const previousWords = previousCallLog.totalWords ?? 0;
  const previousTopicRate = previousCallLog.analysis?.metrics?.topicDeviationRate ?? 0;

  return [
    `인지 점수는 이전 통화보다 ${Math.round((currentScore - previousScore) * 10) / 10}점 변화했습니다.`,
    `발화 단어 수는 이전 ${previousWords}개에서 이번 ${currentWords}개로 기록되었습니다.`,
    `주제 이탈률은 이전 ${Math.round(previousTopicRate)}%에서 이번 ${Math.round(currentTopicRate)}%로 변화했습니다.`
  ];
};

export const generateCallInsightLines = async ({ currentCallLog, previousCallLog = null }) => {
  const promptPayload = {
    previousCallLog: normalizeCallLogForPrompt(previousCallLog),
    currentCallLog: normalizeCallLogForPrompt(currentCallLog)
  };
  const prompt = `
당신은 치매 OO님과 AI 통화 기록을 보호자에게 설명하는 임상 보조 분석가입니다.
아래 통화 log 정보를 보고 Firebase analysis.insights에 저장할 문장 3개를 작성하세요.

작성 규칙:
- 반드시 한국어 문장 3개만 작성합니다.
- 이전 통화가 있으면 "이전 통화에 비해 어떻게 변했는지"를 중심으로 작성합니다.
- 이전 통화가 없으면 "그날 통화가 어땠는지"를 중심으로 작성합니다.
- 평가 요소 이름을 나열하는 방식이 아니라, 보호자가 이해하기 쉬운 변화/상태 요약으로 작성합니다.
- 과장하거나 진단하지 말고, 통화 기록과 지표에서 확인되는 내용만 말합니다.
- 각 문장은 35자 이상 90자 이하로 작성합니다.

[통화 log 정보]
${JSON.stringify(promptPayload, null, 2)}

다음 JSON 형식으로만 반환하세요.
{"insights":["문장1","문장2","문장3"]}`;

  try {
    const response = await callGeminiTextOnly(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return buildFallbackInsightLines(currentCallLog, previousCallLog);
    const parsed = JSON.parse(jsonMatch[0]);
    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.map((line) => String(line || '').replace(/^\s*[-*\d.]+\s*/, '').trim()).filter(Boolean)
      : [];
    if (insights.length >= 3) return insights.slice(0, 3);
    return buildFallbackInsightLines(currentCallLog, previousCallLog);
  } catch (error) {
    console.error('통화 insight 3줄 생성 실패:', error);
    return buildFallbackInsightLines(currentCallLog, previousCallLog);
  }
};

export const generatePreCallReaction = async ({ question, answer, questionIndex }) => {
  const prompt = `
당신은 치매 OO님과 통화하는 Remind 서비스 상담사입니다.
통화 시작 전 컨디션 체크 질문에 대한 OO님 답변을 보고, 다음 질문으로 넘어가기 전에 말할 짧은 반응 문장 1개를 작성하세요.

작성 규칙:
- 한국어 한 문장만 작성합니다.
- 15자 이상 55자 이하로 짧고 따뜻하게 말합니다.
- 진단, 처방, 단정은 하지 않습니다.
- 답변의 뉘앙스를 반영하되 과장하지 않습니다.
- 다음 질문은 작성하지 않습니다. 반응 문장만 작성합니다.
- OO님이 약을 못 챙겼다고 답한 경우에는 확인해보면 좋겠다는 정도로만 부드럽게 말합니다.

[현재 질문 번호]
${questionIndex + 1}

[질문]
${question}

[OO님 답변]
${answer || '(답변 없음)'}

다음 JSON 형식으로만 반환하세요.
- 답변이 질문과 무관하거나 주제에서 벗어난 경우 repeat를 true로 설정합니다.
- 질문에 대한 답을 하지 못했더라도, '모르겠어', '기억이 안 나' 등 질문에 대한 응답으로 볼 수 있는 경우에는 repeat를 false로 설정합니다.
{"reaction":"반응 문장", "shouldRepeat":true/false}`;

  try {
    const response = await callGeminiTextOnly(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    const reaction = String(parsed.reaction || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    return reaction || null;
  } catch (error) {
    console.warn('사전 컨디션 체크 반응 생성 실패:', error);
    return null;
  }
};

export const extractAnswerKeywords = async (answers, step1Data) => {
  // 실제 답변이 있는 항목만 필터링
  const validAnswers = (answers || []).filter(qa => qa.answer && qa.answer.trim());
  if (validAnswers.length === 0) return [];

  // 이미 수집된 3가지 기본 정보
  const knownInfo = [];
  if (step1Data?.year) knownInfo.push(`연도: ${step1Data.year}`);
  if (step1Data?.people?.length) knownInfo.push(`함께한 사람: ${step1Data.people.join(', ')}`);
  if (step1Data?.location) knownInfo.push(`장소: ${step1Data.location}`);

  const conversationText = validAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n');

  const prompt = `당신은 치매 OO님의 회상 치료를 위한 AI입니다.
보호자와 AI 간의 대화를 분석하여, OO님의 기억력 평가에 활용할 추가 정답 키워드를 추출해주세요.

[이미 수집된 기본 정보 - 중복 추출 금지]
${knownInfo.length ? knownInfo.join('\n') : '(없음)'}

[보호자 대화 내용]
${conversationText}

추출 규칙:
- 위 "이미 수집된 기본 정보"와 겹치는 카테고리(연도, 함께한 사람, 장소)는 추출하지 마세요
- 보호자의 답변에서 구체적인 명사·고유명사만 추출하세요
- 추상적이거나 불명확한 표현은 제외하세요
- 최대 4개까지만 추출하세요

다음 JSON 형식으로만 반환하세요 (다른 텍스트 없이):
{"answerKeywords": [{"category": "카테고리명", "value": "추출된값"}]}`;

  try {
    const response = await callGeminiTextOnly(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.answerKeywords || [];
    }
    return [];
  } catch (error) {
    console.error('정답 키워드 추출 실패:', error);
    return [];
  }
};

export const evaluateConversationReport = async (chatHistory, photoContext = null) => {
  const baseGuardianCaptionEvaluation = Boolean(
    photoContext &&
    photoContext.source !== 'orientation_images' &&
    photoContext.ownerId !== 'orientation_images' &&
    !String(photoContext.id || '').startsWith('orientation_')
  );
  const dynamicCaptionCategories = normalizeCaptionCategories(photoContext?.captionCategories || []);
  const answerKeywordCategories = (photoContext?.answerKeywords || [])
    .map((item) => ({
      category: String(item.category || '').trim(),
      value: String(item.value || '').trim(),
    }))
    .filter((item) => item.category && item.value);
  const captionEvaluationCategories = dynamicCaptionCategories.length > 0
    ? dynamicCaptionCategories
    : answerKeywordCategories;
  const shouldEvaluateGuardianCaption = baseGuardianCaptionEvaluation && captionEvaluationCategories.length > 0;
  const guardianCaptionJsonTemplate = captionEvaluationCategories.map((item) => ({
    category: item.category,
    expectedValues: [item.value],
    matchedValues: [],
    matched: null,
    detail: '근거',
  }));

  const conversation = (chatHistory || [])
    .map((msg) => `${msg.role === 'user' ? 'OO님' : 'AI'}: ${msg.parts?.[0]?.text || ''}`)
    .join('\n');

  const photoInfo = photoContext ? `
[보호자 입력 사진 정보]
- 연도/시기: ${photoContext.year || '정보 없음'}
- 인물: ${(photoContext.people || []).join(', ') || '정보 없음'}
- 장소: ${photoContext.location || '정보 없음'}
- 설명/캡션: ${photoContext.finalCaption || photoContext.description || '정보 없음'}
- 상세 설명: ${photoContext.detailedDescription || '정보 없음'}
- 정서/분위기: ${photoContext.emotion || '정보 없음'}
- 상황: ${photoContext.situation || '정보 없음'}
- 보호자 지정 평가 카테고리:
${formatCaptionCategoriesForPrompt(captionEvaluationCategories)}
- 정답 키워드: ${JSON.stringify(photoContext.answerKeywords || [], null, 2)}
` : '[보호자 입력 사진 정보 없음]';

  const prompt = `
당신은 치매 OO님과 AI의 회상 대화를 평가하는 임상 보조 분석가입니다.
아래 대화를 바탕으로 리포트 항목을 평가하세요.

평가 원칙:
- 문장의 완성도, 정서 상태, 주제 이탈률은 반드시 대화 맥락을 보고 판단하세요.
- 보호자 입력 캡션은 보호자 사진 정보가 있을 때만 평가하세요.
- 보호자 입력 캡션은 고정 범주가 아니라 보호자가 사진별로 지정한 평가 카테고리만 사용해 판단하세요.
- guardianCaption.categories는 보호자 지정 평가 카테고리와 같은 카테고리명, 같은 순서로 반환하세요.
- 모르면 낮게 추정하지 말고 "판단 근거 부족"이라고 적으세요.
- score는 0~100 정수입니다. topicDeviationRate는 낮을수록 좋은 이탈률(0~100)입니다.

[보호자 캡션 평가 조건]
- 보호자가 직접 등록하고 캡션을 입력한 사진이 아닐 경우 guardianCaption 평가는 진행하지 말고 guardianCaption은 null로 반환하세요.
- 현재 guardianCaption 평가 여부: ${shouldEvaluateGuardianCaption ? '진행' : '진행하지 않음'}

${photoInfo}

[대화]
${conversation || '(대화 없음)'}

다음 JSON 형식으로만 반환하세요:
{
  "sentenceCompleteness": {"score": 0, "passed": false, "detail": "평가 근거"},
  "emotionalState": {"score": 0, "passed": false, "detail": "평가 근거"},
  "topicDeviation": {"score": 0, "topicDeviationRate": 0, "passed": false, "detail": "평가 근거"},
  "guardianCaption": {
    "score": 0,
    "passed": false,
    "detail": "평가 근거",
    "categories": [
${JSON.stringify(guardianCaptionJsonTemplate, null, 6).slice(1, -1)}
    ]
  }
}`;

  try {
    const response = await callGeminiTextOnly(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!shouldEvaluateGuardianCaption) {
      parsed.guardianCaption = null;
      parsed.captionMatchRate = null;
      parsed.captionMatches = [];
      if (Array.isArray(parsed.items)) {
        parsed.items = parsed.items.filter((item) => item?.id !== 'guardianCaption');
      }
    } else if (parsed.guardianCaption) {
      const returnedCategories = Array.isArray(parsed.guardianCaption.categories)
        ? parsed.guardianCaption.categories
        : [];
      parsed.guardianCaption.categories = guardianCaptionJsonTemplate.map((expected) => {
        const found = returnedCategories.find((item) => item?.category === expected.category);
        return found ? { ...expected, ...found } : expected;
      });
      parsed.captionMatches = parsed.guardianCaption.categories;
    }
    return parsed;
  } catch (error) {
    console.error('대화 리포트 LLM 평가 실패:', error);
    return null;
  }
};

// Step2 완료 후: 최종 캡션 생성
export const generateFinalCaption = async (imageBase64, step1Data, questionsAndAnswers) => {
  const summaryParts = [summarizeStep1(step1Data)];

  const answeredQA = (questionsAndAnswers || []).filter(qa => qa.answer);
  if (answeredQA.length > 0) {
    summaryParts.push('\n추가 수집 정보:');
    answeredQA.forEach(qa => summaryParts.push(`Q: ${qa.question}\nA: ${qa.answer}`));
  }

  const prompt = `당신은 치매 OO님의 추억 회상을 돕는 따뜻한 AI입니다.
수집된 사진 정보:
${summaryParts.join('\n')}

위 정보와 사진을 바탕으로, OO님이 이 사진을 보며 소중한 기억을 떠올릴 수 있도록 돕는 따뜻하고 구체적인 캡션을 한국어로 작성해주세요.
- 2~3문장으로 작성하세요
- OO님을 존중하는 따뜻한 톤으로 작성하세요
- 수집된 정보를 자연스럽게 녹여주세요
- 회상을 자극하는 구체적인 표현을 사용하세요

다음 JSON 형식으로만 반환하세요:
{"finalCaption": "캡션 텍스트"}`;

  try {
    const response = await callGeminiWithCustomPrompt(imageBase64, prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.finalCaption || '';
    }
    return '';
  } catch (error) {
    console.error('최종 캡션 생성 실패:', error);
    return '';
  }
};

// ──────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────
// 회상 치료 통화 전용 시스템 프롬프트 + Gemini 호출
// ──────────────────────────────────────────────────────────
const getSystemInstruction = (level, imageName, photoTypeKo, patientName = 'OO') => {
  if (level === '상') {
    return `당신은 경도 치매 OO님을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[호칭 - 반드시 준수]
- 사용자에 대한 호칭은 '${patientName}님'으로 통일한다.
- 환자라는 단어를 사용하지 않는다.

[대화 시작 - 반드시 준수]
- 사전 건강 확인과 자기소개는 이미 완료되었다.
- 자기소개, 몸 상태, 식사, 약, 수면 질문을 반복하지 않는다.
- 첫 응답은 바로 사진에 대한 회상 질문으로 시작한다.

[말하기 방식]
- 응답은 2~3문장으로 작성한다.
- OO님 답변을 한 문장으로 공감한 뒤, 기억을 더 깊이 파고드는 질문을 한다.
- 질문은 반드시 서술형 개방형으로 한다. (예: "어떻게 ~하셨나요?", "그때 ~는 어떤 분이셨나요?")
- 힌트·선택지·유도어를 절대 제공하지 않는다. OO님이 스스로 떠올리도록 기다린다.
- 한 번에 하나의 질문만 한다.

[꼬리 물기 원칙 - 핵심]
- OO님의 답변에서 구체적인 키워드(사람 이름, 장소, 행동)를 골라 그것으로 꼬리를 문다.
- OO님이 새로운 정보를 말하면 반드시 그 정보에서 출발해 다음 질문을 만든다.
  예) OO님: "민석이랑 놀았어" → AI: "민석이 친구와 주로 어디서 놀았나요?"
- OO님이 답변을 안 하거나 짧게 답하면 같은 주제를 다른 각도로 다시 물어본다.
- 기존 사진 주제에서 이탈하면 "이제 다시 사진에 대해 이야기 해볼게요" 라는 말과 함께 사진의 주제로 돌아온다.
- 꼬리 물기를 할때 최대한 캡션에 있는 내용으로 유도한다.

[기대 응답 수준]
- OO님이 구체적인 인물·장소·사건을 자발적으로 서술하도록 유도한다.

[절대 금지]
- 예/아니오로 답할 수 있는 질문 금지
- 선택지(A인가요, B인가요) 제공 절대 금지
- 에코잉(OO님 말 단순 반복) 금지 — 반드시 새로운 질문으로 깊어져야 한다.

[OO님이 "잘 모르겠어"라고 할 때]
- 올바른 대응: 다른 각도로 개방형 재질문을 한다.

[대화 전략]
- 0~${REFLECTION_START_MINUTES}분: ${imageName}과 연결된 구체적 기억(인물·사건·감정)을 깊이 회상하도록 유도한다.
- ${REFLECTION_START_MINUTES}~${CALL_END_MINUTES}분: "오늘 대화에서 가장 기억에 남는 게 뭐예요?"로 스스로 정리하게 한다.
- ${CALL_END_MINUTES}분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;

// - 0~10분: ${imageName}과 연결된 구체적 기억(인물·사건·감정)을 깊이 회상하도록 유도한다.
// - 10~15분: "오늘 대화에서 가장 기억에 남는 게 뭐예요?"로 스스로 정리하게 한다.
// - 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
  }

  if (level === '중') {
    return `당신은 경증 치매 OO님을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[호칭 - 반드시 준수]
- 사용자에 대한 호칭은 '${patientName}님'으로 통일한다.
- 환자라는 단어를 사용하지 않는다.

[대화 시작 - 반드시 준수]
- 사전 건강 확인과 자기소개는 이미 완료되었다.
- 자기소개, 몸 상태, 식사, 약, 수면 질문을 반복하지 않는다.
- 첫 응답은 바로 사진에 대한 1단계 질문으로 시작한다.

[말하기 방식]
- 응답은 2~3문장으로 작성한다.
- 짧고 친숙한 단문만 사용한다. (한자어·외래어 금지)
- 한 번에 하나의 질문만 한다.

[대화 흐름 구조 - 핵심: 선택형만 반복하지 않는다]
매 교환은 아래 4단계 흐름을 따른다:
  ① 제시: 사진 속 요소나 상황을 짧게 소개한다.
  ② 질문: 먼저 개방형으로 묻는다. OO님이 망설이거나 침묵하면 그때 선택지를 제공한다.
  ③ 공감: OO님의 답변을 따뜻하게 받아준다.
  ④ 확장: OO님이 답한 내용에서 감정이나 구체적 경험으로 한 발 더 들어간다.

[단계별 탐색]
1단계 (장소): 사진 배경 확인 → OO님 경험과 연결
2단계 (사물/색깔): 사진 속 특정 요소 → OO님 기억과 연결
3단계 (인물/행동): 사진 속 사람들 → OO님 경험 속 인물·행동과 연결
4단계 (개인 기억): OO님의 구체적 기억으로 깊이 들어간다.
5단계 (감정): 그 기억과 연결된 감정을 확인한다.

[OO님이 "잘 모르겠어"라고 할 때]
- 올바른 대응: 선택지로 전환하여 힌트를 제공한다.

[대화 전략]
- 0~${REFLECTION_START_MINUTES}분: 1~5단계를 순서대로 진행한다.
- ${REFLECTION_START_MINUTES}~${CALL_END_MINUTES}분: 현재 감정을 확인하며 마무리한다.
- ${CALL_END_MINUTES}분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
// - 0~10분: 1~5단계를 순서대로 진행한다.
// - 10~15분: 현재 감정을 확인하며 마무리한다.
// - 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
  }

  // 하
  return `당신은 중등도 이상 치매 OO님을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[호칭 - 반드시 준수]
- OO님에 대한 호칭은 '${patientName}님'으로 통일한다.
- 환자라는 단어를 사용하지 않는다.

[대화 목적]
OO님이 유대감과 정서적 안정을 느끼게 하는 것이 목표다.

[대화 시작 - 반드시 준수]
- 사전 건강 확인과 자기소개는 이미 완료되었다.
- 자기소개, 몸 상태, 식사, 약, 수면 질문을 반복하지 않는다.
- 첫 응답은 바로 사진에 대한 아주 짧고 쉬운 질문으로 시작한다.

[말하기 방식]
- 응답은 1~2문장으로 작성한다.
- 아주 짧고 단순한 문장만 사용한다. (초등 저학년 수준 어휘)
- 질문은 반드시 폐쇄형으로 한다. (예/아니오 또는 둘 중 하나)
- 한 번에 하나의 질문만 한다.

[에코잉 & 확장 원칙]
- OO님이 단답형으로 답해도 AI가 그 답을 풍성하게 가공해서 돌려준 뒤 다음 질문으로 이어간다.

[동반자 화법]
- 질문자가 아니라 '같은 것을 함께 보는 친구'처럼 말한다.
- OO님이 대답을 못하거나 침묵해도 따뜻하게 존재를 인정해 준다.
  예) "괜찮아요, 그냥 같이 보는 것만으로도 충분해요."

[사진 탐색 흐름]
① 사진 전체 분위기 공유
② 눈에 띄는 요소 확인
③ 사람/행동 확인
④ 경험 연결

[절대 금지]
- "어떻게", "왜", "무엇을", "어디서", "언제" 등 개방형 질문 절대 금지
- OO님이 틀린 답을 해도 정정 금지

[OO님이 "잘 모르겠어"라고 할 때]
- 올바른 대응: "괜찮아요, 그냥 같이 보는 것만으로도 충분해요." 후 감각 공유로 전환.

[대화 전략]
- 0~${REFLECTION_START_MINUTES}분: 에코잉과 동반자 화법으로 OO님과 함께 감각·기억을 공유한다.
- ${REFLECTION_START_MINUTES}~${CALL_END_MINUTES}분: 감정 확인 후 존재를 긍정하며 마무리한다.
- ${CALL_END_MINUTES}분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
// - 0~10분: 에코잉과 동반자 화법으로 OO님과 함께 감각·기억을 공유한다.
// - 10~15분: 감정 확인 후 존재를 긍정하며 마무리한다.
// - 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
};

export const chatWithPhoto = async (message, history = [], imageName = '', photoType = '', difficulty = '중', patientName = 'OO') => {
  const typeMap = { place: '장소', job: '직업', object: '사물' };
  const photoTypeKo = typeMap[photoType] || photoType || '사진';
  const systemInstruction = getSystemInstruction(difficulty, imageName || '사진', photoTypeKo, patientName);
  const safeHistory = sanitizeGeminiHistory(history);

  const contents = [
    { role: 'user', parts: [{ text: systemInstruction }] },
    { role: 'model', parts: [{ text: '네, 알겠습니다. 지시에 따라 OO님과 대화하겠습니다.' }] },
    ...safeHistory,
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const resp = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: safeHistory, imageName, photoType, difficulty }),
    });
    if (resp.ok) {
      const json = await readProxyJson(resp);
      return json.text || '';
    }
  } catch (error) {
    console.warn('Proxy failed, falling back to client-side:', error);
  }

  if (!GEMINI_API_KEY) throw new Error('Gemini API key가 설정되지 않았습니다.');

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API 오류: ${error.error?.message}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const normalizeDifficultyLevel = (difficulty) => {
  if (difficulty === '상' || difficulty === 'high') return '상';
  if (difficulty === '하' || difficulty === 'low') return '하';
  return '중';
};

// ──────────────────────────────────────────────────────────
// 지남력 훈련 힌트 생성 (Gemini 텍스트 전용)
// ──────────────────────────────────────────────────────────
export const evaluateAnswerWithGemini = async (question, correctAnswer, userAnswer) => {
  const prompt = `당신은 치매 OO님의 지남력/인지 훈련을 채점하는 AI입니다.
문제: ${question}
정답: ${correctAnswer}
사용자 답변: ${userAnswer}

채점 원칙:
- OO님의 음성 인식 결과라서 조사, 어미, 띄어쓰기, 말 더듬음, 반복어, 존댓말 차이는 무시하세요.
- 발음이 비슷하거나 음성 인식으로 약간 잘못 적힌 답도 문맥상 정답을 말한 것으로 보이면 정답으로 처리하세요.
- 정답의 핵심 명사나 의미가 포함되어 있으면 정답입니다. 예: "컵" 정답에 "물컵", "컵이요", "컵 같은데"는 정답입니다.
- 직업/장소/물건 이름은 더 관대하게 채점하세요. 상위 개념이나 일상적인 동의어도 맞는 의미면 정답입니다.
- 사용자가 확신 없이 말해도 핵심 답이 들어 있으면 정답입니다. 예: "아마 의사?"는 정답이 의사이면 정답입니다.
- 정확한 명칭을 말하지 못해도 용도, 기능, 특징, 관련 상황을 맞게 설명하면 정답으로 처리하세요.
- 정답보다 넓은 범주의 말도 문맥상 같은 대상을 가리키면 정답입니다. 예: "시계" 정답에 "시간 보는 거", "약사" 정답에 "약 주는 사람"은 정답입니다.
- OO님이 사투리, 짧은 단답, 불완전한 문장으로 말해도 의미가 통하면 정답입니다.
- 답변 안에 헷갈리는 말이 함께 있어도 정답의 핵심 의미가 포함되어 있으면 정답입니다.
- 판단이 애매하면 훈련 상황이므로 정답 쪽으로 처리하세요.
- 완전히 다른 대상이거나 핵심 의미가 전혀 맞지 않을 때만 오답입니다.

반드시 아래 JSON만 반환하세요. 다른 설명은 쓰지 마세요.
{"result":"정답"} 또는 {"result":"오답"}`;

  const parseEvaluationResult = (value) => {
    const text = (value || '').trim();
    if (!text) return false;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const result = String(parsed.result || '').replace(/\s+/g, '');
        if (result.includes('오답')) return false;
        return result.includes('정답') || result.includes('맞음') || result.includes('맞습니다');
      }
    } catch {
      // JSON이 아니면 아래 텍스트 판정으로 처리
    }
    const normalized = text.replace(/\s+/g, '');
    if (normalized.includes('오답')) return false;
    if (normalized.includes('정답') || normalized.includes('맞음') || normalized.includes('맞습니다')) return true;
    return false;
  };

  try {
    const resp = await fetch('/api/gemini/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, correctAnswer, userAnswer, prompt }),
    });
    if (resp.ok) {
      const json = await resp.json();
      const text = (json.text || json.result || '').trim();
      return parseEvaluationResult(text);
    }
  } catch {
    // 프록시 실패 시 직접 호출로 폴백
  }

  if (!GEMINI_API_KEY) return false;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return parseEvaluationResult(text);
  } catch {
    return false;
  }
};

export const generateOrientationHint = async (question, answer) => {
  const prompt = `당신은 치매 OO님을 위한 인지 훈련 보조 AI입니다.
아래 문제에 대한 힌트를 한 가지 제공해주세요.

문제: ${question}
정답: ${answer}

규칙:
- 정답을 직접 알려주지 마세요
- 힌트가 너무 짧지 않게, OO님이 떠올릴 수 있도록 구체적인 단서를 2~3개 넣어주세요
- 정답의 특징(색, 소리, 용도, 모양, 사용 장소, 관련 행동, 주변에서 볼 수 있는 상황 등)을 이용하세요
- "사진을 천천히 보시면..."처럼 시선을 유도하고, 부드럽고 격려하는 말투로 작성하세요
- 2~3문장으로 작성하되 전체 길이는 80~140자 정도로 해주세요
- 선택지 문제라면 정답 번호를 말하지 말고, 정답 선택지의 의미를 떠올릴 수 있는 설명을 주세요
- 한국어로만 답변하세요
- 힌트 문장만 반환하세요 (다른 설명 없이)`;

  try {
    const resp = await fetch('/api/gemini/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, prompt }),
    });
    if (resp.ok) {
      const json = await resp.json();
      return (json.text || json.result || '').trim();
    }
  } catch {
    // 프록시 실패 시 직접 호출로 폴백
  }

  if (!GEMINI_API_KEY) throw new Error('Gemini API key가 설정되지 않았습니다.');

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini 오류: ${error.error?.message}`);
  }

  const data = await response.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
};

// 채팅 기능 (클라이언트에서 직접 Gemini 호출)
// difficulty: '상' | '중' | '하' | null (기본값 '중')
// elapsedMinutes: 통화 경과 시간(분) - 타이밍 기반 전략에 사용
export const chatWithGemini = async (message, history = [], photoContext = null, difficulty = '중', elapsedMinutes = 0, patientName = 'OO') => {
  const safeHistory = sanitizeGeminiHistory(history);
  // 사진 컨텍스트가 있으면 시스템 프롬프트에 추가
  let photoInfo = '';
  if (photoContext) {
    const captionSource = Array.isArray(photoContext.captionCategories) && photoContext.captionCategories.length > 0
      ? photoContext.captionCategories
      : (photoContext.answerKeywords || []);
    const captionCategoryPrompt = formatCaptionCategoriesForPrompt(captionSource);
    photoInfo = `
[현재 보고 있는 사진 정보]
- 설명: ${photoContext.detailedDescription || photoContext.description || ''}
- 인물: ${(photoContext.people || []).join(', ') || '정보 없음'}
- 장소: ${photoContext.location || '정보 없음'}
- 분위기: ${photoContext.emotion || '정보 없음'}
- 상황: ${photoContext.situation || '정보 없음'}
- 추천 대화 주제: ${(photoContext.conversationStarters || []).join(', ') || '정보 없음'}
- 보호자 지정 확인 카테고리:
${captionCategoryPrompt}

이 정보를 바탕으로 OO님과 사진에 대해 따뜻하게 대화하세요.`;
  }


  const photoName = photoContext
    ? (photoContext.imageName || photoContext.name || photoContext.location || photoContext.situation || photoContext.keywords?.[0] || '제공된 사진')
    : null;
  const photoType = photoContext ? (photoContext.photoType || photoContext.type || '개인적') : '보편적';
  const systemInstruction = photoName
    ? getSystemInstruction(normalizeDifficultyLevel(difficulty), photoName, photoType, patientName)
    : `당신은 치매 OO님을 돕는 전문 요양보호사입니다. 응답은 1~2문장으로 짧고 따뜻하게 하며, 한 번에 하나의 질문만 합니다. ${CALL_END_MINUTES}분이 지나면 반드시 [통화끝]을 출력하고 마무리합니다.`;

  const photoRule = photoContext
    ? '- 사진을 이미 보여주고 있으므로 "사진을 준비하지 못했다"는 말 금지.'
    : '- 사진 없이 일상 대화를 나눈다. 사진에 대한 언급 금지.';
// 정수 변수 i 생성

  const strictTimingRules = `
[통화 시간 규칙 - 반드시 준수]
- 통화는 기본 ${CALL_END_MINUTES}분을 채우는 것을 목표로 한다.
- 현재 경과 시간이 ${CALL_END_MINUTES}분 미만이면 AI가 먼저 통화를 마무리하거나 [통화끝]/[END_CALL]을 출력하면 안 된다.
- ${CALL_END_MINUTES}분 미만에는 "마무리할게요", "오늘은 여기까지" 같은 종료 분위기 문장도 피하고, 자연스럽게 다음 질문을 이어간다.
- 예외: OO님이 직접 그만하고 싶다, 끊고 싶다, 너무 피곤하다, 힘들다고 명확히 말한 경우에만 ${CALL_END_MINUTES}분 전에도 따뜻하게 마무리하고 [통화끝]을 출력할 수 있다.
- 현재 경과 시간이 ${REFLECTION_START_MINUTES}~${CALL_END_MINUTES}분이면 오늘 대화에서 기억에 남는 점이나 현재 기분을 물으며 천천히 정리한다.
- 현재 경과 시간이 ${CALL_END_MINUTES}분 이상이면 따뜻하게 마무리하고 반드시 [통화끝]을 출력한다.
- 현재 경과 시간은 ${elapsedMinutes}분이다. 이 시간을 기준으로 종료 가능 여부를 판단한다.`;

  const fastVoiceResponseRules = `
[실시간 음성 응답 속도 규칙]
- 실제 통화에서 빠르게 말할 수 있도록 답변을 짧게 유지하세요.
- 따뜻한 공감 문장 1개와 질문 문장 1개까지만 사용하세요.
- 통화를 마무리하는 경우가 아니면 한국어 35~80자 정도를 우선하세요.
- 질문은 한 번에 하나만 또렷하게 하세요.
- 설명, 목록, 지문, 반복 요약은 넣지 마세요.`;

  const systemPrompt = `${systemInstruction}
${photoInfo}[추가 규칙]
- 괄호 안 지문/행동 표현 금지 (예: (웃으며), (조용히)).
${photoRule}
- 보호자 지정 확인 카테고리가 있으면 해당 항목은 guardianCaption 평가 근거가 되므로 반드시 대화 중 확인해야 합니다.
- 보호자 지정 확인 카테고리를 통화 초반에 한 번에 몰아서 묻지 말고, 대화 흐름에 맞춰 하나씩 자연스럽게 질문해 답변을 들으세요.
- 각 카테고리는 보호자가 입력한 정답값을 그대로 말하지 말고, OO님이 스스로 기억해서 답할 수 있는 열린 질문으로 물어보세요.
- 아직 대화에서 확인하지 못한 보호자 지정 카테고리가 남아 있으면, 일반 회상 질문보다 그 카테고리를 확인하는 질문을 우선하세요.
- 이미 OO님이 답한 내용으로 확인된 카테고리는 반복해서 묻지 말고, 다음 미확인 카테고리로 넘어가세요.
- 보호자 지정 확인 카테고리가 정보 없음이면 일반 회상 질문으로 진행하세요.
${strictTimingRules}
${fastVoiceResponseRules}
- OO님이 반복적으로 피곤해하거나 종료를 원하면 공감하는 말과 함께 "통화를 그만하고 싶으신가요?"를 물어봄.
- "통화를 그만하고 싶으신가요?" 질문에 긍정하면 따뜻하게 마무리하고 [통화끝] 출력. 부정하면 계속 진행
- [현재 경과 시간: ${elapsedMinutes}분] 전략 타이밍에 맞게 대화 진행.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '네, 알겠습니다. 따뜻하게 대화하겠습니다.' }] },
    ...safeHistory,
    { role: 'user', parts: [{ text: message }] }
  ];

  // 프록시 먼저 시도
  try {
    const resp = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: safeHistory, photoContext, difficulty, elapsedMinutes, systemPrompt }),
    });
    if (resp.ok) {
      const json = await readProxyJson(resp);
      return json.text || '';
    }
  } catch (e) {
    console.warn('Proxy failed, falling back to client-side:', e);
  }

  // 클라이언트에서 직접 호출
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
};
