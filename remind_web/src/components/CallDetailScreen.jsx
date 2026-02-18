import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './CallDetailScreen.css';

function CallDetailScreen({ callLog, currentUser, onBack }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const analysis = callLog?.analysis || {};
  const scores = analysis.scores || {};
  const metrics = analysis.metrics || {};
  const status = analysis.status || {};
  const insights = analysis.insights || [];
  const conversation = callLog?.conversation || '';
  const cognitiveScore = scores.cognitive || callLog?.cognitiveScore || 0;

  useEffect(() => {
    loadPhoto();
  }, [callLog]);

  const loadPhoto = async () => {
    try {
      if (callLog?.photoId && callLog?.userId) {
        const photoDocRef = doc(db, 'users', callLog.userId, 'photos', callLog.photoId);
        const photoSnap = await getDoc(photoDocRef);
        if (photoSnap.exists()) {
          setPhotoUrl(photoSnap.data().imageUrl || photoSnap.data().url || null);
        }
      }
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

  const getCallTimeString = () => {
    const d = callLog?.callDate?.toDate?.() || new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const getDurationString = () => {
    const dur = callLog?.callDuration || 0;
    const min = Math.floor(dur / 60);
    const sec = dur % 60;
    return `${min}분 ${sec}초`;
  };

  const getStatusBadgeType = () => {
    const label = status.label || '';
    if (label === '매우 양호' || label === '양호') return 'good';
    if (label === '주의 필요' || label === '관심 필요') return 'warning';
    if (label === '분석 불가') return 'unavailable';
    return 'normal';
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

  // Score bar helper
  const ScoreBar = ({ label, value, color }) => (
    <div className="cd-score-row">
      <span className="cd-score-label">{label}</span>
      <div className="cd-score-bar-bg">
        <div
          className="cd-score-bar-fill"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color || '#41d17f' }}
        />
      </div>
      <span className="cd-score-value">{value}점</span>
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
      <div className="cd-header">
        <button className="cd-back-btn" onClick={onBack}>←</button>
        <h1>통화 분석</h1>
      </div>

      {/* Call Info */}
      <div className="cd-call-info-bar">
        <span className="cd-call-date">{getCallDateString()} {getCallTimeString()}</span>
        <span className="cd-call-dur">통화시간 {getDurationString()}</span>
      </div>

      {/* Photo Section */}
      {photoUrl && (
        <div className="cd-photo-section">
          <div className="cd-photo-label">사용된 사진</div>
          <div className="cd-photo-wrapper">
            <img src={photoUrl} alt="통화에 사용된 사진" className="cd-photo" />
          </div>
        </div>
      )}

      {/* Score Circle & Status */}
      <div className="cd-score-section">
        <div className="cd-score-circle" style={{ borderColor: status.color || '#41d17f' }}>
          <span className="cd-score-num" style={{ color: status.color || '#41d17f' }}>{cognitiveScore}</span>
          <span className="cd-score-unit">점</span>
        </div>
        <div className={`cd-status-badge ${getStatusBadgeType()}`}>
          {status.label || '분석 완료'}
        </div>
      </div>

      {/* Detailed Analysis Bars */}
      <div className="cd-analysis-card">
        <div className="cd-analysis-title">상세 분석</div>
        <div className="cd-score-bars">
          <ScoreBar label="유창성" value={metrics.fluencyScore || scores.language || 0} color="#4CAF50" />
          <ScoreBar label="기억력" value={scores.memory || 0} color="#2196F3" />
          <ScoreBar label="정서" value={scores.emotion || 0} color="#FF9800" />
        </div>

        {/* Metric Details */}
        <div className="cd-metrics-grid">
          <div className="cd-metric-item">
            <span className="cd-metric-label">대명사 비율</span>
            <span className="cd-metric-val">{metrics.pronounRatio || 0}%</span>
          </div>
          <div className="cd-metric-item">
            <span className="cd-metric-label">분당 단어 수</span>
            <span className="cd-metric-val">{metrics.wordsPerMinute || 0}</span>
          </div>
          <div className="cd-metric-item">
            <span className="cd-metric-label">주제 이탈률</span>
            <span className="cd-metric-val">{metrics.topicDeviationRate || 0}%</span>
          </div>
          <div className="cd-metric-item">
            <span className="cd-metric-label">긍정 감정</span>
            <span className="cd-metric-val">{metrics.emotionPositiveRatio || 0}%</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="cd-insight-card">
          <div className="cd-insight-icon">💡</div>
          <div className="cd-insight-text">
            {insights.map((insight, i) => (
              <p key={i}>{insight}</p>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Section */}
      {messages.length > 0 && (
        <div className="cd-conversation-card">
          <div className="cd-conversation-title">대화 내용</div>
          <div className="cd-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`cd-message ${msg.role}`}>
                <div className="cd-message-role">
                  {msg.role === 'ai' ? '🤖 AI' : '👤 환자'}
                </div>
                <div className="cd-message-text">{msg.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CallDetailScreen;
