import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { generateVerificationCode, saveVerificationCode, verifyCode, formatPhoneNumber, validatePhoneNumber } from '../services/verificationService';
import './AuthScreen.css';

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
  
  // 환자 정보
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientBirthdate, setPatientBirthdate] = useState('');
  const [patientGender, setPatientGender] = useState('남성');
  const [patientId, setPatientId] = useState('');
  const [patientPassword, setPatientPassword] = useState('');
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

    if (!guardianName.trim() || !patientName.trim()) {
      setError('이름을 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (verificationStep !== 'verified') {
      setError('전화번호 인증을 완료해주세요.');
      setLoading(false);
      return;
    }

    if (!patientBirthdate || !patientGender) {
      setError('환자 정보를 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!patientId.trim() || !patientPassword.trim()) {
      setError('환자용 아이디와 비밀번호를 입력해주세요.');
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

      // 3. 환자 계정 생성 (Firebase Auth) - 유효한 이메일 형식 사용
      const patientEmail = `${patientId}@patient.app`;
      
      const patientCredential = await createUserWithEmailAndPassword(auth, patientEmail, patientPassword);
      const patientUser = patientCredential.user;

      // 4. 환자 프로필 업데이트
      await updateProfile(patientUser, {
        displayName: patientName
      });

      // ========== 새로운 DB 구조 ==========
      
      // 5. Users 컬렉션에 보호자 정보 저장
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

      // 6. Users 컬렉션에 환자 정보 저장
      const patientUserDocRef = doc(db, 'users', patientUser.uid);
      await setDoc(patientUserDocRef, {
        user_id: patientUser.uid,
        login_id: patientId,
        name: patientName,
        phone_number: patientPhone,
        role: '환자',
        created_at: new Date(),
        notification_enabled: true,
        personal_information: agreeTerms
      });

      // 7. Guardians 컬렉션에 보호자 추가 정보 저장
      const guardianDocRef = doc(db, 'guardians', guardianUser.uid);
      await setDoc(guardianDocRef, {
        user_id: guardianUser.uid,
        relationship: '보호자',
        patient_id: patientUser.uid
      });

      // 8. Patients 컬렉션에 환자 추가 정보 저장
      const patientDocRef = doc(db, 'patients', patientUser.uid);
      await setDoc(patientDocRef, {
        user_id: patientUser.uid,
        birth_date: patientBirthdate,
        gender: patientGender,
        guardian_id: guardianUser.uid
      });

      // 9. FamilyLinks 컬렉션에 가족 연결 정보 저장
      const linkId = `${guardianUser.uid}_${patientUser.uid}`;
      const familyLinkDocRef = doc(db, 'family_links', linkId);
      await setDoc(familyLinkDocRef, {
        link_id: linkId,
        patient_id: patientUser.uid,
        guardian_id: guardianUser.uid,
        status: '연결됨',
        created_at: new Date()
      });

      // 회원가입 성공 - 로그아웃 후 로그인 화면으로
      console.log('보호자 회원가입 성공:', guardianUser.uid);
      console.log('환자 계정 자동 생성:', patientUser.uid);
      
      // 현재 로그인된 계정 로그아웃
      await auth.signOut();
      
      alert('✅ 회원가입이 완료되었습니다!\n환자 계정도 자동으로 생성되었습니다.\n로그인 화면에서 로그인해주세요.');
      
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
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <h1>REMIND CALL</h1>
          <p>건강한 뇌, 행복을 찾다</p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          {/* 보호자 정보 섹션 */}
          <div className="form-section">
            <h3 className="section-subtitle">📋 보호자 정보</h3>
            
            <div className="form-group">
              <label>보호자 이름</label>
              <input
                type="text"
                placeholder="보호자 이름을 입력해주세요"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>아이디 (이메일)</label>
              <input
                type="email"
                placeholder="이메일을 입력해주세요"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호를 입력해주세요"
                value={guardianPassword}
                onChange={(e) => setGuardianPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>비밀번호 확인</label>
              <input
                type="password"
                placeholder="비밀번호를 다시 입력해주세요"
                value={guardianPasswordConfirm}
                onChange={(e) => setGuardianPasswordConfirm(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>전화번호</label>
              <div className="phone-verification-group">
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={guardianPhoneNumber}
                  onChange={(e) => setGuardianPhoneNumber(formatPhoneNumber(e.target.value))}
                  disabled={loading || verificationStep !== 'none'}
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

          {/* 환자 정보 섹션 */}
          <div className="form-section patient-section">
            <h3 className="section-subtitle">➕ 환자 정보</h3>
            <div className="info-box">
              <span className="info-icon">ℹ️</span>
              <p>가입 완료 시, 입력하신 환자 정보로 <strong>환자 전용 계정</strong>이 자동 생성됩니다.</p>
            </div>
            
            <div className="form-group">
              <label>환자 이름</label>
              <input
                type="text"
                placeholder="환자 성함을 입력하세요"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>환자 전화번호</label>
              <input
                type="tel"
                placeholder="환자 전화번호를 입력하세요"
                value={patientPhone}
                onChange={(e) => setPatientPhone(formatPhoneNumber(e.target.value))}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>생년월일</label>
              <input
                type="date"
                value={patientBirthdate}
                onChange={(e) => setPatientBirthdate(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>성별</label>
              <div className="gender-selector">
                <button
                  type="button"
                  className={`gender-btn ${patientGender === '남성' ? 'active' : ''}`}
                  onClick={() => setPatientGender('남성')}
                  disabled={loading}
                >
                  남성
                </button>
                <button
                  type="button"
                  className={`gender-btn ${patientGender === '여성' ? 'active' : ''}`}
                  onClick={() => setPatientGender('여성')}
                  disabled={loading}
                >
                  여성
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>환자용 아이디</label>
              <input
                type="text"
                placeholder="아이디를 입력하세요"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>환자용 비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={patientPassword}
                onChange={(e) => setPatientPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="terms-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  disabled={loading}
                />
                <span className="checkbox-text">
                  개인정보 수집 및 이용, 환자 정보 제공 서비스 이용 약관에 동의합니다. <strong>(필수)</strong>
                </span>
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
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
      </div>
    </div>
  );
}

export default SignupScreen;
