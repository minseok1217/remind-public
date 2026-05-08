// Gemini API Service
// 우선순위: 1) 로컬/원격 프록시 서버로 요청 -> 2) 클라이언트에서 직접 Gemini 호출(환경변수 필요)
const BACKEND_PROXY = import.meta.env.VITE_GEMINI_PROXY || '/api/gemini/analyze';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const buildPromptText = (userDescription) => `당신은 치매 어르신과의 회상 치료 대화를 돕는 AI 분석가입니다. 사진과 보호자 설명을 분석하여 어르신과 자연스러운 대화를 나눌 수 있는 정보를 추출해주세요.

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
- 어르신의 기억을 자극할 수 있는 구체적인 세부사항 포함
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
  } catch (e) {
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
  return parts.length ? parts.join('\n') : '(선택된 정보 없음)';
};

// Step2: AI 후속 질문 1~2개 생성
export const generateFollowUpQuestions = async (imageBase64, step1Data) => {
  const summary = summarizeStep1(step1Data);
  const prompt = `당신은 치매 어르신의 추억 사진 캡션 작성을 돕는 AI 도우미입니다.
보호자가 이 사진에 대해 제공한 정보:
${summary}

이 사진을 분석하여, 캡션 작성에 필요한 추가 정보를 수집하기 위해 보호자에게 물어볼 질문을 1~2개 한국어로 만들어주세요.
- 질문 대상은 반드시 보호자입니다. 어르신(환자)에게 묻는 것이 아닙니다.
- 이미 제공된 정보는 다시 묻지 마세요
- 보호자가 알고 있을 법한 구체적인 정보를 물어보세요
- "어르신께서 기억하시나요?" 같은 표현은 절대 사용하지 마세요
- 예: "이 사진은 어디서 찍으신 건지 알고 계신가요?", "이 날 특별한 행사나 모임이 있었나요?", "사진 속 분들은 누구인지 알려주시겠어요?"

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
  } catch (e) {
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
export const extractAnswerKeywords = async (imageBase64, captionText, step1Data) => {
  const parts = [];
  if (step1Data?.year) parts.push(`연도/시기: ${step1Data.year}`);
  if (step1Data?.location) parts.push(`장소(선택 항목): ${step1Data.location}`);
  if (step1Data?.people?.length) parts.push(`함께한 사람(선택 항목): ${step1Data.people.join(', ')}`);
  if (step1Data?.freeText) parts.push(`보호자 메모: ${step1Data.freeText}`);
  if (captionText) parts.push(`생성된 캡션: ${captionText}`);

  if (parts.length === 0 && !imageBase64) return [];

  const prompt = `당신은 치매 어르신의 회상 치료를 위한 AI입니다.
첨부된 사진과 보호자가 입력한 정보를 함께 분석하여, 어르신의 기억력 평가에 활용할 핵심 정답 키워드를 추출해주세요.

보호자 입력 정보:
${parts.length ? parts.join('\n') : '(입력 없음)'}

추출 규칙:
- 사진에서 확인되거나 보호자가 언급한 구체적인 명사만 추출하세요
- 보호자가 직접 언급한 정보를 최우선으로 하고, 사진에서만 보이는 정보를 보완으로 활용하세요
- "산", "바다"처럼 두루뭉술한 단어 대신 보호자 메모에 구체적인 이름이 있으면 그것을 사용하세요
- 카테고리: 장소, 인물, 연도/시기, 행사/사건, 활동, 사물 중 해당하는 것만 사용
- 불명확하거나 추상적인 정보는 제외하세요
- 최대 6개까지만 추출하세요

다음 JSON 형식으로만 반환하세요 (다른 텍스트 없이):
{"answerKeywords": [{"category": "카테고리명", "value": "추출된값"}]}`;

  try {
    // 이미지가 있으면 멀티모달로, 없으면 텍스트만으로 호출
    let response;
    if (imageBase64) {
      response = await callGeminiWithCustomPrompt(imageBase64, prompt);
    } else {
      response = await callGeminiTextOnly(prompt);
    }
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
  const conversation = (chatHistory || [])
    .map((msg) => `${msg.role === 'user' ? '환자' : 'AI'}: ${msg.parts?.[0]?.text || ''}`)
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
- 정답 키워드: ${JSON.stringify(photoContext.answerKeywords || [], null, 2)}
` : '[보호자 입력 사진 정보 없음]';

  const prompt = `
당신은 치매 어르신과 AI의 회상 대화를 평가하는 임상 보조 분석가입니다.
아래 대화를 바탕으로 리포트 항목을 평가하세요.

평가 원칙:
- 문장의 완성도, 정서 상태, 주제 이탈률은 반드시 대화 맥락을 보고 판단하세요.
- 보호자 입력 캡션은 보호자 사진 정보가 있을 때만 평가하세요.
- 보호자 입력 캡션은 연도/시기, 인물, 장소, 활동, 사물 5개 범주 각각이 환자 답변에서 맞게 언급되었는지 판단하세요.
- 모르면 낮게 추정하지 말고 "판단 근거 부족"이라고 적으세요.
- score는 0~100 정수입니다. topicDeviationRate는 낮을수록 좋은 이탈률(0~100)입니다.

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
      {"category": "연도/시기", "expectedValues": [], "matchedValues": [], "matched": null, "detail": "근거"},
      {"category": "인물", "expectedValues": [], "matchedValues": [], "matched": null, "detail": "근거"},
      {"category": "장소", "expectedValues": [], "matchedValues": [], "matched": null, "detail": "근거"},
      {"category": "활동", "expectedValues": [], "matchedValues": [], "matched": null, "detail": "근거"},
      {"category": "사물", "expectedValues": [], "matchedValues": [], "matched": null, "detail": "근거"}
    ]
  }
}`;

  try {
    const response = await callGeminiTextOnly(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
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

  const prompt = `당신은 치매 어르신의 추억 회상을 돕는 따뜻한 AI입니다.
