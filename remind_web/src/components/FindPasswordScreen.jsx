import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { generateVerificationCode, saveVerificationCode, verifyCode, formatPhoneNumber, validatePhoneNumber } from '../services/verificationService';
import './AuthScreen.css';

function FindPasswordScreen({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [verificationStep, setVerificationStep] = useState('none'); // 'none', 'verifying', 'reset'
  const [verificationCode, setVerificationCode] = useState('');
  const [inputVerificationCode, setInputVerificationCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSendVerification = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('유효한 전화번호를 입력해주세요. (010-1234-5678 형식)');
      return;
    }

    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);

      // Firestore에서 해당 정보로 계정 검색
      const guardiansRef = collection(db, 'guardians');
      const q = query(
        guardiansRef,
        where('phoneNumber', '==', phoneNumber),
        where('name', '==', name),
        where('email', '==', email)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('일치하는 계정을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      const code = generateVerificationCode();
      saveVerificationCode(phoneNumber, code);
      setVerificationCode(code);
      setResetEmail(email);
      setVerificationStep('verifying');

      console.log(`인증번호 [${code}]를 ${phoneNumber}으로 전송했습니다.`);
      alert(`인증번호 [${code}]를 전송했습니다.\n(테스트: 인증번호를 입력해주세요)`);
    } catch (err) {
      setError('인증번호 전송에 실패했습니다.');
      console.error('인증번호 전송 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');

    if (!inputVerificationCode) {
      setError('인증번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const result = verifyCode(phoneNumber, inputVerificationCode);

      if (result.success) {
        // 비밀번호 초기화 이메일 전송
        await sendPasswordResetEmail(auth, resetEmail);
        setResetSent(true);
        setVerificationStep('reset');
      } else {
        setError(result.message);
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('등록되지 않은 이메일입니다.');
      } else {
        setError('비밀번호 초기화 이메일 전송에 실패했습니다.');
      }
      console.error('비밀번호 초기화 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = (e) => {
    e.preventDefault();
    setInputVerificationCode('');
    handleSendVerification(e);
  };

  const handleBackToForm = () => {
    setVerificationStep('none');
    setEmail('');
    setPhoneNumber('');
    setName('');
    setInputVerificationCode('');
    setError('');
    setResetSent(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <h1>계정 정보 찾기</h1>
        </div>

        {/* 탭 선택 */}
        <div className="tab-selector">
          <button
            type="button"
            className="tab-button"
            onClick={onSwitchToLogin}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            className="tab-button active"
            disabled
          >
            비밀번호 찾기
          </button>
        </div>

        {verificationStep === 'none' && (
          <form className="auth-form" onSubmit={handleSendVerification}>
            <div className="form-group">
              <label>이름</label>
              <input
                type="text"
                placeholder="보호자 이름을 입력해주세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>아이디 (이메일)</label>
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
              <label>전화번호</label>
              <input
                type="tel"
                placeholder="010-1234-5678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                disabled={loading}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="auth-button"
              disabled={loading || !name.trim() || !email.trim() || !phoneNumber}
            >
              {loading ? '인증번호 전송 중...' : '인증번호 받기'}
            </button>
          </form>
        )}

        {verificationStep === 'verifying' && (
          <form className="auth-form" onSubmit={handleVerifyCode}>
            <div className="form-group verification-input">
              <label>인증번호 (6자리)</label>
              <div className="code-input-group">
                <input
                  type="text"
                  placeholder="인증번호를 입력해주세요"
                  value={inputVerificationCode}
                  onChange={(e) => setInputVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  className="verification-check-btn"
                  onClick={handleVerifyCode}
                  disabled={loading || inputVerificationCode.length !== 6}
                >
                  {loading ? '확인 중...' : '확인'}
                </button>
              </div>
              <button
                type="button"
                className="resend-btn"
                onClick={handleResendCode}
                disabled={loading}
              >
                재전송
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
          </form>
        )}

        {verificationStep === 'reset' && resetSent && (
          <div className="auth-form result-container">
            <div className="result-message success">
              ✅ 비밀번호 초기화 링크가 전송되었습니다!
            </div>
            <div className="result-description">
              <p>입력하신 이메일 ({resetEmail})로</p>
              <p>비밀번호 초기화 링크가 전송되었습니다.</p>
              <p>이메일의 링크를 클릭하여 새로운 비밀번호를 설정해주세요.</p>
            </div>
            <button
              type="button"
              className="auth-button"
              onClick={onSwitchToLogin}
            >
              로그인하기
            </button>
          </div>
        )}

        <div className="auth-footer">
          <p>
            <button
              type="button"
              className="switch-button"
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              ← 로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default FindPasswordScreen;
