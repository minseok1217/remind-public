import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { generateVerificationCode, saveVerificationCode, verifyCode, formatPhoneNumber, validatePhoneNumber } from '../services/verificationService';
import './AuthScreen.css';
import './SignupScreen.css';
import backicon from '../assets/back_icon.png';
import usericon from '../assets/user_icon.png';
import plusicon from '../assets/plus_icon.png';
import infoicon from '../assets/info_icon.png';


function SignupScreen({ onSwitchToLogin }) {
  // 보호자 정보
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPassword, setGuardianPassword] = useState('');
  const [guardianPasswordConfirm, setGuardianPasswordConfirm] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhoneNumber, setGuardianPhoneNumber] = useState('');
  const [verificationStep, setVerificationStep] = useState('none'); // 'none', 'sending', 'verifying', 'verified'
  const [verificationCode, setVerificationCode] = useState('');
  const [inputVerificationCode, setInputVerificationCode] = useState('');

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendVerification = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validatePhoneNumber(guardianPhoneNumber)) {
      setError('유효한 전화번호를 입력해주세요. (010-1234-5678 형식)');
      return;
    }

    try {
      setLoading(true);
      const code = generateVerificationCode();
      saveVerificationCode(guardianPhoneNumber, code);
      setVerificationCode(code);
      setVerificationStep('verifying');
      
      // 실제 환경에서는 여기서 SMS API를 통해 code를 전송
      console.log(`인증번호 [${code}]를 ${guardianPhoneNumber}으로 전송했습니다.`);
      alert(`인증번호 [${code}]를 전송했습니다.\n(테스트: 인증번호를 입력해주세요)`);
    } catch (err) {
      setError('인증번호 전송에 실패했습니다.');
      console.error('인증번호 전송 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    setError('');
    
    if (!inputVerificationCode) {
      setError('인증번호를 입력해주세요.');
      return;
    }

    const result = verifyCode(guardianPhoneNumber, inputVerificationCode);
    if (result.success) {
      setVerificationStep('verified');
      setError('');
    } else {
      setError(result.message);
    }
  };

  const handleResendCode = (e) => {
    e.preventDefault();
    setInputVerificationCode('');
    handleSendVerification(e);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 유효성 검사
    if (guardianPassword !== guardianPasswordConfirm) {
      setError('보호자 비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (guardianPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    if (!guardianName.trim()) {
      setError('이름을 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (verificationStep !== 'verified') {
      setError('전화번호 인증을 완료해주세요.');
      setLoading(false);
      return;
    }

    if (!agreeTerms) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      setLoading(false);
      return;
    }

    try {
      // 1. 보호자 계정 생성 (Firebase Auth)
      const guardianCredential = await createUserWithEmailAndPassword(auth, guardianEmail, guardianPassword);
      const guardianUser = guardianCredential.user;

      // 2. 보호자 프로필 업데이트
      await updateProfile(guardianUser, {
        displayName: guardianName
      });

      // ========== 새로운 DB 구조 ==========
      
      // 3. Users 컬렉션에 보호자 정보 저장
      const guardianUserDocRef = doc(db, 'users', guardianUser.uid);
      await setDoc(guardianUserDocRef, {
        user_id: guardianUser.uid,
        login_id: guardianEmail,
        name: guardianName,
        phone_number: guardianPhoneNumber,
        role: '보호자',
        created_at: new Date(),
        notification_enabled: true,
        personal_information: agreeTerms
      });

      // 4. Guardians 컬렉션에 보호자 추가 정보 저장
      const guardianDocRef = doc(db, 'guardians', guardianUser.uid);
      await setDoc(guardianDocRef, {
        user_id: guardianUser.uid,
        relationship: '보호자',
        patient_id: null
      });
      
      // 현재 로그인된 계정 로그아웃
      await auth.signOut();
      
      alert('✅ 회원가입이 완료되었습니다!\n로그인 화면에서 로그인해주세요.');
      
      // 로그인 화면으로 이동
      onSwitchToLogin();
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setError('유효하지 않은 이메일입니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호가 너무 약합니다.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
      console.error('회원가입 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-header">
        <div className="header-content">
          <button type="button" className="back-ic-button" onClick={onSwitchToLogin}>
            <img className="icon" src={backicon} alt="뒤로가기 아이콘" />
          </button>
          <h1 className="header-title">회원가입</h1>
        </div>
      </div>

      <form className="signup-content" onSubmit={handleSignup}>
        {/* 보호자 정보 섹션 */}
        <section>
          <div className="sign-section-header">
            <div className="section-icon">
              <img className="icon-small" src={usericon} alt="유저 아이콘" />
            </div>
            <h3 className="sign-section-title">보호자 정보</h3>
          </div>
            
          <div className="form-fields">
            <div className="form-field">
              <label className="field-label" htmlFor="guardianName">이름</label>
              <input
                type="text"
                placeholder="보호자 이름을 입력해주세요"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                disabled={loading}
                className="input-field"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="guardianId">이메일</label>
              <input
                type="email"
                placeholder="이메일을 입력해주세요"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                disabled={loading}
                className="input-field"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="guardianPassword">비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호를 입력해주세요"
                value={guardianPassword}
                onChange={(e) => setGuardianPassword(e.target.value)}
                disabled={loading}
                className="input-field"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="guardianPassword">비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호를 다시 입력해주세요"
                value={guardianPasswordConfirm}
                onChange={(e) => setGuardianPasswordConfirm(e.target.value)}
                disabled={loading}
                className="input-field"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="guardianPhone">전화번호</label>
              <div className="phone-verification-group">
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={guardianPhoneNumber}
                  onChange={(e) => setGuardianPhoneNumber(formatPhoneNumber(e.target.value))}
                  disabled={loading || verificationStep !== 'none'}
                  className="input-field"
                  required
                />
                {verificationStep === 'none' && (
                  <button
                    type="button"
                    className="verification-btn"
                    onClick={handleSendVerification}
                    disabled={loading || !guardianPhoneNumber}
                  >
                    {loading ? '전송 중...' : '인증 요청'}
                  </button>
                )}
              </div>
            </div>

            {verificationStep === 'verifying' && (
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
            )}

            {verificationStep === 'verified' && (
              <div className="verification-success">
                ✅ 전화번호가 인증되었습니다.
              </div>
            )}
          </div>
        </section>

        <div className="sign-terms-checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              disabled={loading}
            />
            <span className="checkbox-text">
              개인정보 수집 및 이용, 환자 정보 제공 서비스 이용 약관에 동의합니다. (필수)
            </span>
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="common-button"
          disabled={loading}
        >
          <span className='common-button-text'>
            {loading ? '회원가입 중...' : '회원가입'}
          </span>
        </button>
      </form>

      <p class="login-link">
        이미 계정이 있으신가요?{' '}
        <button
          type="button"
          className="switch-button"
          onClick={onSwitchToLogin}
          disabled={loading}
        >
          로그인
        </button>
      </p>
    </div>
  );
}

export default SignupScreen;
