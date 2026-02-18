import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './AuthScreen.css';

function LoginScreen({ onSwitchToSignup, onSwitchToFindId, onSwitchToFindPassword }) {
  const [accountType, setAccountType] = useState('guardian'); // 'guardian' or 'patient'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Firebase Auth로 로그인
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Users 컬렉션에서 사용자 역할 확인
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        setError('사용자 정보가 존재하지 않습니다.');
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      const userData = userDocSnap.data();
      const expectedRole = accountType === 'guardian' ? '보호자' : '환자';
      
      if (userData.role !== expectedRole) {
        setError(`${expectedRole} 계정이 아닙니다.`);
        await auth.signOut();
        setLoading(false);
        return;
      }

      console.log(`${userData.role} 로그인 성공`);
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일입니다.');
      } else if (err.code === 'auth/user-not-found') {
        setError('등록되지 않은 계정입니다.');
      } else if (err.code === 'auth/wrong-password') {
        setError('잘못된 비밀번호입니다.');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
      console.error('로그인 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          {/* Infinity Logo SVG */}
          <svg 
            className="auth-infinity-logo" 
            viewBox="0 0 100 50" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M25 25 C25 15, 35 10, 45 15 C55 20, 55 30, 45 35 C35 40, 25 35, 25 25 M75 25 C75 35, 65 40, 55 35 C45 30, 45 20, 55 15 C65 10, 75 15, 75 25"
              fill="none"
              stroke="#41d17f"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h1>REMIND CALL</h1>
          <p>기억을 잇다, 마음을 잇다</p>
        </div>

        {/* 계정 타입 선택 */}
        <div className="account-type-selector">
          <button
            type="button"
            className={`account-type-btn ${accountType === 'guardian' ? 'active' : ''}`}
            onClick={() => setAccountType('guardian')}
            disabled={loading}
          >
            🔐 보호자 로그인
          </button>
          <button
            type="button"
            className={`account-type-btn ${accountType === 'patient' ? 'active' : ''}`}
            onClick={() => setAccountType('patient')}
            disabled={loading}
          >
            👤 환자 로그인
          </button>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>아이디</label>
            <input
              type="email"
              placeholder="이메일을 입력해주세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력해주세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="auth-footer">
          <div className="footer-links">
            <button
              type="button"
              className="switch-button"
              onClick={onSwitchToFindId}
              disabled={loading}
            >
              아이디 찾기
            </button>
            <span className="link-divider">|</span>
            <button
              type="button"
              className="switch-button"
              onClick={onSwitchToFindPassword}
              disabled={loading}
            >
              비밀번호 찾기
            </button>
            <span className="link-divider">|</span>
            <button
              type="button"
              className="switch-button"
              onClick={onSwitchToSignup}
              disabled={loading}
            >
              회원가입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
