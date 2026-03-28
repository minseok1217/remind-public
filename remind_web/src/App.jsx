import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import './App.css';
import SplashScreen from './components/SplashScreen';
import MainScreen from './components/MainScreen';
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
import home_icon_on from './assets/home_icon_on.png'; 
import home_icon_off from './assets/home_icon_off.png'; 
import photo_icon_on from './assets/photo_icon_on.png'; 
import photo_icon_off from './assets/photo_icon_off.png'; 
import chart_icon_on from './assets/chart_icon_on.png'; 
import chart_icon_off from './assets/chart_icon_off.png'; 
import info_icon_on from './assets/info_icon_on.png'; 
import info_icon_off from './assets/info_icon_off.png'; 

function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // '보호자' | '환자'
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'signup', 'findId', 'findPassword'
  const [subScreen, setSubScreen] = useState(null); // { type: 'callHistory' | 'callDetail', data: {} }

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

  useEffect(() => {
    // 스플래시 화면 표시 후 숨기기
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // 역할 조회
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserRole(userDocSnap.data().role || null);
          }
        } catch (e) {
          console.error('역할 조회 실패:', e);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try {
        await signOut(auth);
        setActiveNav('home');
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

          {/* 환자 전용: 통화 */}
          {userRole === '환자' && (
            <button 
              className={`nav-item ${activeNav === 'call' ? 'active' : ''}`}
              onClick={() => setActiveNav('call')}
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
            <span className="nav-label">내 정보</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        {activeNav === 'home' && <MainScreen currentUser={currentUser} onNavigate={handleStatsNavigate} onViewAllCallHistory={handleMainScreenCallHistoryNavigate} />}
        {activeNav === 'photo' && <PhotoScreen currentUser={currentUser} onBack={() => setActiveNav('home')} onGoToManagement={() => setActiveNav('management')} />}
        {activeNav === 'management' && <PhotoManagementScreen currentUser={currentUser} onBack={() => setActiveNav('photo')} />}
        {activeNav === 'call' && <VoiceChatScreen onBack={() => setActiveNav('home')} />}
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