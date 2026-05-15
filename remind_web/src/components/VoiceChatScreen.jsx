import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { chatWithGemini, evaluateConversationReport, generateCallInsightLines, generatePreCallReaction } from '../services/geminiService';
import { analyzeConversation } from '../services/conversationAnalysisService';
import { getConnectedPatientId } from '../services/familyLinkService';
import './VoiceChatScreen.css';
import { tts, cancelTTS } from '../services/ttsService';
import { useScribeSpeechRecognition } from '../hooks/useScribeSpeechRecognition';

const SILENCE_TIMEOUT_MS = 800;
const AUTO_LISTEN_DELAY_MS = 700;
const PRE_CALL_CHECK_QUESTIONS = [
  '안녕하세요. 저는 Remind 서비스 상담사입니다. 대화를 시작하기 전에 몸 상태를 잠깐 여쭤볼게요. 오늘 몸은 좀 어떠세요?',
  '오늘 식사는 잘 챙겨 드셨어요?',
  '오늘 드셔야 하는 약은 챙겨 드셨나요?',
  '어젯밤에는 잠을 편하게 주무셨나요?',
];

const getPreCallReaction = (questionIndex, answerText) => {
  const answer = (answerText || '').replace(/\s+/g, ' ').trim();
  const hasNegativeSignal = /아파|아프|불편|힘들|피곤|못|안\s*좋|나빠|어지|속상|걱정|별로|굶|거르|안\s*먹|못\s*먹|안\s*잤|못\s*잤|잠.*안|깼/.test(answer);
  const hasPositiveSignal = /좋|괜찮|편하|먹었|챙|잤|잘|응|네|예/.test(answer);

  if (questionIndex === 0) {
    if (hasNegativeSignal) return '말씀해 주셔서 고마워요. 불편한 곳이 있으셨군요.';
    if (hasPositiveSignal) return '괜찮으시다니 다행이에요.';
    return '그렇군요, 오늘 몸 상태를 알려주셔서 고마워요.';
  }

  if (questionIndex === 1) {
    if (hasNegativeSignal) return '식사를 챙기기 어려우셨군요. 무리하지 않으셔도 괜찮아요.';
    if (hasPositiveSignal) return '식사 챙기셨다니 다행이에요.';
    return '알려주셔서 고마워요.';
  }

  if (questionIndex === 2) {
    if (hasNegativeSignal) return '약은 가끔 헷갈릴 수 있어요. 보호자분께도 확인해 보면 좋겠어요.';
    if (hasPositiveSignal) return '약도 챙기셨군요, 잘하셨어요.';
    return '네, 약에 대해서도 말씀해 주셔서 고마워요.';
  }

  if (hasNegativeSignal) return '잠을 편히 못 주무셨군요. 오늘은 조금 더 편안하게 쉬셨으면 좋겠어요.';
  if (hasPositiveSignal) return '잘 주무셨다니 참 다행이에요.';
  return '수면 상태도 알려주셔서 고마워요.';
};

const joinReactionAndQuestion = (reaction, question) => {
  if (!question) return reaction;
  return `${reaction} ${question}`;
};

const sanitizeForFirestore = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeForFirestore);
  if (value && typeof value === 'object' && typeof value.isEqual === 'function') return value;
  if (value && typeof value === 'object' && typeof value.toDate !== 'function') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeForFirestore(nestedValue)])
    );
  }
  return value;
};

