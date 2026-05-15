// Simple Express proxy to call Gemini on the server-side.
// Usage: node server/gemini-proxy.js  (.env in project root is loaded automatically)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not set. Proxy will not work without it.');
}

app.post('/api/gemini/analyze', async (req, res) => {
  const { imageBase64, userDescription } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const prompt = `당신은 치매 어르신과의 회상 치료 대화를 돕는 AI 분석가입니다. 사진과 보호자 설명을 분석하여 어르신과 자연스러운 대화를 나눌 수 있는 정보를 추출해주세요.

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

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      return res.status(502).json({ error: 'Gemini API error', details: txt });
    }

    const data = await response.json();
    // try to extract candidate text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
    return res.json({ text, raw: data });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 텍스트 채팅 엔드포인트
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history, photoContext, systemPrompt: clientSystemPrompt } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message required' });

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

  const systemPrompt = clientSystemPrompt || `당신은 치매 노인을 위한 다정하고 침착한 '회상 치료사'입니다.
${photoInfo}
[대화 규칙]
1. 답변은 어르신이 듣기 편하도록 1~2문장 이내로 짧고 천천히 하세요.
2. 사진에 대한 대화라면, 사진 속 추억을 함께 나누듯 질문하고 반응하세요.
3. 사용자가 피곤해하거나 대화를 그만하고 싶어 하면 따뜻한 마무리 인사를 건네세요.
4. 마무리 인사 맨 마지막에는 [END_CALL] 태그를 붙이세요.
5. 절대로 (살짝 놀라며), (웃으며), (조용히) 같은 괄호 안 지문/행동 표현을 쓰지 마세요. 음성으로 직접 말하는 것만 작성하세요.
6. 사진을 이미 보여주고 있으므로, "사진을 준비하지 못했다"같은 말을 하지 마세요. 사진에 대해 자연스럽게 대화하세요.`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '네, 알겠습니다. 따뜻하게 대화하겠습니다.' }] },
    ...(history || []),
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      const txt = await response.text();
      return res.status(502).json({ error: 'Gemini API error', details: txt });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
});
// ElevenLabs Scribe 토큰 엔드포인트
app.get('/api/elevenlabs/scribe-token', async (req, res) => {
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });
  }
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text/streaming/create-signed-url',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiry_time_seconds: 60 }),
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }
    const data = await response.json();
    return res.json({ token: data.signed_url || data.token });
  } catch (err) {
    console.error('Scribe token error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 서버 시작 (모든 라우트 정의 후 마지막에!)
app.listen(PORT, () => console.log(`Gemini proxy listening on http://localhost:${PORT}`));
