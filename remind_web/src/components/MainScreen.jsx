import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './MainScreen.css';

function MainScreen({ currentUser }) {
  const [guardianInfo, setGuardianInfo] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadUserInfo();
    }
  }, [currentUser]);

  const loadUserInfo = async () => {
    try {
      console.log('현재 사용자 UID:', currentUser.uid);
      
      // 현재 사용자가 보호자인지 환자인지 확인
      const guardianDocRef = doc(db, 'guardians', currentUser.uid);
      const guardianDocSnap = await getDoc(guardianDocRef);
      console.log('guardians/{uid} 문서 존재:', guardianDocSnap.exists());

      if (guardianDocSnap.exists()) {
        // 보호자 계정 - 환자 정보 로드
        const guardianData = guardianDocSnap.data();
        setGuardianInfo(guardianData);

        if (guardianData.patientId) {
          const patientDocRef = doc(db, 'patients', guardianData.patientId);
          const patientDocSnap = await getDoc(patientDocRef);
          if (patientDocSnap.exists()) {
            setPatientInfo(patientDocSnap.data());
          }
        }
      } else {
        // 환자 계정인 경우
        const patientDocRef = doc(db, 'patients', currentUser.uid);
        const patientDocSnap = await getDoc(patientDocRef);
        console.log('patients/{uid} 문서 존재:', patientDocSnap.exists());
        if (patientDocSnap.exists()) {
          setPatientInfo(patientDocSnap.data());
        }
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);
      // 사용자에게 문제 원인을 간단히 안내
      alert(
        `사용자 정보 로드 실패: ${error.code} - ${error.message}\n\n` +
        '원인: Firestore 보안 규칙 또는 인증(로그인) 문제일 수 있습니다.\n' +
        '해결: Firebase 콘솔의 Firestore 규칙에서 `guardians/{uid}` 및 `patients/{uid}` 읽기 권한을 확인하세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  const [todayStatus] = useState({
    lastCallTime: '오후 2:30',
    lastCallDuration: '15분'
  });

  const [cognitiveStatus] = useState({
    score: 75,
    recent: [
      { label: '언어', score: 80 },
      { label: '기억력', score: 75 },
      { label: '정서', score: 85 }
    ]
  });

  const [callRecords] = useState([
    {
      id: 1,
      date: '2026년 1월 1일',
      time: '03시',
      duration: '15분 20초',
      status: '통화 완료',
      isRecent: true
    },
    {
      id: 2,
      date: '2026년 1월 2일',
      time: '02시',
      duration: '13분 20초',
      status: '주의 필요'
    },
    {
      id: 3,
      date: '2026년 1월 1일',
      time: '02시',
      duration: '2분 20초',
      status: '통화 완료'
    }
  ]);

  return (
    <div className="main-screen">
      {/* Header */}
      <div className="header">
        <div className="greeting-section">
          {loading ? (
            <span className="username">로딩 중...</span>
          ) : guardianInfo ? (
            <>
              <span className="greeting">🔔 안녕하세요! </span>
              <span className="username">{patientInfo?.name || '환자'}환자 보호자님 </span>
            </>
          ) : (
            <span className="username">안녕하세요! {patientInfo?.name || '사용자'}님</span>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Top Row - Two Cards */}
        <div className="top-row">
          {/* Today's Status Card */}
          <div className="status-card today-status">
            <h2 className="card-title">오늘의 현황</h2>
            <div className="status-content">
              <div className="call-info">
                <div className="call-icon">☎️</div>
                <div className="call-text">
                  <p className="call-label">오늘 통화를 완료했어요!</p>
                  <p className="call-subtitle">목소리가 평소보다 밝게 들렸어요!</p>
                </div>
              </div>
              <div className="call-time">
                <p className="time-label">통화 시간</p>
                <p className="time-value">{todayStatus.lastCallTime}</p>
                <p className="time-duration">{todayStatus.lastCallDuration}</p>
              </div>
            </div>
            <button className="check-button">기록 확인</button>
          </div>

          {/* Cognitive Status Card */}
          <div className="cognitive-card">
            <div className="cognitive-header">
              <h3 className="cognitive-title">최근 인지상태 요약</h3>
            </div>
            
            <div className="cognitive-score-section">
              <p className="score-label">매우 양호</p>
              <p className="score-description">최근 일주일간 통화를 분석했습니다.</p>
              <div className="big-score">{cognitiveStatus.score}점</div>
            </div>

            <div className="metrics-section">
              {cognitiveStatus.recent.map((metric, index) => (
                <div key={index} className="metric-item">
                  <div className="metric-header">
                    <label className="metric-label">{metric.label}</label>
                    <span className="metric-value">{metric.score}점</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${metric.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row - Call Records */}
        <div className="call-records">
          <div className="section-header">
            <h3 className="section-title">최근 통화 기록</h3>
            <a href="#" className="view-all">전체 보기</a>
          </div>
          <div className="records-list">
            {callRecords.map((record) => (
              <div key={record.id} className={`record-card ${record.isRecent ? 'recent' : ''}`}>
                <div className="record-header">
                  <span className="record-date">📅 {record.date}</span>
                  <span className="record-status-badge">{record.status}</span>
                </div>
                <div className="record-details">
                  <span className="detail-item">시간: 오전 {record.time}</span>
                  <span className="detail-item">통화 시간: {record.duration}</span>
                </div>
                {record.isRecent && (
                  <button className="record-button">주의 필요</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainScreen;