const getDateMillis = (value) => {
  const date = value?.toDate?.() || value;
  const time = date ? new Date(date).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const describeNumericChange = (label, currentValue, previousValue, unit = '점') => {
  if (typeof currentValue !== 'number' || typeof previousValue !== 'number') return null;
  const diff = Math.round((currentValue - previousValue) * 10) / 10;
  if (Math.abs(diff) < 0.5) {
    return `${label}은 이전 통화와 거의 비슷했습니다.`;
  }
  const direction = diff > 0 ? '올랐습니다' : '낮아졌습니다';
  return `${label}은 이전보다 ${Math.abs(diff)}${unit} ${direction}.`;
};

const buildChangeSummary = (currentCallLog, previousCallLog) => {
  if (!previousCallLog) {
    return {
      hasPreviousCallLog: false,
      summaryText: '비교할 이전 통화 기록이 아직 없습니다.',
      highlights: ['첫 통화 기록으로 저장되었습니다.'],
      metricChanges: {},
    };
  }

  const metricChanges = {
    cognitiveScore: {
      previous: previousCallLog.cognitiveScore ?? previousCallLog.analysis?.scores?.cognitive ?? null,
      current: currentCallLog.cognitiveScore ?? currentCallLog.analysis?.scores?.cognitive ?? null,
    },
    totalUtterances: {
      previous: previousCallLog.totalUtterances ?? null,
      current: currentCallLog.totalUtterances ?? null,
    },
    totalWords: {
      previous: previousCallLog.totalWords ?? null,
      current: currentCallLog.totalWords ?? null,
    },
    topicDeviationRate: {
      previous: previousCallLog.analysis?.metrics?.topicDeviationRate ?? previousCallLog.metrics?.topicDeviationRate ?? null,
      current: currentCallLog.analysis?.metrics?.topicDeviationRate ?? currentCallLog.metrics?.topicDeviationRate ?? null,
    },
    wordsPerMinute: {
      previous: previousCallLog.analysis?.metrics?.wordsPerMinute ?? previousCallLog.metrics?.wordsPerMinute ?? null,
      current: currentCallLog.analysis?.metrics?.wordsPerMinute ?? currentCallLog.metrics?.wordsPerMinute ?? null,
    },
    emotionPositiveRatio: {
      previous: previousCallLog.analysis?.metrics?.emotionPositiveRatio ?? previousCallLog.metrics?.emotionPositiveRatio ?? null,
      current: currentCallLog.analysis?.metrics?.emotionPositiveRatio ?? currentCallLog.metrics?.emotionPositiveRatio ?? null,
    },
  };

  Object.keys(metricChanges).forEach((key) => {
    const item = metricChanges[key];
    item.diff = typeof item.current === 'number' && typeof item.previous === 'number'
      ? Math.round((item.current - item.previous) * 10) / 10
      : null;
  });

  const highlights = [
    describeNumericChange('인지 점수', metricChanges.cognitiveScore.current, metricChanges.cognitiveScore.previous),
    describeNumericChange('발화 횟수', metricChanges.totalUtterances.current, metricChanges.totalUtterances.previous, '회'),
    describeNumericChange('발화 단어 수', metricChanges.totalWords.current, metricChanges.totalWords.previous, '개'),
    describeNumericChange('분당 단어 수', metricChanges.wordsPerMinute.current, metricChanges.wordsPerMinute.previous, '개'),
    describeNumericChange('주제 이탈률', metricChanges.topicDeviationRate.current, metricChanges.topicDeviationRate.previous, '%'),
    describeNumericChange('긍정 감정 비율', metricChanges.emotionPositiveRatio.current, metricChanges.emotionPositiveRatio.previous, '%'),
  ].filter(Boolean);

  const scoreDiff = metricChanges.cognitiveScore.diff || 0;
  const topicDiff = metricChanges.topicDeviationRate.diff || 0;
  const wordDiff = metricChanges.totalWords.diff || 0;

  let summaryText = '이전 통화와 전반적으로 비슷한 흐름을 보였습니다.';
  if (scoreDiff >= 5 && topicDiff <= 5) {
    summaryText = '이전 통화보다 인지 점수와 대화 흐름이 좋아진 편입니다.';
  } else if (scoreDiff <= -5 || topicDiff >= 10) {
    summaryText = '이전 통화보다 집중도나 대화 흐름을 조금 더 살펴볼 필요가 있습니다.';
  } else if (wordDiff >= 10) {
    summaryText = '이전 통화보다 표현량이 늘어 대화 참여가 좋아진 편입니다.';
  } else if (wordDiff <= -10) {
    summaryText = '이전 통화보다 말수가 줄어 컨디션이나 피로도를 함께 확인해 보면 좋겠습니다.';
  }

  return {
    hasPreviousCallLog: true,
    previousCallLogId: previousCallLog.id || null,
    previousCallDate: previousCallLog.callDate || previousCallLog.createdAt || null,
    summaryText,
    highlights,
    metricChanges,
  };
};

function VoiceChatScreen({ onBack }) {
  const [, setStatus] = useState('사진을 불러오는 중...');
  const [, setCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uiState, setUiState] = useState('loading');
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);

  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [photoKeywords, setPhotoKeywords] = useState(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  // 사용자가 버튼 눌러 멈춘 상태 (waiting dots 표시용)
  const [userPaused, setUserPaused] = useState(false);

  const chatHistoryRef = useRef([]);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentPhotoIdRef = useRef(null);
  const currentPhotoOwnerIdRef = useRef(null);
  const currentPhotoRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const isEndingCallRef = useRef(false);
  const endSignalCountRef = useRef(0);
  const processingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const silenceTimerRef = useRef(null);
  const autoListenTimerRef = useRef(null);
  const introTimerRef = useRef(null);
  const isMountedRef = useRef(false);
  const startupIdRef = useRef(0);
  const preCallStartedRef = useRef(false);
  const firstQuestionAskedRef = useRef(false);
  const uiStateRef = useRef('loading');
  const autoListenEnabledRef = useRef(true);
  const timerIntervalRef = useRef(null);
  const conversationDifficultyRef = useRef('중');
  const callLogSavedRef = useRef(false);
  const preCallCheckRef = useRef({
    active: false,
    index: 0,
    answers: [],
    photoData: null,
    context: null,
    fallbackGreeting: '',
  });

  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);
  const waitingDotsRef = useRef(null);
  const userPausedRef = useRef(false);
  const {
    startListening: startSpeechRecognition,
    stopListening: stopSpeechRecognition,
  } = useScribeSpeechRecognition({
    finalizeDelayMs: SILENCE_TIMEOUT_MS,
    webSpeechSilenceMs: SILENCE_TIMEOUT_MS - 500,
  });

  useEffect(() => { uiStateRef.current = uiState; }, [uiState]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { autoListenEnabledRef.current = autoListenEnabled; }, [autoListenEnabled]);
  useEffect(() => { userPausedRef.current = userPaused; }, [userPaused]);

  const isActiveStartup = (startupId) =>
    isMountedRef.current &&
    !isEndingCallRef.current &&
    (startupId === undefined || startupIdRef.current === startupId);

  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setCallSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  const formatTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── 음성바 애니메이션 ───────────────────────────────────────────

  const syncCanvasSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 204;
    const h = canvas.clientHeight || 68;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  const stopWaveAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (waitingDotsRef.current) {
      clearInterval(waitingDotsRef.current);
      waitingDotsRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startListeningWave = async () => {
    stopWaveAnimation();
    syncCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const BAR_COUNT = 20;
    const BAR_W = 6;
    const GAP = 5;
    const totalW = BAR_COUNT * (BAR_W + GAP) - GAP;
    const startX = (W - totalW) / 2;

    const drawBars = (getVal) => {
      animFrameRef.current = requestAnimationFrame(() => drawBars(getVal));
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = Math.min(1, Math.max(0, getVal(i)));
        const barH = Math.max(5, val * H * 0.85);
        const x = startX + i * (BAR_W + GAP);
        const y = (H - barH) / 2;
        ctx.fillStyle = 'rgb(65, 209, 127)';
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_W, barH, 3);
        ctx.fill();
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const USE_BINS = Math.floor(bufferLength * 0.4);
      drawBars((i) => {
        analyser.getByteFrequencyData(dataArray);
        return dataArray[Math.floor(i * USE_BINS / BAR_COUNT)] / 255;
      });
    } catch {
      let t2 = 0;
      const fallback = () => {
        animFrameRef.current = requestAnimationFrame(fallback);
        ctx.clearRect(0, 0, W, H);
        t2 += 0.07;
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = Math.max(0, (Math.sin(t2 + i * 0.45) + 1) / 2);
          const barH = Math.max(5, val * H * 0.78);
          const x = startX + i * (BAR_W + GAP);
          const y = (H - barH) / 2;
          ctx.fillStyle = 'rgb(65, 209, 127)';
          ctx.beginPath();
          ctx.roundRect(x, y, BAR_W, barH, 3);
          ctx.fill();
        }
      };
      fallback();
    }
  };

  // ─── AI 말할 때 파형: 왼쪽이 큰 삼각형 분포 랜덤값, 오른쪽 4개는 항상 0 ───
  const startSpeakingWave = () => {
    stopWaveAnimation();
    syncCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const BAR_COUNT = 20;
    const FIXED_ZERO_COUNT = 4; // 오른쪽 4개 고정 0
    const ACTIVE_COUNT = BAR_COUNT - FIXED_ZERO_COUNT;
    const BAR_W = 6;
    const GAP = 5;
    const totalW = BAR_COUNT * (BAR_W + GAP) - GAP;
    const startX = (W - totalW) / 2;
    const MIN_H = 3;
    const RISE_MS = 200;
    const FALL_MS = 100;

    // 왼쪽이 큰 삼각형 분포 랜덤값 (max 두 랜덤값 중 큰 값)
    const triangleRandom = (maxRatio) => {
      const r1 = Math.random();
      const r2 = Math.random();
      return Math.max(r1, r2) * maxRatio;
    };

    // 왼쪽이 크고 오른쪽으로 갈수록 작아지는 maxRatio (ACTIVE_COUNT 기준)
    const bars = Array.from({ length: ACTIVE_COUNT }, (_, i) => {
      const maxRatio = 0.25 + (1 - i / (ACTIVE_COUNT - 1)) * 0.75;
      return {
        currentH: MIN_H,
        targetH: triangleRandom(maxRatio) * H * 0.9 + MIN_H,
        maxRatio,
        phase: 'rise',
        startTime: performance.now() - Math.random() * (RISE_MS + FALL_MS),
        startH: MIN_H,
      };
    });

    const draw = (now) => {
      animFrameRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      // 활성 막대 (왼쪽 ACTIVE_COUNT개)
      for (let i = 0; i < ACTIVE_COUNT; i++) {
        const bar = bars[i];
        const elapsed = now - bar.startTime;
        if (bar.phase === 'rise') {
          const progress = Math.min(1, elapsed / RISE_MS);
          bar.currentH = bar.startH + (bar.targetH - bar.startH) * progress;
          if (progress >= 1) {
            bar.phase = 'fall';
            bar.startTime = now;
            bar.startH = bar.targetH;
          }
        } else {
          const progress = Math.min(1, elapsed / FALL_MS);
          bar.currentH = bar.startH + (MIN_H - bar.startH) * progress;
          if (progress >= 1) {
            const maxRatio = 0.25 + (1 - i / (ACTIVE_COUNT - 1)) * 0.75;
            bar.phase = 'rise';
            bar.startTime = now;
            bar.startH = MIN_H;
            bar.currentH = MIN_H;
            bar.targetH = triangleRandom(maxRatio) * H * 0.9 + MIN_H;
          }
        }
        const barH = Math.max(MIN_H, bar.currentH);
        const x = startX + i * (BAR_W + GAP);
        const y = (H - barH) / 2;
        ctx.fillStyle = 'rgb(255, 105, 150)';
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_W, barH, 3);
        ctx.fill();
      }

      // 오른쪽 4개: 항상 최소 높이, 같은 분홍 낮은 투명도
      for (let i = ACTIVE_COUNT; i < BAR_COUNT; i++) {
        const barH = MIN_H;
        const x = startX + i * (BAR_W + GAP);
        const y = (H - barH) / 2;
        ctx.fillStyle = 'rgba(255, 105, 150, 0.15)';
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_W, barH, 3);
        ctx.fill();
      }
    };
    requestAnimationFrame(draw);
  };

  // ─── 대기 점 (크기 1/2, 개수 2배 = 12개) ───────────────────────
  const startWaitingDots = () => {
    stopWaveAnimation();
    syncCanvasSize();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const DOT_COUNT = 12;   // 기존 6개 → 12개
    const DOT_R = 4;        // 기존 8 → 4 (1/2)
    const GAP = 8;          // 간격도 비례 축소
    const totalW = DOT_COUNT * (DOT_R * 2) + (DOT_COUNT - 1) * GAP;
    const startX = (W - totalW) / 2 + DOT_R;
    const cy = H / 2;
    let frame = 0;
    const FRAMES_PER_DOT = 8;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      frame++;
      const activeIdx = Math.floor(frame / FRAMES_PER_DOT) % DOT_COUNT;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < DOT_COUNT; i++) {
        const x = startX + i * (DOT_R * 2 + GAP);
        let alpha;
        if (i === activeIdx) {
          alpha = 0.95;
        } else if (i < activeIdx) {
          alpha = 0.15 + ((activeIdx - i) / DOT_COUNT) * 0.25;
        } else {
          alpha = 0.12;
        }
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, cy, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
  };

  useEffect(() => {
    if (showPhoto) {
      stopWaveAnimation();
      return;
    }
    if (uiState === 'recording') {
      startListeningWave();
    } else if (uiState === 'processing') {
      stopMicStream();
      startWaitingDots();
    } else if (uiState === 'ready') {
      stopMicStream();
      if (userPaused) {
        // 사용자가 멈춘 상태 → 대기 점
        startWaitingDots();
      } else if (isSpeakingRef.current) {
        startSpeakingWave();
      } else {
        stopWaveAnimation();
      }
    } else {
      stopMicStream();
      stopWaveAnimation();
    }
  }, [uiState, showPhoto, userPaused]);

  const stopMicStream = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  };
  const clearAutoListenTimer = () => {
    if (autoListenTimerRef.current) { clearTimeout(autoListenTimerRef.current); autoListenTimerRef.current = null; }
  };
  const clearIntroTimer = () => {
    if (introTimerRef.current) { clearTimeout(introTimerRef.current); introTimerRef.current = null; }
  };

  const scheduleAutoListen = (delay = AUTO_LISTEN_DELAY_MS) => {
    if (!autoListenEnabledRef.current || isEndingCallRef.current) return;
    clearAutoListenTimer();
    autoListenTimerRef.current = setTimeout(() => {
      if (autoListenEnabledRef.current && !isEndingCallRef.current && !isRecordingRef.current && !processingRef.current && !isSpeakingRef.current && uiStateRef.current === 'ready') {
        startRecording();
      }
    }, delay);
  };

  const cleanStageDirections = (text) => {
    return text.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, (match) => (match === '[END_CALL]' ? match : '')).replace(/\s{2,}/g, ' ').trim();
  };

  const containsEndIntent = (text) => /그만|종료|끊|끝낼|끝내|쉬자|피곤|힘들/.test(text || '');

  const isLikelyIncompleteUtterance = (text) => {
    const normalized = (text || '').trim();
    if (!normalized) return true;
    if (normalized.length < 3) return true;
    if (/^(어+|음+|아+|그+|저+|에+)[.!?\s]*$/i.test(normalized)) return true;
    return false;
  };

  const normalizeStatus = (value) => (value || '').replace(/\s+/g, '');

  const isUncalledPhoto = (photoData) => {
    const statusValue = normalizeStatus(photoData.callStatus || photoData.tag);
    return statusValue === '통화전' || !statusValue;
  };

  const getPhotoCreatedTime = (photoData) => {
    const date =
      photoData.createdAt?.toDate?.() ||
      photoData.uploadDate?.toDate?.() ||
      photoData.createdAt ||
      photoData.uploadDate ||
      photoData.date;
    const time = date ? new Date(date).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  };

  const getPhotoUrl = (photoData) =>
    photoData?.photoURL ||
    photoData?.imageUrl ||
    photoData?.imageURL ||
    photoData?.photoUrl ||
    photoData?.url ||
    photoData?.image ||
    '';

  const getPhotoName = (photoData) =>
    photoData?.imageName ||
    photoData?.name ||
    photoData?.location ||
    photoData?.situation ||
    photoData?.finalCaption ||
    photoData?.description ||
    photoData?.fileName ||
    '사진';

  const getPhotoTypeLabel = (photoData) => {
    const type = photoData?.photoType || photoData?.type || '';
    const typeMap = { place: '장소', job: '직업', object: '사물' };
    return typeMap[type] || type || '개인적';
  };

  const extractPhotoContext = (photoData) => {
    const keywordsObj = photoData?.keywords && typeof photoData.keywords === 'object' && !Array.isArray(photoData.keywords) ? photoData.keywords : {};
    const keywordList = Array.isArray(photoData?.keywords) ? photoData.keywords : keywordsObj.keywords || [];
    return {
      keywords: keywordList,
      detailedDescription: photoData?.detailedDescription || keywordsObj.detailedDescription || photoData?.description || '',
      description: photoData?.description || keywordsObj.description || '',
      people: photoData?.people || keywordsObj.people || [],
      location: photoData?.location || keywordsObj.location || '',
      emotion: photoData?.emotion || keywordsObj.emotion || '',
      situation: photoData?.situation || keywordsObj.situation || '',
      conversationStarters: photoData?.conversationStarters || keywordsObj.conversationStarters || [],
      year: photoData?.year || '',
      finalCaption: photoData?.finalCaption || '',
      answerKeywords: photoData?.answerKeywords || [],
      imageName: getPhotoName(photoData),
      photoType: getPhotoTypeLabel(photoData),
      type: photoData?.type || '',
      name: photoData?.name || '',
    };
  };

  const buildFallbackPhotoFromOrientation = async () => {
    try {
      console.log('[VoiceChat] 보호자 사진 없음/URL 없음 → orientation_images fallback 조회 시작');
      const snap = await getDocs(collection(db, 'orientation_images'));
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => getPhotoUrl(item));

      console.log('[VoiceChat] orientation_images 조회 결과:', {
        totalDocs: snap.docs.length,
        usableDocs: docs.length,
      });

      if (docs.length === 0) return null;

      const selected = docs[Math.floor(Math.random() * docs.length)];
      const photoUrl = getPhotoUrl(selected);
      console.log('[VoiceChat] orientation fallback 사진 선택:', {
        id: selected.id,
        type: selected.type,
        hasUrl: Boolean(photoUrl),
        urlPreview: photoUrl ? photoUrl.slice(0, 80) : '',
      });
      const fallbackPhoto = {
        ...selected,
        id: `orientation_${selected.id}`,
        ownerId: 'orientation_images',
        source: 'orientation_images',
        url: photoUrl,
        description:
          selected.detailedDescription ||
          selected.finalCaption ||
          selected.description ||
          selected.location ||
          selected.name ||
          '지남력 훈련에 사용하는 사진입니다.',
      };

      return {
        photo: fallbackPhoto,
        context: extractPhotoContext(fallbackPhoto),
      };
    } catch (error) {
      console.warn('[VoiceChat] orientation_images fallback 로드 실패:', error);
      return null;
    }
  };

  const resolvePhotoOwnerId = async (userId) => {
    const connectedPatientId = await getConnectedPatientId(userId);
    if (connectedPatientId) return connectedPatientId;
    return userId;
  };

  const loadConversationDifficulty = async (ownerId) => {
    try {
      const snap = await getDoc(doc(db, 'patients', ownerId));
      const difficulty = snap.exists() ? snap.data()?.difficulty : null;
      conversationDifficultyRef.current = difficulty || '중';
      console.log('[VoiceChat] 대화 난이도 설정:', {
        ownerId,
        difficulty: conversationDifficultyRef.current,
      });
    } catch (error) {
      console.warn('[VoiceChat] 난이도 로드 실패, 기본값 중 사용:', error);
      conversationDifficultyRef.current = '중';
    }
  };

  const stopSpeaking = () => {
    cancelTTS();
    ttsQueueRef.current = [];
    isSpeakingRef.current = false;
  };

  const processTTSQueue = async () => {
    if (!isMountedRef.current || isEndingCallRef.current) return;
    if (ttsQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      if (!showPhoto) stopWaveAnimation();
      if (!isEndingCallRef.current && uiStateRef.current === 'ready') scheduleAutoListen();
      return;
    }
    isSpeakingRef.current = true;
    if (!showPhoto) startSpeakingWave();
    const text = ttsQueueRef.current.shift();
    await tts(text);
    if (!isMountedRef.current || isEndingCallRef.current) return;
    processTTSQueue();
  };

  const addToTTSQueue = (text) => {
    if (!isMountedRef.current || isEndingCallRef.current) return;
    ttsQueueRef.current.push(text);
    if (!isSpeakingRef.current) processTTSQueue();
  };

  const speakAssistantText = (text, statusText = '천천히 말씀해 주세요.') => {
    if (!isMountedRef.current || isEndingCallRef.current) return;
    const displayText = cleanStageDirections(text).trim();
    if (!displayText) return;
    chatHistoryRef.current.push({ role: 'model', parts: [{ text: displayText }] });
    setCaption(`AI: ${displayText}`);
    addToTTSQueue(displayText);
    setUiState('ready');
    setStatus(statusText);
  };

  const askPreCallQuestion = () => {
    const index = preCallCheckRef.current.index;
    const question = PRE_CALL_CHECK_QUESTIONS[index];
    if (!question) return false;
    speakAssistantText(question, '먼저 컨디션을 확인할게요. 천천히 말씀해 주세요.');
    return true;
  };

  const startPreCallCheck = ({ photoData = null, context = null, fallbackGreeting = '' } = {}) => {
    if (!isMountedRef.current || preCallStartedRef.current) return;
    preCallStartedRef.current = true;
    preCallCheckRef.current = {
      active: true,
      index: 0,
      answers: [],
      photoData,
      context,
      fallbackGreeting,
    };
    askPreCallQuestion();
  };

  const finishPreCallCheck = async () => {
    const { photoData, context, fallbackGreeting } = preCallCheckRef.current;
    preCallCheckRef.current.active = false;

    if (photoData && context) {
      await startPhotoConversation(photoData, context);
      return;
    }

    startConversationWithoutPhoto(fallbackGreeting || '안녕하세요. 오늘 기분은 어떠세요?', true);
  };

  const handlePreCallAnswer = async (text) => {
    const currentIndex = preCallCheckRef.current.index;
    preCallCheckRef.current.answers[currentIndex] = text;
    chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });

    const currentQuestion = PRE_CALL_CHECK_QUESTIONS[currentIndex];
    const reaction = await generatePreCallReaction({
      question: currentQuestion,
      answer: text,
      questionIndex: currentIndex,
    }) || getPreCallReaction(currentIndex, text);
    preCallCheckRef.current.index += 1;
    if (preCallCheckRef.current.index < PRE_CALL_CHECK_QUESTIONS.length) {
      const nextQuestion = PRE_CALL_CHECK_QUESTIONS[preCallCheckRef.current.index];
      speakAssistantText(
        joinReactionAndQuestion(reaction, nextQuestion),
        '먼저 컨디션을 확인할게요. 천천히 말씀해 주세요.'
      );
      return;
    }

    speakAssistantText(
      `${reaction} 이제 사진을 보면서 이야기를 나눠볼게요.`,
      '사진 대화를 시작할게요.'
    );
    await finishPreCallCheck();
  };

  const markPhotoAsCompleted = async () => {
    const photoId = currentPhotoIdRef.current;
    const ownerId = currentPhotoOwnerIdRef.current;
    if (!photoId || !ownerId) return;
    try {
      const photoRef = doc(db, 'users', ownerId, 'photos', photoId);
      await updateDoc(photoRef, { callStatus: '통화후', tag: '통화 후', lastCallDate: new Date().toISOString() });
      currentPhotoIdRef.current = null;
    } catch (error) {
      console.error('❌ 상태 업데이트 오류:', error);
    }
  };

  const loadLatestPreviousCallLog = async (userId) => {
    try {
      const callLogQuery = query(collection(db, 'call_logs'), where('userId', '==', userId));
      const snapshot = await getDocs(callLogQuery);
      const callLogs = snapshot.docs
        .map((callLogDoc) => ({ id: callLogDoc.id, ...callLogDoc.data() }))
        .sort((a, b) => getDateMillis(b.callDate || b.createdAt) - getDateMillis(a.callDate || a.createdAt));

      return callLogs[0] || null;
    } catch (error) {
      console.warn('[VoiceChat] 이전 call_logs 조회 실패:', error);
      return null;
    }
  };

  const saveCallLog = async () => {
    try {
      if (callLogSavedRef.current) return;
      callLogSavedRef.current = true;

      const user = auth.currentUser;
      if (!user) return;
      const callDuration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      if (chatHistoryRef.current.length === 0) return;
      const usedPhotoContext = hasPhoto ? {
        ...(photoKeywords || {}),
        ...(currentPhotoRef.current || {})
      } : null;
      const llmReport = await evaluateConversationReport(chatHistoryRef.current, usedPhotoContext);
      const analysis = analyzeConversation(chatHistoryRef.current, callDuration, {
        photoContext: usedPhotoContext,
        llmReport
      });
      const conversationText = chatHistoryRef.current.map((msg) => {
        const role = msg.role === 'user' ? '환자' : 'AI';
        return `${role}: ${msg.parts[0]?.text || ''}`;
      }).join('\n');
      const previousCallLog = await loadLatestPreviousCallLog(user.uid);
      const changesFromPrevious = buildChangeSummary({
        totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        cognitiveScore: analysis.scores.cognitive,
        analysis: {
          metrics: analysis.metrics,
          scores: analysis.scores,
        },
      }, previousCallLog);
      const currentCallForInsight = {
        userId: user.uid,
        photoOwnerId: currentPhotoOwnerIdRef.current || user.uid,
        callDate: new Date().toISOString(),
        callDuration,
        photoId: currentPhotoIdRef.current || null,
        hasPhoto,
        conversation: conversationText,
        totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        photoContext: usedPhotoContext,
        preCallCheck: {
          questions: PRE_CALL_CHECK_QUESTIONS,
          answers: preCallCheckRef.current.answers || [],
        },
        analysis: {
          metrics: analysis.metrics,
          scores: analysis.scores,
          status: analysis.status,
          insights: analysis.insights,
          report: analysis.report || llmReport || null,
        },
        status: analysis.status.label,
        cognitiveScore: analysis.scores.cognitive,
        changesFromPrevious,
      };
      const insightLines = await generateCallInsightLines({
        currentCallLog: currentCallForInsight,
        previousCallLog
      });
      currentCallForInsight.analysis.insights = insightLines;
      const callLogData = sanitizeForFirestore({
        userId: user.uid,
        photoOwnerId: currentPhotoOwnerIdRef.current || user.uid,
        callDate: serverTimestamp(), callDuration, photoId: currentPhotoIdRef.current || null,
        hasPhoto, conversation: conversationText, totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        photoContext: usedPhotoContext,
        preCallCheck: {
          questions: PRE_CALL_CHECK_QUESTIONS,
          answers: preCallCheckRef.current.answers || [],
        },
        analysis: { metrics: analysis.metrics, scores: analysis.scores, status: analysis.status, insights: insightLines, report: analysis.report || llmReport || null },
        changesFromPrevious,
        summary: {
          status: analysis.status,
          cognitiveScore: analysis.scores.cognitive,
          totalUtterances: analysis.totalUtterances,
          totalWords: analysis.totalWords,
          insights: insightLines,
        },
        status: analysis.status.label, cognitiveScore: analysis.scores.cognitive, createdAt: serverTimestamp()
      });
      await addDoc(collection(db, 'call_logs'), callLogData);
    } catch (error) {
      callLogSavedRef.current = false;
      console.error('❌ 통화 기록 저장 오류:', error);
    }
  };

  const finalizeRecognizedSpeech = async (recognizedText = '') => {
    clearSilenceTimer();
    const text = (recognizedText || `${finalTranscriptRef.current} ${interimTranscriptRef.current}`).replace(/\s+/g, ' ').trim();
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    if (!text) {
      setUiState('ready');
      setStatus('잘 안 들렸어요. 천천히 다시 말씀해 주세요.');
      scheduleAutoListen(400);
      return;
    }
    if (isLikelyIncompleteUtterance(text)) {
      setCaption(`당신: ${text}`);
      setUiState('ready');
      setStatus('천천히 이어서 말씀해 주세요.');
      scheduleAutoListen(300);
      return;
    }
    setCaption(`당신: ${text}`);
    setUiState('processing');
      setStatus(preCallCheckRef.current.active ? '확인하고 있어요...' : '대답을 생각하는 중...');
      if (preCallCheckRef.current.active) {
        await handlePreCallAnswer(text);
      } else {
        await sendTextToGemini(text);
      }
  };

  const startRecording = () => {
    if (isSpeakingRef.current || processingRef.current || isEndingCallRef.current || isRecordingRef.current) return;
    try {
      clearSilenceTimer();
      stopSpeaking();
      setUserPaused(false);
      setIsRecording(true);
      isRecordingRef.current = true;
      setUiState('recording');
      setStatus('듣고 있어요...');
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      startSpeechRecognition(
        (text) => {
          setIsRecording(false);
          isRecordingRef.current = false;
          finalizeRecognizedSpeech(text);
        },
        () => {
          setIsRecording(false);
          isRecordingRef.current = false;
          setUiState('ready');
          setStatus('잘 안 들렸어요. 천천히 다시 말씀해 주세요.');
          scheduleAutoListen(400);
        },
        {
          onTranscript: (preview) => {
            finalTranscriptRef.current = preview;
            interimTranscriptRef.current = '';
            setCaption(`당신: ${preview}`);
          },
        }
      );
    } catch (err) {
      console.error('❌ 음성인식 시작 오류:', err);
    }
  };

  const stopRecording = () => {
    clearSilenceTimer();
    stopSpeechRecognition();
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  const startPhotoConversation = async (photoData, context) => {
    if (firstQuestionAskedRef.current) return;
    firstQuestionAskedRef.current = true;

    const enrichedContext = {
      ...context,
      imageName: context.imageName || getPhotoName(photoData),
      photoType: context.photoType || getPhotoTypeLabel(photoData),
    };

    let firstQuestion = '';
    try {
      firstQuestion = await chatWithGemini(
        '사전 건강 확인과 자기소개는 이미 했습니다. 몸 상태, 식사, 약, 수면, 자기소개를 반복하지 말고 바로 사진을 보며 이어질 첫 질문만 해주세요.',
        [],
        enrichedContext,
        conversationDifficultyRef.current,
        0
      );
    } catch (error) {
      console.warn('[VoiceChat] 첫 질문 생성 실패, 기본 질문 사용:', error);
    }

    if (!firstQuestion) {
      const description = enrichedContext.detailedDescription || enrichedContext.description || photoData.description || '';
      firstQuestion = description
        ? `이제 ${description} 사진을 같이 볼게요. 이 사진을 보니 어떤 느낌이 드세요?`
        : '이제 이 사진을 같이 볼게요. 이 사진을 보니 어떤 느낌이 드세요?';
    }

    const displayText = cleanStageDirections(firstQuestion.replace('[END_CALL]', '').replace('[통화끝]', '')).trim();
    chatHistoryRef.current.push({ role: 'model', parts: [{ text: displayText }] });
    setCaption(`AI: ${displayText}`);
    addToTTSQueue(displayText);
    setUiState('ready');
    setStatus('AI가 질문했어요. 천천히 말씀해 주세요.');
  };

  const startConversationWithoutPhoto = (greeting = '오늘은 편안하게 이야기를 나눠볼게요. 최근에 기억에 남는 일이 있으셨나요?', skipPreCallCheck = false) => {
    setHasPhoto(false);
    setShowPhoto(false);
    if (!skipPreCallCheck) {
      startPreCallCheck({ fallbackGreeting: greeting });
      return;
    }
    setUiState('ready');
    setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
    setCaption(`AI: ${greeting}`);
    chatHistoryRef.current.push({ role: 'model', parts: [{ text: greeting }] });
    addToTTSQueue(greeting);
  };

  const startWithFallbackPhoto = async (startupId) => {
    const fallback = await buildFallbackPhotoFromOrientation();
    if (!isActiveStartup(startupId)) return false;
    if (!fallback) {
      console.warn('[VoiceChat] orientation fallback 사진도 찾지 못했습니다.');
      return false;
    }

    const { photo, context } = fallback;
    console.log('[VoiceChat] fallback 사진으로 대화 시작:', {
      id: photo.id,
      url: photo.url,
      description: context.description || context.detailedDescription,
    });
    setCurrentPhoto(photo);
    currentPhotoRef.current = photo;
    currentPhotoIdRef.current = null;
    currentPhotoOwnerIdRef.current = null;
    setPhotoKeywords(context);
    setHasPhoto(true);
    setShowPhoto(true);
    setUiState('ready');
    setStatus('훈련용 사진으로 대화를 시작할게요. 천천히 말씀해 주세요.');
    startPreCallCheck({ photoData: photo, context });
    return true;
  };

  const loadPhotoAndStart = async (startupId) => {
    try {
      const user = auth.currentUser;
      console.log('[VoiceChat] loadPhotoAndStart 시작:', {
        authUid: user?.uid || null,
      });
      if (!user) {
        console.warn('[VoiceChat] auth.currentUser가 없어 사진을 조회하지 못했습니다.');
        setStatus('로그인이 필요합니다.');
        return;
      }
      const ownerId = await resolvePhotoOwnerId(user.uid);
      if (!isActiveStartup(startupId)) return;
      await loadConversationDifficulty(ownerId);
      if (!isActiveStartup(startupId)) return;
      console.log('[VoiceChat] 사진 ownerId 결정:', {
        loginUid: user.uid,
        ownerId,
        isFallbackToSelf: ownerId === user.uid,
      });
      currentPhotoOwnerIdRef.current = ownerId;
      const photosRef = collection(db, 'users', ownerId, 'photos');
      const snapshot = await getDocs(photosRef);
      if (!isActiveStartup(startupId)) return;
      const photos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log('[VoiceChat] users/{ownerId}/photos 조회 결과:', {
        ownerId,
        totalPhotos: photos.length,
        photoIds: photos.map((p) => p.id),
      });
      const pendingPhotos = photos.filter(isUncalledPhoto);
      const selectablePhotos = pendingPhotos.length > 0 ? pendingPhotos : photos;
      console.log('[VoiceChat] 선택 가능한 사진:', {
        pendingPhotos: pendingPhotos.length,
        selectablePhotos: selectablePhotos.length,
      });
      if (selectablePhotos.length === 0) {
        console.warn('[VoiceChat] 보호자/환자 등록 사진이 없어 fallback을 시도합니다.');
        const usedFallback = await startWithFallbackPhoto(startupId);
        if (!isActiveStartup(startupId)) return;
        if (!usedFallback) startConversationWithoutPhoto();
        return;
      }
      selectablePhotos.sort((a, b) => getPhotoCreatedTime(b) - getPhotoCreatedTime(a));
      const photoData = selectablePhotos[0];
      const photoUrl = getPhotoUrl(photoData);
      console.log('[VoiceChat] 사용자 사진 선택:', {
        id: photoData.id,
        callStatus: photoData.callStatus,
        tag: photoData.tag,
        hasUrl: Boolean(photoUrl),
        urlPreview: photoUrl ? photoUrl.slice(0, 80) : '',
        availableUrlFields: {
          photoURL: Boolean(photoData.photoURL),
          imageUrl: Boolean(photoData.imageUrl),
          imageURL: Boolean(photoData.imageURL),
          photoUrl: Boolean(photoData.photoUrl),
          url: Boolean(photoData.url),
          image: Boolean(photoData.image),
        },
      });
      const context = extractPhotoContext(photoData);
      const selectedPhoto = { ...photoData, id: photoData.id, ownerId, url: photoUrl };
      if (!isActiveStartup(startupId)) return;
      setCurrentPhoto(selectedPhoto);
      currentPhotoRef.current = selectedPhoto;
      currentPhotoIdRef.current = photoData.id;
      setPhotoKeywords(context);
      setHasPhoto(Boolean(photoUrl));
      setShowPhoto(Boolean(photoUrl));
      setUiState('ready');
      setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
      if (photoUrl) {
        startPreCallCheck({ photoData, context });
      } else {
        console.warn('[VoiceChat] 선택된 사용자 사진에 URL이 없어 fallback을 시도합니다:', photoData.id);
        const usedFallback = await startWithFallbackPhoto(startupId);
        if (!isActiveStartup(startupId)) return;
        if (!usedFallback) startConversationWithoutPhoto();
      }
    } catch (error) {
      if (!isActiveStartup(startupId)) return;
      console.error('❌ 사진 로드 오류:', error);
      const usedFallback = await startWithFallbackPhoto(startupId);
      if (!isActiveStartup(startupId)) return;
      if (!usedFallback) startConversationWithoutPhoto('오늘 하루 중 기억에 남는 일을 천천히 들려주세요.');
    }
  };

  const sendTextToGemini = async (text) => {
    processingRef.current = true;
    try {
      const elapsedMinutes = Math.floor(callSeconds / 60);
      const fullText = await chatWithGemini(
        text,
        chatHistoryRef.current,
        hasPhoto ? photoKeywords : null,
        conversationDifficultyRef.current,
        elapsedMinutes
      );
      chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullText }] });
      const hasEndTag = fullText.includes('[END_CALL]') || fullText.includes('[통화끝]');
      const displayText = cleanStageDirections(fullText.replace('[END_CALL]', '').replace('[통화끝]', '')).trim();
      if (displayText) { setCaption(`AI: ${displayText}`); addToTTSQueue(displayText); }
      if (hasEndTag) {
        const userWantsToEnd = containsEndIntent(text);
        const canEndByTime = elapsedMinutes >= 15;

        if (userWantsToEnd || canEndByTime) {
          isEndingCallRef.current = true;
          setAutoListenEnabled(false);
          setStatus('대화를 마무리할게요.');
          await saveCallLog();
          if (hasPhoto) await markPhotoAsCompleted();
          setTimeout(() => { alert('대화를 종료합니다. 건강하세요!'); onBack(); }, 2500);
        } else {
          endSignalCountRef.current = 0;
          setUiState('ready');
          setStatus('아직 통화를 이어갈게요. 천천히 말씀해 주세요.');
          scheduleAutoListen(700);
        }
      } else {
        endSignalCountRef.current = 0;
        setUiState('ready');
        setStatus('천천히 이어서 말씀해 주세요.');
      }
    } catch (error) {
      console.error('❌ Gemini 오류:', error);
      setStatus('잘 못 들었어요. 다시 말씀해 주세요.');
      setCaption(`에러: ${error.message}`);
      setUiState('ready');
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const startupId = startupIdRef.current + 1;
    startupIdRef.current = startupId;
    preCallStartedRef.current = false;
    callStartTimeRef.current = Date.now();
    stopSpeaking();
    loadPhotoAndStart(startupId);
    return () => {
      isMountedRef.current = false;
      startupIdRef.current += 1;
      clearSilenceTimer();
      clearAutoListenTimer();
      clearIntroTimer();
      stopSpeaking();
      stopWaveAnimation();
      stopMicStream();
      clearInterval(timerIntervalRef.current);
      stopSpeechRecognition();
    };
  }, []);

  const handleBack = async () => {
    isEndingCallRef.current = true;
    setAutoListenEnabled(false);
    stopRecording();
    await saveCallLog();
    if (hasPhoto && currentPhotoIdRef.current) await markPhotoAsCompleted();
    onBack();
  };

  const handleMicClick = () => {
    // AI가 말하는 중 → 즉시 끊고 녹음 시작
    if (isSpeakingRef.current) {
      stopSpeaking();
      isSpeakingRef.current = false;
      setUserPaused(false);
      setAutoListenEnabled(true);
      startRecording();
      return;
    }    if (isRecording) {
      // 사용자가 버튼 눌러 멈춤 → waiting dots 표시
      setAutoListenEnabled(false);
      setUserPaused(true);
      stopRecording();
      setUiState('ready');
      setStatus('자동 듣기를 멈췄어요. 다시 누르면 재개합니다.');
      return;
    }
    setAutoListenEnabled(true);
    setUserPaused(false);
    startRecording();
  };

