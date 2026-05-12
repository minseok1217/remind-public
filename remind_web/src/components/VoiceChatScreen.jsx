import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { chatWithGemini, evaluateConversationReport } from '../services/geminiService';
import { analyzeConversation } from '../services/conversationAnalysisService';
import { getConnectedPatientId } from '../services/familyLinkService';
import './VoiceChatScreen.css';
import { tts, cancelTTS } from '../services/ttsService';
import { useScribeSpeechRecognition } from '../hooks/useScribeSpeechRecognition';

const SILENCE_TIMEOUT_MS = 1700;
const AUTO_LISTEN_DELAY_MS = 700;

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
  const firstQuestionAskedRef = useRef(false);
  const uiStateRef = useRef('loading');
  const autoListenEnabledRef = useRef(true);
  const timerIntervalRef = useRef(null);

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
    webSpeechSilenceMs: SILENCE_TIMEOUT_MS,
  });

  useEffect(() => { uiStateRef.current = uiState; }, [uiState]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { autoListenEnabledRef.current = autoListenEnabled; }, [autoListenEnabled]);
  useEffect(() => { userPausedRef.current = userPaused; }, [userPaused]);

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
      answerKeywords: photoData?.answerKeywords || []
    };
  };

  const resolvePhotoOwnerId = async (userId) => {
    const connectedPatientId = await getConnectedPatientId(userId);
    if (connectedPatientId) return connectedPatientId;
    return userId;
  };

  const stopSpeaking = () => {
    cancelTTS();
    ttsQueueRef.current = [];
    isSpeakingRef.current = false;
  };

  const processTTSQueue = async () => {
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
    processTTSQueue();
  };

  const addToTTSQueue = (text) => {
    ttsQueueRef.current.push(text);
    if (!isSpeakingRef.current) processTTSQueue();
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

  const saveCallLog = async () => {
    try {
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
      const callLogData = {
        userId: user.uid,
        photoOwnerId: currentPhotoOwnerIdRef.current || user.uid,
        callDate: serverTimestamp(), callDuration, photoId: currentPhotoIdRef.current || null,
        hasPhoto, conversation: conversationText, totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        photoContext: usedPhotoContext,
        analysis: { metrics: analysis.metrics, scores: analysis.scores, status: analysis.status, insights: analysis.insights, report: analysis.report },
        status: analysis.status.label, cognitiveScore: analysis.scores.cognitive, createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'call_logs'), callLogData);
    } catch (error) {
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
    setStatus('대답을 생각하는 중...');
    await sendTextToGemini(text);
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
    const description = context.detailedDescription || context.description || photoData.description || '';
    const people = context.people || [];
    const location = context.location || '';
    const emotion = context.emotion || '';
    const conversationStarters = context.conversationStarters || [];
    let firstQuestion = '';
    if (conversationStarters.length > 0) firstQuestion = conversationStarters[0];
    else if (description) firstQuestion = `이 사진 보니까 ${description} 같네요. 이때 기억나세요?`;
    else if (people.length > 0) firstQuestion = `사진에 ${people.join(', ')}님이 보이네요. 함께한 추억 이야기해 주세요.`;
    else if (location) firstQuestion = `이곳이 ${location}인 것 같아요. 여기 언제 가셨어요?`;
    else if (emotion) firstQuestion = `사진 분위기가 ${emotion}하네요. 어떤 날이었나요?`;
    else if (photoData.description) firstQuestion = `이 사진은 "${photoData.description}"라고 하네요. 이때 기억나시나요?`;
    else firstQuestion = '사진이 참 좋아 보여요. 어떤 추억이 담겨 있나요?';
    chatHistoryRef.current.push({ role: 'model', parts: [{ text: firstQuestion }] });
    setCaption(`AI: ${firstQuestion}`);
    addToTTSQueue(firstQuestion);
    setUiState('ready');
    setStatus('AI가 질문했어요. 천천히 말씀해 주세요.');
  };

  const loadPhotoAndStart = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setStatus('로그인이 필요합니다.'); return; }
      const ownerId = await resolvePhotoOwnerId(user.uid);
      currentPhotoOwnerIdRef.current = ownerId;
      const photosRef = collection(db, 'users', ownerId, 'photos');
      const snapshot = await getDocs(photosRef);
      const photos = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const pendingPhotos = photos.filter(isUncalledPhoto);
      const selectablePhotos = pendingPhotos.length > 0 ? pendingPhotos : photos;
      if (selectablePhotos.length === 0) {
        const greeting = '안녕하세요. 오늘 기분은 어떠세요?';
        setHasPhoto(false);
        setShowPhoto(false);
        setUiState('ready');
        setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
        setCaption(`AI: ${greeting}`);
        chatHistoryRef.current.push({ role: 'model', parts: [{ text: greeting }] });
        addToTTSQueue(greeting);
        return;
      }
      selectablePhotos.sort((a, b) => getPhotoCreatedTime(b) - getPhotoCreatedTime(a));
      const photoData = selectablePhotos[0];
      const photoUrl = photoData.photoURL || photoData.imageUrl || photoData.url || '';
      const context = extractPhotoContext(photoData);
      const selectedPhoto = { id: photoData.id, ownerId, url: photoUrl, ...photoData };
      setCurrentPhoto(selectedPhoto);
      currentPhotoRef.current = selectedPhoto;
      currentPhotoIdRef.current = photoData.id;
      setPhotoKeywords(context);
      setHasPhoto(Boolean(photoUrl));
      setShowPhoto(Boolean(photoUrl));
      setUiState('ready');
      setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
      if (photoUrl) {
        await startPhotoConversation(photoData, context);
      } else {
        const greeting = '안녕하세요. 오늘 기분은 어떠세요?';
        setCaption(`AI: ${greeting}`);
        chatHistoryRef.current.push({ role: 'model', parts: [{ text: greeting }] });
        addToTTSQueue(greeting);
      }
    } catch (error) {
      console.error('❌ 사진 로드 오류:', error);
      const greeting = '안녕하세요. 오늘 어떤 하루였는지 들려주세요.';
      setHasPhoto(false);
      setShowPhoto(false);
      setUiState('ready');
      setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
      setCaption(`AI: ${greeting}`);
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: greeting }] });
      addToTTSQueue(greeting);
    }
  };

  const sendTextToGemini = async (text) => {
    processingRef.current = true;
    try {
      const fullText = await chatWithGemini(text, chatHistoryRef.current, hasPhoto ? photoKeywords : null);
      chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullText }] });
      const hasEndTag = fullText.includes('[END_CALL]');
      const displayText = cleanStageDirections(fullText.replace('[END_CALL]', '')).trim();
      if (displayText) { setCaption(`AI: ${displayText}`); addToTTSQueue(displayText); }
      if (hasEndTag) {
        if (containsEndIntent(text) || endSignalCountRef.current >= 1) {
          isEndingCallRef.current = true;
          setAutoListenEnabled(false);
          setStatus('대화를 마무리할게요.');
          await saveCallLog();
          if (hasPhoto) await markPhotoAsCompleted();
          setTimeout(() => { alert('대화를 종료합니다. 건강하세요!'); onBack(); }, 2500);
        } else {
          endSignalCountRef.current += 1;
          setUiState('ready');
          setStatus('계속 이야기해도 좋아요. 천천히 말씀해 주세요.');
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
    callStartTimeRef.current = Date.now();
    loadPhotoAndStart();
    return () => {
      isMountedRef.current = false;
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
