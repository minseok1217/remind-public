import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import './App.css';
import SplashScreen from './components/SplashScreen';
import MainScreen from './components/MainScreen';
import MainScreen_p from './components/MainScreen_p';
import ProfileScreen from './components/ProfileScreen';
import PhotoScreen from './components/PhotoScreen';
import PhotoManagementScreen from './components/PhotoManagementScreen';
import StatsScreen from './components/StatsScreen';
import CallHistoryScreen from './components/CallHistoryScreen';
import CallDetailScreen from './components/CallDetailScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import FindIdScreen from './components/FindIdScreen';
import FindPasswordScreen from './components/FindPasswordScreen';
import VoiceChatScreen from './components/VoiceChatScreen';
import OrientationTrainingScreen from './components/OrientationTrainingScreen';
import KMMSEScreen from './components/KMMSEScreen';
import home_icon_on from './assets/home_icon_on.png'; 
import home_icon_off from './assets/home_icon_off.png'; 
import photo_icon_on from './assets/photo_icon_on.png'; 
import photo_icon_off from './assets/photo_icon_off.png'; 
import chart_icon_on from './assets/chart_icon_on.png'; 
import chart_icon_off from './assets/chart_icon_off.png'; 
import info_icon_on from './assets/info_icon_on.png'; 
import info_icon_off from './assets/info_icon_off.png'; 

const SKIP_ORIENTATION_TRAINING_FOR_DEBUG = false;

