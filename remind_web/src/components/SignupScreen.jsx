import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import './AuthScreen.css';

function SignupScreen({ onSwitchToLogin }) {
  // 보호자 정보
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPassword, setGuardianPassword] = useState('');
  const [guardianPasswordConfirm, setGuardianPasswordConfirm] = useState('');
  const [guardianName, setGuardianName] = useState('');
  
  // 환자 정보
  const [patientName, setPatientName] = useState('');
  const [patientBirthdate, setPatientBirthdate] = useState('');
  const [patientGender, setPatientGender] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (!patientBirthdate || !patientGender) {
      setError('환자 정보를 모두 입력해주세요.');
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

      // 3. 환자 계정 생성 (Firebase Auth)
      const patientEmail = `${guardianEmail.split('@')[0]}-patient@remind.local`;
      const patientPassword = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      
      const patientCredential = await createUserWithEmailAndPassword(auth, patientEmail, patientPassword);
      const patientUser = patientCredential.user;

      // 4. 환자 프로필 업데이트
      await updateProfile(patientUser, {
        displayName: patientName
      });

      // 5. Firestore에 보호자 정보 저장 (guardians 컬렉션)
      const guardianDocRef = doc(db, 'guardians', guardianUser.uid);
      await setDoc(guardianDocRef, {
        uid: guardianUser.uid,
        email: guardianEmail,
        name: guardianName,
        patientId: patientUser.uid,
        createdAt: new Date(),
        phoneNumber: '',
        relation: '보호자'
      });

      // 6. Firestore에 환자 정보 저장 (patients 컬렉션)
      const patientDocRef = doc(db, 'patients', patientUser.uid);
      await setDoc(patientDocRef, {
        uid: patientUser.uid,
        email: patientEmail,
        password: patientPassword, // 참고: 실제로는 저장하면 안 됨 (보안상)
        name: patientName,
        birthdate: patientBirthdate,
        gender: patientGender,
        guardianId: guardianUser.uid,
        createdAt: new Date(),
        // AI 통화 설정
        callTime: '03:00',
        // 통계 초기값
        cognitiveScore: 75
      });

      // 회원가입 성공
      console.log('보호자 회원가입 성공:', guardianUser.uid);
      console.log('환자 계정 자동 생성:', patientUser.uid);
      alert(`✅ 회원가입이 완료되었습니다!\n환자 계정도 자동으로 생성되었습니다.\n(로그인하시면 계정이 자동으로 전환됩니다)`);
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
          </div>

          {/* 환자 정보 섹션 */}
          <div className="form-section">
            <h3 className="section-subtitle">👤 환자 정보 (자동 생성)</h3>
            <p className="section-description">환자 계정이 자동으로 생성됩니다</p>
            
            <div className="form-group">
              <label>환자 이름</label>
              <input
                type="text"
                placeholder="환자 이름을 입력해주세요"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
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
                  className={`gender-btn ${patientGender === 'M' ? 'active' : ''}`}
                  onClick={() => setPatientGender('M')}
                  disabled={loading}
                >
                  남성
                </button>
                <button
                  type="button"
                  className={`gender-btn ${patientGender === 'F' ? 'active' : ''}`}
                  onClick={() => setPatientGender('F')}
                  disabled={loading}
                >
                  여성
                </button>
              </div>
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
