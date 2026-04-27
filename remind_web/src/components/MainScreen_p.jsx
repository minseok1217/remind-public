import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth'; // getAuth, signOut 추가
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, onSnapshot } from 'firebase/firestore';
import { generateAndStoreTempCode } from '../services/familyLinkService';
import './MainScreen_p.css'; // MainScreen.css 대신 MainScreen_p.css 임포트
import bell_icon from '../assets/bell_icon.png'; // 종 아이콘 추가
import clock_icon from '../assets/clock_icon.png'; // 시계 아이콘 추가
import user_icon from '../assets/user_icon.png'; // 사용자 아이콘 추가
import info_icon from '../assets/Info_icon.png'; // 정보 아이콘 추가

function MainScreen_p({ currentUser, onViewAllCallHistory }) { // 컴포넌트 이름 변경
  const [patientInfo, setPatientInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedCallTime, setSelectedCallTime] = useState(""); // HHMM 형식
  const [tempCode, setTempCode] = useState(null);
  const [countdown, setCountdown] = useState(0); // 초 단위
  const [isCodeGenerating, setIsCodeGenerating] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(null);
  const isInitialMount = useRef(true);
  const prevConnectedGuardianIdsRef = useRef([]); // 이전 연결된 보호자 ID 목록을 추적하기 위한 ref 추가
  const [debugToken, setDebugToken] = useState("토큰 대기 중...");

  useEffect(() => {
    if (currentUser) {
      loadUserInfo();
    }
  }, [currentUser]);

  useEffect(() => {
    window.onReceiveFcmToken = async (token) => {      
      // 1. 화면 확인용 (성공했으니 나중엔 지우셔도 됩니다)
      setDebugToken(token); 
      // 2. 실제 DB 저장 함수 호출
      await handleUpdateFcmToken(token);
    };

    if (window.AndroidBridge && window.AndroidBridge.onReady) {
      window.AndroidBridge.onReady();
    }

    return () => {
      delete window.onReceiveFcmToken;
    };
  }, [currentUser]); // currentUser가 로드된 후 저장해야 하므로 의존성 배열에 추가

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && tempCode) {
      // 타이머가 0이 되고 코드가 있으면 코드 만료 처리
      setTempCode(null);
      alert('임시 코드가 만료되었습니다. 다시 생성해주세요.');
    }
    return () => clearInterval(timer);
  }, [countdown, tempCode]);

  useEffect(() => {
    if (currentUser) {
      const q = query(collection(db, 'family_links'), where('patient_id', '==', currentUser.uid), where('status', '==', '연결됨'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const currentGuardianIds = snapshot.docs.map(doc => doc.data().guardian_id);
        
        // 새로 연결된 보호자가 있는지 확인 (이전 상태는 ref에서 가져옴)
        const newConnections = currentGuardianIds.filter(id => !prevConnectedGuardianIdsRef.current.includes(id));

        if (currentGuardianIds.length > 0) {
          console.log('[MainScreen_p] 보호자 연결됨 확인!');

          // 첫 렌더링이 아니고, 새로운 연결이 있을 때만 메시지 표시
          if (!isInitialMount.current && newConnections.length > 0) {
            setConnectionMessage('보호자와 연결되었습니다.');
            setTempCode(null);
            setCountdown(0);
            setTimeout(() => {
              setConnectionMessage(null);
            }, 3000);
          }
        } else {
          console.log('[MainScreen_p] 보호자 연결 안됨.');
          setConnectionMessage(null);
        }
        prevConnectedGuardianIdsRef.current = currentGuardianIds; // ref 업데이트 (다음 스냅샷 비교용)
        
        // onSnapshot이 처음 실행된 후에는 isInitialMount를 false로 설정
        if (isInitialMount.current) {
            isInitialMount.current = false;
        }
      }, (error) => {
        console.error('가족 연결 상태 실시간 업데이트 실패:', error);
      });

      return () => unsubscribe();
    }
  }, [currentUser]); // connectedGuardianIds를 의존성 배열에서 제거

  const handleUpdateFcmToken = async (token) => {

    if (!auth.currentUser) {
      console.error("저장 실패: Auth 세션이 아직 없습니다.");
      return;
    }

    try {
      const uid = auth.currentUser.uid; // props로 받은 currentUser 대신 auth 직접 참조
      const patientDocRef = doc(db, 'patients', uid);

      await setDoc(patientDocRef, {
        fcmToken: token,
        token_last_updated: new Date().toISOString()
      }, { merge: true });

      console.log("Firestore 저장 최종 성공!");
    } catch (error) {
      // 여기서 어떤 에러가 찍히는지 꼭 확인해야 합니다.
      console.error('최종 저장 에러 상세:', error);
    }
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

        if (userData.role === '환자') {
          // 환자인 경우 - patients 추가 정보 로드
          const patientDocRef = doc(db, 'patients', currentUser.uid);
          const patientDocSnap = await getDoc(patientDocRef);
          if (patientDocSnap.exists()) {
            setPatientInfo({ ...userData, ...patientDocSnap.data() });
          }
        } else {
            // MainScreen_p는 환자 전용 스크린이므로, 보호자 정보 로직은 필요 없음.
            // 혹시 보호자가 이 스크린에 접근했다면, patientInfo를 null로 설정하거나 다른 처리가 필요할 수 있습니다.
            // 여기서는 보호자 로직을 제거하고, 환자 정보가 없을 경우를 대비하여 patientInfo를 null로 유지합니다.
            setPatientInfo(null);
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

  const handleTimePickerToggle = () => {
    if (patientInfo?.call_time) {
      // Convert HHMM to HH:MM for input type="time"
      const hour = patientInfo.call_time.substring(0, 2);
      const minute = patientInfo.call_time.substring(2, 4);
      setSelectedCallTime(`${hour}:${minute}`);
    } else {
      setSelectedCallTime("00:00"); // Default value if no call_time
    }
    setShowTimePicker(prev => !prev);
  };

  const handleTimeSave = async () => {
    if (!currentUser || !selectedCallTime) return;

    try {
      const patientDocRef = doc(db, 'patients', currentUser.uid);
      // Convert HH:MM to HHMM for Firestore
      const newCallTime = selectedCallTime.replace(':', '');
      await setDoc(patientDocRef, { call_time: newCallTime }, { merge: true });

      //안드로이드 네이티브 브릿지 호출 (추가된 부분)
      if (window.AndroidBridge && window.AndroidBridge.setAlarmTimeOnce) {
        // "14:30" 형태 그대로 앱에 전달
        window.AndroidBridge.setAlarmTimeOnce(selectedCallTime);
      }
      
      setPatientInfo(prev => ({ ...prev, call_time: newCallTime }));
      setShowTimePicker(false);
      alert('통화 시간이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('통화 시간 업데이트 실패:', error);
      alert('통화 시간 업데이트 실패: ' + error.message);
    }
  };

  const handleNotificationToggle = async () => {
    if (!currentUser || !patientInfo) return;

    try {
      const patientDocRef = doc(db, 'patients', currentUser.uid);
      const newNotificationStatus = !patientInfo.is_notified;
      await setDoc(patientDocRef, { is_notified: newNotificationStatus }, { merge: true });
      setPatientInfo(prev => ({ ...prev, is_notified: newNotificationStatus }));
      console.log('알림 설정 업데이트 성공:', newNotificationStatus);
    } catch (error) {
      console.error('알림 설정 업데이트 실패:', error);
      alert('알림 설정 업데이트 실패: ' + error.message);
    }
  };

  const formatCallTime = (timeString) => {
    if (!timeString) return "--:-- AM";

    const hour = parseInt(timeString.substring(0, 2), 10);
    const minute = parseInt(timeString.substring(2, 4), 10);

    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${formattedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleGenerateCode = async () => {
    if (!currentUser) return;
    setIsCodeGenerating(true);
    try {
      const code = await generateAndStoreTempCode(currentUser.uid);
      setTempCode(code);
      setCountdown(60); // 1분 = 60초
      alert('6자리 임시 코드가 생성되었습니다. 보호자에게 이 코드를 알려주세요.');
    } catch (error) {
      console.error('임시 코드 생성 실패:', error);
      alert('임시 코드 생성 실패: ' + error.message);
    } finally {
      setIsCodeGenerating(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) { // 알림창 추가
      try {
        await signOut(auth); // Firebase auth.js에서 내보낸 auth 인스턴스 사용
        console.log('로그아웃 성공');
        // 로그아웃 후 로그인 페이지로 리다이렉트 (예시)
        window.location.href = '/login'; 
      } catch (error) {
        console.error('로그아웃 실패:', error);
        alert('로그아웃 실패: ' + error.message);
      }
    }
  };

  return (
    <div className="main-screen-p">
      {/* Header */}
      <div className="main-header-p">
        <div className="greeting-section-p">
          {loading ? (
            <span className="username-p">로딩 중...</span>
          ) : (
            <div className="main-header-content-p">
              <div className="user-type-p">사용자</div>
              <span className="greeting-p">안녕하세요, </span>
              <span className="username-p">{patientInfo?.name || currentUser?.displayName || '김철수'}님!</span>
            </div>
          )}
        </div>
      </div>
      <div className="header-diver"></div>

      {/* Content Section */}
      <div className="content-section-p">
        {connectionMessage && (
          <div className="connection-message" style={{ backgroundColor: '#e0ffe0', padding: '10px', borderRadius: '5px', marginBottom: '15px', textAlign: 'center', color: '#007000' }}>
            {connectionMessage}
          </div>
        )}

        {/* Call Settings Card */}
        <div className="card-p">
          <div className="card-item-p">
            <div className="item-left-p">
              <div className="icon-container-p" style={{ backgroundColor: '#DCFAED' }}>
                <img src={bell_icon} alt="item-icon-p" className="item-icon-bell-p" />
              </div>
              <span className="item-text-p">통화 설정</span>
            </div>
            <div className="item-right-p">
              <label className="switch-p">
                <input type="checkbox" checked={patientInfo?.is_notified || false} onChange={handleNotificationToggle} />
                <span className="slider-p round-p"></span>
              </label>
            </div>
          </div>
          <div className="divider-p"></div>
          <div className="card-item-p">
            <div className="item-left-p">
              <div className="icon-container-p" style={{ backgroundColor: '#DCFAED' }}>
                <img src={clock_icon} alt="item-icon-p" className="item-icon-p" />
              </div>
              <div className="text-group-p">
                <span className="item-text-p">통화 시간</span>
                <span className="item-description-p">매일 AI가 설정한 시간에 전화를 드립니다.</span>
              </div>
            </div>
            <div className="item-right-p">
              {showTimePicker ? 
                <input
                  type="time"
                  value={selectedCallTime}
                  onChange={(e) => setSelectedCallTime(e.target.value)}
                  style={{ backgroundColor: '#DCFAED', borderColor: '#00C16E', color: '#00C16E' }}
                />
              : 
                <div className="time-selector-p" style={{ backgroundColor: '#DCFAED', borderColor: '#00C16E', color: '#00C16E' }} onClick={handleTimePickerToggle}>
                  <span>{formatCallTime(patientInfo?.call_time)}</span>
                  <span className="arrow-down-p">▼</span>
                </div>
              }
            </div>
          </div>
        </div>

        {showTimePicker && (
          <div className="time-picker-controls-section">
            <button onClick={handleTimeSave}>통화 시간 수정</button>
            <button onClick={handleTimePickerToggle}>취소</button>
          </div>
        )}

        {/* Guardian Connection Card */}
        <div className="card-p">
          <div className="card-item-title-p">
            <div className="icon-container-small-p" style={{ backgroundColor: '#DCFAED' }}>
              <img src={user_icon} alt="User Icon" className="item-icon-small-p" />
            </div>
            <span className="item-title-text-p">보호자 연결</span>
          </div>
          <span className="card-subtitle-p">임시코드로 보호자들을 연결하세요.</span>
          <div className="info-box-p" style={{ backgroundColor: '#F0F0F0' }}>
            <img src={info_icon} alt="Info Icon" className="info-icon-p" />
            <span className="info-text-p">아래 버튼을 눌러 임시코드를 생성하세요. 보호자가 앱에서 이 코드를 입력하면 연결이 완료됩니다. 코드는 1분간 유효합니다.</span>
          </div>
          {!tempCode && (
            <button
              className="connect-button-p"
              style={{ backgroundColor: '#00C16E', color: '#FFF' }}
              onClick={handleGenerateCode}
              disabled={isCodeGenerating}
            >
              {isCodeGenerating ? '코드 생성 중...' : '보호자 연결하기'}
            </button>
          )}
          {tempCode && countdown > 0 && (
            <div className="code-display-section-p">
              <p>임시 코드: <span className="temp-code-p">{tempCode}</span></p>
              <p>남은 시간: <span className="countdown-p">{countdown}초</span></p>
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button className="logout-button-p" onClick={handleLogout} >
          로그아웃
        </button>
      </div>
    </div>
  );
}

export default MainScreen_p;
