// Gemini API Service
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent';

export const analyzeImageWithGemini = async (imageBase64, userDescription) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                text: `사진과 다음 설명을 기반으로 중요한 키워드를 5-7개 추출해주세요. JSON 형식으로 반환해주세요: {"keywords": ["키워드1", "키워드2", ...]}
                
보호자 설명: ${userDescription}

추출된 키워드는 나중에 영상통화에서 대화의 주제가 될 중요한 내용들이어야 합니다.`,
              },
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
      const text = data.candidates[0].content?.parts?.[0]?.text || '';
      return text;
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
        
        // Parse JSON response to extract keywords
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            resolve(parsed.keywords || []);
          } else {
            // Fallback: split by commas if JSON parsing fails
            const keywords = response.split(',').map(k => k.trim()).filter(k => k);
            resolve(keywords);
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON, using fallback method:', parseError);
          const keywords = response.split(',').map(k => k.trim()).filter(k => k);
          resolve(keywords);
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