수집된 사진 정보:
${summaryParts.join('\n')}

위 정보와 사진을 바탕으로, 어르신이 이 사진을 보며 소중한 기억을 떠올릴 수 있도록 돕는 따뜻하고 구체적인 캡션을 한국어로 작성해주세요.
- 2~3문장으로 작성하세요
- 어르신을 존중하는 따뜻한 톤으로 작성하세요
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
const getSystemInstruction = (level, imageName, photoTypeKo) => {
  if (level === '상') {
    return `당신은 경도 치매 어르신을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[대화 시작 - 반드시 준수]
- 첫 응답에서 반드시 자기소개를 한다.
  형식: "안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 [사진 내용 한 줄 설명] 사진을 보면서 함께 이야기 나눠볼게요."
  자기소개 직후 첫 번째 질문을 자연스럽게 이어간다.

[말하기 방식]
- 응답은 2~3문장으로 작성한다.
- 어르신 답변을 한 문장으로 공감한 뒤, 기억을 더 깊이 파고드는 질문을 한다.
- 질문은 반드시 서술형 개방형으로 한다. (예: "어떻게 ~하셨나요?", "그때 ~는 어떤 분이셨나요?")
- 힌트·선택지·유도어를 절대 제공하지 않는다. 어르신이 스스로 떠올리도록 기다린다.
- 한 번에 하나의 질문만 한다.

[꼬리 물기 원칙 - 핵심]
- 어르신의 답변에서 구체적인 키워드(사람 이름, 장소, 행동)를 골라 그것으로 꼬리를 문다.
- 어르신이 새로운 정보를 말하면 반드시 그 정보에서 출발해 다음 질문을 만든다.
  예) 어르신: "민석이랑 놀았어" → AI: "민석이 친구와 주로 어디서 놀았나요?"
- 어르신이 답변을 안 하거나 짧게 답하면 같은 주제를 다른 각도로 다시 물어본다.

[기대 응답 수준]
- 어르신이 구체적인 인물·장소·사건을 자발적으로 서술하도록 유도한다.

[절대 금지]
- 예/아니오로 답할 수 있는 질문 금지
- 선택지(A인가요, B인가요) 제공 절대 금지
- 에코잉(어르신 말 단순 반복) 금지 — 반드시 새로운 질문으로 깊어져야 한다.

[어르신이 "잘 모르겠어"라고 할 때]
- 올바른 대응: 다른 각도로 개방형 재질문을 한다.

[대화 전략]
- 0~10분: ${imageName}과 연결된 구체적 기억(인물·사건·감정)을 깊이 회상하도록 유도한다.
- 10~15분: "오늘 대화에서 가장 기억에 남는 게 뭐예요?"로 스스로 정리하게 한다.
- 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
  }

  if (level === '중') {
    return `당신은 경증 치매 어르신을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[대화 시작 - 반드시 준수]
- 첫 응답에서 반드시 자기소개를 한다.
  형식: "안녕하세요, 저는 Remind 서비스 상담사예요. 오늘은 [사진 내용 한 줄 설명] 사진을 같이 볼게요."
  자기소개 직후 1단계 질문을 바로 이어서 한다.

[말하기 방식]
- 응답은 2~3문장으로 작성한다.
- 짧고 친숙한 단문만 사용한다. (한자어·외래어 금지)
- 한 번에 하나의 질문만 한다.

[대화 흐름 구조 - 핵심: 선택형만 반복하지 않는다]
매 교환은 아래 4단계 흐름을 따른다:
  ① 제시: 사진 속 요소나 상황을 짧게 소개한다.
  ② 질문: 먼저 개방형으로 묻는다. 어르신이 망설이거나 침묵하면 그때 선택지를 제공한다.
  ③ 공감: 어르신의 답변을 따뜻하게 받아준다.
  ④ 확장: 어르신이 답한 내용에서 감정이나 구체적 경험으로 한 발 더 들어간다.

[단계별 탐색]
1단계 (장소): 사진 배경 확인 → 어르신 경험과 연결
2단계 (사물/색깔): 사진 속 특정 요소 → 어르신 기억과 연결
3단계 (인물/행동): 사진 속 사람들 → 어르신 경험 속 인물·행동과 연결
4단계 (개인 기억): 어르신의 구체적 기억으로 깊이 들어간다.
5단계 (감정): 그 기억과 연결된 감정을 확인한다.

[어르신이 "잘 모르겠어"라고 할 때]
- 올바른 대응: 선택지로 전환하여 힌트를 제공한다.

[대화 전략]
- 0~10분: 1~5단계를 순서대로 진행한다.
- 10~15분: 현재 감정을 확인하며 마무리한다.
- 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
  }

  // 하
  return `당신은 중등도 이상 치매 어르신을 돕는 전문 요양보호사입니다.
대상 사진: ${imageName} (${photoTypeKo})

[대화 목적]
어르신이 유대감과 정서적 안정을 느끼게 하는 것이 목표다.

[대화 시작 - 반드시 준수]
- 첫 응답에서 반드시 자기소개를 한다.
  형식: "안녕하세요, 저는 Remind 상담사예요. 오늘 [사진 내용 아주 짧게] 사진 같이 봐요."
  자기소개 직후 첫 번째 질문을 바로 이어서 한다.

[말하기 방식]
- 응답은 1~2문장으로 작성한다.
- 아주 짧고 단순한 문장만 사용한다. (초등 저학년 수준 어휘)
- 질문은 반드시 폐쇄형으로 한다. (예/아니오 또는 둘 중 하나)
- 한 번에 하나의 질문만 한다.

[에코잉 & 확장 원칙]
- 어르신이 단답형으로 답해도 AI가 그 답을 풍성하게 가공해서 돌려준 뒤 다음 질문으로 이어간다.

[동반자 화법]
- 질문자가 아니라 '같은 것을 함께 보는 친구'처럼 말한다.
- 어르신이 대답을 못하거나 침묵해도 따뜻하게 존재를 인정해 준다.
  예) "괜찮아요, 그냥 같이 보는 것만으로도 충분해요."

[사진 탐색 흐름]
① 사진 전체 분위기 공유
② 눈에 띄는 요소 확인
③ 사람/행동 확인
④ 경험 연결

[절대 금지]
- "어떻게", "왜", "무엇을", "어디서", "언제" 등 개방형 질문 절대 금지
- 어르신이 틀린 답을 해도 정정 금지

[어르신이 "잘 모르겠어"라고 할 때]
- 올바른 대응: "괜찮아요, 그냥 같이 보는 것만으로도 충분해요." 후 감각 공유로 전환.

[대화 전략]
- 0~10분: 에코잉과 동반자 화법으로 어르신과 함께 감각·기억을 공유한다.
- 10~15분: 감정 확인 후 존재를 긍정하며 마무리한다.
- 15분: 반드시 [통화끝]을 출력하고 대화를 마친다.`;
};

