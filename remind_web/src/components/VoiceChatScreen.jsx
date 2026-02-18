import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { chatWithGemini } from '../services/geminiService';
import { analyzeConversation } from '../services/conversationAnalysisService';
import './VoiceChatScreen.css';

function VoiceChatScreen({ onBack }) {
  const [status, setStatus] = useState('사진을 불러오는 중...');
  const [caption, setCaption] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uiState, setUiState] = useState('loading'); // loading, ready, recording, processing
  
  // 사진 관련 상태
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [photoKeywords, setPhotoKeywords] = useState(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false); // 사진 보여주기 상태 (자연스러운 전환용)
  
  const chatHistoryRef = useRef([]); // 대화 히스토리
  const recognitionRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentPhotoIdRef = useRef(null);
  const callStartTimeRef = useRef(null); // 통화 시작 시간

  const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || '';

  // 괄호 지문 제거 (예: "(살짝 놀라며)", "(웃으며)" 등)
  const cleanStageDirections = (text) => {
    return text
      .replace(/\([^)]*\)/g, '')  // (xxx) 제거
      .replace(/\[[^\]]*\]/g, (match) => match === '[END_CALL]' ? match : '')  // [END_CALL] 외 [] 제거
      .replace(/\s{2,}/g, ' ')    // 연속 공백 정리
      .trim();
  };

  // 초기화
  useEffect(() => {
    callStartTimeRef.current = Date.now(); // 통화 시작 시간 기록
    loadPhotoAndStart();
    initSpeechRecognition();
    return () => {
      stopSpeaking();
    };
  }, []);

  // Firestore에서 "통화전" 상태인 사진 가져오기
  const loadPhotoAndStart = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setStatus('로그인이 필요합니다.');
        return;
      }

      // 사진 가져오기 (callStatus 또는 tag로 필터링)
      const photosRef = collection(db, 'users', user.uid, 'photos');
      const snapshot = await getDocs(photosRef);
      
      console.log('📸 전체 사진 수:', snapshot.docs.length);
      snapshot.docs.forEach(doc => {
        const d = doc.data();
        console.log('📸 사진:', doc.id, '| callStatus:', d.callStatus, '| tag:', d.tag, '| url:', d.photoURL || d.imageUrl || d.url || '없음');
      });
      
      // 클라이언트에서 통화전 상태 필터링 (callStatus 또는 tag 확인)
      let pendingPhotos = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.callStatus === '통화전' || 
               data.tag === '통화 전' ||
               data.tag === '통화전' ||
               (!data.callStatus && !data.tag); // 상태 미지정 사진도 포함
      });
      
      console.log('📸 통화전 사진 수:', pendingPhotos.length);
      
      // 통화전 사진이 없으면 통화후 사진이라도 사용 (가장 최근 것)
      if (pendingPhotos.length === 0 && snapshot.docs.length > 0) {
        console.log('📸 통화전 사진 없음 → 전체 사진 중 최근 것 사용');
        pendingPhotos = snapshot.docs; // 모든 사진 대상
      }
      
      if (pendingPhotos.length > 0) {
        // 클라이언트에서 정렬 후 사진 선택
        const photos = pendingPhotos.map(doc => ({ id: doc.id, ...doc.data() }));
        photos.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.uploadDate?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.uploadDate?.toDate?.() || new Date(0);
          return dateB - dateA; // 최신 사진 우선
        });
        
        const photoData = photos[0];
        console.log('📸 선택된 사진:', photoData);
        
        const photoUrl = photoData.photoURL || photoData.imageUrl || photoData.url || '';
        console.log('📸 사진 URL:', photoUrl);
        
        if (!photoUrl) {
          console.warn('⚠️ 사진 URL이 없습니다!');
        }
        
        setCurrentPhoto({
          id: photoData.id,
          url: photoUrl,
          ...photoData
        });
        currentPhotoIdRef.current = photoData.id;
        
        // 키워드 정보 설정 (빈 배열이면 description으로 대체)
        if (photoData.keywords && typeof photoData.keywords === 'object' && !Array.isArray(photoData.keywords) && Object.keys(photoData.keywords).length > 0) {
          setPhotoKeywords(photoData.keywords);
        } else if (Array.isArray(photoData.keywords) && photoData.keywords.length > 0) {
          setPhotoKeywords({ keywords: photoData.keywords });
        } else {
          // keywords가 없으면 description 등으로 기본 컨텍스트 생성
          setPhotoKeywords({
            description: photoData.description || '사진',
            detailedDescription: photoData.description || '',
          });
        }
        console.log('📸 사진 키워드 설정:', photoData.keywords, '| description:', photoData.description);
        
        setHasPhoto(true);
        setShowPhoto(true); // 사진 즉시 표시
        setStatus('사진에 대해 이야기해 볼까요?');
        setUiState('ready');
        
        // AI가 먼저 사진에 대해 질문하도록
        setTimeout(() => startPhotoConversation(photoData), 1500);
      } else {
        // 사진이 없으면 일반 대화
        setHasPhoto(false);
        setStatus('마이크를 누르고 말씀해 주세요.');
        setUiState('ready');
      }
    } catch (error) {
      console.error('❌ 사진 로드 오류:', error);
      setHasPhoto(false);
      setStatus('마이크를 누르고 말씀해 주세요.');
      setUiState('ready');
    }
  };

  // 사진 기반 대화 시작 - AI가 사진에 대해 질문
  const startPhotoConversation = async (photoData) => {
    const keywords = photoData.keywords || {};
    const description = keywords.detailedDescription || keywords.description || photoData.description || '';
    const people = keywords.people || [];
    const location = keywords.location || '';
    const emotion = keywords.emotion || '';
    const situation = keywords.situation || '';
    const conversationStarters = keywords.conversationStarters || [];
    
    console.log('📝 사진 키워드:', keywords);
    console.log('📝 보호자 설명:', photoData.description);
    
    // 사진에 대해 바로 질문
    let firstQuestion = '';
    
    if (conversationStarters && conversationStarters.length > 0) {
      firstQuestion = conversationStarters[0];
    } else if (description) {
      firstQuestion = `이 사진 보니까 ${description} 같네요. 이때 기억나세요?`;
    } else if (people.length > 0) {
      firstQuestion = `사진에 ${people.join(', ')}님이 보이네요. 이분들과 함께한 추억 이야기해 주세요!`;
    } else if (location) {
      firstQuestion = `이곳이 ${location}인 것 같아요. 여기 언제 가셨어요?`;
    } else if (emotion) {
      firstQuestion = `사진에서 ${emotion} 분위기가 느껴지네요. 어떤 날이었나요?`;
    } else if (photoData.description) {
      firstQuestion = `이 사진은 "${photoData.description}"라고 하네요. 이때 기억나시나요?`;
    } else {
      firstQuestion = '이 사진 참 좋네요. 어떤 추억이 담겨 있나요?';
    }

    console.log('🎤 첫 질문:', firstQuestion);
    
    // 히스토리에 추가
    chatHistoryRef.current.push({ role: 'model', parts: [{ text: firstQuestion }] });
    
    setCaption('AI: ' + firstQuestion);
    addToTTSQueue(firstQuestion);
    
    setUiState('ready');
    setStatus('마이크를 누르고 대답해 주세요.');
  };

  // 통화 완료 시 상태 업데이트
  const markPhotoAsCompleted = async () => {
    const photoId = currentPhotoIdRef.current;
    if (!photoId) {
      console.log('⚠️ 사진 ID 없음, 업데이트 스킵');
      return;
    }
    
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('⚠️ 사용자 없음, 업데이트 스킵');
        return;
      }
      
      console.log('📝 사진 상태 업데이트 시도:', photoId);
      const photoRef = doc(db, 'users', user.uid, 'photos', photoId);
      await updateDoc(photoRef, {
        callStatus: '통화후',
        tag: '통화 후',
        lastCallDate: new Date().toISOString()
      });
      console.log('✅ 사진 상태 업데이트 완료: 통화후');
      
      // 업데이트 후 ref 초기화 (중복 방지)
      currentPhotoIdRef.current = null;
    } catch (error) {
      console.error('❌ 상태 업데이트 오류:', error);
    }
  };

  // 통화 기록 저장 (대화 내용 + 분석 결과)
  const saveCallLog = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('⚠️ 사용자 없음, 저장 스킵');
        return;
      }

      // 통화 시간 계산
      const callDuration = Math.round((Date.now() - callStartTimeRef.current) / 1000);
      
      // 대화 내용이 있는 경우에만 저장
      if (chatHistoryRef.current.length === 0) {
        console.log('⚠️ 대화 내용 없음, 저장 스킵');
        return;
      }

      // 대화 분석
      const analysis = analyzeConversation(chatHistoryRef.current, callDuration);
      console.log('📊 대화 분석 결과:', analysis);

      // 대화 텍스트 추출
      const conversationText = chatHistoryRef.current.map(msg => {
        const role = msg.role === 'user' ? '환자' : 'AI';
        return `${role}: ${msg.parts[0]?.text || ''}`;
      }).join('\n');

      // call_logs 컨렉션에 저장
      const callLogData = {
        userId: user.uid,
        callDate: serverTimestamp(),
        callDuration: callDuration, // 초 단위
        photoId: currentPhotoIdRef.current || null,
        hasPhoto: hasPhoto,
        
        // 대화 내용
        conversation: conversationText,
        totalUtterances: analysis.totalUtterances,
        totalWords: analysis.totalWords,
        
        // 분석 지표
        analysis: {
          metrics: analysis.metrics,
          scores: analysis.scores,
          status: analysis.status,
          insights: analysis.insights
        },
        
        // 상태 표시용
        status: analysis.status.label,
        cognitiveScore: analysis.scores.cognitive,
        
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'call_logs'), callLogData);
      console.log('✅ 통화 기록 저장 완료:', docRef.id);
      
    } catch (error) {
      console.error('❌ 통화 기록 저장 오류:', error);
    }
  };

  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('이 브라우저는 음성인식을 지원하지 않습니다.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'ko-KR';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('🎤 인식된 텍스트:', transcript);
      setCaption('당신: ' + transcript);
      setUiState('processing');
      setStatus('대답하는 중...');
      await sendTextToGemini(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('❌ 음성인식 오류:', event.error);
      setStatus('잘 못 들었어요. 다시 말씀해 주세요.');
      setUiState('ready');
      setIsRecording(false);
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
      if (uiState === 'recording') {
        setUiState('ready');
        setStatus('마이크를 누르고 말씀해 주세요.');
      }
    };
  };

  // TTS
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

      const audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
      return new Promise((resolve) => {
        audio.onended = () => resolve();
        audio.play();
      });
    } catch (error) {
      return fallbackSpeak(text);
    }
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

  const addToTTSQueue = (text) => {
    ttsQueueRef.current.push(text);
    if (!isSpeakingRef.current) processTTSQueue();
  };

  const processTTSQueue = async () => {
    if (ttsQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      return;
    }
    isSpeakingRef.current = true;
    const text = ttsQueueRef.current.shift();
    await playHighQualityTTS(text);
    processTTSQueue();
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    isSpeakingRef.current = false;
  };

  // 음성인식 시작/정지
  const startRecording = () => {
    try {
      stopSpeaking();
      recognitionRef.current.start();
      setIsRecording(true);
      setUiState('recording');
      setStatus('듣고 있어요...');
      console.log('🎤 음성인식 시작');
    } catch (err) {
      console.error('❌ 음성인식 오류:', err);
      alert('음성인식을 시작할 수 없습니다.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // Gemini에 텍스트 전송 (프록시 또는 직접 호출)
  const sendTextToGemini = async (text, retryCount = 0) => {
    try {
      console.log('📨 Gemini에 텍스트 전송:', text);
      
      const fullText = await chatWithGemini(
        text, 
        chatHistoryRef.current,
        hasPhoto ? photoKeywords : null
      );
      console.log('📝 응답:', fullText);

      // 히스토리 업데이트
      chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullText }] });

      // 화면에 표시 (괄호 지문 제거)
      const displayText = cleanStageDirections(fullText.replace('[END_CALL]', '')).trim();
      setCaption('AI: ' + displayText);
      
      // TTS 재생 (괄호 지문 제거된 텍스트)
      if (displayText) addToTTSQueue(displayText);

      if (fullText.includes('[END_CALL]')) {
        console.log('🔚 종료 신호 감지');
        // 통화 기록 저장
        await saveCallLog();
        // 사진이 있었다면 통화후로 상태 변경
        if (hasPhoto) {
          await markPhotoAsCompleted();
        }
        setTimeout(() => {
          alert('대화를 종료합니다. 건강하세요!');
          onBack();
        }, 5000);
      } else {
        setUiState('ready');
        setStatus('마이크를 누르고 말씀해 주세요.');
      }
    } catch (error) {
      console.error('❌ Gemini 오류:', error);
      setStatus('잘 못 들었어요. 다시 말씀해 주세요.');
      setCaption('에러: ' + error.message);
      setUiState('ready');
    }
  };

  // 종료 버튼 클릭 시
  const handleBack = async () => {
    console.log('🔙 종료 버튼 클릭, hasPhoto:', hasPhoto, 'photoId:', currentPhotoIdRef.current);
    
    // 통화 기록 저장
    await saveCallLog();
    
    // 사진이 있으면 무조건 통화후로 변경 (대화 여부 상관없이)
    if (hasPhoto && currentPhotoIdRef.current) {
      await markPhotoAsCompleted();
    }
    onBack();
  };

  const handleMicClick = () => {
    if (!isRecording) startRecording();
    else stopRecording();
  };

  return (
    <div className="voice-chat-screen">
      <div className="chat-header">
        <button className="back-btn" onClick={handleBack}>〈 종료</button>
        <h2>통화</h2>
      </div>

      <div className="call-interface">
        {/* 사진 표시 영역 - 자연스럽게 페이드인 */}
        {showPhoto && hasPhoto && currentPhoto ? (
          <div className="photo-display visible">
            <img src={currentPhoto.url} alt="추억 사진" />
            {photoKeywords && (
              <div className="photo-keywords">
                {photoKeywords.emotion && <span className="keyword-tag">{photoKeywords.emotion}</span>}
                {photoKeywords.location && <span className="keyword-tag">📍 {photoKeywords.location}</span>}
              </div>
            )}
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
              {uiState === 'processing' && '🔊'}
            </span>
            <span className="label">
              {uiState === 'loading' && '준비 중'}
              {uiState === 'ready' && '말하기'}
              {uiState === 'recording' && '다 했어요'}
              {uiState === 'processing' && '듣는 중'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChatScreen;
