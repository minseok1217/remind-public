import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signOut, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { calculateWeeklyTrend } from '../services/conversationAnalysisService';
import './MainScreen.css';
import call_icon from '../assets/call_icon.png';

function MainScreen({ currentUser, onViewAllCallHistory }) {
  const [guardianInfo, setGuardianInfo] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [familyLink, setFamilyLink] = useState(null);
  const [loading, setLoading] = useState(true);

  // 환자 생성 팝업
  const [showPatientRegistrationPopup, setShowPatientRegistrationPopup] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhoneNumber, setNewPatientPhoneNumber] = useState('');
  const [newPatientBirthdate, setNewPatientBirthdate] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('남성');
  const [newPatientCallTime, setNewPatientCallTime] = useState('12:00');
  const [newPatientId, setNewPatientId] = useState('');
  const [newPatientPassword, setNewPatientPassword] = useState('');
  // 위치 정보 (K-MMSE 채점용)
  const [newPatientCity, setNewPatientCity] = useState('');
  const [newPatientPlaceType, setNewPatientPlaceType] = useState('집');
  const [newPatientPlaceName, setNewPatientPlaceName] = useState('');
  const [newPatientFloor, setNewPatientFloor] = useState('1');
  const [error, setError] = useState('');
  
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

  const clampScore = (value) => Math.max(0, Math.min(Number(value) || 0, 100));

  const buildFallbackReportItem = ({ id, label, score, passed, detail }) => ({
    id,
    label,
    score: score === null || score === undefined ? null : Math.round(clampScore(score)),
    passed,
    detail
  });

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

  const getEvaluationItems = (analysis, callLog = {}) => {
    const scores = analysis?.scores || {};
    const metrics = analysis?.metrics || {};
    const topicDeviationRate = Number(metrics.topicDeviationRate);
    const utteranceCountValue = callLog?.totalUtterances ?? analysis?.totalUtterances ?? metrics.totalUtterances;
    const totalUtterances = Number(utteranceCountValue);
    const hasTopicDeviationRate = metrics.topicDeviationRate !== null &&
      metrics.topicDeviationRate !== undefined &&
      Number.isFinite(topicDeviationRate);
    const canShowTopicDeviation = hasTopicDeviationRate &&
      (utteranceCountValue === null || utteranceCountValue === undefined || totalUtterances > 0);
    const savedItems = analysis?.report?.items || [];
    const savedById = savedItems.reduce((acc, item) => {
      if (!item.id) return acc;
      acc[item.id] = {
        ...item,
        score: item.score === null || item.score === undefined ? null : Math.round(clampScore(item.score))
      };
      return acc;
    }, {});
    const photoContext = callLog?.photoContext || {};
    const shouldShowGuardianCaption = !(
      photoContext.source === 'orientation_images' ||
      photoContext.ownerId === 'orientation_images' ||
      String(photoContext.id || '').startsWith('orientation_')
    );
    const hasPhotoEvaluationContext = Boolean(
      photoContext.url ||
      photoContext.photoURL ||
      photoContext.imageUrl ||
      photoContext.description ||
      photoContext.detailedDescription ||
      photoContext.finalCaption
    );
    const savedTopicDeviation = savedById.topicDeviation;
    const savedTopicDeviationRate = Number(savedTopicDeviation?.topicDeviationRate);
    const canRestoreSavedTopicDeviation = savedTopicDeviation &&
      savedTopicDeviation.score === null &&
      savedTopicDeviation.topicDeviationRate !== null &&
      savedTopicDeviation.topicDeviationRate !== undefined &&
      Number.isFinite(savedTopicDeviationRate);
    const topicDeviationItem = savedTopicDeviation?.score !== null &&
      savedTopicDeviation?.score !== undefined
      ? savedTopicDeviation
      : canRestoreSavedTopicDeviation
        ? {
          ...savedTopicDeviation,
          score: Math.round(clampScore(100 - savedTopicDeviationRate)),
          passed: savedTopicDeviation.passed ?? savedTopicDeviationRate <= 40
        }
        : null;

    return [
      savedById.vocabularyDiversity || buildFallbackReportItem({
        id: 'vocabularyDiversity',
        label: '어휘의 다양성',
        score: metrics.vocabularyDiversityScore ?? scores.language ?? 0,
        passed: (metrics.vocabularyDiversityScore ?? scores.language ?? 0) >= 60
      }),
      savedById.sentenceCompleteness || buildFallbackReportItem({
        id: 'sentenceCompleteness',
        label: '문장의 완성도',
        score: metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0,
        passed: (metrics.sentenceCompletenessScore ?? metrics.fluencyScore ?? 0) >= 60
      }),
      savedById.emotionalState || buildFallbackReportItem({
        id: 'emotionalState',
        label: '정서 상태',
        score: scores.emotion ?? metrics.emotionPositiveRatio ?? 0,
        passed: (scores.emotion ?? metrics.emotionPositiveRatio ?? 0) >= 50
      }),
      topicDeviationItem || buildFallbackReportItem({
        id: 'topicDeviation',
        label: '주제 이탈률',
        score: canShowTopicDeviation ? 100 - topicDeviationRate : null,
        passed: canShowTopicDeviation ? topicDeviationRate <= 40 : null
      }),
      savedById.guardianCaption || buildFallbackReportItem({
        id: 'guardianCaption',
        label: '보호자 입력 캡션',
        score: analysis?.report?.captionMatchRate ?? null,
        passed: null
      })
    ].filter((item) => shouldShowGuardianCaption || item.id !== 'guardianCaption');
  };

  const getReportMessage = (analysis) => {
    const reportItems = analysis?.report?.items || [];
    const needsCheck = reportItems.find((item) => item.passed === false);
    if (needsCheck) return `${needsCheck.label}: ${needsCheck.detail}`;
    return reportItems[0]?.detail || normalizeInsights(analysis?.insights)[0] || '통화가 완료되었습니다.';
  };

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
          // 보호자인 경우 - guardians 추가 정보 로드 (없어도 계속 진행)
          const guardianDocRef = doc(db, 'guardians', currentUser.uid);
          const guardianDocSnap = await getDoc(guardianDocRef);

          if (guardianDocSnap.exists()) {
            setGuardianInfo({ ...userData, ...guardianDocSnap.data() });
          } else {
            setGuardianInfo(userData);
          }

          // FamilyLinks에서 연결된 환자 찾기 (guardians 문서 존재 여부와 무관하게 항상 확인)
          const familyLinksRef = collection(db, 'family_links');
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid), where('status', '==', '연결됨'));
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
          } else {
            // 연결된 환자가 없는 경우에만 팝업 표시
            setShowPatientRegistrationPopup(true);
          }
        } else if (userData.role === '환자') {
          /* 
          // 환자인 경우 - patients 추가 정보 로드
          const patientDocRef = doc(db, 'patients', currentUser.uid);
          const patientDocSnap = await getDoc(patientDocRef);
          console.log('patients/{uid} 문서 존재:', patientDocSnap.exists());
          if (patientDocSnap.exists()) {
            setPatientInfo({ ...userData, ...patientDocSnap.data() });
          }
          */
        }
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error.code, error.message);
    } finally {
      setLoading(false);
    }
  };

  const linkPatient = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 유효성 검사
    if (!newPatientName.trim()) {
      setError('이름을 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientPhoneNumber.trim()) {
      setError('전화번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientBirthdate || !newPatientGender) {
      setError('환자 정보를 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientId.trim() || !newPatientPassword.trim()) {
      setError('환자용 아이디와 비밀번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    // firebase는 계정 생성 시 해당 계정으로 로그인 되도록 되어 있어서 임시 앱을 생성해서 기존 로그인 유지되도록 우회
    let tempApp;
    try {
      // 임시 앱 생성 (이름을 'temp'로 지정하여 메인 앱과 분리)
      const tempAppName = `temp-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      // 1. 환자 계정 생성 (Firebase Auth) - 유효한 이메일 형식 사용
      const patientEmail = `${newPatientId}@patient.app`;
      const patientCredential = await createUserWithEmailAndPassword(tempAuth, patientEmail, newPatientPassword);
      const patientUser = patientCredential.user;

      // 2. 환자 프로필 업데이트
      await updateProfile(patientUser, {
        displayName: newPatientName
      });

      // ========== 새로운 DB 구조 ==========

      // 3. Users 컬렉션에 환자 정보 저장
      const patientUserDocRef = doc(db, 'users', patientUser.uid);
      await setDoc(patientUserDocRef, {
        user_id: patientUser.uid,
        login_id: newPatientId,
        name: newPatientName,
        phone_number: newPatientPhoneNumber,
        role: '환자',
        created_at: new Date(),
        notification_enabled: true,
        personal_information: true
      });

      // 4. Guardians 컬렉션에 보호자 추가 정보 저장
      const guardianDocRef = doc(db, 'guardians', currentUser.uid);
      await setDoc(guardianDocRef, {
        user_id: currentUser.uid,
        relationship: '보호자',
        patient_id: patientUser.uid
      });

      // 5. Patients 컬렉션에 환자 추가 정보 저장
      const patientDocRef = doc(db, 'patients', patientUser.uid);
      await setDoc(patientDocRef, {
        user_id: patientUser.uid,
        birth_date: newPatientBirthdate,
        gender: newPatientGender,
        call_time: newPatientCallTime.replace(':', ''),
        is_notified: true,
        guardian_id: currentUser.uid,
        // K-MMSE 장소 지남력 채점용
        city: newPatientCity.trim(),
        place_type: newPatientPlaceType,
        place_name: newPatientPlaceName.trim(),
        floor: newPatientFloor.trim(),
      });

      // 6. FamilyLinks 컬렉션에 가족 연결 정보 저장
      const linkId = `${currentUser.uid}_${patientUser.uid}`;
      const familyLinkDocRef = doc(db, 'family_links', linkId);
      await setDoc(familyLinkDocRef, {
        link_id: linkId,
        patient_id: patientUser.uid,
        guardian_id: currentUser.uid,
        status: '연결됨',
        created_at: new Date()
      });

      // 임시 앱 로그아웃 및 삭제
      await signOut(tempAuth);
      await deleteApp(tempApp);

      // 등록 성공 후 팝업 닫고 정보 새로고침
      setShowPatientRegistrationPopup(false);
      await loadUserInfo();
      
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 아이디 형식입니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 환자 아이디입니다. 다른 아이디를 입력해주세요.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호는 6자 이상이어야 합니다.');
      } else {
        setError(`등록에 실패했습니다: ${err.message}`);
      }
      try { if (tempApp) await deleteApp(tempApp); } catch {}
      console.error('환자 등록 오류:', err.code, err.message);
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
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid), where('status', '==', '연결됨'));
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
        const latestInsightLines = normalizeInsights(latestCall.analysis?.insights);
        
        setTodayStatus({
          hasCall: isToday,
          lastCallTime: timeString,
          lastCallDuration: `${durationMinutes}분 ${durationSeconds}초`,
          status: latestCall.status || '통화 완료',
          statusColor: latestCall.analysis?.status?.color || '#41d17f',
          message: getReportMessage(latestCall.analysis),
          insightLines: latestInsightLines
        });
        
        // 인지 상태 요약 (최근 7일 트렌드)
        const weeklyTrend = calculateWeeklyTrend(logs);
        const latestAnalysis = latestCall.analysis;
        
        setCognitiveStatus({
          score: latestAnalysis?.scores?.cognitive || latestCall.cognitiveScore || 0,
          statusLabel: latestAnalysis?.status?.label || '분석 중',
          statusColor: latestAnalysis?.status?.color || '#999',
          recent: getEvaluationItems(latestAnalysis, latestCall),
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
            cognitiveScore: log.cognitiveScore || log.analysis?.scores?.cognitive || 0
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
            { label: '어휘의 다양성', score: 0 },
            { label: '문장의 완성도', score: 0 },
            { label: '정서 상태', score: 0 },
            { label: '주제 이탈률', score: 0 }
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

      {/* Content Grid - 3 columns */}
      <div className="three-col-grid">
        {/* 오늘의 현황 */}
        <div className="card-section">
          <h2 className="card-section-title">오늘의 현황</h2>
          <div className="today-card">
            <div className="today-card-content">
              <div className="today-card-text">{todayStatus?.hasCall ? '오늘 통화 완료' : '아직 오늘 통화가 없어요'}</div>
              {todayStatus?.hasCall ? (
                <>
                  <div className="today-card-desc today-card-desc-strong">오늘 통화를 완료했어요!</div>
                  <div className="today-card-desc">{todayStatus?.message || ''}</div>
                </>
              ) : (todayStatus?.insightLines?.length > 0 ? (
                <>
                  <div className="today-card-desc today-card-desc-strong">최근 통화 요약</div>
                  {todayStatus.insightLines.slice(0, 2).map((insight, index) => (
                    <div key={index} className="today-card-desc">{insight}</div>
                  ))}
                </>
              ) : (
                <div className="today-card-desc">아직 오늘 통화가 없어요</div>
              ))}
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

        {/* 최근 인지 상태 요약 */}
        <div className="card-section">
          <h2 className="card-section-title">최근 인지 상태 요약</h2>
          <div className="status-card">
            <div className="status-header">
              <div>
                <div className="status-label">전반적인 상태</div>
                <div className="status-text">{cognitiveStatus?.statusLabel || '분석 중'}</div>
              </div>
              <div className="status-score">{cognitiveStatus?.score || 0}<span className="score-unit">점</span></div>
            </div>
            <div className="stats-list">
              {(cognitiveStatus?.recent || []).map((metric, index) => (
                <div key={index} className="metric-item">
                  <div className="metric-header">
                    <label className="metric-label">{metric.label}</label>
                    <span className={`metric-value ${metric.passed === false ? 'metric-warning' : ''}`}>
                      {metric.score === null || metric.score === undefined ? '평가 제외' : `${metric.score}점`}
                    </span>
                  </div>
                  {metric.score !== null && metric.score !== undefined && (
                    <div className="main-progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(metric.score, 100)}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 최근 통화 기록 */}
        <div className="card-section">
          <div className="card-section-header">
            <h2 className="card-section-title">최근 통화 기록</h2>
            <button className="view-all" onClick={onViewAllCallHistory}>전체 보기</button>
          </div>
          <div className="call-list-container">
            {callRecords.length === 0 ? (
              <div className="no-records">아직 통화 기록이 없습니다.</div>
            ) : (
              callRecords.slice(0, 5).map((record) => (
                <div key={record.id} className="call-item">
                  <div className="call-list-icon">
                    <img src={call_icon} className="call_icon_img" alt="전화 아이콘" />
                  </div>
                  <div className="call-info-content">
                    <div className="call-detail-date">{record.date}</div>
                    <div className="call-detail">시간: {record.time} &nbsp;·&nbsp; {record.duration}</div>
                  </div>
                  <span className={`call-status-value ${record.status === '분석 불가' ? 'status-disabled' : record.status === '주의 필요' ? 'status-warning' : 'status-good'}`}>
                    {record.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showPatientRegistrationPopup && !patientInfo && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h2>환자 정보 등록</h2>
            <p>보호자님, 연결된 환자 정보가 없습니다. 지금 환자를 등록해주세요.</p>
            <form onSubmit={linkPatient}>
              <div className="popup-form-field">
                <label htmlFor="patientName">이름</label>
                <input
                  type="text"
                  id="patientName"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="환자 성함을 입력하세요"
                  disabled={loading}
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientPhoneNumber">전화번호</label>
                <input
                  type="tel"
                  id="patientPhoneNumber"
                  value={newPatientPhoneNumber}
                  onChange={(e) => setNewPatientPhoneNumber(e.target.value)}
                  placeholder="010-1234-5678"
                  disabled={loading}
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientBirthdate">생년월일</label>
                <input
                  type="date"
                  id="patientBirthdate"
                  value={newPatientBirthdate}
                  onChange={(e) => setNewPatientBirthdate(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientGender">성별</label>
                <div className="popup-gender-buttons">
                  <button
                    type="button"
                    className={`popup-gender-btn ${newPatientGender === '남성' ? 'active' : ''}`}
                    onClick={() => setNewPatientGender('남성')}
                    disabled={loading}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    className={`popup-gender-btn ${newPatientGender === '여성' ? 'active' : ''}`}
                    onClick={() => setNewPatientGender('여성')}
                    disabled={loading}
                  >
                    여성
                  </button>
                </div>
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientCallTime">통화 시간</label>
                <input
                  type="time"
                  id="addPatientCallTime"
                  value={newPatientCallTime}
                  onChange={(e) => setNewPatientCallTime(e.target.value)}
                  required
                />
              </div>
              {/* ── K-MMSE 장소 지남력 정보 ── */}
              <div className="popup-section-divider">
                <span>📍 어르신 거주 위치 정보 (K-MMSE 검사용)</span>
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientCity">거주 시/도</label>
                <input
                  type="text"
                  id="patientCity"
                  value={newPatientCity}
                  onChange={(e) => setNewPatientCity(e.target.value)}
                  placeholder="예: 서울, 경기도, 부산"
                  disabled={loading}
                />
              </div>
              <div className="popup-form-field">
                <label>어르신이 계신 곳</label>
                <div className="popup-gender-buttons">
                  {['집','요양원','병원','기타'].map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`popup-gender-btn ${newPatientPlaceType === type ? 'active' : ''}`}
                      onClick={() => setNewPatientPlaceType(type)}
                      disabled={loading}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientPlaceName">장소 이름</label>
                <input
                  type="text"
                  id="patientPlaceName"
                  value={newPatientPlaceName}
                  onChange={(e) => setNewPatientPlaceName(e.target.value)}
                  placeholder="예: 우리집, 행복 요양원"
                  disabled={loading}
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientFloor">층수</label>
                <input
                  type="text"
                  id="patientFloor"
                  value={newPatientFloor}
                  onChange={(e) => setNewPatientFloor(e.target.value)}
                  placeholder="예: 1, 2, 3층"
                  disabled={loading}
                />
              </div>

              <div className="popup-form-field">
                <label htmlFor="patientId">아이디</label>
                <input
                  type="text"
                  id="patientId"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  disabled={loading}
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="patientPassword">비밀번호</label>
                <input
                  type="password"
                  id="patientPassword"
                  value={newPatientPassword}
                  onChange={(e) => setNewPatientPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  disabled={loading}
                  required
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="popup-actions">
                <button type="button" className="cancel-button" onClick={() => setShowPatientRegistrationPopup(false)}>
                  취소
                </button>
                <button type="submit" className="confirm-button" disabled={loading}>
                  환자 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainScreen;
