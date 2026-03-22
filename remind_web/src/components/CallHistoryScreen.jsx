import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import './CallHistoryScreen.css';
import backicon from '../assets/back_icon.png';
import clockicon from '../assets/clock_icon.png';
import timeicon from '../assets/time_icon.png';
import dateicon from '../assets/date_icon.png';

function CallHistoryScreen({ currentUser, onBack, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [callRecords, setCallRecords] = useState([]);

  useEffect(() => {
    if (currentUser) {
      loadCallHistory();
    }
  }, [currentUser]);

  const loadCallHistory = async () => {
    try {
      let targetUserId = currentUser.uid;

      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === '보호자') {
          const familyLinksRef = collection(db, 'family_links');
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid));
          const familySnapshot = await getDocs(familyQuery);

          if (!familySnapshot.empty) {
            targetUserId = familySnapshot.docs[0].data().patient_id;
          }
        }
      }

      const callLogsRef = collection(db, 'call_logs');
      const callQuery = query(callLogsRef, where('userId', '==', targetUserId));
      const callSnapshot = await getDocs(callQuery);

      const logs = callSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort((a, b) => {
        const dateA = a.callDate?.toDate?.() || new Date(0);
        const dateB = b.callDate?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      // 날짜별 그룹핑
      const grouped = {};
      logs.forEach(log => {
        const logDate = log.callDate?.toDate?.() || new Date();
        const dateKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
        const displayDate = `${logDate.getFullYear()}년 ${logDate.getMonth() + 1}월 ${logDate.getDate()}일`;

        if (!grouped[dateKey]) {
          grouped[dateKey] = { dateKey, displayDate, records: [] };
        }

        const hours = String(logDate.getHours()).padStart(2, '0');
        const minutes = String(logDate.getMinutes()).padStart(2, '0');
        const durMin = Math.floor((log.callDuration || 0) / 60);
        const durSec = (log.callDuration || 0) % 60;

        const statusLabel = log.analysis?.status?.label || (log.analysis ? '분석 완료' : '분석 불가');
        let badgeType = 'normal';
        if (statusLabel === '매우 양호' || statusLabel === '양호') badgeType = 'good';
        else if (statusLabel === '주의 필요' || statusLabel === '관심 필요') badgeType = 'warning';
        else if (statusLabel === '분석 불가') badgeType = 'unavailable';

        grouped[dateKey].records.push({
          id: log.id,
          rawLog: log,
          time: `${hours}:${minutes}`,
          duration: `${durMin}분 ${durSec}초`,
          statusLabel,
          badgeType,
          cognitiveScore: log.cognitiveScore || log.analysis?.scores?.cognitive || 0
        });
      });

      const sortedGroups = Object.values(grouped).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
      setCallRecords(sortedGroups);
    } catch (error) {
      console.error('[CallHistoryScreen] 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (record) => {
    if (onNavigate) {
      onNavigate('callDetail', { callLog: record.rawLog });
    }
  };

  if (loading) {
    return (
      <div className="call-history-screen">
        <div className="ch-header">
          <button className="ch-back-btn" onClick={onBack}>←</button>
          <h1>통화 기록</h1>
        </div>
        <div className="ch-loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="call-history-screen">
      <div className="header-content">
        <button type="button" className="back-ic-button" onClick={onBack}>
          <img className="icon" src={backicon} alt="뒤로가기 아이콘" />
        </button>
        <h1 className="header-title">통화 기록</h1>
      </div>
      <div className="header-diver"></div>

      {callRecords.length === 0 ? (
        <div className="ch-empty">
          <div className="ch-empty-icon">📞</div>
          <p>통화 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="ch-date-groups">
          {callRecords.map((group) => (
            <div key={group.dateKey} className="ch-date-group">
              <div className="ch-cards">
                {group.records.map((record) => (
                  <div key={record.id} className="ch-card">
                    <div className="ch-card-header">
                      <h2 className="ch-card-date">{group.displayDate}</h2>
                      <span className={`ch-badge ${record.badgeType}`}>
                        {record.statusLabel}
                      </span>
                    </div>
                    <div className="ch-card-info">
                      <div className="ch-info-row">
                        <div className="ch-info-icon">
                          <img src={timeicon} className='icon-small' />
                        </div>
                        <div className="ch-info-content">
                          <p className="ch-info-label">시간</p>
                          <p className="ch-info-value">{record.time}</p>
                        </div>
                      </div>

                      <div className="ch-info-row">
                        <div className="ch-info-icon">
                          <img src={clockicon} className='icon-small' />
                        </div>
                        <div className="ch-info-content">
                          <p className="ch-info-label">통화 시간</p>
                          <p className="ch-info-value">{record.duration}</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      className="ch-detail-btn"
                      onClick={() => handleViewDetail(record)}
                    >
                      통화 분석 결과 보기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CallHistoryScreen;
