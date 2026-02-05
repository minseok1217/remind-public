// Gemini API Service
// 우선순위: 1) 로컬/원격 프록시 서버로 요청 -> 2) 클라이언트에서 직접 Gemini 호출(환경변수 필요)
const BACKEND_PROXY = import.meta.env.VITE_GEMINI_PROXY || '/api/gemini/analyze';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

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
