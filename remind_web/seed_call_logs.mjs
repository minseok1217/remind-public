import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDiGHtBF69iR3w8BRaR8PnVfGf0k1pbogg",
  authDomain: "remind-aa99f.firebaseapp.com",
  projectId: "remind-aa99f",
  storageBucket: "remind-aa99f.firebasestorage.app",
  messagingSenderId: "286493951038",
  appId: "1:286493951038:web:e167943198eaba8fee7d6f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const USER_ID = 'xuHcDSjJXPfW1b5KMt2BFbVsBQW2';

const dateAt = (daysAgo, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 23, 0, 0);
  return Timestamp.fromDate(d);
};

const logs = [
  // ── Day 7: 시장 사진 / 28점 / 관심 필요 ──────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(7, 10),
    createdAt: dateAt(7, 10),
    callDuration: 198,
    totalUtterances: 7,
    totalWords: 44,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 전통 시장 사진을 보면서 이야기 나눠볼게요. 시장 하면 어떤 기억이 제일 먼저 떠오르세요?
환자: 어... 시장이요 그거
AI: 시장에 자주 가셨나요? 어느 시장에 자주 가셨는지 기억나세요?
환자: 어 그 뭐야 거기 어디더라 잘 모르겠어
AI: 시장에서 뭔가 사시거나 드셨던 기억이 있으신가요?
환자: 그냥 거기서 뭐 사고 그랬지 뭐
AI: 시장에 주로 누구와 함께 가셨나요?
환자: 혼자 갔나 같이 갔나 그게 아니야
AI: 시장에서 즐겨 드셨던 음식 같은 게 있으셨나요?
환자: 어... 뭐 그게 잘 기억이 안 나네
AI: 오늘 함께 이야기 나눠주셔서 고마워요. 건강하게 지내세요.
환자: 응 그래`,
    photoContext: {
      description: "전통 시장에서 물건을 파는 상인",
      detailedDescription: "활기찬 전통 시장에서 채소와 과일을 파는 상인의 모습입니다.",
      emotion: "",
      location: "시장",
      people: ["상인"],
      keywords: ["시장", "상인", "채소", "과일"],
      conversationStarters: ["시장에 자주 가셨나요?"],
      situation: "전통 시장",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 41.2,
        wordsPerMinute: 13.3,
        fluencyScore: 28,
        topicDeviationRate: 20,
        emotionPositiveRatio: 15,
        emotionNegativeRatio: 85,
        responseLengthVariance: 38
      },
      scores: { cognitive: 28, language: 26, memory: 38, emotion: 15 },
      status: { level: 'warning', label: '관심 필요', color: '#f44336' },
      insights: [
        "구체적인 명사 대신 대명사 사용이 매우 많았습니다.",
        "발화 속도가 다소 느린 편입니다.",
        "반복이나 머뭇거림이 자주 관찰되었습니다.",
        "부정적인 감정 표현이 관찰되었습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 28,
          passed: false,
          detail: "'어... 그거', '그게 어...', '거기서 뭐 사고 그랬지' 등 불완전한 문장이 대부분입니다. 명확한 의사 전달이 어려운 상태입니다."
        },
        emotionalState: {
          score: 25,
          passed: false,
          detail: "대화 전반에 걸쳐 불확실함과 기억나지 않음에 대한 당혹감이 느껴졌습니다. 긍정적 감정 표현이 거의 없었습니다."
        },
        topicDeviation: {
          score: 75,
          topicDeviationRate: 25,
          passed: true,
          detail: "시장이라는 주제를 크게 벗어나지는 않았으나 구체적인 답변을 하지 못했습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 28,
    status: '관심 필요'
  },

  // ── Day 6: 운동회 사진 / 42점 / 주의 필요 ────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(6, 11),
    createdAt: dateAt(6, 11),
    callDuration: 256,
    totalUtterances: 10,
    totalWords: 78,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 학교 운동회 사진을 보면서 이야기 나눠볼게요. 이 사진을 보시니 어떤 생각이 드세요?
환자: 운동회 우리 때도 했지 학교에서
AI: 운동회에서 어떤 종목을 즐겨 하셨나요?
환자: 달리기 했던 거 같아 그리고 뭐 공 던지기 그런 거
AI: 달리기에서 좋은 성적을 거두신 적도 있으셨나요?
환자: 어 뭐 가끔 잘 달렸지 일등은 못 했어도
AI: 운동회 날 도시락은 어떻게 드셨나요?
환자: 어머니가 싸주셨지 뭐 김밥이나 그런 거
AI: 어머니가 싸주신 도시락 맛이 어떠셨어요?
환자: 맛있었지 그때는 뭐 먹는 게 귀할 때라서
AI: 운동회에서 가장 신났던 순간이 있으셨다면요?
환자: 우리 편이 이겼을 때 다 같이 좋아했던 기억이 있어
AI: 오늘 좋은 이야기 해주셔서 감사해요.
환자: 네네`,
    photoContext: {
      description: "학교 운동장에서 달리기를 하는 학생들",
      detailedDescription: "가을 운동회에서 학생들이 신나게 달리기를 하고 있는 모습입니다.",
      emotion: "활기찬",
      location: "학교 운동장",
      people: ["학생들", "선생님"],
      keywords: ["운동회", "달리기", "학교", "도시락"],
      conversationStarters: ["운동회에서 즐거운 기억이 있으신가요?"],
      situation: "학교 운동회",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 28.5,
        wordsPerMinute: 18.3,
        fluencyScore: 52,
        topicDeviationRate: 18,
        emotionPositiveRatio: 55,
        emotionNegativeRatio: 45,
        responseLengthVariance: 62
      },
      scores: { cognitive: 42, language: 44, memory: 55, emotion: 55 },
      status: { level: 'caution', label: '주의 필요', color: '#FF5722' },
      insights: [
        "발화 속도가 다소 느린 편입니다.",
        "반복이나 머뭇거림이 관찰되었습니다.",
        "대화 주제를 잘 유지하셨습니다.",
        "전반적으로 안정적인 대화를 나누셨습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 55,
          passed: false,
          detail: "'달리기 했던 거 같아', '어 뭐 가끔 잘 달렸지' 등 일부 불완전한 문장이 있었으나 전반적으로 의미 전달은 가능했습니다."
        },
        emotionalState: {
          score: 60,
          passed: true,
          detail: "어머니 도시락, 우리 편이 이겼던 기억 등 과거의 즐거운 기억을 회상하며 긍정적인 정서를 보였습니다."
        },
        topicDeviation: {
          score: 82,
          topicDeviationRate: 18,
          passed: true,
          detail: "운동회라는 주제를 일관되게 유지하며 자연스럽게 대화를 이어갔습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 42,
    status: '주의 필요'
  },

  // ── Day 5: 고향 마을 사진 / 37점 / 주의 필요 ─────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(5, 14),
    createdAt: dateAt(5, 14),
    callDuration: 232,
    totalUtterances: 9,
    totalWords: 61,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 시골 마을 풍경 사진을 보면서 이야기 나눠볼게요. 이 사진을 보시니 고향이 떠오르시나요?
환자: 어 그게 뭐 비슷하네 고향이랑
AI: 고향이 어딘지 여쭤봐도 될까요?
환자: 충청도 쪽이야 거기 어디였더라
AI: 고향에서 어린 시절 어떻게 보내셨나요?
환자: 뭐 밭에서 놀고 그랬지 애들이랑 뛰어다니고
AI: 밭에서 어떤 걸 키우셨나요?
환자: 고추 뭐 배추 그런 거 어머니가 다 했어 우리는 그냥
AI: 고향에서 가장 그리운 것은 무엇인가요?
환자: 글쎄 그게 이제 다 없어졌으니까 뭐 그게 뭐야
AI: 가족들이랑 함께 지내던 기억도 있으신가요?
환자: 형제들이 많았어 몇이었더라 넷인가 다섯인가
AI: 오늘 고향 이야기 들려주셔서 감사해요.
환자: 응 뭐`,
    photoContext: {
      description: "시골 마을의 평화로운 풍경",
      detailedDescription: "논밭이 펼쳐진 시골 마을 풍경으로 고향의 정취가 느껴집니다.",
      emotion: "그리운",
      location: "시골 마을",
      people: [],
      keywords: ["고향", "밭", "시골", "마을"],
      conversationStarters: ["고향이 어디신가요?"],
      situation: "시골 고향 마을",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 35.1,
        wordsPerMinute: 15.8,
        fluencyScore: 38,
        topicDeviationRate: 22,
        emotionPositiveRatio: 30,
        emotionNegativeRatio: 70,
        responseLengthVariance: 52
      },
      scores: { cognitive: 37, language: 35, memory: 48, emotion: 30 },
      status: { level: 'caution', label: '주의 필요', color: '#FF5722' },
      insights: [
        "구체적인 명사 대신 대명사 사용이 많았습니다.",
        "발화 속도가 다소 느린 편입니다.",
        "반복이나 머뭇거림이 관찰되었습니다.",
        "부정적인 감정 표현이 관찰되었습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 40,
          passed: false,
          detail: "'거기 어디였더라', '그게 뭐야', '몇이었더라 넷인가 다섯인가' 등 불완전하고 기억을 더듬는 표현이 많았습니다."
        },
        emotionalState: {
          score: 40,
          passed: false,
          detail: "고향에 대한 그리움과 상실감이 혼재하였습니다. '다 없어졌으니까'라는 표현에서 상실감이 느껴집니다."
        },
        topicDeviation: {
          score: 78,
          topicDeviationRate: 22,
          passed: true,
          detail: "고향이라는 주제를 대체로 유지했으나 간간이 생각이 흐트러지는 모습이 보였습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 37,
    status: '주의 필요'
  },

  // ── Day 4: 가족 식사 사진 / 56점 / 보통 ──────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(4, 10),
    createdAt: dateAt(4, 10),
    callDuration: 298,
    totalUtterances: 12,
    totalWords: 112,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 가족들이 함께 식사하는 사진을 보면서 이야기 나눠볼게요. 이런 가족 밥상 풍경이 기억나시나요?
환자: 그럼요 우리 집에서 다 같이 밥 먹던 생각 나네요
AI: 가족들과 함께 식사하실 때 어떤 음식이 자주 올라왔나요?
환자: 된장찌개를 많이 먹었어요 어머니가 맛있게 끓이셨거든요 김치도 항상 있었고
AI: 어머니표 된장찌개가 특별하셨군요. 어떤 재료가 들어갔는지 기억나세요?
환자: 두부랑 호박이 들어갔고 멸치로 국물 냈던 거 같아요 그 맛이 지금도 생각나네
AI: 가족이 다 같이 모이는 특별한 날이 있었나요?
환자: 명절에는 꼭 다 모였어요 설날이나 추석에 형제들이 다 왔지요
AI: 명절에 특별히 기억나는 음식이 있으신가요?
환자: 전 부치는 거 도왔던 기억이 나요 어머니 옆에서 뒤집어드리고
AI: 그 시절 가족들이랑 함께한 밥상에서 가장 행복했던 순간이 있으셨나요?
환자: 다 같이 웃으면서 먹던 그 시간이 좋았죠 지금 생각해도 따뜻해요
AI: 요즘도 가족들과 자주 식사하시나요?
환자: 가끔 아이들이 오면 같이 먹지요 예전만큼은 아니지만
AI: 오늘 따뜻한 이야기 들려주셔서 감사합니다.
환자: 네 좋은 얘기 했네요`,
    photoContext: {
      description: "가족들이 둘러앉아 함께 밥을 먹는 모습",
      detailedDescription: "온 가족이 한 상에 모여 따뜻한 식사를 나누는 정겨운 가족 밥상입니다.",
      emotion: "따뜻한",
      location: "집",
      people: ["가족", "어머니"],
      keywords: ["가족", "식사", "된장찌개", "명절"],
      conversationStarters: ["가족들과 식사하던 기억이 있으신가요?"],
      situation: "가족 식사",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 18.3,
        wordsPerMinute: 22.5,
        fluencyScore: 68,
        topicDeviationRate: 12,
        emotionPositiveRatio: 72,
        emotionNegativeRatio: 28,
        responseLengthVariance: 74
      },
      scores: { cognitive: 56, language: 60, memory: 65, emotion: 72 },
      status: { level: 'normal', label: '보통', color: '#FF9800' },
      insights: [
        "유창하게 대화를 이어가셨습니다.",
        "대화 주제를 잘 유지하셨습니다.",
        "긍정적인 감정 표현이 많았습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 70,
          passed: true,
          detail: "대부분의 답변이 완전한 문장으로 이루어져 있었습니다. '두부랑 호박이 들어갔고 멸치로 국물 냈던 거 같아요' 등 구체적인 묘사가 가능했습니다."
        },
        emotionalState: {
          score: 75,
          passed: true,
          detail: "가족과의 따뜻한 기억을 긍정적인 감정으로 회상하였습니다. '지금 생각해도 따뜻해요'라는 표현에서 안정적인 정서 상태가 확인됩니다."
        },
        topicDeviation: {
          score: 88,
          topicDeviationRate: 12,
          passed: true,
          detail: "가족 식사라는 주제를 일관되게 유지하며 자연스럽게 관련 기억들을 이어나갔습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 56,
    status: '보통'
  },

  // ── Day 3: 여름 바다 사진 / 65점 / 양호 ──────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(3, 13),
    createdAt: dateAt(3, 13),
    callDuration: 331,
    totalUtterances: 13,
    totalWords: 147,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 여름 바닷가 사진을 보면서 이야기 나눠볼게요. 바다 하면 어떤 기억이 가장 먼저 떠오르세요?
환자: 부산 바다가 생각나요 거기 자갈치 시장 근처 바다
AI: 부산 바다에는 어떤 계기로 가셨나요?
환자: 아이들 어릴 때 여름휴가로 갔었어요 해수욕장에서 놀고 회도 먹고
AI: 아이들이 바다에서 어떻게 놀았는지 기억나세요?
환자: 모래성 쌓는다고 난리였죠 그리고 파도 보고 무섭다고 울기도 하고 웃기기도 했어
AI: 아이들이 파도를 무서워했군요. 어르신은 바다가 무섭지 않으셨어요?
환자: 나는 좋았죠 바닷바람이 시원하고 넓은 바다 보면 마음이 탁 트이는 것 같아서
AI: 그때 드신 회가 맛있으셨겠어요. 어떤 회를 드셨나요?
환자: 광어회 많이 먹었어요 부산이니까 싱싱하고 저렴하게 먹을 수 있었거든요
AI: 여름 바다에서 가장 기억에 남는 순간이 있으셨다면요?
환자: 저녁에 가족이 다 같이 해변가에 앉아서 아이스크림 먹던 게 생각나요 그때가 참 좋았어요
AI: 바다에서 그런 추억을 만드셨군요. 요즘도 바다 가고 싶으신 적이 있으세요?
환자: 가끔 그렇죠 몸이 좀 더 좋으면 한번 더 가고 싶은데
AI: 오늘 좋은 추억 이야기 들려주셔서 감사해요.
환자: 얘기하고 나니까 기분이 좋네요 바다 생각이 나서`,
    photoContext: {
      description: "파란 여름 바다와 모래사장 풍경",
      detailedDescription: "맑고 투명한 여름 바닷가에서 가족들이 즐거운 시간을 보내고 있습니다.",
      emotion: "시원한",
      location: "부산 해수욕장",
      people: ["가족", "아이들"],
      keywords: ["바다", "여름", "해수욕", "가족여행", "회"],
      conversationStarters: ["바다에서 휴가를 즐기신 적이 있으신가요?"],
      situation: "가족 여름 휴가",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 14.7,
        wordsPerMinute: 26.7,
        fluencyScore: 79,
        topicDeviationRate: 8,
        emotionPositiveRatio: 80,
        emotionNegativeRatio: 20,
        responseLengthVariance: 81
      },
      scores: { cognitive: 65, language: 70, memory: 72, emotion: 80 },
      status: { level: 'good', label: '양호', color: '#4CAF50' },
      insights: [
        "유창하게 대화를 이어가셨습니다.",
        "대화 주제를 잘 유지하셨습니다.",
        "긍정적인 감정 표현이 많았습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 78,
          passed: true,
          detail: "대부분의 문장이 완성도 있게 구성되었습니다. '광어회 많이 먹었어요 부산이니까 싱싱하고 저렴하게 먹을 수 있었거든요' 등 구체적이고 완결된 문장이 많았습니다."
        },
        emotionalState: {
          score: 82,
          passed: true,
          detail: "바다 여행에 대한 즐거운 기억을 생생하게 회상하며 긍정적인 정서를 유지했습니다. 마지막에 '기분이 좋네요'라고 표현한 것이 인상적입니다."
        },
        topicDeviation: {
          score: 92,
          topicDeviationRate: 8,
          passed: true,
          detail: "바다와 가족여행이라는 주제를 일관되게 유지하며 구체적인 기억들을 자연스럽게 이야기했습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 65,
    status: '양호'
  },

  // ── Day 2: 명절 사진 / 58점 / 보통 ───────────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(2, 15),
    createdAt: dateAt(2, 15),
    callDuration: 275,
    totalUtterances: 11,
    totalWords: 98,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 추석 명절 사진을 보면서 이야기 나눠볼게요. 추석 하면 어떤 기억이 떠오르세요?
환자: 추석에는 온 식구가 다 모였지요 그때는 다 같이 차례도 지내고
AI: 차례 준비를 어떻게 하셨나요?
환자: 음식을 많이 했어요 전이랑 나물이랑 탕도 하고 전날부터 준비했지
AI: 명절 준비가 힘드시지는 않으셨나요?
환자: 힘들었지만 다 같이 하니까 그래도 재밌기도 했어요
AI: 추석에 하신 풍속이나 놀이가 있으셨나요?
환자: 강강술래 했던 기억이 어릴 때 있고 어른 되고는 윷놀이도 많이 했어요
AI: 윷놀이할 때 재미있는 에피소드가 있으셨나요?
환자: 편 나눠서 하면 지기 싫어가지고 막 우기고 그랬죠 뭐
AI: 추석에 가장 맛있게 드셨던 음식이 기억나세요?
환자: 어머니가 만드신 송편이 제일 맛있었어요 속을 깨로 넣어서 만드셨는데
AI: 요즘 명절은 어떻게 보내시나요?
환자: 요즘은 그래 많이 달라졌어요 그때처럼 크게 모이진 않고
AI: 오늘 명절 이야기 들려주셔서 고마워요.
환자: 네 옛날 생각이 나네요`,
    photoContext: {
      description: "추석 명절 차례상과 가족들이 모인 모습",
      detailedDescription: "풍성한 추석 차례상 앞에 온 가족이 모여 명절의 따뜻함을 나누고 있습니다.",
      emotion: "풍성한",
      location: "집",
      people: ["가족", "어머니"],
      keywords: ["추석", "명절", "차례", "송편", "윷놀이"],
      conversationStarters: ["추석 명절은 어떻게 보내셨나요?"],
      situation: "추석 명절",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 16.5,
        wordsPerMinute: 21.4,
        fluencyScore: 72,
        topicDeviationRate: 10,
        emotionPositiveRatio: 65,
        emotionNegativeRatio: 35,
        responseLengthVariance: 70
      },
      scores: { cognitive: 58, language: 62, memory: 68, emotion: 65 },
      status: { level: 'normal', label: '보통', color: '#FF9800' },
      insights: [
        "유창하게 대화를 이어가셨습니다.",
        "대화 주제를 잘 유지하셨습니다.",
        "긍정적인 감정 표현이 많았습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 72,
          passed: true,
          detail: "대부분 완결된 문장으로 대화를 이어갔습니다. '어머니가 만드신 송편이 제일 맛있었어요 속을 깨로 넣어서 만드셨는데' 등 구체적인 기억을 잘 표현했습니다."
        },
        emotionalState: {
          score: 68,
          passed: true,
          detail: "명절 기억에 대해 전반적으로 긍정적이고 따뜻한 감정을 표현했습니다. 다만 '요즘은 많이 달라졌어요'에서 약간의 아쉬움이 느껴졌습니다."
        },
        topicDeviation: {
          score: 90,
          topicDeviationRate: 10,
          passed: true,
          detail: "추석 명절이라는 주제를 일관되게 유지하며 다양한 기억들을 자연스럽게 연결했습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 58,
    status: '보통'
  },

  // ── Day 1: 손자녀 사진 / 73점 / 양호 ─────────────────────────────────
  {
    userId: USER_ID,
    photoOwnerId: USER_ID,
    photoId: null,
    hasPhoto: true,
    callDate: dateAt(1, 11),
    createdAt: dateAt(1, 11),
    callDuration: 362,
    totalUtterances: 14,
    totalWords: 168,
    conversation: `AI: 안녕하세요, 저는 Remind 서비스 상담사입니다. 오늘은 아이들이 뛰어노는 사진을 보면서 이야기 나눠볼게요. 이 사진 보시니 어떤 분들이 생각나세요?
환자: 우리 손주들이 생각나네요 저렇게 뛰어다니고 그랬는데
AI: 손주들이 몇 명이신가요?
환자: 셋이에요 큰 아이가 중학교 다니고 아래 둘은 초등학생이에요
AI: 손주들이랑 같이 놀아주신 기억이 있으신가요?
환자: 그럼요 어릴 때는 공원에 자주 데리고 갔어요 그네도 태워주고 미끄럼틀도 같이 타고
AI: 손주들이 할아버지랑 가장 좋아했던 놀이가 뭐였나요?
환자: 큰애가 잡기 놀이를 좋아했어요 내가 잡으러 가면 막 도망가고 까르르 웃고 그랬죠
AI: 그 기억이 참 생생하시겠어요. 손주들이 할아버지를 많이 따랐나요?
환자: 아 많이 따랐죠 밥도 나랑 같이 먹겠다고 하고 잠도 옆에서 자겠다고 하고
AI: 손주들과 함께 한 특별한 여행이 있으셨나요?
환자: 강원도 에버랜드 아니 설악산을 같이 갔던 기억이 있어요 케이블카 타고 올라갔는데 무서워했지만 정상에서 좋아하더라고요
AI: 손주들에게 특별히 해주고 싶으신 말씀이 있으신가요?
환자: 건강하게 잘 자라줘서 고맙다고 하고 싶어요 보는 것만으로도 행복하거든요
AI: 정말 사랑스러운 손주들이군요. 요즘도 자주 보시나요?
환자: 주말에 한번씩 오는데 올 때마다 너무 반가워요 보고 싶었다고 달려오거든요
AI: 오늘 손주들 이야기 들려주셔서 정말 감사해요. 행복해 보이셨습니다.
환자: 얘기하면서 기분이 정말 좋아졌어요 오늘 통화 좋았습니다`,
    photoContext: {
      description: "아이들이 공원에서 즐겁게 뛰어노는 모습",
      detailedDescription: "햇살 가득한 공원에서 아이들이 신나게 뛰어노는 행복한 모습입니다.",
      emotion: "행복한",
      location: "공원",
      people: ["손주들", "아이들"],
      keywords: ["손주", "공원", "놀이", "가족", "행복"],
      conversationStarters: ["손자녀와 함께한 추억이 있으신가요?"],
      situation: "손주들과의 놀이",
      year: "",
      finalCaption: "",
      answerKeywords: []
    },
    analysis: {
      metrics: {
        pronounRatio: 11.2,
        wordsPerMinute: 27.9,
        fluencyScore: 84,
        topicDeviationRate: 6,
        emotionPositiveRatio: 88,
        emotionNegativeRatio: 12,
        responseLengthVariance: 85
      },
      scores: { cognitive: 73, language: 76, memory: 78, emotion: 88 },
      status: { level: 'good', label: '양호', color: '#4CAF50' },
      insights: [
        "유창하게 대화를 이어가셨습니다.",
        "대화 주제를 잘 유지하셨습니다.",
        "긍정적인 감정 표현이 많았습니다."
      ],
      report: {
        sentenceCompleteness: {
          score: 85,
          passed: true,
          detail: "거의 모든 문장이 완결성 있게 구성되었습니다. '큰애가 잡기 놀이를 좋아했어요 내가 잡으러 가면 막 도망가고 까르르 웃고 그랬죠' 등 생생한 묘사가 인상적입니다."
        },
        emotionalState: {
          score: 90,
          passed: true,
          detail: "손주들에 대한 깊은 사랑과 행복감이 대화 전반에 걸쳐 느껴졌습니다. '보는 것만으로도 행복하거든요', '기분이 정말 좋아졌어요' 등 긍정적인 감정 표현이 풍부했습니다."
        },
        topicDeviation: {
          score: 94,
          topicDeviationRate: 6,
          passed: true,
          detail: "손주들과의 기억이라는 주제를 일관되게 유지하며 다양하고 구체적인 에피소드를 자연스럽게 이야기했습니다."
        },
        guardianCaption: {
          score: null,
          passed: null,
          detail: "보호자 입력 캡션 없이 진행된 통화입니다.",
          categories: []
        }
      }
    },
    cognitiveScore: 73,
    status: '양호'
  }
];

async function seed() {
  console.log(`총 ${logs.length}개 더미 데이터 추가 시작...`);
  for (const log of logs) {
    try {
      const ref = await addDoc(collection(db, 'call_logs'), log);
      const daysAgoLabel = logs.indexOf(log) === 0 ? '7일 전' :
                           logs.indexOf(log) === 1 ? '6일 전' :
                           logs.indexOf(log) === 2 ? '5일 전' :
                           logs.indexOf(log) === 3 ? '4일 전' :
                           logs.indexOf(log) === 4 ? '3일 전' :
                           logs.indexOf(log) === 5 ? '2일 전' : '어제';
      console.log(`✅ [${daysAgoLabel}] ${log.status} (${log.cognitiveScore}점) → ${ref.id}`);
    } catch (err) {
      console.error('❌ 추가 실패:', err.message);
    }
  }
  console.log('완료!');
  process.exit(0);
}

seed();
