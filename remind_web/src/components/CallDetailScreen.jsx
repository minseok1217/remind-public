import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './CallDetailScreen.css';
import backicon from '../assets/back_icon.png';
import charticon from '../assets/chart_icon_on.png';
import aiicon from '../assets/ai_icon.png';
import usericon from '../assets/user_icon.png';
import infoicon from '../assets/info_icon.png';
import { cancelTTS, webSpeak } from '../services/ttsService';

const normalizeInsights = (insights) => {
  if (Array.isArray(insights)) {
    return insights.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof insights === 'string') {
    return insights.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  if (insights && typeof insights === 'object') {
    return Object.values(insights).map((item) => String(item || '').trim()).filter(Boolean);
  }
  return [];
};

const normalizeBoolean = (value, fallback = null) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

function CallDetailScreen({ callLog, currentUser, onBack }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [currentAudioSrc, setCurrentAudioSrc] = useState('');
  const [currentAudioLabel, setCurrentAudioLabel] = useState('전체 대화 재생 위치를 선택해 주세요.');
  const [playbackState, setPlaybackState] = useState('idle');
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const messageRefs = useRef({});
  const audioRef = useRef(null);
  const playbackQueueRef = useRef([]);
  const playbackRunIdRef = useRef(0);
  const currentPlaybackMessageRef = useRef(null);

  const analysis = callLog?.analysis || {};
  const scores = analysis.scores || {};
  const metrics = analysis.metrics || {};
  const status = analysis.status || {};
  const insights = normalizeInsights(analysis.insights);
  const photoContext = callLog?.photoContext || {};
  const conversation = callLog?.conversation || '';
  const cognitiveScore = scores.cognitive || callLog?.cognitiveScore || 0;
  const statusLabel = status.label || callLog?.status || '분석 완료';
  const photoTags = [
    photoContext.emotion,
    photoContext.location,
    photoContext.situation,
    photoContext.year
  ].filter(Boolean);

  useEffect(() => {
    loadPhoto();
  }, [callLog]);

  useEffect(() => () => {
    cancelTTS();
    playbackQueueRef.current = [];
  }, []);

  const loadPhoto = async () => {
    try {
      let nextPhotoUrl = photoContext.url || photoContext.photoURL || photoContext.imageUrl || null;
      let nextPhotoDescription = photoContext.finalCaption || photoContext.description || photoContext.detailedDescription || "";

      if (callLog?.photoId && callLog?.userId) {
        const photoDocRef = doc(db, 'users', callLog.photoOwnerId || callLog.userId, 'photos', callLog.photoId);
        const photoSnap = await getDoc(photoDocRef);
        if (photoSnap.exists()) {
          const photoData = photoSnap.data();
          nextPhotoUrl = photoData.photoURL || photoData.imageUrl || photoData.url || nextPhotoUrl;
          nextPhotoDescription =
            photoData.finalCaption ||
            photoData.description ||
            photoData.detailedDescription ||
            nextPhotoDescription;
        }
      }

      setPhotoUrl(nextPhotoUrl);
      setPhotoDescription(nextPhotoDescription);
    } catch (error) {
      console.error('[CallDetailScreen] 사진 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCallDateString = () => {
    const d = callLog?.callDate?.toDate?.() || new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const parseConversation = () => {
    if (Array.isArray(callLog?.messages) && callLog.messages.length > 0) {
      return callLog.messages
        .map((message, idx) => ({
          id: message.id || `msg_${idx}`,
          order: message.order ?? idx,
          role: message.role === 'ai' || message.role === 'model' ? 'ai' : 'patient',
          speaker: message.speaker || (message.role === 'ai' || message.role === 'model' ? 'AI' : 'OO?'),
          text: message.text || '',
          patientTurn: message.patientTurn || null,
          audio: message.audio || null,
        }))
        .filter((message) => message.text.trim())
        .sort((a, b) => a.order - b.order);
    }

    if (!conversation) return [];
    const parsed = [];
    const lines = conversation.split('\n').filter(line => line.trim());
    lines.forEach((line) => {
      const isAI = line.startsWith('AI:');
      const isPatient = line.startsWith('OO') || line.startsWith('환자:') || line.startsWith('?섏옄:');
      const role = isAI ? 'ai' : (isPatient ? 'patient' : null);
      const text = line.replace(/^AI:\s*/, '').replace(/^OO님:\s*/, '').replace(/^환자:\s*/, '').replace(/^\?섏옄:\s*/, '');
      if (role) {
        parsed.push({
          id: `msg_${parsed.length}`,
          order: parsed.length,
          role,
          speaker: role === 'ai' ? 'AI' : 'OO?',
          text
        });
        return;
      }

      const last = parsed[parsed.length - 1];
      if (last) last.text = `${last.text}\n${line.trim()}`;
    });
    return parsed;
  };

  const messages = parseConversation();
  const resolveEvidenceMessageIds = (messageIds = []) => {
    const ids = Array.isArray(messageIds) ? messageIds.filter(Boolean) : [];
    const existingIds = new Set(messages.map((message) => message.id));
    const directMatches = ids.filter((id) => existingIds.has(id));
    if (directMatches.length > 0) return directMatches;

    return ids
      .map((id) => {
        const match = String(id).match(/^msg_(\d+)$/);
        if (!match) return null;
        const order = Number(match[1]);
        return messages.find((message) => message.order === order)?.id || null;
      })
      .filter(Boolean);
  };
  const getPlayableText = (message) => message?.audio?.ttsText || message?.text || '';
  const getAudioSource = (message) => message?.audio?.downloadURL || message?.audio?.dataUrl || '';
  const hasPlayableAudio = (message) => Boolean(getAudioSource(message) || getPlayableText(message));
  const audioMessages = messages.filter(hasPlayableAudio);

  const clampScore = (value) => Math.max(0, Math.min(Number(value) || 0, 100));

  const buildFallbackReportItem = ({ id, label, score, passed, detail, categories = null, evidenceMessageIds = [] }) => ({
    id,
    label,
    score: score === null || score === undefined ? null : Math.round(clampScore(score)),
    passed,
    detail,
    categories,
    evidenceMessageIds,
  });

  const getRawReportItem = (id) => {
    const report = analysis.report || {};
    if (Array.isArray(report.items)) {
      return report.items.find((item) => item?.id === id) || null;
    }
    return report[id] || null;
  };

  const normalizeReportItem = ({ id, label, fallbackScore, fallbackPassed, fallbackDetail, categories = null }) => {
    const raw = getRawReportItem(id);
    if (!raw) {
      return buildFallbackReportItem({
        id,
        label,
        score: fallbackScore,
        passed: fallbackPassed,
        detail: fallbackDetail,
        categories,
      });
    }

    return buildFallbackReportItem({
      id,
      label: raw.label || label,
      score: raw.score ?? fallbackScore,
      passed: normalizeBoolean(raw.passed, fallbackPassed),
      detail: raw.detail || fallbackDetail,
      categories: raw.categories || categories,
      evidenceMessageIds: raw.evidenceMessageIds || [],
    });
  };

  const getEvaluationItems = () => {
    const captionCategories = analysis.report?.captionMatches || [];
    const shouldShowGuardianCaption = !(
      photoContext.source === 'orientation_images' ||
      photoContext.ownerId === 'orientation_images' ||
      String(photoContext.id || '').startsWith('orientation_')
    );
    const hasPhotoEvaluationContext = Boolean(photoUrl || photoContext.description || photoContext.detailedDescription || photoContext.finalCaption);
    const patientMessageIds = messages.filter((message) => message.role === 'patient').map((message) => message.id);
    const withEvidenceFallback = (item) => {
      const resolvedEvidenceIds = resolveEvidenceMessageIds(item.evidenceMessageIds);
      return {
        ...item,
        evidenceMessageIds: resolvedEvidenceIds.length ? resolvedEvidenceIds : patientMessageIds,
      };
    };

    return [
      normalizeReportItem({
        id: 'vocabularyDiversity',
        label: '어휘의 다양성',
        fallbackScore: metrics.vocabularyDiversityScore ?? scores.language ?? 0,
        fallbackPassed: (metrics.vocabularyDiversityScore ?? scores.language ?? 0) >= 60,
        fallbackDetail: '대화에서 서로 다른 표현을 얼마나 다양하게 사용했는지 평가했습니다.'
      }),
      normalizeReportItem({
        id: 'sentenceCompleteness',
        label: '문장의 완성도',
        fallbackScore: metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0,
        fallbackPassed: (metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0) >= 60,
        fallbackDetail: '답변이 끝맺음 있는 문장으로 자연스럽게 완성되었는지 평가했습니다.'
      }),
      normalizeReportItem({
        id: 'emotionalState',
        label: '정서 상태',
        fallbackScore: scores.emotion ?? metrics.emotionPositiveRatio ?? 0,
        fallbackPassed: (scores.emotion ?? metrics.emotionPositiveRatio ?? 0) >= 50,
        fallbackDetail: '긍정/부정 정서 표현의 비율을 바탕으로 정서 흐름을 평가했습니다.'
      }),
      normalizeReportItem({
        id: 'topicDeviation',
        label: '주제 이탈률',
        fallbackScore: 100 - (metrics.topicDeviationRate || 0),
        fallbackPassed: (metrics.topicDeviationRate || 0) <= 40,
        fallbackDetail: `대화 주제에서 벗어난 비율은 ${Math.round(metrics.topicDeviationRate || 0)}%입니다.`
      }),
      normalizeReportItem({
        id: 'guardianCaption',
        label: '보호자 입력 캡션',
        fallbackScore: analysis.report?.captionMatchRate ?? null,
        fallbackPassed: null,
        fallbackDetail: hasPhotoEvaluationContext
          ? '저장된 보호자 입력 캡션 평가 결과가 없어 평가 제외로 표시합니다.'
          : '사진 또는 보호자 입력 캡션 없이 진행된 통화입니다.',
        categories: captionCategories
      })
    ]
      .filter((item) => shouldShowGuardianCaption || item.id !== 'guardianCaption')
      .map(withEvidenceFallback);
  };

  const evaluationItems = getEvaluationItems();

  const scrollToEvidence = (messageIds = []) => {
    const resolvedIds = resolveEvidenceMessageIds(messageIds);
    const targetId = resolvedIds.find((id) => messageRefs.current[id]);
    if (!targetId) return;
    setSelectedMessageId(targetId);
    messageRefs.current[targetId].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const playAudioMessage = async (message, queue = []) => {
    if (!hasPlayableAudio(message)) return;
    const runId = playbackRunIdRef.current + 1;
    playbackRunIdRef.current = runId;
    currentPlaybackMessageRef.current = message;
    const currentIndex = audioMessages.findIndex((item) => item.id === message.id);
    setPlaybackIndex(currentIndex);
    setSelectedMessageId(message.id);
    setCurrentAudioLabel(`${message.speaker || (message.role === 'ai' ? 'AI' : 'OO님')} 대화부터 재생 중`);
    playbackQueueRef.current = queue;
    setPlaybackState('playing');

    const audioSource = getAudioSource(message);
    if (audioSource) {
      cancelTTS();
      setCurrentAudioSrc(audioSource);
      setTimeout(() => audioRef.current?.play?.().catch(() => {}), 0);
      return;
    }

    setCurrentAudioSrc('');
    cancelTTS();
    await webSpeak(getPlayableText(message));
    if (playbackRunIdRef.current !== runId) return;
    const [next, ...rest] = playbackQueueRef.current;
    if (next) {
      playAudioMessage(next, rest);
      return;
    }
    playbackQueueRef.current = [];
    setCurrentAudioLabel('재생이 끝났습니다.');
    setPlaybackState('idle');
    setPlaybackIndex(-1);
  };

  const playAllAudio = () => {
    if (audioMessages.length === 0) return;
    const [first, ...rest] = audioMessages;
    playAudioMessage(first, rest);
  };

  const playFromMessage = (message) => {
    const startIndex = audioMessages.findIndex((item) => item.id === message.id);
    if (startIndex < 0) return;
    const [first, ...rest] = audioMessages.slice(startIndex);
    playAudioMessage(first, rest);
  };

  const handleAudioEnded = () => {
    const [next, ...rest] = playbackQueueRef.current;
    if (next) {
      playAudioMessage(next, rest);
      return;
    }
    playbackQueueRef.current = [];
    setCurrentAudioLabel('재생이 끝났습니다.');
    setPlaybackState('idle');
    setPlaybackIndex(-1);
  };

  const pausePlayback = () => {
    if (currentAudioSrc && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setPlaybackState('paused');
      setCurrentAudioLabel('일시정지됨');
      return;
    }

    if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setPlaybackState('paused');
      setCurrentAudioLabel('일시정지됨');
    }
  };

  const resumePlayback = () => {
    if (currentAudioSrc && audioRef.current?.paused) {
      audioRef.current.play().catch(() => {});
      setPlaybackState('playing');
      setCurrentAudioLabel('재생 중');
      return;
    }

    if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
      setPlaybackState('playing');
      setCurrentAudioLabel('재생 중');
    }
  };

  const stopPlayback = () => {
    playbackRunIdRef.current += 1;
    playbackQueueRef.current = [];
    currentPlaybackMessageRef.current = null;
    cancelTTS();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaybackState('idle');
    setPlaybackIndex(-1);
    setCurrentAudioLabel('재생을 멈췄습니다.');
  };

  const togglePlayback = () => {
    if (playbackState === 'playing') {
      pausePlayback();
      return;
    }
    if (playbackState === 'paused') {
      resumePlayback();
      return;
    }
    playAllAudio();
  };

  const getReportScoreBadgeClass = (item) => {
    if (item.score === null || item.score === undefined) return 'neutral';
    return Number(item.score) >= 60 ? 'good' : 'bad';
  };

  const getReportScoreLabel = (item) => {
    if (item.score === null || item.score === undefined) return '점수 없음';
    return `${Math.round(clampScore(item.score))}점`;
  };

  const ReportItem = ({ item }) => (
    <div
      className={`cd-report-item ${item.evidenceMessageIds?.length ? 'clickable' : ''}`}
      onClick={() => scrollToEvidence(item.evidenceMessageIds)}
      role={item.evidenceMessageIds?.length ? 'button' : undefined}
      tabIndex={item.evidenceMessageIds?.length ? 0 : undefined}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && item.evidenceMessageIds?.length) {
          event.preventDefault();
          scrollToEvidence(item.evidenceMessageIds);
        }
      }}
    >
      <div className="cd-report-head">
        <span className="cd-report-label">{item.label}</span>
        <span className={`cd-report-badge ${getReportScoreBadgeClass(item)}`}>
          {getReportScoreLabel(item)}
        </span>
      </div>
      {item.score !== null && item.score !== undefined && (
        <div className="cd-score-bar-bg">
          <div className="cd-score-bar-fill" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: '#00C16E' }} />
        </div>
      )}
      <p className="cd-report-detail">{item.detail}</p>
      {item.evidenceMessageIds?.length > 0 && (
        <button
          type="button"
          className="cd-evidence-btn"
          onClick={(event) => {
            event.stopPropagation();
            scrollToEvidence(item.evidenceMessageIds);
          }}
        >
          관련 대화 보기
        </button>
      )}
      {item.categories?.length > 0 && (
        <div className="cd-caption-checks">
          {item.categories.map((category) => (
            <div key={category.category} className="cd-caption-check">
              <span>{category.category}</span>
              <strong>{category.matched === null ? '-' : category.matched ? '일치' : '미일치'}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="call-detail-screen">
        <div className="cd-header">
          <button className="cd-back-btn" onClick={onBack}>←</button>
          <h1>통화 분석</h1>
        </div>
        <div className="cd-loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="call-detail-screen">
      <div className="header-content">
        <button className="back-ic-button" onClick={onBack}>
          <img className="icon" src={backicon} alt="뒤로가기 아이콘" />
        </button>
        <h1 className="header-title">{getCallDateString()}</h1>
      </div>
      <div className="header-diver"></div>
      
      {/* Score Circle & Status */}
      <div className="cd-score-section">
        <div className="cd-status-card">
          <p className="cd-score-title">인지 상태 점수</p>
          <div className="cd-score-circle" style={{ borderColor: status.color || '#00C16E' }}>
            <span className="cd-score-num" style={{ color: status.color || '#00C16E' }}>{cognitiveScore}점</span>
          </div>
          <strong className="cd-score-status" style={{ color: status.color || '#00C16E' }}>{statusLabel}</strong>
        </div>
        <div className="cd-status-card cd-photo-summary-card">
          <p className="cd-score-title">통화 사진</p>
          {photoUrl ? (
            <div className="cd-photo-wrapper">
              <img src={photoUrl} alt="통화에 사용된 사진" className="cd-photo" />
              {(photoDescription || photoTags.length > 0) && (
                <div className="cd-photo-meta">
                  {photoDescription && <h2 className="cd-photo-label">{photoDescription}</h2>}
                  {photoTags.length > 0 && (
                    <div className="cd-photo-tags">
                      {photoTags.map((tag) => (
                        <span key={tag} className="cd-photo-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="cd-photo-empty">사진 없이 진행된 통화입니다.</p>
          )}
        </div>
      </div>

      <div className="cd-analysis-card cd-report-card">
        <div className="analysis-label">
          <img src={charticon} className='icon-small' />
          <div className="cd-analysis-title">평가 리포트</div>
        </div>
        <div className="cd-report-list">
          {evaluationItems.map((item) => (
            <ReportItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Conversation Section */}
      {messages.length > 0 && (
        <div className="cd-conversation-section">
          <div className="cd-conversation-title">대화 내용</div>
          <div className="cd-conversation-card">
            <div className="cd-messages">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  ref={(el) => {
                    if (el) messageRefs.current[msg.id] = el;
                  }}
                  className={`cd-message ${msg.role} ${selectedMessageId === msg.id ? 'selected' : ''} ${hasPlayableAudio(msg) ? 'has-audio' : ''}`}
                  onClick={() => {
                    if (hasPlayableAudio(msg)) playFromMessage(msg);
                  }}
                >
                  <div className="cd-message-role">
                    {msg.role === 'ai' ? 
                      <div className='chat-ai-label'>
                        <div className="chat-icon-circle">
                          <img src={aiicon} className='chat-icon' />
                        </div>
                        <span>AI 케어</span>
                      </div>
                      :
                      <div className='chat-user-label'>
                        <span>OO님</span>
                        <div className="chat-icon-circle">
                          <img src={usericon} className='chat-icon' />
                        </div>
                      </div>
                    }
                  </div>
                  <div className={`cd-message-text ${msg.role === 'ai' ? 'ai-message' : 'user-message'}`}>{msg.text}</div>
                </div>
              ))}
            </div>
            <div className="cd-audio-player">
              <div className="cd-player-bar">
                <div className="cd-player-controls">
                  <button
                    type="button"
                    className="cd-player-icon-btn"
                    onClick={togglePlayback}
                    disabled={audioMessages.length === 0}
                    aria-label={playbackState === 'playing' ? '일시정지' : '재생'}
                    title={playbackState === 'playing' ? '일시정지' : '재생'}
                  >
                    {playbackState === 'playing' ? 'II' : '▶'}
                  </button>
                  <button
                    type="button"
                    className="cd-player-icon-btn stop"
                    onClick={stopPlayback}
                    disabled={playbackState === 'idle'}
                    aria-label="정지"
                    title="정지"
                  >
                    ■
                  </button>
                </div>
                <div className="cd-player-main">
                  <div className="cd-player-meta">
                    <span>{currentAudioLabel}</span>
                    <span>
                      {playbackIndex >= 0 ? `${playbackIndex + 1}/${audioMessages.length}` : `0/${audioMessages.length}`}
                    </span>
                  </div>
                  <div className="cd-player-track">
                    <div
                      className="cd-player-fill"
                      style={{
                        width: audioMessages.length > 0 && playbackIndex >= 0
                          ? `${((playbackIndex + 1) / audioMessages.length) * 100}%`
                          : '0%',
                      }}
                    />
                    {audioMessages.map((message, index) => (
                      <button
                        key={message.id}
                        type="button"
                        className={`cd-player-marker ${index === playbackIndex ? 'active' : ''}`}
                        style={{ left: audioMessages.length <= 1 ? '0%' : `${(index / (audioMessages.length - 1)) * 100}%` }}
                        title={`${index + 1}번째 대화로 이동`}
                        onClick={() => playFromMessage(message)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={currentAudioSrc}
                onEnded={handleAudioEnded}
                onPlay={() => setPlaybackState('playing')}
                onPause={() => {
                  if (currentAudioSrc && audioRef.current?.currentTime > 0 && !audioRef.current?.ended) {
                    setPlaybackState('paused');
                  }
                }}
              />
              {audioMessages.length === 0 && (
                <p className="cd-audio-empty">재생할 대화 내용이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Alert */}
      {insights.length > 0 && (
        <div className="info-contain-box">
          <div className="info-icon">
            <img className="icon-tiny" src={infoicon} alt="정보 아이콘" />
          </div>
          <div className="info-text">
            {insights.map((insight, i) => (
              <p key={i}>{insight}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CallDetailScreen;