const currentStateKey = isSpeakingRef.current && uiState === 'ready' ? 'speaking' : uiState;
  const pillColor =
    currentStateKey === 'recording' ? '#41d17f' :
    currentStateKey === 'speaking'  ? '#ff6996' :
    '#8b5cf6';
  const pillLabel =
    currentStateKey === 'recording' ? '듣고 있어요' :
    currentStateKey === 'speaking'  ? '말하고 있어요' :
    uiState === 'loading' ? '준비 중' : '기다리고 있어요';

  return (
    <div className="vc_voice-chat-screen">
      {/* 헤더 */}
      <div className="vc_chat-header">
        <button className="vc_back-btn" onClick={handleBack}>종료</button>
        <div className="vc_header-title">
          <h2>REMIND</h2>
          <span className="vc_header-subtitle">VOICE TALK</span>
        </div>
        {/* 타이머 제거 - 중앙으로 이동 */}
        <div className="vc_header-spacer" />
      </div>

      {/* 타이머: 헤더와 메인 사이 중앙 */}
      <div className="vc_timer-bar">
        <span className="vc_timer-text">{formatTime(callSeconds)}</span>
      </div>

      {/* 메인 */}
      <div className="vc_call-interface">

        {/* 시각화 + pill 묶음 */}
        <div className="vc_main-content">
        {/* 사진 or 음성바 */}
        {showPhoto && hasPhoto && currentPhoto ? (
          <div className="vc_photo-display visible">
            <img
              src={currentPhoto.url}
              alt="추억 사진"
              onError={(e) => {
                console.error('[VoiceChat] 이미지 렌더링 실패:', {
                  url: currentPhoto.url,
                  photoId: currentPhoto.id,
                  ownerId: currentPhoto.ownerId,
                  source: currentPhoto.source || 'user_photo',
                });
                e.target.style.display = 'none';
                setShowPhoto(false);
              }}
            />
            {photoKeywords && (
              <div className="vc_photo-keywords">
                {photoKeywords.emotion && <span className="vc_keyword-tag">{photoKeywords.emotion}</span>}
                {photoKeywords.location && <span className="vc_keyword-tag">📍 {photoKeywords.location}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="vc_wave-container" data-state={currentStateKey}>
            <canvas ref={canvasRef} className="vc_wave-canvas" />
          </div>
        )}

        {/* 상태 pill */}
        <div className="vc_status-pill" style={{ '--pill-color': pillColor }}>
          <span className="vc_pill-dot" />
          <span className="vc_pill-label">{pillLabel}</span>
        </div>
        </div>

        {/* 마이크 버튼 */}
        <div className="vc_control-area">
<button
            className={`vc_mic-btn ${uiState}`}
            onClick={handleMicClick}
            disabled={uiState === 'loading' || uiState === 'processing'}
          >
            <span className="vc_mic-icon">
              {uiState === 'loading' && (
                <svg width="42" height="42" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40 20" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="1s" repeatCount="indefinite"/>
                  </circle>
                </svg>
              )}
              {(uiState === 'ready' || uiState === 'recording') && (
                <svg width="42" height="42" viewBox="0 0 28 28" fill="none">
                  <rect x="10" y="3" width="8" height="14" rx="4" fill="currentColor"/>
                  <path d="M5 14c0 4.97 4.03 9 9 9s9-4.03 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="14" y1="23" x2="14" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
              {uiState === 'processing' && (
                <svg width="42" height="42" viewBox="0 0 28 28" fill="none">
                  <circle cx="8" cy="14" r="2.5" fill="currentColor"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" begin="0s" repeatCount="indefinite"/></circle>
                  <circle cx="14" cy="14" r="2.5" fill="currentColor"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" begin="0.4s" repeatCount="indefinite"/></circle>
                  <circle cx="20" cy="14" r="2.5" fill="currentColor"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" begin="0.8s" repeatCount="indefinite"/></circle>
                </svg>
              )}
            </span>
            <span className="vc_mic-label">
              {uiState === 'loading' && '준비 중'}
              {uiState === 'ready' && isSpeakingRef.current && '내가 말하기'}
              {uiState === 'ready' && !isSpeakingRef.current && (autoListenEnabled ? '자동 듣기' : '통화 계속하기')}
              {uiState === 'recording' && '잠시 통화 멈추기'}
              {uiState === 'processing' && '생각 중'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChatScreen;