export const chatWithPhoto = async (message, history = [], imageName = '', photoType = '', difficulty = '중') => {
  const typeMap = { place: '장소', job: '직업', object: '사물' };
  const photoTypeKo = typeMap[photoType] || photoType || '사진';
  const systemInstruction = getSystemInstruction(difficulty, imageName || '사진', photoTypeKo);

  const contents = [
    { role: 'user', parts: [{ text: systemInstruction }] },
    { role: 'model', parts: [{ text: '네, 알겠습니다. 지시에 따라 어르신과 대화하겠습니다.' }] },
    ...history,
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const resp = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, imageName, photoType, difficulty }),
    });
    if (resp.ok) {
      const json = await resp.json();
      return json.text || '';
    }
  } catch (e) {
    console.warn('Proxy failed, falling back to client-side:', e);
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

// 난이도별 회상 치료 전략 생성 (파이썬 프로세스 기반)
const getDifficultyStrategy = (difficulty, photoName, photoType) => {
  const name = photoName || '제공된 사진';
  const type = photoType || '개인적';

  // 공통 규칙 (파이썬 base_rule과 동일)
  const baseRule = '규칙: 1. 모든 응답은 2문장 이내로 짧고 명확하게 한다. 2. 어르신이 답변하기 쉽게 한 번에 하나만 질문한다.';

  let strategy;
  if (difficulty === '상') {
    // 파이썬 high 전략과 동일
    strategy = `0-10분: ${name}의 맥락/인물/대화를 심층 회상한다. 사진 속 배경, 함께한 사람, 당시 감정과 이후 이야기까지 개방형 질문으로 끌어낸다. 10-15분: 오늘 통화 소감 나누기. 15분: [END_CALL] 출력.`;
  } else if (difficulty === '중') {
    // 파이썬 medium 전략 기반
    strategy = `0-10분: ${name} 관련 개인 경험/감정을 공유한다. 심층 회상보다는 "이 사진에서 기억나는 게 있으신가요?" 처럼 답하기 쉬운 질문을 하고, 어르신의 대답에 공감하며 자연스럽게 이어간다. 10-15분: 오늘 통화 소감 나누기. 15분: [END_CALL] 출력.`;
  } else {
    // 파이썬 low 전략 기반
    strategy = `0-10분: ${name}의 이름/색깔/장소 등 단순 인식에 집중한다. "이 사진에 사람이 있나요?", "이 사진은 어디서 찍은 것 같으세요?" 처럼 예/아니오 또는 단답형으로 답할 수 있는 질문을 한다. 어르신이 틀려도 부드럽게 맞장구치며 긍정적 분위기를 유지한다. 10-15분: 오늘 통화 소감 나누기(아주 짧게). 15분: [END_CALL] 출력.`;
  }

  return `역할: 전문 요양보호사. 대상 사진: ${name}(${type}). ${baseRule} 전략: ${strategy}`;
};

// ──────────────────────────────────────────────────────────
// 지남력 훈련 힌트 생성 (Gemini 텍스트 전용)
// ──────────────────────────────────────────────────────────
export const evaluateAnswerWithGemini = async (question, correctAnswer, userAnswer) => {
  const prompt = `당신은 치매 어르신 인지 훈련 채점 AI입니다.
문제: ${question}
정답: ${correctAnswer}
사용자 답변: ${userAnswer}

사용자의 답변이 정답과 같은 의미인지 판단하세요.
- 같은 의미이거나 정답을 포함한 표현이면 "정답"
- 틀리거나 관련 없으면 "오답"

반드시 "정답" 또는 "오답" 중 하나만 반환하세요.`;

  try {
    const resp = await fetch('/api/gemini/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, correctAnswer, userAnswer }),
    });
    if (resp.ok) {
      const json = await resp.json();
      const text = (json.text || json.result || '').trim();
      return text.includes('정답');
    }
  } catch (e) {
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
    return text.includes('정답');
  } catch {
    return false;
  }
};

