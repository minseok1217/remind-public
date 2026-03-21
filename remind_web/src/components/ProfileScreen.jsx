import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import './ProfileScreen.css';
import user_icon from '../assets/user_icon.png';
import call_icon from '../assets/call_icon.png';
import time_icon from '../assets/time_icon.png';
import date_icon from '../assets/date_icon.png';

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
      console.log('[ProfileScreen] 현재 사용자 UID:', currentUser.uid);
      
      // Users 컬렉션에서 역할 확인
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      console.log('[ProfileScreen] users 문서 존재:', userDocSnap.exists());

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log('[ProfileScreen] 사용자 역할:', userData.role);
        
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
          console.log('[ProfileScreen] family_links 쿼리 실행: guardian_id ==', currentUser.uid);
          const familySnapshot = await getDocs(familyQuery);
          console.log('[ProfileScreen] family_links 결과 개수:', familySnapshot.size);
          
          if (!familySnapshot.empty) {
            const linkData = familySnapshot.docs[0].data();
            console.log('[ProfileScreen] 가족 연결 데이터:', linkData);
            setFamilyLink(linkData);
            
            const patientUserId = linkData.patient_id;
            console.log('[ProfileScreen] 연결된 환자 ID:', patientUserId);
            
            // 환자 Users 정보
            const patientUserRef = doc(db, 'users', patientUserId);
            const patientUserSnap = await getDoc(patientUserRef);
            console.log('[ProfileScreen] 환자 users 문서 존재:', patientUserSnap.exists());
            
            // 환자 Patients 정보
            const patientDocRef = doc(db, 'patients', patientUserId);
            const patientDocSnap = await getDoc(patientDocRef);
            console.log('[ProfileScreen] 환자 patients 문서 존재:', patientDocSnap.exists());
            
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
      <div className="header-content">
        <h1 className="header-title">계정 관리 및 설정</h1>
      </div>
      <div className="header-diver"></div>

      {loading ? (
        <div className="loading-message">로딩 중...</div>
      ) : 
        <>
          {/* 보호자 정보 섹션 */}
          <section className="profile-section">
            <h2 className="profile-section-title">본인 정보</h2>
            <div className="profile-cards-container">
              <div className="profile-info-card">
                <div className="icon-circle">
                  <img src={user_icon} className="icon-circle-small-img" />
                </div>
                <div className="profile-info-content">
                  <div className="profile-info-label">이름</div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editGuardianData.name}
                      onChange={(e) => handleGuardianInputChange('name', e.target.value)}
                      className="profile-info-input"
                    />
                  ) : (
                    <div className="profile-info-value">{guardianData.name || '미입력'}</div>
                  )}
                </div>
              </div>

              <div className="profile-info-card">
                <div className="icon-circle">
                  <img src={user_icon} className="icon-circle-small-img" />
                </div>
                <div className="profile-info-content">
                  <div className="profile-info-label">이메일</div>
                  <div className="profile-info-value">{guardianData.email}</div>
                </div>
              </div>

              <div className="profile-info-card">
                <div className="icon-circle">
                  <img src={call_icon} className="icon-circle-img" />
                </div>
                <div className="profile-info-content">
                  <div className="profile-info-label">전화번호</div>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editGuardianData.phoneNumber}
                      onChange={(e) => handleGuardianInputChange('phoneNumber', e.target.value)}
                      className="profile-info-input"
                      placeholder="010-0000-0000"
                    />
                  ) : (
                    <div className="profile-info-value">{guardianData.phoneNumber || '미입력'}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* AI 통화 설정 */}
          <section class="profile-section">
            <h2 class="profile-section-title">AI 통화 설정</h2>
            <div class="profile-ai-card">
              <div class="icon-circle">
                <img src={time_icon} className="icon-circle-img" />
              </div>
              <div class="profile-ai-content">
                <div class="profile-ai-text">
                  <h3 class="profile-ai-title">통화 시간</h3>
                  <p class="profile-ai-description">매일 AI가 설정한 시간에 전화를 드립니다.</p>
                </div>
                <div class="profile-time-selector">
                  <button class="profile-time-button" id="timeButton">
                    <span id="selectedTime">02:00 PM</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 환자 정보 섹션 */}
          <section class="profile-section">
            <h2 class="profile-section-title">환자 정보</h2>
            <div class="profile-cards-container">
              <div class="profile-info-card">
                <div class="icon-circle">
                  <img src={user_icon} className="icon-circle-small-img" />
                </div>
                <div class="profile-info-content">
                  <div class="profile-info-label">성명</div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editPatientData.name}
                      onChange={(e) => handlePatientInputChange('name', e.target.value)}
                      className="profile-info-input"
                    />
                  ) : (
                    <div className="profile-info-value">{patientData.name || '미입력'}</div>
                  )}
                </div>
              </div>

              <div class="profile-info-card">
                <div class="icon-circle">
                  <img src={date_icon} className="icon-circle-img" />
                </div>
                <div class="profile-info-content">
                  <div class="profile-info-label">생년월일</div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editPatientData.birthdate}
                      onChange={(e) => handlePatientInputChange('birthdate', e.target.value)}
                      className="profile-info-input"
                    />
                  ) : (
                    <div className="profile-info-value">{patientData.birthdate || '미입력'}</div>
                  )}
                </div>
              </div>

              <div class="profile-info-card">
                <div class="icon-circle">
                  <img src={call_icon} className="icon-circle-img" />
                </div>
                <div class="profile-info-content">
                  <div class="profile-info-label">전화번호</div>
                  <div class="profile-info-value">010-2222-2222</div>
                </div>
              </div>
            </div>
          </section>
        </>
        }

      {/* Action Button */}
      <div className="profile-action-section">
        {!isEditing ? (
          <>
            <button 
              className="profile-action-button"
              onClick={handleEditClick}
            >
              수정 하기
            </button>
            <button 
              className="profile-action-button logout-btn"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <button 
              className="profile-action-button save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? '저장 중...' : '저장 하기'}
            </button>
            <button 
              className="profile-action-button cancel-btn"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfileScreen;
