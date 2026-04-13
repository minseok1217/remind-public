import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { textToSpeech } from '../services/textToSpeechService';
import './KMMSEScreen.css';

// ─────────────────────────────────────────────
// 단어 은행 (기억 등록용)
// ─────────────────────────────────────────────
const WORD_BANK = [
  '사과','오렌지','포도','귤','수박','딸기','바나나','참외','복숭아','토마토',
  '감자','고구마','양파','마늘','당근','오이','배추','상추','고추','무',
  '호박','버섯','가지','옥수수','빵','우유','사탕','과자','물','밥',
  '강아지','고양이','소','돼지','말','양','염소','토끼','쥐','호랑이',
  '사자','코끼리','기린','원숭이','사슴','곰','닭','오리','참새','비둘기',
  '까치','거위','독수리','개구리','뱀','나비','벌','파리','모기','개미',
  '산','바다','강','들','하늘','땅','구름','비','눈','바람',
  '해','달','별','돌','흙','모래','나무','꽃','풀','나뭇잎',
  '집','학교','병원','은행','우체국','시장','공원','식당','약국','가게',
  '책상','의자','침대','옷장','쇼파','거울','시계','가위','자','연필',
  '지우개','공책','책','가방','지갑','우산','안경','모자','신발','양말',
  '바지','치마','장갑','목도리','수건','비누','칫솔','치약','빗','휴지',
  '자동차','버스','기차','비행기','배','자전거','오토바이','지하철','택시','트럭',
  '전화기','컴퓨터','텔레비전','냉장고','세탁기','에어컨','선풍기','청소기','다리미','카메라',
  '냄비','주전자','그릇','접시','컵','숟가락','젓가락','칼','도마','국자',
];

// ─────────────────────────────────────────────
// 따라 말하기 문장 목록
// ─────────────────────────────────────────────
const PROVERBS = [
  '가는 날이 장날이다.', '소 잃고 외양간 고친다.', '누워서 침 뱉기.',
  '발 없는 말이 천리 간다.', '돌다리도 두들겨 보고 건너라.',
  '낮말은 새가 듣고 밤말은 쥐가 듣는다.', '티끌 모아 태산이다.',
  '원숭이도 나무에서 떨어진다.', '벼는 익을수록 고개를 숙인다.',
  '사공이 많으면 배가 산으로 간다.', '세 살 버릇 여든까지 간다.',
  '고생 끝에 낙이 온다.', '금강산도 식후경이다.', '등잔 밑이 어둡다.',
  '천 리 길도 한 걸음부터.', '시작이 반이다.', '개구리 올챙이 적 생각 못한다.',
  '호랑이에게 물려가도 정신만 차리면 산다.', '아는 길도 물어가라.',
  '말 한마디에 천 냥 빚 갚는다.', '뿌린 대로 거둔다.',
  '가는 말이 고와야 오는 말이 곱다.', '공든 탑이 무너지랴.',
  '오늘 아침에는 밥 대신 빵을 먹었습니다.',
  '봄이 오니 꽃이 활짝 피었습니다.',
  '건강을 위해 매일 걷기 운동을 하세요.',
  '따뜻한 차 한 잔이 몸을 녹여줍니다.',
  '강아지가 꼬리를 흔들며 반겨줍니다.',
  '이번 주말에는 가족들과 여행을 갑니다.',
];

const TONGUE_TWISTERS = [
  '간장 공장 공장장은 장 공장장이다.',
  '내가 그린 기린 그림은 잘 그린 그림이다.',
  '칠월 칠일은 평창 친구 친정 가는 날.',
  '앞집 팥죽은 붉은 팥죽이고 뒷집 콩죽은 검은 콩죽이다.',
  '경찰청 철창살은 외철창살인가 쌍철창살인가.',
  '들의 콩깍지는 깐 콩깍지인가 안 깐 콩깍지인가.',
];

// 유틸 함수
const pickRandom = (arr, n = 1) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return n === 1 ? shuffled[0] : shuffled.slice(0, n);
};

