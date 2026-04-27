import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { chatWithPhoto } from '../services/geminiService';
import { analyzeConversation } from '../services/conversationAnalysisService';
import './VoiceChatScreen.css';

const SILENCE_TIMEOUT_MS = 1700;
const AUTO_LISTEN_DELAY_MS = 700;

function VoiceChatScreen({ onBack }) {
  const [status, setStatus] = useState('사진을 불러오는 중...');
  const [caption, setCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uiState, setUiState] = useState('loading'); // loading, ready, recording, processing
  const [autoListenEnabled, setAutoListenEnabled] = useState(true);

  // 사진 관련 상태
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  const [difficulty, setDifficulty] = useState('중'); // '상' | '중' | '하'

  const chatHistoryRef = useRef([]);
  const recognitionRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentPhotoIdRef = useRef(null);
  const currentPhotoDataRef = useRef(null); // { name, type, url }
  const callStartTimeRef = useRef(null);
  const difficultyRef = useRef('중');
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

  const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || '';

  useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    autoListenEnabledRef.current = autoListenEnabled;
  }, [autoListenEnabled]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearAutoListenTimer = () => {
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
  };

  const clearIntroTimer = () => {
    if (introTimerRef.current) {
      clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  };

  const scheduleAutoListen = (delay = AUTO_LISTEN_DELAY_MS) => {
    if (!autoListenEnabledRef.current || isEndingCallRef.current) return;
    clearAutoListenTimer();
    autoListenTimerRef.current = setTimeout(() => {
      if (
        autoListenEnabledRef.current &&
        !isEndingCallRef.current &&
        !isRecordingRef.current &&
        !processingRef.current &&
        !isSpeakingRef.current &&
        uiStateRef.current === 'ready'
      ) {
        startRecording();
      }
    }, delay);
  };

  const cleanStageDirections = (text) => {
    return text
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, (match) => (match === '[통화끝]' ? match : ''))
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const containsEndIntent = (text) => /그만|종료|끊|끝낼|끝내|쉬자|피곤|힘들/.test(text || '');

  const isLikelyIncompleteUtterance = (text) => {
    const normalized = (text || '').trim();
    if (!normalized) return true;
    if (normalized.length < 3) return true;
    if (/^(어+|음+|아+|그+|저+|에+)[.!?\s]*$/i.test(normalized)) return true;
    return false;
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    isSpeakingRef.current = false;
  };

  const fallbackSpeak = (text) => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  const playHighQualityTTS = async (text) => {
    if (!GOOGLE_TTS_API_KEY || GOOGLE_TTS_API_KEY.includes('입력')) {
      return fallbackSpeak(text);
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`;
    const requestBody = {
      input: { text },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0.0 }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (data.error) return fallbackSpeak(text);

      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      return new Promise((resolve) => {
        audio.onended = () => resolve();
        audio.play();
      });
    } catch {
      return fallbackSpeak(text);
    }
  };

  const processTTSQueue = async () => {
    if (ttsQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      if (!isEndingCallRef.current && uiStateRef.current === 'ready') {
        scheduleAutoListen();
      }
      return;
    }

    isSpeakingRef.current = true;
    const text = ttsQueueRef.current.shift();
    await playHighQualityTTS(text);
    processTTSQueue();
  };

  const addToTTSQueue = (text) => {
    ttsQueueRef.current.push(text);
    if (!isSpeakingRef.current) processTTSQueue();
  };


  const saveCallLog = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const callDuration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      if (chatHistoryRef.current.length === 0) return;

      const analysis = analyzeConversation(chatHistoryRef.current, callDuration);

      const conversationText = chatHistoryRef.current
        .map((msg) => {
          const role = msg.role === 'user' ? '환자' : 'AI';
          return `${role}: ${msg.parts[0]?.text || ''}`;
        })
        .join('\n');

      const callLogData = {
        userId: user.uid,
        callDate: serverTimestamp(),
        callDuration,
        photoId: currentPhotoIdRef.current || null,
        hasPhoto,
        conversation: conversationText,
        totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        analysis: {
          metrics: analysis.metrics,
          scores: analysis.scores,
          status: analysis.status,
          insights: analysis.insights
        },
        status: analysis.status.label,
        cognitiveScore: analysis.scores.cognitive,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'call_logs'), callLogData);
    } catch (error) {
      console.error('❌ 통화 기록 저장 오류:', error);
    }
  };

  const finalizeRecognizedSpeech = async () => {
    clearSilenceTimer();

    const text = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim();
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

  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('이 브라우저는 음성인식을 지원하지 않습니다.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'ko-KR';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
        } else {
          interim += transcript;
        }
      }

      interimTranscriptRef.current = interim.trim();
      const preview = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim();
      if (preview) setCaption(`당신: ${preview}`);

      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current && !processingRef.current) {
          stopRecording();
          finalizeRecognizedSpeech();
        }
      }, SILENCE_TIMEOUT_MS);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('❌ 음성인식 오류:', event.error);
      setIsRecording(false);
      isRecordingRef.current = false;

      if (event.error !== 'aborted') {
        setUiState('ready');
        setStatus('잘 못 들었어요. 다시 말씀해 주세요.');
        scheduleAutoListen(500);
      }
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
      isRecordingRef.current = false;
      if (uiStateRef.current === 'recording' && !processingRef.current) {
        finalizeRecognizedSpeech();
      }
    };
  };

  const startRecording = () => {
    if (!recognitionRef.current) return;
    if (isSpeakingRef.current || processingRef.current || isEndingCallRef.current || isRecordingRef.current) return;

    try {
      clearSilenceTimer();
      stopSpeaking();
      recognitionRef.current.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setUiState('recording');
      setStatus('듣고 있어요...');
    } catch (err) {
      console.error('❌ 음성인식 시작 오류:', err);
    }
  };

  const stopRecording = () => {
    clearSilenceTimer();
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  const startPhotoConversation = async () => {
    if (firstQuestionAskedRef.current) return;
    firstQuestionAskedRef.current = true;

    const photoData = currentPhotoDataRef.current;
    if (!photoData) return;

    try {
      const introResponse = await chatWithPhoto(
        '안녕하세요',
        [],
        photoData.name,
        photoData.type,
        difficultyRef.current
      );

      const hasEndTag = introResponse.includes('[통화끝]');
      const displayText = cleanStageDirections(introResponse.replace('[통화끝]', '')).trim();

      chatHistoryRef.current.push({ role: 'user', parts: [{ text: '안녕하세요' }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: introResponse }] });

      if (displayText) {
        setCaption(`AI: ${displayText}`);
        addToTTSQueue(displayText);
      }

      if (hasEndTag) {
        isEndingCallRef.current = true;
        setAutoListenEnabled(false);
      } else {
        setUiState('ready');
        setStatus('천천히 말씀해 주세요.');
      }
    } catch (error) {
      console.error('❌ 인트로 오류:', error);
      const fallback = '안녕하세요. 사진 보면서 이야기 나눠봐요.';
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fallback }] });
      setCaption(`AI: ${fallback}`);
      addToTTSQueue(fallback);
      setUiState('ready');
      setStatus('천천히 말씀해 주세요.');
    }
  };

  const loadPhotoAndStart = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'orientation_images'));
      if (snapshot.empty) {
        throw new Error('orientation_images 비어있음');
      }

      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const picked = docs[Math.floor(Math.random() * docs.length)];
      const photoUrl = picked.imageUrl || picked.photoURL || picked.url || '';

      currentPhotoDataRef.current = {
        name: picked.name || '',
        type: picked.type || '',
        url: photoUrl,
      };
      currentPhotoIdRef.current = picked.id;

      const validPhoto = Boolean(photoUrl);
      setCurrentPhoto(validPhoto ? { url: photoUrl } : null);
      setHasPhoto(validPhoto);
      setShowPhoto(validPhoto);
      setUiState('ready');
      setStatus('사진을 불러왔어요. 대화를 시작할게요.');

      clearIntroTimer();
      introTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        startPhotoConversation();
      }, 800);
    } catch (error) {
      console.error('❌ 사진 로드 오류:', error);
      currentPhotoDataRef.current = { name: '', type: '', url: '' };
      setHasPhoto(false);
      setShowPhoto(false);
      setUiState('ready');
      setStatus('대화를 시작할게요. 천천히 말씀해 주세요.');
      clearIntroTimer();
      introTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        startPhotoConversation();
      }, 800);
    }
  };

  const sendTextToGemini = async (text) => {
    processingRef.current = true;
    try {
      const photoData = currentPhotoDataRef.current || {};
      const fullText = await chatWithPhoto(
        text,
        chatHistoryRef.current,
        photoData.name || '',
        photoData.type || '',
        difficultyRef.current
      );

      chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullText }] });

      const hasEndTag = fullText.includes('[통화끝]');
      const displayText = cleanStageDirections(fullText.replace('[통화끝]', '')).trim();
      if (displayText) {
        setCaption(`AI: ${displayText}`);
        addToTTSQueue(displayText);
      }

      if (hasEndTag) {
        if (containsEndIntent(text) || endSignalCountRef.current >= 1) {
          isEndingCallRef.current = true;
          setAutoListenEnabled(false);
          setStatus('대화를 마무리할게요.');
          await saveCallLog();
          setTimeout(() => {
            alert('대화를 종료합니다. 건강하세요!');
            onBack();
          }, 2500);
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

  // 환자 난이도 로드
  useEffect(() => {
    const loadDifficulty = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'patients', user.uid));
        if (snap.exists()) {
          const d = snap.data().difficulty || '중';
          setDifficulty(d);
          difficultyRef.current = d;
        }
      } catch (e) {
        console.warn('난이도 로드 실패, 기본값(중) 사용:', e);
      }
    };
    loadDifficulty();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    callStartTimeRef.current = Date.now();
    loadPhotoAndStart();
    initSpeechRecognition();

    return () => {
      isMountedRef.current = false;
      clearSilenceTimer();
      clearAutoListenTimer();
      clearIntroTimer();
      stopSpeaking();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const handleBack = async () => {
    isEndingCallRef.current = true;
    setAutoListenEnabled(false);
    stopRecording();
    await saveCallLog();
    onBack();
  };

  const handleMicClick = () => {
    if (isRecording) {
      setAutoListenEnabled(false);
      stopRecording();
      setUiState('ready');
      setStatus('자동 듣기를 멈췄어요. 다시 누르면 재개합니다.');
      return;
    }

    setAutoListenEnabled(true);
    startRecording();
  };

  return (
    <div className="voice-chat-screen">
      <div className="chat-header">
        <button className="back-btn" onClick={handleBack}>〈 종료</button>
        <h2>통화</h2>
      </div>

      <div className="call-interface">
        {showPhoto && hasPhoto && currentPhoto ? (
          <div className="photo-display visible">
            <img src={currentPhoto.url} alt="추억 사진" />
          </div>
        ) : (
          <div className="ai-avatar">
            <div className="avatar-placeholder">🤗</div>
          </div>
        )}

        <div className={`status-message ${uiState}`}>{status}</div>
        <div className="caption-area">{caption}</div>

        <div className="control-area">
          <button
            className={`mic-btn ${uiState}`}
            onClick={handleMicClick}
            disabled={uiState === 'loading' || uiState === 'processing'}
          >
            <span className="icon">
              {uiState === 'loading' && '⏳'}
              {uiState === 'ready' && '🎙️'}
              {uiState === 'recording' && '⏹️'}
              {uiState === 'processing' && '💬'}
            </span>
            <span className="label">
              {uiState === 'loading' && '준비 중'}
              {uiState === 'ready' && (autoListenEnabled ? '자동 듣기' : '듣기 시작')}
              {uiState === 'recording' && '잠시 멈춤'}
              {uiState === 'processing' && '생각 중'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChatScreen;

