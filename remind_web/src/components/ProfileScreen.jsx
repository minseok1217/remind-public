import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import './ProfileScreen.css';

function ProfileScreen({ currentUser, onBack }) {
  const [guardianData, setGuardianData] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });

  const [patientData, setPatientData] = useState({
    name: '',
    birthdate: '',
    gender: ''
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editGuardianData, setEditGuardianData] = useState(guardianData);
  const [editPatientData, setEditPatientData] = useState(patientData);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState('guardian'); // 'guardian' or 'patient'

  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  const loadUserData = async () => {
    try {
      // 현재 사용자가 보호자인지 환자인지 확인
      const guardianDocRef = doc(db, 'guardians', currentUser.uid);
      const guardianDocSnap = await getDoc(guardianDocRef);

      if (guardianDocSnap.exists()) {
        // 보호자 계정
        setUserType('guardian');
        const gData = guardianDocSnap.data();
        setGuardianData({
          name: gData.name || '',
          email: gData.email || '',
          phoneNumber: gData.phoneNumber || ''
        });
        setEditGuardianData({
          name: gData.name || '',
          email: gData.email || '',
          phoneNumber: gData.phoneNumber || ''
        });

        // 환자 정보 로드
        if (gData.patientId) {
          const patientDocRef = doc(db, 'patients', gData.patientId);
          const patientDocSnap = await getDoc(patientDocRef);
          if (patientDocSnap.exists()) {
            const pData = patientDocSnap.data();
            setPatientData({
              name: pData.name || '',
              birthdate: pData.birthdate || '',
              gender: pData.gender || ''
            });
            setEditPatientData({
              name: pData.name || '',
              birthdate: pData.birthdate || '',
              gender: pData.gender || ''
            });
          }
        }
      } else {
        // 환자 계정
        setUserType('patient');
        const patientDocRef = doc(db, 'patients', currentUser.uid);
        const patientDocSnap = await getDoc(patientDocRef);
        if (patientDocSnap.exists()) {
          const pData = patientDocSnap.data();
          setPatientData({
            name: pData.name || '',
            birthdate: pData.birthdate || '',
            gender: pData.gender || ''
          });
          setEditPatientData({
            name: pData.name || '',
            birthdate: pData.birthdate || '',
            gender: pData.gender || ''
          });
        }
      }
    } catch (error) {
      console.error('사용자 정보 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditGuardianData(guardianData);
    setEditPatientData(patientData);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditGuardianData(guardianData);
    setEditPatientData(patientData);
  };

  const handleGuardianInputChange = (field, value) => {
    setEditGuardianData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePatientInputChange = (field, value) => {
    setEditPatientData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (userType === 'guardian') {
        // 보호자 정보 저장
        const guardianDocRef = doc(db, 'guardians', currentUser.uid);
        await updateDoc(guardianDocRef, {
          name: editGuardianData.name,
          phoneNumber: editGuardianData.phoneNumber
        });

        // 환자 정보 저장 (보호자가 수정한 환자 정보)
        const guardianDocSnap = await getDoc(guardianDocRef);
        if (guardianDocSnap.data().patientId) {
          const patientDocRef = doc(db, 'patients', guardianDocSnap.data().patientId);
          await updateDoc(patientDocRef, {
            name: editPatientData.name,
            birthdate: editPatientData.birthdate,
            gender: editPatientData.gender
          });
        }
      } else {
        // 환자 정보만 저장
        const patientDocRef = doc(db, 'patients', currentUser.uid);
        await updateDoc(patientDocRef, {
          name: editPatientData.name,
          birthdate: editPatientData.birthdate,
          gender: editPatientData.gender
        });
      }

      setGuardianData(editGuardianData);
      setPatientData(editPatientData);
      setIsEditing(false);
      alert('✅ 정보가 저장되었습니다.');
    } catch (error) {
      console.error('저장 실패:', error);
      alert('❌ 저장 실패: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-screen">
      <div className="header-with-back">
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <h1>계정 관리 및 설정</h1>
      </div>

      {loading ? (
        <div className="loading-message">로딩 중...</div>
      ) : userType === 'guardian' ? (
        <>
          {/* 보호자 정보 섹션 */}
          <div className="section">
            <h2 className="section-title">📋 보호자 정보 (본인)</h2>
            
            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">👤</span>
                  <span>이름</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editGuardianData.name}
                    onChange={(e) => handleGuardianInputChange('name', e.target.value)}
                    className="info-input"
                  />
                ) : (
                  <div className="info-value">{guardianData.name || '미입력'}</div>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">✉️</span>
                  <span>이메일</span>
                </div>
                <div className="info-value">{guardianData.email}</div>
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">☎️</span>
                  <span>전화번호</span>
                </div>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editGuardianData.phoneNumber}
                    onChange={(e) => handleGuardianInputChange('phoneNumber', e.target.value)}
                    className="info-input"
                    placeholder="010-0000-0000"
                  />
                ) : (
                  <div className="info-value">{guardianData.phoneNumber || '미입력'}</div>
                )}
              </div>
            </div>
          </div>

          {/* 환자 정보 섹션 */}
          <div className="section">
            <h2 className="section-title">👤 환자 정보</h2>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">👤</span>
                  <span>환자 이름</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editPatientData.name}
                    onChange={(e) => handlePatientInputChange('name', e.target.value)}
                    className="info-input"
                  />
                ) : (
                  <div className="info-value">{patientData.name || '미입력'}</div>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">📅</span>
                  <span>생년월일</span>
                </div>
                {isEditing ? (
                  <input
                    type="date"
                    value={editPatientData.birthdate}
                    onChange={(e) => handlePatientInputChange('birthdate', e.target.value)}
                    className="info-input"
                  />
                ) : (
                  <div className="info-value">{patientData.birthdate || '미입력'}</div>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">👥</span>
                  <span>성별</span>
                </div>
                {isEditing ? (
                  <div className="gender-selector">
                    <button
                      type="button"
                      className={`gender-btn ${editPatientData.gender === 'M' ? 'active' : ''}`}
                      onClick={() => handlePatientInputChange('gender', 'M')}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      className={`gender-btn ${editPatientData.gender === 'F' ? 'active' : ''}`}
                      onClick={() => handlePatientInputChange('gender', 'F')}
                    >
                      여성
                    </button>
                  </div>
                ) : (
                  <div className="info-value">{patientData.gender === 'M' ? '남성' : patientData.gender === 'F' ? '여성' : '미입력'}</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 환자 정보 섹션 (환자가 접속했을 때) */}
          <div className="section">
            <h2 className="section-title">👤 내 정보</h2>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">👤</span>
                  <span>이름</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editPatientData.name}
                    onChange={(e) => handlePatientInputChange('name', e.target.value)}
                    className="info-input"
                  />
                ) : (
                  <div className="info-value">{patientData.name || '미입력'}</div>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">📅</span>
                  <span>생년월일</span>
                </div>
                {isEditing ? (
                  <input
                    type="date"
                    value={editPatientData.birthdate}
                    onChange={(e) => handlePatientInputChange('birthdate', e.target.value)}
                    className="info-input"
                  />
                ) : (
                  <div className="info-value">{patientData.birthdate || '미입력'}</div>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-row">
                <div className="info-label">
                  <span className="icon">👥</span>
                  <span>성별</span>
                </div>
                {isEditing ? (
                  <div className="gender-selector">
                    <button
                      type="button"
                      className={`gender-btn ${editPatientData.gender === 'M' ? 'active' : ''}`}
                      onClick={() => handlePatientInputChange('gender', 'M')}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      className={`gender-btn ${editPatientData.gender === 'F' ? 'active' : ''}`}
                      onClick={() => handlePatientInputChange('gender', 'F')}
                    >
                      여성
                    </button>
                  </div>
                ) : (
                  <div className="info-value">{patientData.gender === 'M' ? '남성' : patientData.gender === 'F' ? '여성' : '미입력'}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Action Button */}
      <div className="action-section">
        {!isEditing ? (
          <button 
            className="action-button"
            onClick={handleEditClick}
          >
            수정 하기
          </button>
        ) : (
          <div className="action-buttons">
            <button 
              className="action-button save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장 하기'}
            </button>
            <button 
              className="action-button cancel-btn"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileScreen;
