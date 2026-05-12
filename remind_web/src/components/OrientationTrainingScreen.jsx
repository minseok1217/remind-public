import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import './OrientationTrainingScreen.css';
import { tts, cancelTTS } from '../services/ttsService';

const SILENCE_MS = 2000;
const HINT_REVIEW_MS = 2500;

const waitForBrowserPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });


// 설명 문제 번호 파싱 (일번/이번/삼번 → '1'/'2'/'3')
const SPOKEN_OPTION_LABELS = ['일번', '이번', '삼번'];

const parseOptionNumber = (text) => {
  const t = (text || '').replace(/\s/g, '').toLowerCase();
  if (/^(1|일|한|하나|첫|첫번째|첫째|일번|1번)/.test(t)) return '1';
  if (/^(2|이|둘|두|두번째|둘째|이번|2번)/.test(t)) return '2';
  if (/^(3|삼|셋|세|세번째|셋째|삼번|3번)/.test(t)) return '3';
  return null;
};

const normalizeAnswerText = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/입니다|이에요|예요|이요|이어요|같아요|같습니다|아마|정답|답/g, '');

const isAnswerCorrectLocally = (correctAnswer, userAnswer) => {
  const correct = normalizeAnswerText(correctAnswer);
  const user = normalizeAnswerText(userAnswer);
  if (!correct || !user) return false;
  return user.includes(correct) || correct.includes(user);
};

