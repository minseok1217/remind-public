import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';
import MainScreen from './components/MainScreen';
import ProfileScreen from './components/ProfileScreen';
import PhotoScreen from './components/PhotoScreen';
import PhotoManagementScreen from './components/PhotoManagementScreen';
import StatsScreen from './components/StatsScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import FindIdScreen from './components/FindIdScreen';
import FindPasswordScreen from './components/FindPasswordScreen';

function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'signup', 'findId', 'findPassword'

  useEffect(() => {
    // Firebase 인증 상태 감시
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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
            <span className="nav-icon">🏠</span>
            <span className="nav-label">홈</span>
          </button>
          <button 
            className={`nav-item ${activeNav === 'photo' ? 'active' : ''}`}
            onClick={() => setActiveNav('photo')}
            title="사진등록"
          >
            <span className="nav-icon">📸</span>
            <span className="nav-label">사진등록</span>
          </button>
          <button 
            className={`nav-item ${activeNav === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveNav('stats')}
            title="통계"
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">통계</span>
          </button>
          <button 
            className={`nav-item ${activeNav === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveNav('profile')}
            title="내 정보"
          >
            <span className="nav-icon">👤</span>
            <span className="nav-label">내 정보</span>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        {activeNav === 'home' && <MainScreen currentUser={currentUser} />}
        {activeNav === 'photo' && <PhotoScreen currentUser={currentUser} onBack={() => setActiveNav('home')} onGoToManagement={() => setActiveNav('management')} />}
        {activeNav === 'management' && <PhotoManagementScreen currentUser={currentUser} />}
        {activeNav === 'stats' && <StatsScreen currentUser={currentUser} onBack={() => setActiveNav('home')} />}
        {activeNav === 'profile' && <ProfileScreen currentUser={currentUser} onBack={() => setActiveNav('home')} onLogout={handleLogout} />}
      </main>
    </div>
  );
}

export default App;