import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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
  
  const chatHistoryRef = useRef([]); // 대화 히스토리
  const recognitionRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const currentPhotoIdRef = useRef(null);

  const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || '';

  // 초기화
  useEffect(() => {
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
      const photosRef = collection(db, 'guardians', user.uid, 'photos');
      const snapshot = await getDocs(photosRef);
      
      // 클라이언트에서 통화전 상태 필터링 (callStatus 또는 tag 확인)
      const pendingPhotos = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.callStatus === '통화전' || 
               (data.tag === '통화 전' && !data.callStatus);
      });
      
      if (pendingPhotos.length > 0) {
        // 클라이언트에서 정렬 후 첫 번째 사진 선택
        const photos = pendingPhotos.map(doc => ({ id: doc.id, ...doc.data() }));
        photos.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.uploadDate?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.uploadDate?.toDate?.() || new Date(0);
          return dateA - dateB;
        });
        
        const photoData = photos[0];
        console.log('📸 선택된 사진:', photoData);
        
        setCurrentPhoto({
          id: photoData.id,
          url: photoData.photoURL || photoData.imageUrl,
          ...photoData
        });
        currentPhotoIdRef.current = photoData.id;
        
        // 키워드 정보 설정
        if (photoData.keywords) {
          setPhotoKeywords(photoData.keywords);
        }
        
        setHasPhoto(true);
        setStatus('사진에 대해 이야기해 볼까요?');
        setUiState('ready');
        
        // AI가 먼저 사진에 대해 질문하도록
        setTimeout(() => startPhotoConversation(photoData), 1000);
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

  // 사진 기반 대화 시작 - AI가 먼저 질문
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
    
    // 키워드가 있으면 키워드 기반 질문 직접 생성 (API 호출 없이)
    let firstQuestion = '';
    
    if (conversationStarters.length > 0) {
      // 추천 질문이 있으면 첫 번째 사용
      firstQuestion = conversationStarters[0];
    } else if (description) {
      // 설명이 있으면 그걸 기반으로
      firstQuestion = `이 사진을 보니까 ${description} 같네요. 이때 기억나세요?`;
    } else if (people.length > 0) {
      firstQuestion = `사진에 ${people.join(', ')}님이 보이네요. 이분들과 함께한 추억이 있으신가요?`;
    } else if (location) {
      firstQuestion = `이곳이 ${location}인 것 같아요. 이곳에 자주 가셨나요?`;
    } else if (emotion) {
      firstQuestion = `사진에서 ${emotion} 분위기가 느껴지네요. 어떤 날이었나요?`;
    } else if (photoData.description) {
      // 보호자가 입력한 설명 사용
      firstQuestion = `보호자분이 "${photoData.description}"라고 적어주셨네요. 이때 기억나시나요?`;
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
      const photoRef = doc(db, 'guardians', user.uid, 'photos', photoId);
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

  // Gemini에 텍스트 전송 (프록시 사용)
  const sendTextToGemini = async (text, retryCount = 0) => {
    try {
      console.log('📨 Gemini에 텍스트 전송:', text);
      
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text, 
          history: chatHistoryRef.current,
          photoContext: hasPhoto ? photoKeywords : null
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        // 429 에러면 잠시 후 재시도
        if (response.status === 502 && errText.includes('429') && retryCount < 2) {
          console.log('⏳ API 한도 초과, 10초 후 재시도...');
          setStatus('잠시 기다려 주세요...');
          await new Promise(r => setTimeout(r, 10000));
          return sendTextToGemini(text, retryCount + 1);
        }
        throw new Error(errText);
      }

      const data = await response.json();
      const fullText = data.text || '';
      console.log('📝 응답:', fullText);

      // 히스토리 업데이트
      chatHistoryRef.current.push({ role: 'user', parts: [{ text }] });
      chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullText }] });

      // 화면에 표시
      const displayText = fullText.replace('[END_CALL]', '').trim();
      setCaption('AI: ' + displayText);
      
      // TTS 재생
      if (displayText) addToTTSQueue(displayText);

      if (fullText.includes('[END_CALL]')) {
        console.log('🔚 종료 신호 감지');
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
        <h2>추억 파트너</h2>
      </div>

      <div className="call-interface">
        {/* 사진 표시 영역 */}
        {hasPhoto && currentPhoto ? (
          <div className="photo-display">
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