function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // '보호자' | '환자'
  const [loggedInAccountType, setLoggedInAccountType] = useState(null); // 'guardian' | 'patient'
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'signup', 'findId', 'findPassword'
  const [subScreen, setSubScreen] = useState(null); // { type: 'callHistory' | 'callDetail', data: {} }
  const [showKMMSE, setShowKMMSE] = useState(false);
  const [kmmseExistingDifficulty, setKmmseExistingDifficulty] = useState(null);
  // 환자 통화 플로우: 'orientation' → 'voice'
  const [callPhase, setCallPhase] = useState('orientation');
  const [showCallButton, setShowCallButton] = useState(true);
  const forceOrientationRef = useRef(false);

  const getOrientDateKey = (uid = currentUser?.uid) =>
    uid ? `orient_done_date_${uid}` : 'orient_done_date';
  const isOrientationDoneToday = () =>
    SKIP_ORIENTATION_TRAINING_FOR_DEBUG ||
    localStorage.getItem(getOrientDateKey()) === new Date().toDateString() ||
    localStorage.getItem('orient_done_date') === new Date().toDateString();
  const getCallPhaseForToday = () => isOrientationDoneToday() ? 'voice' : 'orientation';

  // 통화 탭 진입 시: 오늘 이미 완료했으면 바로 voice, 아니면 orientation 리셋
  useEffect(() => {
    if (activeNav !== 'call') {
      setCallPhase('orientation');
    } else if (forceOrientationRef.current) {
      forceOrientationRef.current = false;
      setCallPhase(isOrientationDoneToday() ? 'voice' : 'orientation');
    } else if (isOrientationDoneToday()) {
      setCallPhase('voice');
    }
  }, [activeNav, currentUser]);

  const handleStatsNavigate = (type, data) => {
    setSubScreen({ type, data });
  };

  const handleMainScreenCallHistoryNavigate = () => {
    setActiveNav("stats");
    setSubScreen({ type: "callHistory", data: {} });
  };

  const handleSubBack = () => {
    if (subScreen?.type === 'callDetail') {
      // If came from call history, go back to call history
      setSubScreen({ type: 'callHistory', data: {} });
    } else {
      setSubScreen(null);
    }
  };

  const handleLoginSuccess = (accountType) => {
    setLoggedInAccountType(accountType);
    setAuthScreen('login'); // 로그인 성공 후 로그인 화면으로 돌아가게 (실제로 MainScreen으로 이동하므로 이 부분은 재조정 필요)
    setActiveNav('home'); // 성공하면 홈 화면으로 이동
    localStorage.setItem('loggedInAccountType', accountType); // Add this line
  };

  useEffect(() => {
    // 스플래시 화면 표시 후 숨기기
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  // K-MMSE 필요 여부 체크 (환자 전용 / 30일마다 재검사)
  const checkKMMSENeeded = async (uid) => {
    try {
      const patientSnap = await getDoc(doc(db, 'patients', uid));
      if (!patientSnap.exists()) {
        setShowKMMSE(true);
        setKmmseExistingDifficulty(null);
        return;
      }
      const data = patientSnap.data();
      const lastDate = data.kmmse_last_date ? new Date(data.kmmse_last_date) : null;
      const diff = data.difficulty || null;

      if (!lastDate) {
        // 한 번도 검사 안 한 경우
        setShowKMMSE(true);
        setKmmseExistingDifficulty(null);
      } else {
        // 30일 초과 시 재검사
        const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) {
          setShowKMMSE(true);
          setKmmseExistingDifficulty(diff);
        } else {
          setShowKMMSE(false);
        }
      }
    } catch (e) {
      console.warn('K-MMSE 체크 실패:', e);
      setShowKMMSE(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // 역할 조회
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const role = userDocSnap.data().role || null;
            setUserRole(role);
            // On refresh, if user is logged in, set loggedInAccountType from role
            const accountType = role === '환자' ? 'patient' : 'guardian';
            setLoggedInAccountType(accountType);
            // 환자인 경우 K-MMSE 체크
            if (role === '환자') {
              await checkKMMSENeeded(user.uid);
            }
          }
        } catch (e) {
          console.error('역할 조회 실패:', e);
        }
      } else {
        setUserRole(null);
        setLoggedInAccountType(null); // Clear loggedInAccountType on logout
        localStorage.removeItem('loggedInAccountType'); // Also clear from local storage
        setShowKMMSE(false);
      }
      setLoading(false);
    });

    // Load loggedInAccountType from localStorage on initial mount
    const storedAccountType = localStorage.getItem('loggedInAccountType');
    if (storedAccountType) {
      setLoggedInAccountType(storedAccountType);
    }

    return unsubscribe;
  }, []); // Empty dependency array means this runs once on mount and unmount

  useEffect(() => {
    const openCall = ({ forceOrientation = false } = {}) => {
      console.log(forceOrientation ? '지남력 훈련 화면 이동' : '통화 화면 이동');
      forceOrientationRef.current = forceOrientation;
      setCallPhase(getCallPhaseForToday());
      setActiveNav('call');
    };

    window.openVoiceChatScreenPage = () => {
      openCall();
    };

    window.openOrientationTrainingScreenPage = () => {
      openCall({ forceOrientation: true });
    };

    return () => {
      delete window.openVoiceChatScreenPage;
      delete window.openOrientationTrainingScreenPage;
    };
  }, [currentUser]);

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try {
        await signOut(auth);
        setActiveNav('home');
        localStorage.removeItem('loggedInAccountType'); // Also clear on logout
        setLoggedInAccountType(null); // Clear state
      } catch (error) {
        console.error('로그아웃 실패:', error);
      }
    }
  };

  // 스플래시 화면 표시
  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  // 로그인하지 않은 경우
  if (!currentUser) {
    return (
      <>
        {authScreen === 'login' && (
          <LoginScreen 
            onSwitchToSignup={() => setAuthScreen('signup')}
            onSwitchToFindId={() => setAuthScreen('findId')}
            onSwitchToFindPassword={() => setAuthScreen('findPassword')}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
        {authScreen === 'signup' && (
          <SignupScreen onSwitchToLogin={() => setAuthScreen('login')} />
        )}
        {authScreen === 'findId' && (
          <FindIdScreen onSwitchToLogin={() => setAuthScreen('login')} />
        )}
        {authScreen === 'findPassword' && (
          <FindPasswordScreen onSwitchToLogin={() => setAuthScreen('login')} />
        )}
      </>
    );
  }

  // 환자 K-MMSE 검사가 필요한 경우
  if (currentUser && showKMMSE && userRole === '환자') {
    return (
      <KMMSEScreen
        currentUser={currentUser}
        existingDifficulty={kmmseExistingDifficulty}
        onComplete={() => setShowKMMSE(false)}
      />
    );
  }

  // 로그인된 경우
  return (
    <div className="app-container">
      <aside className="sidebar">
          <div className="app-logo">
            <div className="logo-icon">R</div>
            <span className="logo-text">REMIND CALL</span>
          </div>
          
          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
              onClick={() => setActiveNav('home')}
              title="홈"
            >
              <span className="nav-icon"><img src={activeNav === 'home' ? home_icon_on : home_icon_off} alt="홈_아이콘" className='nav_icon' /></span>
              <span className="nav-label">홈</span>
            </button>

            {/* 보호자 전용: 사진등록 */}
            {userRole === '보호자' && (
              <button 
                className={`nav-item ${activeNav === 'photo' ? 'active' : ''}`}
                onClick={() => setActiveNav('photo')}
                title="사진등록"
              >
                <span className="nav-icon"><img src={activeNav === 'photo' ? photo_icon_on : photo_icon_off} alt="사진_아이콘" className='nav_icon' /></span>
                <span className="nav-label">사진등록</span>
              </button>
            )}

            {/* 통화 */}
            {userRole === '환자' && (
              <button
                className={`nav-item ${activeNav === 'call' ? 'active' : ''}`}
                onClick={() => {
                  setCallPhase(getCallPhaseForToday());
                  setActiveNav('call');
                }}
                title="통화"
              >
                <span className="nav-icon">📞</span>
                <span className="nav-label">통화</span>
              </button>
            )}

            <button 
              className={`nav-item ${activeNav === 'stats' ? 'active' : ''}`}
              onClick={() => { setActiveNav('stats'); setSubScreen(null); }}
              title="통계"
            >
              <span className="nav-icon"><img src={activeNav === 'stats' ? chart_icon_on : chart_icon_off} alt="통계_아이콘" className='nav_icon' /></span>
              <span className="nav-label">통계</span>
            </button>
            <button 
              className={`nav-item ${activeNav === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveNav('profile')}
              title="내 정보"
            >
              <span className="nav-icon"><img src={activeNav === 'profile' ? info_icon_on : info_icon_off} alt="프로필_아이콘" className='nav_icon' /></span>
              <span className="nav-label">계정 관리</span>
            </button>
          </nav>
        </aside>

      <main className="main-content">
        {activeNav === 'home' && (loggedInAccountType === 'patient' ? 
          <MainScreen_p currentUser={currentUser} onNavigate={handleStatsNavigate} /> : 
          <MainScreen currentUser={currentUser} onNavigate={handleStatsNavigate} onViewAllCallHistory={handleMainScreenCallHistoryNavigate} />
        )}
        {activeNav === 'photo' && <PhotoScreen currentUser={currentUser} onBack={() => setActiveNav('home')} onGoToManagement={() => setActiveNav('management')} />}
        {activeNav === 'management' && <PhotoManagementScreen currentUser={currentUser} onBack={() => setActiveNav('photo')} />}
        {activeNav === 'call' && callPhase === 'orientation' && !isOrientationDoneToday() && (
          <OrientationTrainingScreen
            currentUser={currentUser}
            onComplete={() => {
              localStorage.setItem(getOrientDateKey(), new Date().toDateString());
              localStorage.setItem('orient_done_date', new Date().toDateString());
              setCallPhase('voice');
            }}
            onBack={() => setActiveNav('home')}
          />
        )}
        {activeNav === 'call' && (callPhase === 'voice' || isOrientationDoneToday()) && (
          <VoiceChatScreen
            onBack={() => {
              setCallPhase('orientation');
              setActiveNav('home');
            }}
          />
        )}
        {activeNav === 'stats' && !subScreen && (
          <StatsScreen
            currentUser={currentUser}
            onBack={() => setActiveNav('home')}
            onNavigate={handleStatsNavigate}
          />
        )}
        {activeNav === 'stats' && subScreen?.type === 'callHistory' && (
          <CallHistoryScreen
            currentUser={currentUser}
            onBack={() => setSubScreen(null)}
            onNavigate={handleStatsNavigate}
          />
        )}
        {activeNav === 'stats' && subScreen?.type === 'callDetail' && (
          <CallDetailScreen
            callLog={subScreen.data?.callLog}
            currentUser={currentUser}
            onBack={handleSubBack}
          />
        )}
        {activeNav === 'profile' && <ProfileScreen currentUser={currentUser} onBack={() => setActiveNav('home')} onLogout={handleLogout} />}
      </main>
    </div>
  );
}

export default App;