const buildLocalHint = (q) => {
  if (q?.type === 'name' && q.description) {
    return `힌트예요. 이것은 ${q.description}`;
  }

  if (q?.type === 'description' && q.itemName) {
    return `힌트예요. 사진 속 이름은 "${q.itemName}"이에요. 이 이름과 가장 잘 맞는 설명을 골라 보세요.`;
  }

  const cleanAnswer = String(q?.answer || '').replace(/^\d번\((.*)\)$/, '$1').trim();
  if (!cleanAnswer) return '';
  return `사진을 천천히 보면서 모양, 쓰임새, 장소를 떠올려 보세요. 정답과 관련된 중요한 단서는 "${cleanAnswer.slice(0, 1)}" 소리로 시작해요.`;
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
export default function OrientationTrainingScreen({ currentUser, onComplete, onBack }) {
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
  const initRef = useRef(false);
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
    if (initRef.current) return;
    initRef.current = true;
    loadAndStart();
    return () => {
      mountedRef.current = false;
      clearTimeout(silenceRef.current);
      if (recRef.current) try { recRef.current.stop(); } catch {}
      cancelTTS();
    };
  }, []);

  // ── Firestore에서 이미지 문제 로드 ──
  const getImageUrl = (d) =>
    d.imageURL || d.imageUrl || d.photoURL || d.photoUrl || d.url || d.image || '';

  const toOrientationPhotoDocs = (snap) => {
    const types = ['object', 'place', 'job'];
    return snap.docs.map((d, index) => {
      const data = d.data();
      const description =
        data.detailedDescription ||
        data.finalCaption ||
        data.description ||
        data.location ||
        '보호자가 등록한 추억 사진입니다.';
      const name =
        data.location ||
        data.finalCaption ||
        data.description ||
        data.fileName ||
        '추억 사진';

      return {
        id: `photo_${d.id}`,
        ...data,
        type: data.type || types[index % types.length],
        name,
        description,
        imageUrl: getImageUrl(data),
      };
    }).filter((d) => d.imageUrl && d.description);
  };

  const loadOrientationDocs = async () => {
    try {
      const snap = await getDocs(collection(db, 'orientation_images'));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (docs.length > 0) return docs;
      console.warn('[OrientationTraining] orientation_images 문서가 비어 있어 환자 사진 fallback을 시도합니다.');
    } catch (error) {
      console.warn('[OrientationTraining] orientation_images 로드 실패, 환자 사진 fallback을 시도합니다:', error);
    }

    if (!currentUser?.uid) return [];
    const photoSnap = await getDocs(collection(db, 'users', currentUser.uid, 'photos'));
    const photoDocs = toOrientationPhotoDocs(photoSnap);
    console.log('[OrientationTraining] 환자 사진 fallback 문서 수:', photoDocs.length);
    return photoDocs;
  };

  const loadAndStart = async () => {
    try {
      const docs = await loadOrientationDocs();
      console.log('[OrientationTraining] 문서 수:', docs.length);

      const recentIds = getRecentIds();
      const pickOne = (type) => {
        const pool = shuffle(docs.filter((d) => d.type === type && !recentIds.includes(d.id)));
        return pool.length > 0 ? pool[0] : shuffle(docs.filter((d) => d.type === type))[0];
      };

      const objectDoc  = pickOne('object');
      const placeDoc   = pickOne('place');
      const jobDoc     = pickOne('job');
      const nameDocs   = [objectDoc, placeDoc, jobDoc].filter(Boolean);

      // 설명 문제용: 이름 문제와 겹치지 않는 문서에서 타입별 1개
      const usedIds = new Set(nameDocs.map((d) => d.id));
      const pickOneExcluding = (type) => {
        const pool = shuffle(docs.filter((d) => d.type === type && !usedIds.has(d.id)));
        return pool.length > 0 ? pool[0] : shuffle(docs.filter((d) => d.type === type && d.id !== pickOne(type)?.id))[0];
      };

      const descDocs = [pickOneExcluding('object'), pickOneExcluding('place'), pickOneExcluding('job')].filter(Boolean);

      if (nameDocs.length === 0) throw new Error('문서 부족');

      // ── 이름 맞추기 3문제 ──
      const NAME_QUESTION = {
        job:    '이분의 직업은 무엇인가요?',
        place:  '이곳의 이름은 무엇인가요?',
        object: '이 물건의 이름은 무엇인가요?',
      };

      const nameQs = nameDocs.map((doc) => ({
        id: doc.id,
        type: 'name',
        imageUrl: getImageUrl(doc),
        questionText: NAME_QUESTION[doc.type] || '이 사진에 있는 것은 무엇인가요?',
        answer: doc.name || '',
        description: doc.description || '',
        hint: '',
        explanation: `정답은 "${doc.name}"이에요!`,
      }));

      // ── 설명 맞추기 3문제 (같은 type의 다른 사진 설명을 보기로 활용) ──
      const DESC_QUESTION = {
        job:    '이분은 어떤 일을 하는 사람인가요?',
        place:  '이곳은 어떤 일을 하는 곳인가요?',
        object: '이 물건은 무엇에 쓰이는 것인가요?',
      };

      const descQs = descDocs.map((doc) => {
        const correctDesc = doc.description || '';
        const sameType = docs.filter((d) => d.type === doc.type && d.id !== doc.id && d.description);
        const distractors = shuffle(sameType).slice(0, 2).map((d) => d.description);
        const opts = shuffle([correctDesc, ...distractors]);
        while (opts.length < 3) opts.push('알 수 없음');
        const correctIdx = opts.indexOf(correctDesc);
        return {
          id: `desc_${doc.id}`,
          type: 'description',
          imageUrl: getImageUrl(doc),
          questionText: DESC_QUESTION[doc.type] || '이 사진에 맞는 설명은 몇 번인가요?',
          options: opts.slice(0, 3),
          answer: String(correctIdx + 1),
          itemName: doc.name || '',
          hint: '',
          explanation: `정답은 ${correctIdx + 1}번이에요! "${correctDesc}"`,
        };
      });

      const allQs = shuffle([...nameQs, ...descQs]);
      if (!mountedRef.current) return;
      setQuestions(allQs);
      questionsRef.current = allQs;
      appendRecentIds(allQs.map((q) => q.id));
      await runIntro();
    } catch (e) {
      console.error('지남력 훈련 로딩 오류:', e);
      if (!mountedRef.current) return;
      setPhase('loading');
      setStatusMsg('문제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const runIntro = async () => {
    if (!mountedRef.current) return;
    setCurrentIdx(0);
    currentIdxRef.current = 0;
    setPhase('intro');
    phaseRef.current = 'intro';
    await waitForBrowserPaint();
    if (!mountedRef.current || phaseRef.current !== 'intro') return;
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

    // 설명 문제: 보기 3개를 순서대로 읽어줌
    if (q.type === 'description' && q.options) {
      for (let i = 0; i < q.options.length; i++) {
        if (!mountedRef.current) return;
        await tts(`${SPOKEN_OPTION_LABELS[i] || `${i + 1}번`}, ${q.options[i]}`);
      }
    }

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

    // 타입별 평가: 설명 문제는 번호 파싱, 나머지는 로컬 문자열 비교
    const isCorrect = q.type === 'description'
      ? parseOptionNumber(answer) === correctAns
      : isAnswerCorrectLocally(correctAns, answer);

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
        // 힌트 모드 - API 호출 없이 기본 힌트 생성
        playHintSound();
        setPhase('hint');
        phaseRef.current = 'hint';
        setStatusMsg('힌트를 준비하고 있어요...');
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        const [generatedHint] = await Promise.all([
          Promise.resolve(q.hint || buildLocalHint(q)),
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
        setStatusMsg('힌트를 천천히 떠올려 보세요.');
        setTimeout(() => {
          isSpeakingRef.current = false;
          processingAnswerRef.current = false;
          if (mountedRef.current) startListening('second');
        }, HINT_REVIEW_MS);
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
    cancelTTS();
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

  // 로딩 화면
  if (phase === 'loading' || !q) {
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

  if (phase === 'intro') {
    return (
      <div className="ot-screen">
        <div className="ot-header">
          <button className="ot-back-btn" onClick={handleBack}>뒤로</button>
          <span className="ot-header-title">지남력 훈련</span>
          <span className="ot-header-step">준비</span>
        </div>

        <div className="ot-card">
          {(q.type === 'name' || q.type === 'description') && q.imageUrl ? (
            <div className="ot-image-box">
              <img src={q.imageUrl} alt="훈련 문제" className="ot-image" />
            </div>
          ) : (
            <div className="ot-icon-box">
              <span className="ot-icon">?</span>
            </div>
          )}

          <p className="ot-question">{questionText}</p>

          <div className="ot-indicator-area">
            <div className="ot-speaking">
              <div className="ot-wave">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className={`ot-wave-bar ot-bar${i}`} />
                ))}
              </div>
              <p className="ot-indicator-label">AI가 말하고 있어요</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        {(q.type === 'name' || q.type === 'description') && q.imageUrl ? (
          <div className="ot-image-box">
            <img src={q.imageUrl} alt="훈련 문제" className="ot-image" />
          </div>
        ) : (
          <div className="ot-icon-box">
            <span className="ot-icon">🖼️</span>
          </div>
        )}

        {/* 질문 */}
        <p className="ot-question">{questionText}</p>

        {/* 설명 문제 보기 목록 */}
        {q.type === 'description' && q.options && (
          <div className="ot-options-list">
            {q.options.map((opt, i) => (
              <div key={i} className="ot-option-item">
                <span className="ot-option-num">{i + 1}번</span>
                <span className="ot-option-text">{opt}</span>
              </div>
            ))}
          </div>
        )}

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
