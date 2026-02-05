import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import './ProfileScreen.css';

function ProfileScreen({ currentUser, onBack, onLogout }) {
  const [guardianData, setGuardianData] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });

  const [patientData, setPatientData] = useState({
    name: '',
    birthdate: '',
    gender: '',
    phoneNumber: ''
  });
  
  const [familyLink, setFamilyLink] = useState(null); // 가족 연결 정보
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
      // Users 컬렉션에서 역할 확인
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        if (userData.role === '보호자') {
          // 보호자 계정
          setUserType('guardian');
          setGuardianData({
            name: userData.name || '',
            email: userData.login_id || '',
            phoneNumber: userData.phone_number || ''
          });
          setEditGuardianData({
            name: userData.name || '',
            email: userData.login_id || '',
            phoneNumber: userData.phone_number || ''
          });

          // FamilyLinks에서 연결된 환자 찾기
          const familyLinksRef = collection(db, 'family_links');
          const familyQuery = query(familyLinksRef, where('guardian_id', '==', currentUser.uid));
          const familySnapshot = await getDocs(familyQuery);
          
          if (!familySnapshot.empty) {
            const linkData = familySnapshot.docs[0].data();
            setFamilyLink(linkData);
            
            const patientUserId = linkData.patient_id;
            
            // 환자 Users 정보
            const patientUserRef = doc(db, 'users', patientUserId);
            const patientUserSnap = await getDoc(patientUserRef);
            
            // 환자 Patients 정보
            const patientDocRef = doc(db, 'patients', patientUserId);
            const patientDocSnap = await getDoc(patientDocRef);
            
            if (patientUserSnap.exists()) {
              const pUserData = patientUserSnap.data();
              const pData = patientDocSnap.exists() ? patientDocSnap.data() : {};
              setPatientData({
                name: pUserData.name || '',
                birthdate: pData.birth_date || '',
                gender: pData.gender || '',
                phoneNumber: pUserData.phone_number || ''
              });
              setEditPatientData({
                name: pUserData.name || '',
                birthdate: pData.birth_date || '',
                gender: pData.gender || '',
                phoneNumber: pUserData.phone_number || ''
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
              name: userData.name || '',
              birthdate: pData.birth_date || '',
              gender: pData.gender || '',
              phoneNumber: userData.phone_number || ''
            });
            setEditPatientData({
              name: userData.name || '',
              birthdate: pData.birth_date || '',
              gender: pData.gender || '',
              phoneNumber: userData.phone_number || ''
            });
          }
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

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      try {
        await signOut(auth);
        if (onLogout) {
          onLogout();
        }
      } catch (error) {
        console.error('로그아웃 실패:', error);
        alert('로그아웃 실패: ' + error.message);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (userType === 'guardian') {
        // Users 컬렉션의 보호자 정보 저장
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          name: editGuardianData.name,
          phone_number: editGuardianData.phoneNumber
        });

        // 환자 정보 저장 (보호자가 수정한 환자 정보)
        const guardianDocRef = doc(db, 'guardians', currentUser.uid);
        const guardianDocSnap = await getDoc(guardianDocRef);
        
        if (guardianDocSnap.data().patient_id) {
          const patientUserId = guardianDocSnap.data().patient_id;
          
          // Users 컬렉션의 환자 정보 업데이트
          const patientUserRef = doc(db, 'users', patientUserId);
          await updateDoc(patientUserRef, {
            name: editPatientData.name
          });
          
          // Patients 컬렉션의 환자 정보 업데이트
          const patientDocRef = doc(db, 'patients', patientUserId);
          await updateDoc(patientDocRef, {
            birth_date: editPatientData.birthdate,
            gender: editPatientData.gender
          });
        }
      } else {
        // 환자 정보만 저장
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          name: editPatientData.name
        });
        
        const patientDocRef = doc(db, 'patients', currentUser.uid);
        await updateDoc(patientDocRef, {
          birth_date: editPatientData.birthdate,
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
        <button className="back-button" onClick={onBack} title="뒤로가기">←</button>
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
          <>
            <button 
              className="action-button"
              onClick={handleEditClick}
            >
              수정 하기
            </button>
            <button 
              className="action-button logout-btn"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </>
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