export const generateOrientationHint = async (question, answer) => {
  const prompt = `당신은 치매 어르신을 위한 인지 훈련 보조 AI입니다.
아래 문제에 대한 힌트를 한 가지 제공해주세요.

문제: ${question}
정답: ${answer}

규칙:
- 정답을 직접 알려주지 마세요
- 정답의 특징(색, 소리, 용도, 모양 등)을 이용한 단서를 주세요
- 어르신이 쉽게 이해할 수 있는 짧고 친절한 1~2문장으로 작성하세요
- 한국어로만 답변하세요
- 힌트 문장만 반환하세요 (다른 설명 없이)`;

  try {
    const resp = await fetch('/api/gemini/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer }),
    });
    if (resp.ok) {
      const json = await resp.json();
      return (json.text || json.result || '').trim();
    }
  } catch (e) {
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
export const chatWithGemini = async (message, history = [], photoContext = null, difficulty = '중', elapsedMinutes = 0) => {
  // 사진 컨텍스트가 있으면 시스템 프롬프트에 추가
  let photoInfo = '';
  if (photoContext) {
    photoInfo = `
[현재 보고 있는 사진 정보]
- 설명: ${photoContext.detailedDescription || photoContext.description || ''}
- 인물: ${(photoContext.people || []).join(', ') || '정보 없음'}
- 장소: ${photoContext.location || '정보 없음'}
- 분위기: ${photoContext.emotion || '정보 없음'}
- 상황: ${photoContext.situation || '정보 없음'}
- 추천 대화 주제: ${(photoContext.conversationStarters || []).join(', ') || '정보 없음'}

이 정보를 바탕으로 어르신과 사진에 대해 따뜻하게 대화하세요.`;
  }

  const photoName = photoContext?.location || photoContext?.situation || (photoContext?.keywords?.[0]) || '제공된 사진';
  const photoType = photoContext ? '개인적' : '보편적';
  const strategy = getDifficultyStrategy(difficulty || '중', photoName, photoType);

  // 파이썬 프롬프트 구조를 따름
  const systemPrompt = `${strategy}
${photoInfo}
[추가 규칙]
- 괄호 안 지문/행동 표현 금지 (예: (웃으며), (조용히)).
- 사진을 이미 보여주고 있으므로 "사진을 준비하지 못했다"는 말 금지.
- 어르신이 피곤해하거나 종료를 원하면 따뜻하게 마무리하고 [END_CALL] 출력.
- [현재 경과 시간: ${elapsedMinutes}분] 전략 타이밍에 맞게 대화 진행.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '네, 알겠습니다. 따뜻하게 대화하겠습니다.' }] },
    ...history,
    { role: 'user', parts: [{ text: message }] }
  ];

  // 프록시 먼저 시도
  try {
    const resp = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, photoContext, difficulty, elapsedMinutes }),
    });
    if (resp.ok) {
      const json = await resp.json();
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