// 점수 → 난이도
const getDifficulty = (score, maxScore) => {
  const normalized = Math.round((score / maxScore) * 30);
  if (normalized >= 21) return { level: '상', label: '경도인지장애~최경도', color: '#16a34a' };
  if (normalized >= 16) return { level: '중', label: '경도', color: '#f59e0b' };
  return { level: '하', label: '중등도', color: '#ef4444' };
};

// ─────────────────────────────────────────────
// 단계(step) 목록 빌더
// ─────────────────────────────────────────────
const buildSteps = (memoryWords, followPhrase, loc = {}) => {
  const now = new Date();
  const dayNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const seasons = [null,'겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'];
  const yr = now.getFullYear(), mo = now.getMonth()+1, dt = now.getDate();
  const day = dayNames[now.getDay()], season = seasons[mo];

  return [
    // ── 도입 나레이션 ──
    {
      type: 'narration',
      title: '시작 전 안내',
      text: `안녕하세요, 어르신. '리마인드' 서비스를 시작하기에 앞서, 어르신의 현재 기억력을 확인해보는 시간을 가지려고 합니다.\n\n지금부터 몇 가지 질문을 드릴 거예요. 시험이라고 생각하지 마시고, 편안하게 대답해 주시면 됩니다.\n\n잘 모르겠다면 '잘 모르겠어요'라고 말씀하셔도 괜찮습니다.\n\n준비가 되셨다면 '시작하기' 버튼을 눌러주세요.`,
      btnLabel: '시작하기',
    },

    // ── 영역 1: 시간/장소 지남력 ──
    {
      type: 'section_narration',
      title: '영역 1 / 시간·장소 지남력',
      text: '먼저 오늘이 언제인지, 그리고 지금 계신 곳이 어디인지 여쭤보겠습니다.',
    },
    { type:'question', id:'t1', section:'시간·장소 지남력', maxScore:1,
      question:'올해는 몇 년도인가요?', inputType:'text', placeholder:'예: 2026',
      evaluate:(a) => a.trim().includes(String(yr)) ? 1 : 0 },
    { type:'question', id:'t2', section:'시간·장소 지남력', maxScore:1,
      question:'오늘은 몇 월인가요?', inputType:'text', placeholder:'예: 4',
      evaluate:(a) => a.trim().replace(/[월\s]/g,'') === String(mo) ? 1 : 0 },
    { type:'question', id:'t3', section:'시간·장소 지남력', maxScore:1,
      question:'오늘은 며칠인가요?', inputType:'text', placeholder:'예: 6',
      evaluate:(a) => a.trim().replace(/[일\s]/g,'') === String(dt) ? 1 : 0 },
    { type:'question', id:'t4', section:'시간·장소 지남력', maxScore:1,
      question:'오늘은 무슨 요일인가요?',
      inputType:'choice', choices:['월요일','화요일','수요일','목요일','금요일','토요일','일요일'],
      evaluate:(a) => a === day ? 1 : 0 },
    { type:'question', id:'t5', section:'시간·장소 지남력', maxScore:1,
      question:'지금은 무슨 계절인가요?',
      inputType:'choice', choices:['봄 🌸','여름 ☀️','가을 🍂','겨울 ❄️'],
      evaluate:(a) => a.startsWith(season) ? 1 : 0 },
    { type:'question', id:'p1', section:'시간·장소 지남력', maxScore:1,
      question:'지금 우리가 있는 나라는 어디인가요?', inputType:'text', placeholder:'예: 대한민국',
      evaluate:(a) => /대한민국|한국/.test(a) ? 1 : 0 },
    { type:'question', id:'p2', section:'시간·장소 지남력', maxScore:1,
      question:'지금 어르신이 계신 곳은 어느 시(또는 도)인가요?', inputType:'text', placeholder:'예: 서울, 경기도',
      evaluate:(a) => {
        if (!loc.city) return a.trim().length > 0 ? 1 : 0;
        const cityKey = loc.city.replace(/특별시$|광역시$|특별자치시$|특별자치도$|도$|시$/, '');
        return a.includes(cityKey) ? 1 : 0;
      }},
    { type:'question', id:'p3', section:'시간·장소 지남력', maxScore:1,
      question:'이곳은 무엇을 하는 곳인가요?',
      inputType: loc.placeType ? 'choice' : 'text',
      choices: ['집','요양원','병원','기타'],
      placeholder:'예: 집, 요양원, 병원',
      evaluate:(a) => {
        if (!loc.placeType) return a.trim().length > 0 ? 1 : 0;
        return a.includes(loc.placeType) ? 1 : 0;
      }},
    { type:'question', id:'p4', section:'시간·장소 지남력', maxScore:1,
      question:'이 건물(또는 장소)의 이름은 무엇인가요?', inputType:'text', placeholder:'예: 우리집, 행복 요양원',
      evaluate:(a) => {
        if (!loc.placeName) return a.trim().length > 0 ? 1 : 0;
        const key = loc.placeName.slice(0, Math.min(2, loc.placeName.length));
        return a.includes(key) ? 1 : 0;
      }},
    { type:'question', id:'p5', section:'시간·장소 지남력', maxScore:1,
      question:'지금 몇 층에 계신가요?', inputType:'text', placeholder:'예: 1층',
      evaluate:(a) => {
        if (!loc.floor) return a.trim().length > 0 ? 1 : 0;
        return a.replace(/[^0-9]/g,'') === loc.floor.replace(/[^0-9]/g,'') ? 1 : 0;
      }},

    // ── 영역 2: 기억 등록 ──
    {
      type: 'section_narration',
      title: '영역 2 / 기억 등록',
      text: `이제 제가 세 가지 단어를 보여드릴게요.\n잘 보시고 기억해 주세요.\n나중에 다시 여쭤볼 테니 꼭 기억하셔야 합니다.`,
    },
    {
      type: 'memory_show',
      id: 'mem_show',
      words: memoryWords,
      maxScore: 3,
      evaluate: () => 3,
    },

    // ── 영역 3: 주의집중 및 계산 ──
    {
      type: 'section_narration',
      title: '영역 3 / 주의집중 및 계산',
      text: '이번에는 숫자를 빼보겠습니다.\n조금 어려울 수 있지만 천천히 해보세요.',
    },
    { type:'question', id:'c1', section:'주의집중 및 계산', maxScore:1,
      question:'100에서 7을 빼면 얼마인가요?', inputType:'text', placeholder:'숫자를 말씀해 주세요',
      evaluate:(a) => a.trim().replace(/[^0-9]/g,'') === '93' ? 1 : 0 },
    { type:'question', id:'c2', section:'주의집중 및 계산', maxScore:1,
      question:'거기서 또 7을 빼면 얼마인가요?', inputType:'text', placeholder:'숫자를 말씀해 주세요',
      evaluate:(a) => a.trim().replace(/[^0-9]/g,'') === '86' ? 1 : 0 },
    { type:'question', id:'c3', section:'주의집중 및 계산', maxScore:1,
      question:'거기서 또 7을 빼면 얼마인가요?', inputType:'text', placeholder:'숫자를 말씀해 주세요',
      evaluate:(a) => a.trim().replace(/[^0-9]/g,'') === '79' ? 1 : 0 },
    { type:'question', id:'c4', section:'주의집중 및 계산', maxScore:1,
      question:'거기서 또 7을 빼면 얼마인가요?', inputType:'text', placeholder:'숫자를 말씀해 주세요',
      evaluate:(a) => a.trim().replace(/[^0-9]/g,'') === '72' ? 1 : 0 },
    { type:'question', id:'c5', section:'주의집중 및 계산', maxScore:1,
      question:'거기서 또 7을 빼면 얼마인가요?', inputType:'text', placeholder:'숫자를 말씀해 주세요',
      evaluate:(a) => a.trim().replace(/[^0-9]/g,'') === '65' ? 1 : 0 },

    // ── 영역 4: 기억 회상 ──
    {
      type: 'section_narration',
      title: '영역 4 / 기억 회상',
      text: '아까 제가 기억해달라고 부탁드렸던 세 가지 단어가 있었죠?\n그것이 무엇이었나요?',
    },
    {
      type: 'question', id: 'recall', section: '기억 회상', maxScore: 3,
      question: '기억나는 단어를 모두 말씀해 주세요.',
      inputType: 'text', placeholder: '기억나는 단어를 말씀해 주세요',
      evaluate: (a) => {
        let score = 0;
        memoryWords.forEach(w => { if (a.includes(w)) score++; });
        return score;
      },
    },

    // ── 영역 5: 언어 및 실행 능력 ──
    {
      type: 'section_narration',
      title: '영역 5 / 언어 및 실행 능력',
      text: '화면에 나오는 것들을 보고 질문에 답해 보세요.',
    },
    { type:'question', id:'l1', section:'언어 및 실행 능력', maxScore:1,
      question:'이것은 무엇인가요?', inputType:'object_name',
      emoji:'⌚', objectHint:'시계',
      evaluate:(a) => a.trim().includes('시계') ? 1 : 0 },
    { type:'question', id:'l2', section:'언어 및 실행 능력', maxScore:1,
      question:'이것은 무엇인가요?', inputType:'object_name',
      emoji:'🖊️', objectHint:'볼펜',
      evaluate:(a) => /볼펜|펜|연필/.test(a.trim()) ? 1 : 0 },
    { type:'question', id:'l3', section:'언어 및 실행 능력', maxScore:1,
      question:'이것은 무엇인가요?', inputType:'object_name',
      emoji:'📺', objectHint:'텔레비전',
      evaluate:(a) => /텔레비전|티비|tv|TV/.test(a.trim()) ? 1 : 0 },
    {
      type: 'question', id: 'l4', section: '언어 및 실행 능력', maxScore: 1,
      question: `제가 드리는 말을 한 번만 듣고 따라 말해 보세요.\n\n"${followPhrase}"`,
      inputType: 'text', placeholder: '위 문장을 따라 말씀해 주세요',
      evaluate: (a) => {
        const normalize = (s) => s.replace(/[.,!?·\s]/g,'').toLowerCase();
        return normalize(a).includes(normalize(followPhrase).slice(0, 6)) ? 1 : 0;
      },
    },

    // ── 종료 나레이션 ──
    {
      type: 'outro',
      text: `어르신, 모든 질문에 대답하시느라 정말 고생 많으셨습니다.\n\n이제 어르신이 대답해주신 내용을 바탕으로, 다음 통화부터는 어르신께 꼭 맞는 재미있는 사진들을 준비해 올게요.\n\n오늘 고생하셨습니다. 곧 다시 봬요!`,
    },
  ];
};

