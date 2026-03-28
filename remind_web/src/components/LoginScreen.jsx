import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './LoginScreen.css'; // AuthScreen.css 대신 LoginScreen.css 임포트
import logo from '../assets/logo.png'; 

function LoginScreen({ onSwitchToSignup, onSwitchToFindId, onSwitchToFindPassword }) {
  const [accountType, setAccountType] = useState('guardian'); // 'guardian' or 'patient'
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedLoginId = loginId.trim();
      if (!normalizedLoginId) {
        setError('아이디를 입력해주세요.');
        setLoading(false);
        return;
      }

      let signInEmail = normalizedLoginId;

      if (accountType === 'guardian') {
        if (!normalizedLoginId.includes('@')) {
          setError('보호자는 이메일 형식으로 입력해주세요.');
          setLoading(false);
          return;
        }
      } else {
        // 환자는 아이디만 입력해도 로그인 가능하도록 변환
        if (!normalizedLoginId.includes('@')) {
          signInEmail = `${normalizedLoginId}@patient.app`;
        }
      }

      // Firebase Auth로 로그인
      const userCredential = await signInWithEmailAndPassword(auth, signInEmail, password);
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
        setError(accountType === 'guardian' ? '유효하지 않은 이메일입니다.' : '환자용 아이디 또는 이메일 형식이 올바르지 않습니다.');
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
    <div className="login-auth-screen">
      <div className="login-auth-container">
        <div className="login-auth-header">
          <img className="login-logo-img" src={logo} alt="REMIND CALL 로고" />
          <p className="login-text-wrapper">기억을 잇다, 마음을 잇다</p>
        </div>

        {/* 계정 타입 선택 */}
        <div className="login-account-type-selector">
          <button
            type="button"
            className={`account-type-btn ${accountType === 'guardian' ? 'active' : ''}`}
            onClick={() => setAccountType('guardian')}
            disabled={loading}
          >
            보호자 로그인
          </button>
          <button
            type="button"
            className={`account-type-btn ${accountType === 'patient' ? 'active' : ''}`}
            onClick={() => setAccountType('patient')}
            disabled={loading}
          >
            환자 로그인
          </button>
        </div>

        <section className="login-frame">
          <form className="login-auth-form" onSubmit={handleLogin} noValidate>
            <div className="login-frame-input">
              <div className="login-form-group">
                <label className="login-text-wrapper-2">{accountType === 'guardian' ? '아이디(이메일)' : '환자용 아이디'}</label>
                <div className="common-input-box">
                  <input
                    type={accountType === 'guardian' ? 'email' : 'text'}
                    className="common-input-text"
                    placeholder={accountType === 'guardian' ? '이메일을 입력해주세요' : '환자용 아이디를 입력해주세요'}
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="login-form-group">
                <label className="login-text-wrapper-2">비밀번호</label>
                <div className="common-input-box">
                  <input
                    type="password"
                    className="common-input-text"
                    placeholder="비밀번호를 입력해주세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="common-button"
              disabled={loading}
            >
              <span className="common-button-text">
                {loading ? '로그인 중...' : '로그인'}
              </span>
            </button>
          </form>

          <div className="login-auth-footer">
            <div className="login-footer-links">
              <button
                type="button"
                className="login-switch-button"
                onClick={onSwitchToFindId}
                disabled={loading}
              >
                <p>아이디 찾기</p>
              </button>
              <span className="login-link-divider">ㅣ</span>
              <button
                type="button"
                className="login-switch-button"
                onClick={onSwitchToFindPassword}
                disabled={loading}
              >
                <p>비밀번호 찾기</p>
              </button>
              <span className="login-link-divider">ㅣ</span>
              <button
                type="button"
                className="login-switch-button"
                onClick={onSwitchToSignup}
                disabled={loading}
              >
                <p>회원가입</p>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LoginScreen;
