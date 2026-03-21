import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { calculateWeeklyTrend } from '../services/conversationAnalysisService';
import './MainScreen.css';
import call_icon from '../assets/call_icon.png'

function MainScreen({ currentUser }) {
  const [guardianInfo, setGuardianInfo] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [familyLink, setFamilyLink] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 통화 관련 상태
  const [todayStatus, setTodayStatus] = useState(null);
  const [cognitiveStatus, setCognitiveStatus] = useState(null);
  const [callRecords, setCallRecords] = useState([]);

  useEffect(() => {
    if (currentUser) {
      loadUserInfo();
      loadCallData();
    }
  }, [currentUser]);

  const loadUserInfo = async () => {
    try {
      console.log('현재 사용자 UID:', currentUser.uid);
      
      // Users 컬렉션에서 사용자 정보 조회
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      console.log('users/{uid} 문서 존재:', userDocSnap.exists());

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        if (userData.role === '보호자') {
          // 보호자인 경우 - guardians 추가 정보 로드
          const guardianDocRef = doc(db, 'guardians', currentUser.uid);
          const guardianDocSnap = await getDoc(guardianDocRef);
          
          if (guardianDocSnap.exists()) {
            const guardianData = guardianDocSnap.data();
            setGuardianInfo({ ...userData, ...guardianData });

            // FamilyLinks에서 연결된 환자 찾기
            const familyLinksRef = collection(db, 'family_links');
            const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid));
            const familySnapshot = await getDocs(familyQuery);
            
            if (!familySnapshot.empty) {
              const linkData = familySnapshot.docs[0].data();
              setFamilyLink(linkData);
              console.log('가족 연결 정보:', linkData);
              
              const patientUserId = linkData.patient_id;
              
              // 연결된 환자 정보 로드
              const patientUserRef = doc(db, 'users', patientUserId);
              const patientUserSnap = await getDoc(patientUserRef);
              const patientDocRef = doc(db, 'patients', patientUserId);
              const patientDocSnap = await getDoc(patientDocRef);
              
              if (patientUserSnap.exists()) {
                const pUserData = patientUserSnap.data();
                const pData = patientDocSnap.exists() ? patientDocSnap.data() : {};
                setPatientInfo({ ...pUserData, ...pData });
                console.log('환자 정보 로드 완료:', pUserData.name);
              }
            }
          }
        } else if (userData.role === '환자') {
          // 환자인 경우 - patients 추가 정보 로드
          const patientDocRef = doc(db, 'patients', currentUser.uid);
          const patientDocSnap = await getDoc(patientDocRef);
          console.log('patients/{uid} 문서 존재:', patientDocSnap.exists());
          if (patientDocSnap.exists()) {
            setPatientInfo({ ...userData, ...patientDocSnap.data() });
          }
        }
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);
      alert(
        `사용자 정보 로드 실패: ${error.code} - ${error.message}\n\n` +
        '원인: Firestore 보안 규칙 또는 인증(로그인) 문제일 수 있습니다.\n' +
        '해결: Firebase 콘솔의 Firestore 규칙에서 `users/{uid}`, `guardians/{uid}`, `patients/{uid}`, `family_links` 읽기 권한을 확인하세요.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 통화 기록 및 인지 상태 로드
  const loadCallData = async () => {
    try {
      // 보호자인 경우 환자 ID로 조회, 환자인 경우 본인 ID로 조회
      // familyLink가 로드될 때까지 기다림
      let targetUserId = currentUser.uid;
      
      // 보호자인지 확인 (users 문서에서 role 확인)
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === '보호자') {
          // family_links에서 연결된 환자 찾기
          const familyLinksRef = collection(db, 'family_links');
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid));
          const familySnapshot = await getDocs(familyQuery);
          
          if (!familySnapshot.empty) {
            const linkData = familySnapshot.docs[0].data();
            targetUserId = linkData.patient_id;
            console.log('보호자 모드: 환자 ID로 통화 기록 조회:', targetUserId);
          }
        }
      }

      // call_logs에서 통화 기록 조회
      const callLogsRef = collection(db, 'call_logs');
      const callQuery = query(
        callLogsRef,
        where('userId', '==', targetUserId)
      );
      
      const callSnapshot = await getDocs(callQuery);
      const logs = callSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const dateA = a.callDate?.toDate?.() || new Date(0);
        const dateB = b.callDate?.toDate?.() || new Date(0);
        return dateB - dateA; // 최신순
      }).slice(0, 10);
      
      console.log('통화 기록 로드:', logs.length, '건');
      
      if (logs.length > 0) {
        // 오늘의 현황 (가장 최근 통화)
        const latestCall = logs[0];
        const callDate = latestCall.callDate?.toDate?.() || new Date();
        const isToday = new Date().toDateString() === callDate.toDateString();
        
        const hours = callDate.getHours();
        const minutes = callDate.getMinutes();
        const timeString = `${hours >= 12 ? '오후' : '오전'} ${hours % 12 || 12}:${String(minutes).padStart(2, '0')}`;
        const durationMinutes = Math.floor((latestCall.callDuration || 0) / 60);
        const durationSeconds = (latestCall.callDuration || 0) % 60;
        
        setTodayStatus({
          hasCall: isToday,
          lastCallTime: timeString,
          lastCallDuration: `${durationMinutes}분 ${durationSeconds}초`,
          status: latestCall.status || '통화 완료',
          statusColor: latestCall.analysis?.status?.color || '#41d17f',
          message: latestCall.analysis?.insights?.[0] || '통화가 완료되었습니다.'
        });
        
        // 인지 상태 요약 (최근 7일 트렌드)
        const weeklyTrend = calculateWeeklyTrend(logs);
        const latestAnalysis = latestCall.analysis;
        
        setCognitiveStatus({
          score: latestAnalysis?.scores?.cognitive || 0,
          statusLabel: latestAnalysis?.status?.label || '분석 중',
          statusColor: latestAnalysis?.status?.color || '#999',
          recent: [
            { label: '언어', score: latestAnalysis?.scores?.language || 0 },
            { label: '기억력', score: latestAnalysis?.scores?.memory || 0 },
            { label: '정서', score: latestAnalysis?.scores?.emotion || 0 }
          ],
          trend: weeklyTrend.trend,
          trendMessage: weeklyTrend.message
        });
        
        // 통화 기록 목록
        const formattedRecords = logs.slice(0, 5).map((log, index) => {
          const logDate = log.callDate?.toDate?.() || new Date();
          const year = logDate.getFullYear();
          const month = logDate.getMonth() + 1;
          const day = logDate.getDate();
          const hour = logDate.getHours();
          const durMin = Math.floor((log.callDuration || 0) / 60);
          const durSec = (log.callDuration || 0) % 60;
          
          return {
            id: log.id,
            date: `${year}년 ${month}월 ${day}일`,
            time: `${String(hour).padStart(2, '0')}시`,
            duration: `${durMin}분 ${durSec}초`,
            status: log.status || '통화 완료',
            statusColor: log.analysis?.status?.color || '#41d17f',
            isRecent: index === 0,
            cognitiveScore: log.cognitiveScore || 0
          };
        });
        
        setCallRecords(formattedRecords);
      } else {
        // 통화 기록이 없는 경우
        setTodayStatus({
          hasCall: false,
          lastCallTime: '-',
          lastCallDuration: '-',
          message: '아직 통화 기록이 없습니다.'
        });
        
        setCognitiveStatus({
          score: 0,
          statusLabel: '데이터 없음',
          recent: [
            { label: '언어', score: 0 },
            { label: '기억력', score: 0 },
            { label: '정서', score: 0 }
          ]
        });
        
        setCallRecords([]);
      }
    } catch (error) {
      console.error('통화 기록 로드 실패:', error);
      // 에러 시 기본값 설정
      setTodayStatus({ hasCall: false, message: '데이터를 불러올 수 없습니다.' });
      setCognitiveStatus({ score: 0, statusLabel: '오류', recent: [] });
      setCallRecords([]);
    }
  };

  return (
    <div className="main-screen">
      {/* Header */}
      <div className="main-header">
        <div className="greeting-section">
          {loading ? (
            <span className="username">로딩 중...</span>
          ) : guardianInfo ? (
            <div className="main-header-content">
              <div className="user-type">보호자</div>
              <span className="greeting">안녕하세요! </span>
              <span className="username">{patientInfo?.name || '환자'}환자 보호자님 </span>
            </div>
          ) : (
            <span className="username">안녕하세요! {patientInfo?.name || '사용자'}님</span>
          )}
        </div>
      </div>
      <div className="header-diver"></div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Top Row - Two Cards */}
        <div className="top-row">
          {/* Today's Status Card */}
          <div className="card-section">
            <h2 className="card-section-title">오늘의 현황</h2>
            <div className="today-card">
              <div className="today-card-content">
                <div className="today-card-text">{todayStatus?.hasCall ? '오늘 통화 완료' : '아직 오늘 통화가 없어요'}</div>
                <div className="today-card-desc">{todayStatus?.hasCall ? '오늘 통화를 완료했어요!' : '아직 오늘 통화가 없어요'}</div>
                <div className="today-card-desc">{todayStatus?.message || ''}</div>
              </div>
              <div className="today-card-footer">
                <div>
                  <div className="call-time-label">통화 시간</div>
                  <div className="call-time-value">{todayStatus?.lastCallTime || '-'} {todayStatus?.lastCallDuration || '-'}</div>
                </div>
                <button className="record-btn">기록 확인</button>
              </div>
            </div>
          </div>

          {/* Cognitive Status Card */}
          <div className="card-section">
            <h2 className="card-section-title">최근 인지 상태 요약</h2>
            
            <div className="status-card">
              <p className="section-desc">{cognitiveStatus?.trendMessage || '최근 통화를 분석했습니다.'}</p>
              <div className="status-header">
                <div>
                  <div className="status-label">전반적인 상태</div>
                  <div className="status-text">{cognitiveStatus?.statusLabel || '분석 중'}</div>
                </div>
                <div className="status-score">{cognitiveStatus?.score || 0}<span class="score-unit">점</span></div>
              </div>
                
              <div className="stats-list">
                {(cognitiveStatus?.recent || []).map((metric, index) => (
                <div key={index} className="metric-item">
                  <div className="metric-header">
                    <label className="metric-label">{metric.label}</label>
                    <span className="metric-value">{metric.score}점</span>
                  </div>
                  <div className="main-progress-bar">
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
        </div>

        {/* Bottom Row - Call Records */}
        <div className="card-section call-history-section">
          <div className="card-section-header">
            <h2 className="card-section-title">최근 통화 기록</h2>
            <a href="#" className="view-all">전체 보기</a>
          </div>
          <div className="call-list">
            {callRecords.length === 0 ? (
              <div className="no-records">
                <p>아직 통화 기록이 없습니다.</p>
              </div>
            ) : (
              callRecords.map((record) => (
              <div key={record.id} className="call-item">
                <div className="call-list-icon">
                  <img src={call_icon} className="call_icon_img" alt="전화 아이콘" />
                </div>
                <div className="call-info-content">
                  <div className="call-detail">날짜: {record.date}</div>
                  <div className="call-detail">시간: {record.time}</div>
                  <div className="call-detail">통화 시간: {record.duration}</div>
                </div>
                <span className={`call-status-value ${record.status=="분석 불가" ? 'status-disabled' : (record.status=="주의 필요" ? 'status-warning' : 'status-good')}`}>{record.status}</span>
              </div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainScreen;