// ─────────────────────────────────────────────
// 음성 인식 훅
// ─────────────────────────────────────────────
const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = (onResult, onEnd) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      onEnd?.();
    };
    recognition.onerror = () => {
      setIsListening(false);
      onEnd?.();
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, supported, startListening, stopListening };
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function KMMSEScreen({ currentUser, existingDifficulty, onComplete }) {
  // 마운트 시 1회 결정되는 랜덤값 (ref)
  const memoryWords = useRef(pickRandom(WORD_BANK, 3)).current;
  const followPhrase = useRef(
    existingDifficulty === '상' ? pickRandom(TONGUE_TWISTERS) : pickRandom(PROVERBS)
  ).current;

  // ── 모든 state/hook 선언 (early return 이전) ──
  const [steps, setSteps] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentInput, setCurrentInput] = useState('');
  const [memoryTimer, setMemoryTimer] = useState(10);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enableNarration, setEnableNarration] = useState(true);

  const { isListening, supported, startListening, stopListening } = useSpeechRecognition();

  // 위치 정보 로드 후 STEPS 빌드
  useEffect(() => {
    const load = async () => {
      let loc = {};
      try {
        const snap = await getDoc(doc(db, 'patients', currentUser.uid));
        if (snap.exists()) {
          const d = snap.data();
          loc = {
            city: d.city || '',
            placeType: d.place_type || '',
            placeName: d.place_name || '',
            floor: d.floor || '',
          };
        }
      } catch (e) {
        console.warn('위치 정보 로드 실패, 기본값으로 진행:', e);
      }
      setSteps(buildSteps(memoryWords, followPhrase, loc));
      setLoadingLocation(false);
    };
    load();
  }, []);

  const STEPS = steps || [];

  // 기억 등록 타이머
  useEffect(() => {
    if (!STEPS.length) return;
    const currentStep = STEPS[stepIdx];
    if (currentStep?.type === 'memory_show') {
      setMemoryTimer(10);
      const iv = setInterval(() => {
        setMemoryTimer(prev => {
          if (prev <= 1) { clearInterval(iv); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(iv);
    }
  }, [stepIdx, STEPS.length]);

  // 스텝 이동 시 음성 인식 중단 및 입력 초기화
  useEffect(() => {
    stopListening();
    setVoiceTranscript('');
    setCurrentInput('');
  }, [stepIdx]);

  // 각 스텝이 변경될 때 자동으로 나레이션 읽기
  useEffect(() => {
    if (loadingLocation || !STEPS.length || !enableNarration) return;

    const currentStep = STEPS[stepIdx];
    if (!currentStep) return;

    const timer = setTimeout(async () => {
      let textToRead = '';

      if (currentStep.type === 'narration' || currentStep.type === 'section_narration' || currentStep.type === 'intro') {
        textToRead = currentStep.text;
      } else if (currentStep.type === 'question') {
        textToRead = currentStep.question;
      }

      if (!textToRead) return;

      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.getVoices();
        }

        await textToSpeech.speak(textToRead, {
          lang: 'ko-KR',
          rate: 0.9,
          pitch: 1,
          volume: 1,
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: (error) => {
            console.error('음성 재생 오류:', error);
            setIsSpeaking(false);
          }
        });
      } catch (error) {
        console.error('TTS 오류:', error);
        setIsSpeaking(false);
      }
    }, 300); // 300ms 딜레이

    return () => clearTimeout(timer);
  }, [loadingLocation, stepIdx, STEPS.length, enableNarration]);

  // ── 로딩 중 early return ──
  if (loadingLocation) {
    return (
      <div className="kmmse-screen">
        <div className="kmmse-card" style={{ alignItems: 'center', gap: 20 }}>
          <div className="kmmse-logo">∞</div>
          <p className="kmmse-subtitle">검사를 준비하는 중입니다...</p>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[stepIdx];

  // ── 함수 정의 ──
  const finalizeAndSave = async (finalAnswers) => {
    const questionSteps = STEPS.filter(s => s.type === 'question' || s.type === 'memory_show');
    const maxScore = questionSteps.reduce((s, q) => s + (q.maxScore || 1), 0);
    const rawScore = Object.values(finalAnswers).reduce((s, a) => s + (a.score || 0), 0);
    const diff = getDifficulty(rawScore, maxScore);
    setResult({ rawScore, maxScore, diff });
    setSaving(true);
    try {
      await setDoc(doc(db, 'patients', currentUser.uid), {
        kmmse_score: rawScore,
        kmmse_max: maxScore,
        difficulty: diff.level,
        kmmse_last_date: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.error('K-MMSE 저장 오류:', e);
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => setStepIdx(prev => prev + 1);

  const submitAnswer = (value) => {
    const step = STEPS[stepIdx];
    const inputValue = value ?? currentInput;
    const scored = step.evaluate ? step.evaluate(inputValue) : 0;
    const newAnswers = { ...answers, [step.id]: { value: inputValue, score: scored } };
    setAnswers(newAnswers);
    setCurrentInput('');
    setVoiceTranscript('');
    const nextIdx = stepIdx + 1;
    if (STEPS[nextIdx]?.type === 'outro' || nextIdx >= STEPS.length) {
      finalizeAndSave(newAnswers);
    }
    setStepIdx(nextIdx);
  };

  const handleVoiceText = () => {
    if (isListening) { stopListening(); return; }
    startListening((transcript) => {
      setCurrentInput(transcript);
      setVoiceTranscript(transcript);
    }, null);
  };

  const handleVoiceChoice = (choices) => {
    if (isListening) { stopListening(); return; }
    startListening((transcript) => {
      setVoiceTranscript(transcript);
      const norm = (s) => s.replace(/[.,!?\s🌸☀️🍂❄️]/g, '').toLowerCase();
      const normalized = norm(transcript);
      
      // "I don't know" 키워드 확인
      if (/모르겠|모르겠어|잘모르|잘 모르|모르겠네/.test(normalized)) {
        setTimeout(() => submitAnswer('잘 모르겠어요'), 300);
        return;
      }
      
      // 선택지와 매칭
      const match = choices.find(c => {
        const cn = norm(c);
        return cn.includes(normalized) || normalized.includes(cn);
      });
      if (match) setTimeout(() => submitAnswer(match), 300);
    }, null);
  };

  const handleSpeakNarration = async (text) => {
    if (!enableNarration) return;
    
    try {
      setIsSpeaking(true);
      await textToSpeech.speak(text, {
        lang: 'ko-KR',
        rate: 0.9, // 조금 느리게 (환자 이해 용이)
        pitch: 1,
        volume: 1,
        onEnd: () => {
          setIsSpeaking(false);
        },
        onError: (error) => {
          console.error('음성 재생 오류:', error);
          setIsSpeaking(false);
        }
      });
    } catch (error) {
      console.error('TTS 오류:', error);
      setIsSpeaking(false);
    }
  };

  // ── 통계 ──
  const questionSteps = STEPS.filter(s => s.type === 'question' || s.type === 'memory_show');
  const answeredCount = Object.keys(answers).length;
  const progress = STEPS.length > 1 ? stepIdx / (STEPS.length - 1) : 0;

  // ── outro 화면 ──
  if (currentStep?.type === 'outro') {
    return (
      <div className="kmmse-screen">
        <div className="kmmse-card">
          <div className="kmmse-logo">∞</div>
          <h2 className="kmmse-title">검사 완료</h2>
          <p className="kmmse-narration-text" style={{ textAlign:'center', whiteSpace:'pre-line' }}>
            {currentStep.text}
          </p>
          {result && (
            <>
              <div className="kmmse-score-circle" style={{ borderColor: result.diff.color }}>
                <span className="kmmse-score-num" style={{ color: result.diff.color }}>{result.rawScore}</span>
                <span className="kmmse-score-max">/ {result.maxScore}</span>
              </div>
              <div className="kmmse-diff-badge" style={{ backgroundColor: result.diff.color }}>
                난이도 {result.diff.level}단계 설정 완료
              </div>
              <p className="kmmse-diff-label">{result.diff.label}</p>
            </>
          )}
          <button className="kmmse-btn-primary" onClick={onComplete} disabled={saving}>
            {saving ? '저장 중...' : '홈으로 이동'}
          </button>
        </div>
      </div>
    );
  }

  // ── 마이크 버튼 공통 컴포넌트 ──
  const MicButton = ({ onClick }) => supported ? (
    <button
      className={`kmmse-mic-btn ${isListening ? 'listening' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="kmmse-mic-icon">{isListening ? '🔴' : '🎤'}</span>
      <span className="kmmse-mic-label">
        {isListening ? '듣는 중... (탭하면 중지)' : '마이크로 말하기'}
      </span>
    </button>
  ) : null;

  const VoiceResult = () => voiceTranscript ? (
    <div className="kmmse-voice-result">
      <span className="kmmse-voice-result-label">인식된 내용:</span>
      <span className="kmmse-voice-result-text">"{voiceTranscript}"</span>
    </div>
  ) : null;

  return (
    <div className="kmmse-screen">
      {/* 상단 진행바 */}
      <div className="kmmse-top-bar">
        <span className="kmmse-progress-text">
          {answeredCount} / {questionSteps.length} 문항 완료
        </span>
        <div className="kmmse-progress-track">
          <div className="kmmse-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* 도입 나레이션 */}
      {currentStep?.type === 'narration' && (
        <div className="kmmse-card">
          <div className="kmmse-logo">∞</div>
          <h2 className="kmmse-title">{currentStep.title}</h2>
          <p className="kmmse-narration-text">{currentStep.text}</p>
          {isSpeaking && <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>🔊 음성 재생 중...</p>}
          <button className="kmmse-btn-primary" onClick={goNext}>
            {currentStep.btnLabel || '다음'}
          </button>
        </div>
      )}

      {/* 섹션 전환 나레이션 */}
      {currentStep?.type === 'section_narration' && (
        <div className="kmmse-card">
          <div className="kmmse-section-header-badge">{currentStep.title}</div>
          <p className="kmmse-narration-text">{currentStep.text}</p>
          {isSpeaking && <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>🔊 음성 재생 중...</p>}
          <button className="kmmse-btn-primary" onClick={goNext}>시작하기</button>
        </div>
      )}

      {/* 기억 등록 */}
      {currentStep?.type === 'memory_show' && (
        <div className="kmmse-card">
          <div className="kmmse-section-label">기억 등록</div>
          <p className="kmmse-question">아래 세 가지 단어를 기억해 주세요.</p>
          <div className="kmmse-memory-words">
            {currentStep.words.map(w => (
              <div key={w} className="kmmse-memory-word">{w}</div>
            ))}
          </div>
          {memoryTimer > 0 ? (
            <p className="kmmse-timer-text">{memoryTimer}초 후 자동으로 넘어갑니다...</p>
          ) : (
            <button className="kmmse-btn-primary" onClick={() => submitAnswer('shown')}>
              기억했어요, 다음으로
            </button>
          )}
        </div>
      )}

      {/* 질문 */}
      {currentStep?.type === 'question' && (
        <div className="kmmse-card kmmse-question-card">
          <div className="kmmse-section-label">{currentStep.section}</div>
          <p className="kmmse-question">{currentStep.question}</p>

          {/* 텍스트 / 물건 이름 */}
          {(currentStep.inputType === 'text' || currentStep.inputType === 'object_name') && (
            <div className="kmmse-input-area">
              {currentStep.inputType === 'object_name' && (
                <div className="kmmse-object-display">
                  <span className="kmmse-object-emoji">{currentStep.emoji}</span>
                </div>
              )}
              <MicButton onClick={handleVoiceText} />
              <VoiceResult />
              <input
                className="kmmse-input"
                type="text"
                placeholder={currentStep.placeholder}
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && currentInput.trim() && submitAnswer()}
              />
              <button
                className="kmmse-btn-primary"
                disabled={!currentInput.trim()}
                onClick={() => submitAnswer()}
              >
                다음 문항
              </button>
              <button className="kmmse-btn-secondary" onClick={() => submitAnswer('잘 모르겠어요')}>
                잘 모르겠어요
              </button>
            </div>
          )}

          {/* 선택지 */}
          {currentStep.inputType === 'choice' && (
            <div className="kmmse-input-area">
              <MicButton onClick={() => handleVoiceChoice(currentStep.choices)} />
              <VoiceResult />
              <p className="kmmse-choice-hint">또는 아래에서 직접 선택하세요</p>
              <div className="kmmse-choices">
                {currentStep.choices.map(c => (
                  <button key={c} className="kmmse-choice-btn" onClick={() => submitAnswer(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
