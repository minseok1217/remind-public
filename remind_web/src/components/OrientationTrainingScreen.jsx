import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { generateOrientationHint } from '../services/geminiService';
import './OrientationTrainingScreen.css';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 환경 변수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GOOGLE_TTS_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || '';
const SILENCE_MS = 2000; // 침묵 감지 대기 시간

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TTS (Google Cloud Neural2 + 브라우저 폴백)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const webSpeak = (text) =>
  new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.82;
    u.pitch = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });

const tts = async (text) => {
  if (!GOOGLE_TTS_KEY) return webSpeak(text);
  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.82, pitch: 0.0 },
        }),
      }
    );
    const d = await r.json();
    if (!d.audioContent) return webSpeak(text);
    const audio = new Audio(`data:audio/mp3;base64,${d.audioContent}`);
    return new Promise((res) => {
      audio.onended = res;
      audio.onerror = res;
      audio.play();
    });
  } catch {
    return webSpeak(text);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로컬 답변 평가 (Gemini API 없이 즉각 처리)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const KO_NUMBERS = {
  '영': '0', '일': '1', '이': '2', '삼': '3', '사': '4',
  '오': '5', '육': '6', '칠': '7', '팔': '8', '구': '9', '십': '10',
  '하나': '1', '둘': '2', '셋': '3', '넷': '4', '다섯': '5',
  '여섯': '6', '일곱': '7', '여덟': '8', '아홉': '9', '열': '10',
  '열하나': '11', '열둘': '12', '스물': '20',
  '한': '1', '두': '2', '세': '3', '네': '4',
};

// 동의어 그룹 (같은 그룹 안에 있으면 정답으로 인정)
const SYNONYM_GROUPS = [
  ['파란색', '파랑', '파란', '하늘색', '블루'],
  ['빨간색', '빨강', '빨간', '레드'],
  ['노란색', '노랑', '노란', '옐로'],
  ['초록색', '초록', '녹색', '그린'],
  ['흰색', '하얀색', '하얀', '흰', '화이트'],
  ['검정색', '검은색', '검정', '검은', '블랙'],
  ['강아지', '개', '멍멍이', '강아지요', '개요'],
  ['고양이', '냥이', '야옹이', '고양이요'],
  ['소', '황소', '암소', '송아지'],
  ['동쪽', '동', '동방', '동쪽이요'],
  ['서쪽', '서', '서방'],
  ['남쪽', '남', '남방'],
  ['북쪽', '북', '북방'],
  ['봄', '봄이요', '봄이에요', '봄철'],
  ['여름', '여름이요', '여름이에요', '여름철'],
  ['가을', '가을이요', '가을이에요', '가을철'],
  ['겨울', '겨울이요', '겨울이에요', '겨울철'],
  ['월요일', '월', '월요'],
  ['화요일', '화', '화요'],
  ['수요일', '수', '수요'],
  ['목요일', '목', '목요'],
  ['금요일', '금', '금요'],
  ['토요일', '토', '토요'],
  ['일요일', '일', '일요'],
  ['의사', '의사요', '의사선생님', '닥터', '의원'],
  ['경찰', '경찰관', '경찰이요', '순경', '경관'],
  ['소방관', '소방수', '소방대원', '소방이요', '소방관이요'],
  ['선생님', '교사', '교사요', '선생요', '스승'],
  ['요리사', '주방장', '셰프', '요리사요', '쉐프'],
  ['간호사', '간호원', '간호사요'],
  ['농부', '농민', '농부요'],
  ['군인', '군인이요', '병사', '군관'],
  ['사과', '사과요', '사과이요', '사과나무'],
  ['바나나', '바나나요'],
  ['포도', '포도요'],
  ['배', '배요'],
  ['귤', '귤이요', '오렌지'],
  ['물', '물이요', '물이에요'],
  ['가위', '가위요', '가이', '가이요'],
  ['칫솔', '칫솔이요', '치솔'],
  ['안경', '안경이요'],
  ['우산', '우산이요'],
  ['시계', '시계요'],
  ['전화기', '전화기요', '핸드폰', '핸드폰이요', '전화'],
  ['냉장고', '냉장고요'],
  ['텔레비전', '티비', '티브이', '텔레비전이요', '티비요'],
  ['남대문', '남대문이요', '숭례문'],
  ['경복궁', '경복궁이요'],
  ['한강', '한강이요'],
  ['북한산', '북한산이요'],
];

const normalizeKo = (s) =>
  (s || '')
    .replace(/[^가-힣a-z0-9]/gi, '')
    .toLowerCase()
    .trim();

const evalAnswerLocal = (correct, userAnswer) => {
  const u = normalizeKo(userAnswer);
  const c = normalizeKo(correct);

  if (!u) return false;

  // 직접 포함 관계
  if (u === c || u.includes(c) || c.includes(u)) return true;

  // 한글 숫자 ↔ 아라비아 숫자
  const uNum = KO_NUMBERS[u] || u;
  const cNum = KO_NUMBERS[c] || c;
  if (uNum === cNum || uNum === c || u === cNum) return true;

  // 동의어 그룹
  const uGroup = SYNONYM_GROUPS.find((g) => g.some((s) => normalizeKo(s) === u));
  const cGroup = SYNONYM_GROUPS.find((g) => g.some((s) => normalizeKo(s) === c));
  if (uGroup && cGroup && uGroup === cGroup) return true;

  // 정답이 여러 단어일 때 핵심 단어 포함 여부 (예: "바닥을 쓸 때 쓰는 물건" → "빗자루" 등은 불가, 그러나 "빗자루"를 answer에 넣으면 됨)
  // 짧은 정답(3자 이하)이 사용자 답변에 포함되면 정답
  if (c.length <= 3 && u.includes(c)) return true;
  if (u.length <= 3 && c.includes(u)) return true;

  return false;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 효과음 (Web Audio API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const playCorrectSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[523, 0], [659, 0.18], [784, 0.36]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch {}
};

const playHintSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 370;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 일반 상식 문제 풀 (충분히 많이)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const buildGeneralPool = () => {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDay();
  const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const SEASON =
    m >= 3 && m <= 5 ? '봄' : m >= 6 && m <= 8 ? '여름' : m >= 9 && m <= 11 ? '가을' : '겨울';

  return [
    // ── 날짜/시간 ──
    {
      id: 'g_season', question: '지금은 무슨 계절인가요?', answer: SEASON,
      hint: `봄, 여름, 가을, 겨울 중 하나예요. 지금 창밖의 날씨를 생각해 보세요!`,
      explanation: `지금은 ${SEASON}이에요! ${m}월은 ${SEASON}이랍니다.`,
    },
    {
      id: 'g_day', question: '오늘은 무슨 요일인가요?', answer: DAYS[d],
      hint: `월요일부터 일요일 중에 하나예요.`,
      explanation: `오늘은 ${DAYS[d]}이에요! 잘 기억해 두세요.`,
    },
    // ── 색깔 ──
    {
      id: 'g_sky', question: '맑은 날 하늘은 무슨 색인가요?', answer: '파란색',
      hint: `비가 안 오는 맑은 날 하늘을 생각해 보세요.`,
      explanation: `하늘은 파란색이에요! 맑은 날 하늘을 보면 예쁜 파란색을 볼 수 있어요.`,
    },
    {
      id: 'g_grass', question: '풀밭은 무슨 색인가요?', answer: '초록색',
      hint: `나무 잎사귀나 잔디밭의 색깔을 생각해 보세요.`,
      explanation: `풀밭은 초록색이에요! 봄이 되면 싱그러운 초록색 잔디를 볼 수 있죠.`,
    },
    {
      id: 'g_snow', question: '눈은 무슨 색인가요?', answer: '흰색',
      hint: `겨울에 내리는 눈의 색을 생각해 보세요.`,
      explanation: `눈은 흰색이에요! 겨울에 내리는 하얀 눈은 참 예쁘죠.`,
    },
    // ── 덧셈 ──
    {
      id: 'g_math1', question: '둘 더하기 셋은 얼마인가요?', answer: '5',
      hint: `손가락으로 세어보세요. 둘에서 셋을 더하면...`,
      explanation: `2 더하기 3은 5예요!`,
    },
    {
      id: 'g_math2', question: '넷 더하기 하나는 얼마인가요?', answer: '5',
      hint: `손가락으로 세어보세요. 넷에서 하나를 더하면...`,
      explanation: `4 더하기 1은 5예요!`,
    },
    {
      id: 'g_math3', question: '하나 더하기 둘은 얼마인가요?', answer: '3',
      hint: `손가락으로 세어보세요. 하나에서 둘을 더하면...`,
      explanation: `1 더하기 2는 3이에요!`,
    },
    {
      id: 'g_math4', question: '셋 더하기 하나는 얼마인가요?', answer: '4',
      hint: `손가락으로 세어보세요.`,
      explanation: `3 더하기 1은 4예요!`,
    },
    {
      id: 'g_math5', question: '둘 더하기 둘은 얼마인가요?', answer: '4',
      hint: `손가락으로 세어보세요. 둘에서 둘을 더하면...`,
      explanation: `2 더하기 2는 4예요!`,
    },
    // ── 동물 ──
    {
      id: 'g_dog', question: '멍멍 짖는 동물은 무엇인가요?', answer: '강아지',
      hint: `집에서 많이 키우는 동물이에요. 멍멍 짖는 소리를 내죠.`,
      explanation: `맞아요, 강아지예요! 귀엽고 충직한 강아지랍니다.`,
    },
    {
      id: 'g_cat', question: '야옹 하고 우는 동물은 무엇인가요?', answer: '고양이',
      hint: `집에서 많이 키우는 동물이에요. 야옹 하는 소리를 내죠.`,
      explanation: `맞아요, 고양이예요! 귀여운 고양이랍니다.`,
    },
    {
      id: 'g_cow', question: '우유를 주는 동물은 무엇인가요?', answer: '소',
      hint: `농장에서 키우는 큰 동물이에요. 음매 하고 울죠.`,
      explanation: `맞아요, 소예요! 소에서 우유를 얻는답니다.`,
    },
    // ── 과일/음식 ──
    {
      id: 'g_apple', question: '빨갛고 달콤한 과일은 무엇인가요?', answer: '사과',
      hint: `빨간색이고 달콤한 과일이에요. 하루에 하나씩 먹으면 좋다고 하죠.`,
      explanation: `바로 사과예요! 새콤달콤한 사과는 참 맛있죠.`,
    },
    {
      id: 'g_banana', question: '노랗고 길쭉한 과일은 무엇인가요?', answer: '바나나',
      hint: `원숭이가 좋아하는 노란색 과일이에요.`,
      explanation: `바로 바나나예요! 달콤한 바나나는 참 맛있죠.`,
    },
    {
      id: 'g_water', question: '목이 마를 때 마시는 것은 무엇인가요?', answer: '물',
      hint: `투명하고 맛이 없지만 우리 몸에 꼭 필요한 것이에요.`,
      explanation: `바로 물이에요! 하루에 물을 충분히 마시면 건강에 좋아요.`,
    },
    // ── 방향/상식 ──
    {
      id: 'g_sun', question: '태양은 어느 방향에서 뜨나요?', answer: '동쪽',
      hint: `아침에 해가 뜨는 방향을 생각해 보세요.`,
      explanation: `태양은 동쪽에서 떠요! 아침 해가 뜨는 방향이 동쪽이랍니다.`,
    },
    {
      id: 'g_fire', question: '불은 무슨 색인가요?', answer: '빨간색',
      hint: `뜨겁고 타오르는 불꽃의 색깔을 생각해 보세요.`,
      explanation: `불은 빨간색이에요! 위험하니까 조심해야 해요.`,
    },
    {
      id: 'g_moon', question: '밤하늘에 빛나는 것은 무엇인가요?', answer: '달',
      hint: `밤이 되면 하늘에 둥글게 떠있는 것이에요.`,
      explanation: `바로 달이에요! 밤하늘에 빛나는 아름다운 달이랍니다.`,
    },
    {
      id: 'g_salt', question: '음식에 짠맛을 내는 것은 무엇인가요?', answer: '소금',
      hint: `하얀색 가루로 음식을 짭짤하게 만들 때 쓰는 것이에요.`,
      explanation: `바로 소금이에요! 음식에 간을 맞출 때 꼭 필요하죠.`,
    },
  ];
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 최근 문항 중복 방지 (localStorage)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const RECENT_KEY = 'orient_recent_q_ids';

const getRecentIds = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

const appendRecentIds = (ids) => {
  const prev = getRecentIds();
  const next = [...prev, ...ids].slice(-30);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸리티
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickRandom = (arr, n, excludeIds = []) => {
  const preferred = arr.filter((q) => !excludeIds.includes(q.id));
  const src = preferred.length >= n ? preferred : arr.length > 0 ? arr : [];
  return shuffle(src).slice(0, n);
};

// 카테고리별 기본 질문 텍스트
const DEFAULT_QUESTION_TEXT = {
  object: ['이 물건의 이름은 무엇인가요?', '이 물건은 무엇에 쓰는 것인가요?'],
  place: ['이곳은 어디인가요?', '이 장소의 이름은 무엇인가요?'],
  job: ['이분은 무엇을 하는 사람인가요?', '이분의 직업은 무엇인가요?'],
};

const getDefaultQuestion = (category) => {
  const opts = DEFAULT_QUESTION_TEXT[category] || ['이것은 무엇인가요?'];
  return opts[Math.floor(Math.random() * opts.length)];
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 스파클 오버레이
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SPARKLE_EMOJIS = ['✨', '🌟', '⭐', '💫', '✨', '🌟', '💫', '⭐', '🎉', '🌟'];

function SparkleOverlay() {
  return (
    <div className="ot-sparkle-overlay">
      {SPARKLE_EMOJIS.map((e, i) => (
        <span key={i} className={`ot-sparkle-particle ot-p${i}`}>{e}</span>
      ))}
      <div className="ot-sparkle-text">참 잘하셨어요!</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function OrientationTrainingScreen({ onComplete, onBack }) {
  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [correctCount, setCorrectCount] = useState(0);
  const [sparkle, setSparkle] = useState(false);
  const [statusMsg, setStatusMsg] = useState('문제를 불러오는 중...');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const mountedRef = useRef(true);
  const questionsRef = useRef([]);
  const currentIdxRef = useRef(0);
  const correctCountRef = useRef(0);
  const phaseRef = useRef('loading');
  const recRef = useRef(null);
  const silenceRef = useRef(null);
  const finalTxRef = useRef('');
  const interimTxRef = useRef('');
  const isRecordingRef = useRef(false);
  const processingAnswerRef = useRef(false); // 답변 중복 처리 방지
  const isSpeakingRef = useRef(false);       // TTS 중 마이크 잡힘 방지

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    loadAndStart();
    return () => {
      mountedRef.current = false;
      clearTimeout(silenceRef.current);
      if (recRef.current) try { recRef.current.stop(); } catch {}
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Firestore에서 이미지 문제 로드 ──
  const getImageUrl = (d) =>
    d.imageURL || d.imageUrl || d.photoURL || d.url || d.image || '';

  const loadAndStart = async () => {
    try {
      const [imageSnap, generalSnap] = await Promise.all([
        getDocs(collection(db, 'orientaion_images')),
        getDocs(collection(db, 'orientation_questions')).catch(() => ({ docs: [] })),
      ]);

      const docs = imageSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log('[OrientationTraining] 이미지 문서 수:', docs.length);

      const firebaseGeneralDocs = generalSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        type: 'general',
        questionText: d.data().questionText || d.data().question || '',
      }));
      console.log('[OrientationTraining] 일반 문제 수:', firebaseGeneralDocs.length);

      const recentIds = getRecentIds();
      const objects = docs.filter((d) => d.category === 'object');
      const places  = docs.filter((d) => d.category === 'place');
      const jobs    = docs.filter((d) => d.category === 'job');
      const generalPool = firebaseGeneralDocs.length > 0 ? firebaseGeneralDocs : buildGeneralPool();

      const imageQs = shuffle([
        ...pickRandom(objects, 3, recentIds).map((q) => ({
          ...q, type: 'image',
          imageUrl: getImageUrl(q),
          questionText: q.questionText || getDefaultQuestion('object'),
          answer: q.answer || '',
          hint: q.hint || `이 물건을 잘 보세요!`,
          explanation: q.explanation || `${q.answer}이에요!`,
        })),
        ...pickRandom(places, 2, recentIds).map((q) => ({
          ...q, type: 'image',
          imageUrl: getImageUrl(q),
          questionText: q.questionText || getDefaultQuestion('place'),
          answer: q.answer || '',
          hint: q.hint || `이 장소를 잘 살펴보세요!`,
          explanation: q.explanation || `${q.answer}이에요!`,
        })),
        ...pickRandom(jobs, 3, recentIds).map((q) => ({
          ...q, type: 'image',
          imageUrl: getImageUrl(q),
          questionText: q.questionText || getDefaultQuestion('job'),
          answer: q.answer || '',
          hint: q.hint || `이분이 무엇을 하고 계신지 생각해 보세요!`,
          explanation: q.explanation || `${q.answer}이에요!`,
        })),
      ]);

      const generalQs = pickRandom(generalPool, 2, recentIds).map((q) => ({
        ...q, type: 'general',
      }));

      const allQs = shuffle([...imageQs, ...generalQs]);
      // 문제가 너무 적으면 일반 상식으로 채움
      const finalQs = allQs.length >= 3
        ? allQs
        : shuffle(buildGeneralPool()).slice(0, 8).map((q) => ({ ...q, type: 'general' }));

      if (!mountedRef.current) return;
      setQuestions(finalQs);
      questionsRef.current = finalQs;
      appendRecentIds(finalQs.map((q) => q.id));
      await runIntro();
    } catch (e) {
      console.error('지남력 훈련 로딩 오류:', e);
      if (e?.code === 'permission-denied') {
        console.warn(
          '[Firestore 규칙 필요] Firebase 콘솔 → Firestore → 규칙에 추가하세요:\n' +
          'match /orientaion_images/{doc} { allow read: if request.auth != null; }'
        );
      }
      if (!mountedRef.current) return;
      // 일반 상식 문제로 대체 (이번 세션에 아직 안 쓴 것 우선)
      const recentIds = getRecentIds();
      const pool = buildGeneralPool();
      const fallback = shuffle(pickRandom(pool, pool.length, recentIds)).map((q) => ({
        ...q, type: 'general',
      }));
      setQuestions(fallback);
      questionsRef.current = fallback;
      appendRecentIds(fallback.map((q) => q.id));
      await runIntro();
    }
  };

  const runIntro = async () => {
    if (!mountedRef.current) return;
    setPhase('intro');
    phaseRef.current = 'intro';
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setStatusMsg('훈련을 시작할게요!');
    await tts('안녕하세요! 지금부터 지남력 훈련을 시작할게요. 제가 보여드리는 것을 잘 보시고, 큰 소리로 말씀해 주세요!');
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    if (!mountedRef.current) return;
    goToQuestion(0);
  };

  // ── 문제 이동 ──
  const goToQuestion = async (idx) => {
    if (!mountedRef.current) return;
    const qs = questionsRef.current;

    if (idx >= qs.length) {
      setPhase('complete');
      phaseRef.current = 'complete';
      const total = qs.length;
      const correct = correctCountRef.current;
      setStatusMsg(`${total}문제 중 ${correct}문제 맞히셨어요!`);
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      const msg = correct === total
        ? `와, ${total}문제를 모두 맞히셨어요! 정말 훌륭하세요!`
        : `총 ${total}문제 중 ${correct}문제를 맞히셨어요! 정말 잘하셨어요!`;
      await tts(msg);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const q = qs[idx];
    setCurrentIdx(idx);
    currentIdxRef.current = idx;
    setTranscript('');
    setSparkle(false);
    processingAnswerRef.current = false;

    const questionText = q.questionText || q.question || '이것은 무엇인가요?';
    setPhase('question');
    phaseRef.current = 'question';
    setStatusMsg(questionText);

    // TTS 재생 전 기존 인식 완전 중지
    stopListening();

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    await tts(questionText);
    setIsSpeaking(false);
    if (!mountedRef.current) return;

    // isSpeakingRef는 유지한 채 짧게 대기하여 TTS 잔향을 차단
    await new Promise((r) => setTimeout(r, 350));
    isSpeakingRef.current = false;
    if (!mountedRef.current) return;
    startListening('first');
  };

  // ── 음성 인식 ──
  const startListening = (attempt) => {
    if (!mountedRef.current || processingAnswerRef.current) return;

    const p = attempt === 'first' ? 'listening' : 'hint_listening';
    setPhase(p);
    phaseRef.current = p;
    setIsListening(true);
    setTranscript('');
    setStatusMsg('말씀해 주세요...');
    finalTxRef.current = '';
    interimTxRef.current = '';

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setStatusMsg('이 브라우저는 음성 인식을 지원하지 않아요.');
      setIsListening(false);
      return;
    }

    if (recRef.current) try { recRef.current.stop(); } catch {}

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;
    isRecordingRef.current = true;

    // ── 클로저 기반 1회 발화 트리거 (중복 호출 원천 차단) ──
    let answered = false;
    const triggerAnswer = () => {
      if (answered || processingAnswerRef.current) return;
      answered = true;
      clearTimeout(silenceRef.current);
      stopListening();
      handleAnswer(attempt);
    };

    rec.onresult = (e) => {
      // TTS 재생 중 마이크 잡힘 무시
      if (isSpeakingRef.current) return;

      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalTxRef.current = `${finalTxRef.current} ${r[0].transcript}`.trim();
        } else {
          interim += r[0].transcript;
        }
      }
      interimTxRef.current = interim;
      const preview = `${finalTxRef.current} ${interim}`.trim();
      if (preview) setTranscript(preview);

      // 침묵 감지 타이머 리셋
      clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(triggerAnswer, SILENCE_MS);
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      isRecordingRef.current = false;
      setIsListening(false);
      if (!processingAnswerRef.current && !answered) {
        setStatusMsg('잘 못 들었어요. 다시 말씀해 주세요.');
        setTimeout(() => {
          if (mountedRef.current && !processingAnswerRef.current) startListening(attempt);
        }, 1200);
      }
    };

    rec.onend = () => {
      isRecordingRef.current = false;
      setIsListening(false);
      // rec.onend가 silence timer보다 먼저 발생할 때도 처리
      const answer = `${finalTxRef.current} ${interimTxRef.current}`.trim();
      if (answer && !answered && !processingAnswerRef.current) {
        triggerAnswer();
      }
    };

    try { rec.start(); } catch (err) { console.error('음성 인식 시작 오류:', err); }
  };

  const stopListening = () => {
    clearTimeout(silenceRef.current);
    if (recRef.current) try { recRef.current.stop(); } catch {}
    isRecordingRef.current = false;
    setIsListening(false);
  };

  // ── 답변 처리 (로컬 평가, Gemini API 미사용) ──
  const handleAnswer = async (attempt) => {
    if (processingAnswerRef.current) return;
    processingAnswerRef.current = true;

    const answer = `${finalTxRef.current} ${interimTxRef.current}`.trim();
    if (!answer) {
      processingAnswerRef.current = false;
      setStatusMsg('잘 못 들었어요. 다시 말씀해 주세요.');
      setTimeout(() => { if (mountedRef.current) startListening(attempt); }, 1000);
      return;
    }

    const evalPhase = attempt === 'first' ? 'evaluating' : 'hint_eval';
    setPhase(evalPhase);
    phaseRef.current = evalPhase;
    setStatusMsg('확인 중...');

    const q = questionsRef.current[currentIdxRef.current];
    const correctAns = q.answer || '';

    // 로컬 평가 (동기, 즉각 처리)
    const isCorrect = evalAnswerLocal(correctAns, answer);

    if (!mountedRef.current) return;

    if (isCorrect) {
      correctCountRef.current++;
      setCorrectCount((prev) => prev + 1);
      setSparkle(true);
      setPhase('correct');
      phaseRef.current = 'correct';
      setStatusMsg('참 잘하셨어요!');
      playCorrectSound();

      const praises = [
        '정답이에요! 역시 기억력이 좋으시네요.',
        '맞아요! 훌륭하세요!',
        '정확해요! 정말 잘하셨어요!',
        '바로 그거예요! 대단하세요!',
      ];
      const praise =
        attempt === 'first'
          ? praises[Math.floor(Math.random() * praises.length)]
          : `맞아요! ${q.explanation || `${correctAns}이에요!`} 잘하셨어요!`;

      setIsSpeaking(true);
      isSpeakingRef.current = true;
      await tts(praise);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setSparkle(false);

      if (!mountedRef.current) return;
      setTimeout(() => {
        processingAnswerRef.current = false;
        if (mountedRef.current) goToQuestion(currentIdxRef.current + 1);
      }, 800);
    } else {
      if (attempt === 'first') {
        // 힌트 모드 - Gemini로 힌트 생성 (첫 TTS 재생 중 병렬 처리)
        playHintSound();
        setPhase('hint');
        phaseRef.current = 'hint';
        setStatusMsg('힌트를 준비하고 있어요...');
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        const questionText = q.questionText || q.question || '';
        const [generatedHint] = await Promise.all([
          generateOrientationHint(questionText, q.answer || '').catch(() => q.hint || ''),
          tts('아쉽네요! 제가 힌트를 드릴 테니 다시 한번 볼까요?'),
        ]);

        const hintText = (generatedHint || q.hint || '').trim();
        if (hintText) {
          // UI 힌트 박스 표시를 위해 질문 객체 힌트 업데이트
          setQuestions((prev) =>
            prev.map((item, i) =>
              i === currentIdxRef.current ? { ...item, hint: hintText } : item
            )
          );
          questionsRef.current = questionsRef.current.map((item, i) =>
            i === currentIdxRef.current ? { ...item, hint: hintText } : item
          );
          setStatusMsg(`💡 ${hintText}`);
          await tts(hintText);
        } else {
          setStatusMsg('힌트를 잘 들어보세요!');
        }

        setIsSpeaking(false);
        if (!mountedRef.current) return;
        setTimeout(() => {
          isSpeakingRef.current = false;
          processingAnswerRef.current = false;
          if (mountedRef.current) startListening('second');
        }, 350);
      } else {
        // 2차 시도 후 정답 공개
        setPhase('result');
        phaseRef.current = 'result';
        const explanation = q.explanation || `정답은 ${correctAns}이에요! 다음엔 꼭 기억해 보세요.`;
        setStatusMsg(explanation);
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        await tts(explanation);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (!mountedRef.current) return;
        setTimeout(() => {
          processingAnswerRef.current = false;
          if (mountedRef.current) goToQuestion(currentIdxRef.current + 1);
        }, 1500);
      }
    }
  };

  const handleBack = () => {
    stopListening();
    window.speechSynthesis.cancel();
    onBack?.();
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 렌더링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const q = questions[currentIdx];
  const total = questions.length;
  const progress = total > 0 ? (currentIdx / total) * 100 : 0;
  const isActiveListening = ['listening', 'hint_listening'].includes(phase);
  const isHintPhase = ['hint', 'hint_listening', 'hint_eval'].includes(phase);
  const isEvaluating = ['evaluating', 'hint_eval'].includes(phase);

  // 완료 화면
  if (phase === 'complete') {
    const isPerfect = correctCount === total;
    return (
      <div className="ot-screen">
        <div className="ot-complete-card">
          <div className="ot-complete-icon">{isPerfect ? '🌟' : '👍'}</div>
          <h2 className="ot-complete-title">{isPerfect ? '완벽해요!' : '잘 하셨어요!'}</h2>
          <p className="ot-complete-score">
            {total}문제 중 <strong>{correctCount}문제</strong> 정답
          </p>
          <p className="ot-complete-msg">
            이제 AI와 통화를 시작할게요.<br />편안하게 이야기 나눠 보세요!
          </p>
          <button className="ot-btn-primary" onClick={() => onComplete?.()}>
            통화 시작하기
          </button>
          <button className="ot-btn-secondary" onClick={handleBack}>
            나중에 할게요
          </button>
        </div>
      </div>
    );
  }

  // 로딩/인트로 화면
  if (phase === 'loading' || phase === 'intro' || !q) {
    return (
      <div className="ot-screen">
        <div className="ot-loading-box">
          <div className="ot-spinner" />
          <p className="ot-loading-text">지남력 훈련을 준비하고 있어요...</p>
        </div>
      </div>
    );
  }

  const questionText = q.questionText || q.question || '이것은 무엇인가요?';

  return (
    <div className="ot-screen">
      {sparkle && <SparkleOverlay />}

      {/* 헤더 */}
      <div className="ot-header">
        <button className="ot-back-btn" onClick={handleBack}>← 뒤로</button>
        <span className="ot-header-title">지남력 훈련</span>
        <span className="ot-header-step">{currentIdx + 1}/{total}</span>
      </div>

      {/* 진행바 */}
      <div className="ot-progress-track">
        <div className="ot-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* 메인 카드 */}
      <div className={`ot-card ${phase === 'correct' ? 'ot-card-correct' : isHintPhase ? 'ot-card-hint' : ''}`}>

        {/* 이미지 또는 아이콘 */}
        {q.type === 'image' && q.imageUrl ? (
          <div className="ot-image-box">
            <img src={q.imageUrl} alt="훈련 문제" className="ot-image" />
          </div>
        ) : (
          <div className="ot-icon-box">
            <span className="ot-icon">{q.type === 'general' ? '🧠' : '🖼️'}</span>
          </div>
        )}

        {/* 질문 */}
        <p className="ot-question">{questionText}</p>

        {/* 힌트 박스 */}
        {isHintPhase && q.hint && (
          <div className="ot-hint-box">
            <span className="ot-hint-icon">💡</span>
            <p className="ot-hint-text">{q.hint}</p>
          </div>
        )}

        {/* 결과 박스 */}
        {phase === 'result' && (
          <div className="ot-result-box">
            <p className="ot-result-text">{statusMsg}</p>
          </div>
        )}

        {/* 사용자 발화 */}
        {transcript && !['correct', 'result'].includes(phase) && (
          <div className="ot-transcript">
            <span className="ot-transcript-label">내 대답</span>
            <span className="ot-transcript-text">"{transcript}"</span>
          </div>
        )}

        {/* 상태 인디케이터 */}
        <div className="ot-indicator-area">
          {isSpeaking && (
            <div className="ot-speaking">
              <div className="ot-wave">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className={`ot-wave-bar ot-bar${i}`} />
                ))}
              </div>
              <p className="ot-indicator-label">AI가 말하고 있어요</p>
            </div>
          )}

          {isActiveListening && !isSpeaking && (
            <div className="ot-mic-area">
              <div className="ot-mic-pulse">
                <div className="ot-mic-ring ot-ring1" />
                <div className="ot-mic-ring ot-ring2" />
                <span className="ot-mic-icon">🎤</span>
              </div>
              <p className="ot-indicator-label">듣고 있어요... 크게 말씀해 주세요</p>
            </div>
          )}

          {isEvaluating && (
            <div className="ot-processing">
              <div className="ot-dots">
                <div className="ot-dot" /><div className="ot-dot" /><div className="ot-dot" />
              </div>
              <p className="ot-indicator-label">확인 중...</p>
            </div>
          )}

          {phase === 'correct' && (
            <div className="ot-correct-badge">
              <span className="ot-correct-icon">✅</span>
              <p className="ot-correct-label">정답이에요!</p>
            </div>
          )}
        </div>
      </div>

      {isHintPhase && !isSpeaking && !isActiveListening && (
        <p className="ot-bottom-hint">힌트를 잘 들으셨나요? 다시 말씀해 보세요!</p>
      )}
    </div>
  );
}
