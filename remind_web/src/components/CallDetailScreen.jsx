import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './CallDetailScreen.css';
import backicon from '../assets/back_icon.png';
import charticon from '../assets/chart_icon_on.png';
import aiicon from '../assets/ai_icon.png';
import usericon from '../assets/user_icon.png';
import infoicon from '../assets/info_icon.png';

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

function CallDetailScreen({ callLog, currentUser, onBack }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [loading, setLoading] = useState(true);

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

  // Parse conversation into messages
  const parseConversation = () => {
    if (!conversation) return [];
    return conversation.split('\n').filter(line => line.trim()).map((line, idx) => {
      const isAI = line.startsWith('AI:');
      const isPatient = line.startsWith('환자:');
      const text = line.replace(/^(AI|환자):\s*/, '');
      return {
        id: idx,
        role: isAI ? 'ai' : (isPatient ? 'patient' : 'unknown'),
        text
      };
    });
  };

  const messages = parseConversation();

  const clampScore = (value) => Math.max(0, Math.min(Number(value) || 0, 100));

  const buildFallbackReportItem = ({ id, label, score, passed, detail, categories = null }) => ({
    id,
    label,
    score: score === null || score === undefined ? null : Math.round(clampScore(score)),
    passed,
    detail,
    categories
  });

  const getEvaluationItems = () => {
    const savedItems = analysis.report?.items || [];
    const savedById = savedItems.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
    const captionCategories = analysis.report?.captionMatches || [];
    const shouldShowGuardianCaption = !(
      photoContext.source === 'orientation_images' ||
      photoContext.ownerId === 'orientation_images' ||
      String(photoContext.id || '').startsWith('orientation_')
    );
    const hasPhotoEvaluationContext = Boolean(photoUrl || photoContext.description || photoContext.detailedDescription || photoContext.finalCaption);

    return [
      savedById.vocabularyDiversity || buildFallbackReportItem({
        id: 'vocabularyDiversity',
        label: '어휘의 다양성',
        score: metrics.vocabularyDiversityScore ?? scores.language ?? 0,
        passed: (metrics.vocabularyDiversityScore ?? scores.language ?? 0) >= 60,
        detail: '대화에서 서로 다른 표현을 얼마나 다양하게 사용했는지 평가했습니다.'
      }),
      savedById.sentenceCompleteness || buildFallbackReportItem({
        id: 'sentenceCompleteness',
        label: '문장의 완성도',
        score: metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0,
        passed: (metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0) >= 60,
        detail: '답변이 끝맺음 있는 문장으로 자연스럽게 완성되었는지 평가했습니다.'
      }),
      savedById.emotionalState || buildFallbackReportItem({
        id: 'emotionalState',
        label: '정서 상태',
        score: scores.emotion ?? metrics.emotionPositiveRatio ?? 0,
        passed: (scores.emotion ?? metrics.emotionPositiveRatio ?? 0) >= 50,
        detail: '긍정/부정 정서 표현의 비율을 바탕으로 정서 흐름을 평가했습니다.'
      }),
      savedById.topicDeviation || buildFallbackReportItem({
        id: 'topicDeviation',
        label: '주제 이탈률',
        score: 100 - (metrics.topicDeviationRate || 0),
        passed: (metrics.topicDeviationRate || 0) <= 40,
        detail: `대화 주제에서 벗어난 비율은 ${Math.round(metrics.topicDeviationRate || 0)}%입니다.`
      }),
      savedById.guardianCaption || buildFallbackReportItem({
        id: 'guardianCaption',
        label: '보호자 입력 캡션',
        score: analysis.report?.captionMatchRate ?? null,
        passed: hasPhotoEvaluationContext ? null : null,
        detail: hasPhotoEvaluationContext
          ? '저장된 보호자 입력 캡션 평가 결과가 없어 평가 제외로 표시합니다.'
          : '사진 또는 보호자 입력 캡션 없이 진행된 통화입니다.',
        categories: captionCategories
      })
    ].filter((item) => shouldShowGuardianCaption || item.id !== 'guardianCaption');
  };

  const evaluationItems = getEvaluationItems();

  const ReportItem = ({ item }) => (
    <div className="cd-report-item">
      <div className="cd-report-head">
        <span className="cd-report-label">{item.label}</span>
        <span className={`cd-report-badge ${item.passed === false ? 'bad' : item.passed === null ? 'neutral' : 'good'}`}>
          {item.passed === null ? '평가 제외' : item.passed ? '양호' : '확인 필요'}
        </span>
      </div>
      {item.score !== null && item.score !== undefined && (
        <div className="cd-score-bar-bg">
          <div className="cd-score-bar-fill" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: '#00C16E' }} />
        </div>
      )}
      <p className="cd-report-detail">{item.detail}</p>
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
          <div className="cd-conversation-title">주요 대화 내용</div>
          <div className="cd-conversation-card">
            <div className="cd-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`cd-message ${msg.role}`}>
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
                        <span>환자</span>
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
