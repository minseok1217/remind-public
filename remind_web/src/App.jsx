import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import './App.css';

// 컴포넌트들 (기존과 동일)
import MainScreen from './components/MainScreen';
import ProfileScreen from './components/ProfileScreen';
import PhotoScreen from './components/PhotoScreen';
import PhotoManagementScreen from './components/PhotoManagementScreen';
import StatsScreen from './components/StatsScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import FindIdScreen from './components/FindIdScreen';
import FindPasswordScreen from './components/FindPasswordScreen';
import VoiceChatScreen from './components/VoiceChatScreen';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  return (
    <Router>
      <Routes>
        {/* 1. 로그인 전용 경로들 */}
        {!currentUser ? (
          <>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/find-id" element={<FindIdScreen />} />
            <Route path="/find-pw" element={<FindPasswordScreen />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          /* 2. 로그인 후 레이아웃 (Sidebar 포함) */
          <Route path="/" element={<AuthenticatedLayout currentUser={currentUser} onLogout={handleLogout} />}>
            <Route index element={<MainScreen currentUser={currentUser} />} />
            <Route path="photo" element={<PhotoScreen currentUser={currentUser} />} />
            <Route path="management" element={<PhotoManagementScreen currentUser={currentUser} />} />
            <Route path="voice" element={<VoiceChatScreen />} />
            <Route path="stats" element={<StatsScreen currentUser={currentUser} />} />
            <Route path="profile" element={<ProfileScreen currentUser={currentUser} onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

// 로그인한 사용자용 레이아웃 컴포넌트 (사이드바 포함)
function AuthenticatedLayout({ currentUser, onLogout }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="app-logo">
          <div className="logo-icon">R</div>
          <span className="logo-text">REMIND CALL</span>
        </div>
        
        <nav className="nav-menu">
          {/* Link 컴포넌트를 사용하여 URL 이동 */}
          <Link to="/" className={`nav-item ${path === '/' ? 'active' : ''}`}>
            <span className="nav-icon">🏠</span><span className="nav-label">홈</span>
          </Link>
          <Link to="/photo" className={`nav-item ${path === '/photo' ? 'active' : ''}`}>
            <span className="nav-icon">📸</span><span className="nav-label">사진등록</span>
          </Link>
          <Link to="/voice" className={`nav-item ${path === '/voice' ? 'active' : ''}`}>
            <span className="nav-icon">🎙️</span><span className="nav-label">음성대화</span>
          </Link>
          <Link to="/stats" className={`nav-item ${path === '/stats' ? 'active' : ''}`}>
            <span className="nav-icon">📊</span><span className="nav-label">통계</span>
          </Link>
          <Link to="/profile" className={`nav-item ${path === '/profile' ? 'active' : ''}`}>
            <span className="nav-icon">👤</span><span className="nav-label">내 정보</span>
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        {/* 실제 페이지 내용이 렌더링되는 곳 */}
        <Outlet context={{ currentUser }} />
      </main>
    </div>
  );
}

// Outlet 사용을 위해 import 추가 필요
import { Outlet } from 'react-router-dom';

export default App;