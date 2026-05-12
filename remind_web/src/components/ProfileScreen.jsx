import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signOut, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { updatePatientConnectionStatus, verifyAndLinkGuardian } from '../services/familyLinkService';
import { getPatientNotificationTokens, sendPushNotificationToTokens } from '../services/notificationService';
import './ProfileScreen.css';
import user_icon from '../assets/user_icon.png';
import call_icon from '../assets/call_icon.png';
import time_icon from '../assets/time_icon.png';
import email_icon from '../assets/email_icon.png';
import plus_icon from '../assets/plus_icon.png';
import trash_icon from '../assets/trash_icon.png';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ko } from 'date-fns/locale';

function ProfileScreen({ currentUser, onBack, onLogout }) {
  const [guardianData, setGuardianData] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });

  const [patients, setPatients] = useState([]); // 여러 환자 정보
  const [selectedPatientId, setSelectedPatientId] = useState(null); // 현재 선택된 환자의 ID
  const [familyLinks, setFamilyLinks] = useState([]); // 가족 연결 정보들

  const [showAddPatientPopup, setShowAddPatientPopup] = useState(false); // 환자 추가 팝업 표시 여부
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhoneNumber, setNewPatientPhoneNumber] = useState('');
  const [newPatientBirthdate, setNewPatientBirthdate] = useState('');
  const [newPatientGender, setNewPatientGender] = useState('남성'); // 기본값 남성
  const [newPatientId, setNewPatientId] = useState(''); // 환자 로그인 아이디
  const [newPatientPassword, setNewPatientPassword] = useState(''); // 환자 로그인 비밀번호
  const [newPatientCallTime, setNewPatientCallTime] = useState('12:00'); // 통화 시간 (HH:mm 형식)
  const [newPatientCity, setNewPatientCity] = useState(''); // 위치 정보 - 도시
  const [newPatientPlaceType, setNewPatientPlaceType] = useState('집'); // 위치 정보 - 장소 유형
  const [newPatientPlaceName, setNewPatientPlaceName] = useState(''); // 위치 정보 - 장소 이름
  const [newPatientFloor, setNewPatientFloor] = useState('1'); // 위치 정보 - 층수
  const [addPatientError, setAddPatientError] = useState(''); // 환자 추가 시 에러 메시지

  const [showExistingPatientPopup, setShowExistingPatientPopup] = useState(false); // 기존 환자 등록 팝업 표시 여부
  const [existingPatientCode, setExistingPatientCode] = useState(''); // 기존 환자 등록 코드
  const [existingPatientError, setExistingPatientError] = useState(''); // 기존 환자 등록 시 에러 메시지

  const [isEditingMyInfo, setIsEditingMyInfo] = useState(false); // 본인 정보 수정 모드
  const [isEditingPatientInfo, setIsEditingPatientInfo] = useState(false); // 환자 정보 수정 모드
  const [isSaving, setIsSaving] = useState(false);

  const [editGuardianData, setEditGuardianData] = useState(guardianData);
  const [editPatients, setEditPatients] = useState([]);
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
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setUserType(userData.role === '보호자' ? 'guardian' : 'patient');

        if (userData.role === '보호자') {
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

          const familyLinksQuery = query(collection(db, 'family_links'), where('guardian_id', '==', currentUser.uid));
          const familyLinksSnapshot = await getDocs(familyLinksQuery);
          const fetchedFamilyLinks = familyLinksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFamilyLinks(fetchedFamilyLinks);

          const fetchedPatients = [];
          for (const link of fetchedFamilyLinks) {
            const patientUserId = link.patient_id;
            const patientUserRef = doc(db, 'users', patientUserId);
            const patientUserSnap = await getDoc(patientUserRef);
            const patientDocRef = doc(db, 'patients', patientUserId);
            const patientDocSnap = await getDoc(patientDocRef);

            if (patientUserSnap.exists()) {
              const pUserData = patientUserSnap.data();
              const pData = patientDocSnap.exists() ? patientDocSnap.data() : {};
              fetchedPatients.push({
                id: patientUserId,
                name: pUserData.name || '',
                birthdate: pData.birth_date || '',
                gender: pData.gender || '',
                phoneNumber: pUserData.phone_number || '',
                callTime: pData.call_time || '1200', // 통화 시간 추가 (기본값 "1200")
                city: pData.city || '',
                placeType: pData.place_type || '집',
                placeName: pData.place_name || '',
                floor: pData.floor || '',
                status: link.status // family_links에서 status 추가
              });
            }
          }
          setPatients(fetchedPatients);
          setEditPatients(fetchedPatients); // 편집용 데이터 초기화
          if (fetchedPatients.length > 0) {
            // 이전에 선택된 환자 ID가 있다면 유지, 없다면 첫 번째 환자 선택
            const previouslySelectedPatient = fetchedPatients.find(p => p.id === selectedPatientId);
            if (previouslySelectedPatient) {
              setSelectedPatientId(previouslySelectedPatient.id);
            } else {
              // 현재 '연결됨' 상태인 환자가 있다면 그 환자를 선택
              const connectedPatient = fetchedPatients.find(p => p.status === '연결됨');
              if (connectedPatient) {
                setSelectedPatientId(connectedPatient.id);
              } else if (fetchedPatients.length > 0) {
                // '연결됨' 환자가 없으면 첫 번째 환자 선택
                setSelectedPatientId(fetchedPatients[0].id);
              } else {
                setSelectedPatientId(null);
              }
            }
          }

        } else { // 환자 계정
          const patientDocRef = doc(db, 'patients', currentUser.uid);
          const patientDocSnap = await getDoc(patientDocRef);
          if (patientDocSnap.exists()) {
            const pData = patientDocSnap.data();
            setPatients([{
              id: currentUser.uid,
              name: userData.name || '',
              birthdate: pData.birth_date || '',
              gender: pData.gender || '',
              phoneNumber: userData.phone_number || '',
              callTime: pData.call_time || '1200',
              city: pData.city || '',
              placeType: pData.place_type || '집',
              placeName: pData.place_name || '',
              floor: pData.floor || ''
            }]);
            setEditPatients([{
              id: currentUser.uid,
              name: userData.name || '',
              birthdate: pData.birth_date || '',
              gender: pData.gender || '',
              phoneNumber: userData.phone_number || '',
              callTime: pData.call_time || '1200',
              city: pData.city || '',
              placeType: pData.place_type || '집',
              placeName: pData.place_name || '',
              floor: pData.floor || ''
            }]);
            setSelectedPatientId(currentUser.uid);
          }
        }
      }
    } catch (error) {
      console.error('사용자 정보 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMyInfoClick = () => {
    setEditGuardianData(guardianData);
    setIsEditingMyInfo(true);
  };

  const handleCancelMyInfoEdit = () => {
    setIsEditingMyInfo(false);
    setEditGuardianData(guardianData);
  };

  const handleSaveMyInfo = async () => {
    setIsSaving(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        name: editGuardianData.name,
        phone_number: editGuardianData.phoneNumber
      });
      setGuardianData(editGuardianData);
      setIsEditingMyInfo(false);
      alert('✅ 본인 정보가 저장되었습니다.');
    } catch (error) {
      console.error('본인 정보 저장 실패:', error);
      alert('❌ 본인 정보 저장 실패: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPatientInfoClick = (patientId) => {
    setSelectedPatientId(patientId);
    setIsEditingPatientInfo(true);
    // editPatients는 이미 loadUserData에서 초기화됨
  };

  const handleCancelPatientInfoEdit = () => {
    setIsEditingPatientInfo(false);
    setEditPatients(patients); // 원본 데이터로 되돌림
  };

  const handleSavePatientInfo = async () => {
    setIsSaving(true);
    try {
      const patientToSave = editPatients.find(p => p.id === selectedPatientId);
      // 수정 전 기존 데이터 찾기 (시간 변경 여부 확인용)
      const originalPatient = patients.find(p => p.id === selectedPatientId);
      
      if (!patientToSave || !originalPatient) return;

      // 1. 통화 시간 변경 여부 체크
      const oldTime = originalPatient.callTime?.replace(':', '');
      const newTime = patientToSave.callTime?.replace(':', '');
      const isTimeChanged = oldTime !== newTime;

      // --- DB 업데이트 시작 ---
      // Users 컬렉션 업데이트
      const patientUserRef = doc(db, 'users', selectedPatientId);
      await updateDoc(patientUserRef, {
        name: patientToSave.name,
        phone_number: patientToSave.phoneNumber
      });
      
      // Patients 컬렉션 업데이트
      const patientDocRef = doc(db, 'patients', selectedPatientId);
      await updateDoc(patientDocRef, {
        birth_date: patientToSave.birthdate,
        gender: patientToSave.gender,
        call_time: newTime,
        city: patientToSave.city || '',
        place_type: patientToSave.placeType || '집',
        place_name: patientToSave.placeName || '',
        floor: patientToSave.floor || ''
      });
      // --- DB 업데이트 끝 ---

      // 2. 시간이 변경되었다면 푸시 전송
      if (isTimeChanged) {
        console.log("통화 시간 변경 감지, 푸시 전송 준비...");
        
        // 환자의 최신 FCM 토큰 가져오기
        const patientSnap = await getDoc(patientDocRef);
        const fcmToken = patientSnap.data()?.fcmToken;
        const tokens = await getPatientNotificationTokens(selectedPatientId, fcmToken);

        if (tokens.length > 0) {
          // 푸시 전송 함수 호출 (아래에 정의)
          await sendPushNotification(tokens, patientToSave.callTime);
        } else {
          console.warn("환자의 FCM 토큰이 없어 푸시를 보내지 못했습니다.");
        }
      }

      setPatients([...editPatients]); 
      setIsEditingPatientInfo(false);
      alert(isTimeChanged ? '✅ 정보 저장 및 시간 변경 알림이 전송되었습니다.' : '✅ 환자 정보가 저장되었습니다.');

    } catch (error) {
      console.error('환자 정보 저장 실패:', error);
      alert('❌ 환자 정보 저장 실패: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  /** 푸시 전송 API 호출 함수 */
  const sendPushNotification = async (tokens, formattedTime) => {
    if (Array.isArray(tokens)) {
      try {
        const results = await sendPushNotificationToTokens(tokens, formattedTime);
        console.log("?몄떆 ?쒕쾭 ?묐떟:", results);
      } catch (error) {
        console.error("?몄떆 ?뚮┝ ?꾩넚 以??ㅽ듃?뚰겕 ?먮윭:", error);
      }
      return;
    }
    const token = tokens;
  try {
    const response = await fetch(
      "https://us-central1-remind-aa99f.cloudfunctions.net/pushSend",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          data: {
            time: formattedTime, // "14:30" 형태
          },
        }),
      }
    );
    const result = await response.json();
    console.log("푸시 서버 응답:", result);
  } catch (error) {
    console.error("푸시 알림 전송 중 네트워크 에러:", error);
  }
};

  const handleGuardianInputChange = (field, value) => {
    setEditGuardianData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePatientInputChange = (patientId, field, value) => {
    setEditPatients(prevPatients => 
      prevPatients.map(p => 
        p.id === patientId ? { ...p, [field]: value } : p
      )
    );
  };

  // 환자 연결 상태 변경 핸들러
  const handleConnectPatient = async (patientIdToConnect) => {
    try {
      setLoading(true);
      await updatePatientConnectionStatus(currentUser.uid, patientIdToConnect);
      alert('✅ 환자 연결 상태가 업데이트되었습니다.');
      await loadUserData(); // 데이터 새로고침
    } catch (error) {
      console.error('환자 연결 상태 업데이트 실패:', error);
      alert('❌ 환자 연결 상태 업데이트 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patientId) => {
    setSelectedPatientId(patientId);
  };

  const handleAddPatient = () => {
    setShowAddPatientPopup(true);
    setNewPatientName('');
    setNewPatientPhoneNumber('');
    setNewPatientBirthdate('');
    setNewPatientGender('남성');
    setNewPatientId('');
    setNewPatientPassword("");
    setNewPatientCallTime("12:00"); // 통화 시간 초기화
    setNewPatientCity(''); // 위치 정보 초기화
    setNewPatientPlaceType('집'); // 위치 정보 초기화
    setNewPatientPlaceName(''); // 위치 정보 초기화
    setNewPatientFloor('1'); // 위치 정보 초기화
    setAddPatientError('');
  };

  const handleCloseAddPatientPopup = () => {
    setShowAddPatientPopup(false);
  };

  const handleShowExistingPatientPopup = () => {
    setShowExistingPatientPopup(true);
    setExistingPatientCode('');
    setExistingPatientError('');
  };

  const handleCloseExistingPatientPopup = () => {
    setShowExistingPatientPopup(false);
  };

  const handleVerifyAndLinkPatient = async (e) => {
    e.preventDefault();
    setExistingPatientError('');
    if (!existingPatientCode) {
      setExistingPatientError('6자리 코드를 입력해주세요.');
      return;
    }

    if (existingPatientCode.length !== 6 || !/^[0-9]+$/.test(existingPatientCode)) {
      setExistingPatientError('코드는 6자리 숫자여야 합니다.');
      return;
    }

    try {
      setIsSaving(true);
      const success = await verifyAndLinkGuardian(currentUser.uid, existingPatientCode);
      if (success) {
        alert('✅ 환자와 성공적으로 연결되었습니다.');
        handleCloseExistingPatientPopup();
        await loadUserData(); // 환자 목록 새로고침
      } else {
        setExistingPatientError('유효하지 않거나 만료된 코드입니다. 다시 확인해주세요.');
      }
    } catch (error) {
      console.error('기존 환자 연결 실패:', error);
      setExistingPatientError('환자 연결 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNewPatient = async (e) => {
    e.preventDefault();
    setAddPatientError('');
    setLoading(true);

    // 유효성 검사
    if (!newPatientName.trim()) {
      setAddPatientError('이름을 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientPhoneNumber.trim()) {
      setAddPatientError('전화번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientBirthdate || !newPatientGender) {
      setAddPatientError('환자 정보를 모두 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!newPatientPassword.trim()) {
      setAddPatientError('환자용 아이디와 비밀번호를 입력해주세요.');
      setLoading(false);
      return;
    }
    
    // 유효성 검사: 통화 시간
    if (!newPatientCallTime.trim()) {
      setAddPatientError('통화 시간을 입력해주세요.');
      setLoading(false);
      return;
    }


    // firebase는 계정 생성 시 해당 계정으로 로그인 되도록 되어 있어서 임시 앱을 생성해서 기존 로그인 유지되도록 우회
    let tempApp; 
    try {
      // 임시 앱 생성 (이름을 'temp'로 지정하여 메인 앱과 분리)
      const tempAppName = `temp-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      // 1. 환자 계정 생성 (Firebase Auth) - 유효한 이메일 형식 사용
      const patientEmail = `${newPatientId}@patient.app`;
      const patientCredential = await createUserWithEmailAndPassword(tempAuth, patientEmail, newPatientPassword);
      const patientUser = patientCredential.user;

      // 2. 환자 프로필 업데이트
      await updateProfile(patientUser, {
        displayName: newPatientName
      });

      // ========== 새로운 DB 구조 ==========

      // 3. Users 컬렉션에 환자 정보 저장
      const patientUserDocRef = doc(db, 'users', patientUser.uid);
      await setDoc(patientUserDocRef, {
        user_id: patientUser.uid,
        login_id: newPatientId,
        name: newPatientName,
        phone_number: newPatientPhoneNumber,
        role: '환자',
        created_at: new Date(),
        notification_enabled: true,
        personal_information: true
      });

      // 4. Patients 컬렉션에 환자 추가 정보 저장
      const patientDocRef = doc(db, 'patients', patientUser.uid);
      await setDoc(patientDocRef, {
        user_id: patientUser.uid,
        birth_date: newPatientBirthdate,
        gender: newPatientGender,
        call_time: newPatientCallTime.replace(':', ''), // HHmm 형식으로 저장
        is_notified: true, // 알림 설정 필드 추가
        guardian_id: currentUser.uid,
        // K-MMSE 장소 지남력 채점용
        city: newPatientCity.trim(),
        place_type: newPatientPlaceType,
        place_name: newPatientPlaceName.trim(),
        floor: newPatientFloor.trim(),
      });

      // 5. FamilyLinks 컬렉션에 가족 연결 정보 저장
      const linkId = `${currentUser.uid}_${patientUser.uid}`;
      const familyLinkDocRef = doc(db, 'family_links', linkId);
      await setDoc(familyLinkDocRef, {
        link_id: linkId,
        patient_id: patientUser.uid,
        guardian_id: currentUser.uid,
        status: '연결됨',
        created_at: new Date()
      });

      // 새로 등록된 환자를 "연결됨" 상태로 만들고, 다른 환자들은 "연결안됨"으로 설정
      await updatePatientConnectionStatus(currentUser.uid, patientUser.uid);

      // 임시 앱 로그아웃 및 삭제
      await signOut(tempAuth);
      await deleteApp(tempApp);

      // 등록 성공 후 팝업 닫고 정보 새로고침
      setShowAddPatientPopup(false);
      await loadUserData();
      
    } catch (err) {
      if (err.code === 'auth/invalid-email') {
        setAddPatientError('유효하지 않은 이메일입니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAddPatientError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/weak-password') {
        setAddPatientError('비밀번호가 너무 약합니다.');
      } else {
        setAddPatientError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
      if (tempApp) await deleteApp(tempApp); // 에러 시에도 삭제
      console.error('회원가입 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!window.confirm('정말 이 환자를 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) {
      return;
    }

    try {
      setIsSaving(true); // 로딩 상태 활성화
      
      // 1. patients 문서 삭제
      await deleteDoc(doc(db, 'patients', patientId));
      console.log(`[ProfileScreen] Patient document ${patientId} deleted.`);

      // 2. users 문서 삭제 (환자 계정)
      // Firebase Auth 계정 삭제는 클라이언트에서 직접 불가능하며, 관리자 SDK나 Cloud Functions를 사용해야 합니다.
      // 여기서는 users 컬렉션의 문서만 삭제합니다.
      await deleteDoc(doc(db, 'users', patientId));
      console.log(`[ProfileScreen] User document ${patientId} deleted.`);
      
      // 3. family_links 문서 삭제
      const linkToDelete = familyLinks.find(link => link.patient_id === patientId);
      if (linkToDelete) {
        await deleteDoc(doc(db, 'family_links', linkToDelete.id));
        console.log(`[ProfileScreen] Family link ${linkToDelete.id} deleted.`);
      }

      // UI 업데이트
      setPatients(prevPatients => prevPatients.filter(p => p.id !== patientId));
      setEditPatients(prevPatients => prevPatients.filter(p => p.id !== patientId));
      if (selectedPatientId === patientId) {
        setSelectedPatientId(patients.length > 1 ? patients[0].id : null);
      }
      alert('✅ 환자 정보가 삭제되었습니다.');
    } catch (error) {
      console.error('환자 삭제 실패:', error);
      alert('❌ 환자 삭제 실패: ' + error.message);
    } finally {
      setIsSaving(false);
      loadUserData(); // 데이터 새로고침
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('로그아웃 실패:', error);
      alert('로그아웃 실패: ' + error.message);
    }
  };

  const renderPatientCard = (patient) => {
    const isSelected = patient.id === selectedPatientId;
    const currentEditPatient = editPatients.find(p => p.id === patient.id) || patient;
    const isConnectedPatient = patient.status === '연결됨'; // 연결 상태 확인

    return (
      <div 
        key={patient.id} 
        className={`profile-info-card patient-card ${isConnectedPatient ? 'selected' : ''}`}
        onClick={() => handleSelectPatient(patient.id)}
      >
        {isConnectedPatient && (
          <div className="connected-patients-header">연결됨</div>
        )}
        <div className="patient-card-content-wrapper">
          <div className="icon-circle">
            <img src={user_icon} className="icon-circle-small-img" alt="User Icon" />
          </div>
          <div className="profile-info-content">
            <div className="profile-info-row">
              <div className="profile-info-label">이름</div>
              {isEditingPatientInfo && isSelected ? (
                <input
                  type="text"
                  value={currentEditPatient.name}
                  onChange={(e) => handlePatientInputChange(patient.id, 'name', e.target.value)}
                  className="profile-info-input"
                  onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
                />
              ) : (
                <div className="profile-info-value">{patient.name || '미입력'}</div>
              )}
            </div>
            <div className="profile-info-row">
              <div className="profile-info-label">생년월일</div>
              {isEditingPatientInfo && isSelected ? (
                <DatePicker
                  selected={currentEditPatient.birthdate ? new Date(currentEditPatient.birthdate) : null}
                  onChange={(date) => {
                    const formatted = date ? date.toISOString().split('T')[0] : '';
                    handlePatientInputChange(patient.id, 'birthdate', formatted);
                  }}
                  dateFormat="yyyy-MM-dd"
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  locale={ko}
                  className="profile-info-input"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="profile-info-value">{patient.birthdate || '미입력'}</div>
              )}
            </div>
            <div className="profile-info-row">
              <div className="profile-info-label">전화번호</div>
              {isEditingPatientInfo && isSelected ? (
                <input
                  type="tel"
                  value={currentEditPatient.phoneNumber}
                  onChange={(e) => handlePatientInputChange(patient.id, 'phoneNumber', e.target.value)}
                  className="profile-info-input"
                  placeholder="010-0000-0000"
                  onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
                />
              ) : (
                <div className="profile-info-value">{patient.phoneNumber || '미입력'}</div>
              )}
            </div>
            <div className="profile-info-row">
              <div className="profile-info-label">통화 시간</div>
              {isEditingPatientInfo && isSelected ? (
                <input
                  type="time"
                  value={currentEditPatient.callTime ? currentEditPatient.callTime.substring(0, 2) + ':' + currentEditPatient.callTime.substring(2, 4) : '12:00'}
                  onChange={(e) => handlePatientInputChange(patient.id, 'callTime', e.target.value.replace(':', ''))} // HHmm 형식으로 저장
                  className="profile-info-input"
                  onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
                />
              ) : (
                <div className="profile-info-value">
                  {(currentEditPatient.callTime ? currentEditPatient.callTime.substring(0, 2) + ':' + currentEditPatient.callTime.substring(2, 4) : '미입력')}
                </div>
              )}
            </div>
            <div className="profile-info-row">
              <div className="profile-info-label">성별</div>
              {isEditingPatientInfo && isSelected ? (
                <div className="popup-gender-buttons" onClick={(e) => e.stopPropagation()}> {/* 클릭 이벤트 전파 방지 */}
                  <button
                    type="button"
                    className={`popup-gender-btn ${currentEditPatient.gender === '남성' ? 'active' : ''}`}
                    onClick={() => handlePatientInputChange(patient.id, 'gender', '남성')}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    className={`popup-gender-btn ${currentEditPatient.gender === '여성' ? 'active' : ''}`}
                    onClick={() => handlePatientInputChange(patient.id, 'gender', '여성')}
                  >
                    여성
                  </button>
                </div>
              ) : (
                <div className="profile-info-value">{patient.gender || '미입력'}</div>
              )}
            </div>

            {/* 위치 정보 표시 */}
            {isEditingPatientInfo && isSelected && (
              <>
                <div style={{ margin: '10px 0', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>위치 정보</div>
                </div>
                <div className="profile-info-row">
                  <div className="profile-info-label">도시/지역</div>
                  <input
                    type="text"
                    value={currentEditPatient.city}
                    onChange={(e) => handlePatientInputChange(patient.id, 'city', e.target.value)}
                    className="profile-info-input"
                    placeholder="예: 서울"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="profile-info-row">
                  <div className="profile-info-label">장소 유형</div>
                  <select
                    value={currentEditPatient.placeType}
                    onChange={(e) => handlePatientInputChange(patient.id, 'placeType', e.target.value)}
                    className="profile-info-input"
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="집">집</option>
                    <option value="요양원">요양원</option>
                    <option value="병원">병원</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="profile-info-row">
                  <div className="profile-info-label">장소 이름</div>
                  <input
                    type="text"
                    value={currentEditPatient.placeName}
                    onChange={(e) => handlePatientInputChange(patient.id, 'placeName', e.target.value)}
                    className="profile-info-input"
                    placeholder="예: 우리집, 행복 요양원"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="profile-info-row">
                  <div className="profile-info-label">층수</div>
                  <input
                    type="text"
                    value={currentEditPatient.floor}
                    onChange={(e) => handlePatientInputChange(patient.id, 'floor', e.target.value)}
                    className="profile-info-input"
                    placeholder="예: 1층"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </>
            )}
            {!isEditingPatientInfo && (currentEditPatient.city || currentEditPatient.placeName) && (
              <>
                <div style={{ margin: '10px 0', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>위치 정보</div>
                </div>
                {currentEditPatient.city && (
                  <div className="profile-info-row">
                    <div className="profile-info-label">도시/지역</div>
                    <div className="profile-info-value">{currentEditPatient.city}</div>
                  </div>
                )}
                {currentEditPatient.placeName && (
                  <div className="profile-info-row">
                    <div className="profile-info-label">장소</div>
                    <div className="profile-info-value">{currentEditPatient.placeName} ({currentEditPatient.placeType})</div>
                  </div>
                )}
                {currentEditPatient.floor && (
                  <div className="profile-info-row">
                    <div className="profile-info-label">층수</div>
                    <div className="profile-info-value">{currentEditPatient.floor}</div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="patient-card-actions">
            {!isEditingPatientInfo && userType === 'guardian' && (
              <>
                <button 
                  className="patient-action-button edit-patient-btn"
                  onClick={(e) => { e.stopPropagation(); handleEditPatientInfoClick(patient.id); }}
                >
                  수정
                </button>
                <button 
                  className="patient-action-button delete-patient-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeletePatient(patient.id); }}
                  disabled={isSaving}
                >
                  <img src={trash_icon} className="trash-icon" alt="Delete Icon" />
                </button>
                {!isConnectedPatient &&
                  <button 
                    className="patient-action-button connect-patient-btn"
                    onClick={(e) => { e.stopPropagation(); handleConnectPatient(patient.id); }}
                  >
                    연결
                  </button>
                }
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const connectedPatients = patients.filter(p => p.status === '연결됨');
  const disconnectedPatients = patients.filter(p => p.status !== '연결됨');

  return (
    <div className="profile-screen">
      <div className="header-content">
        <h1 className="header-title">계정 관리 및 설정</h1>
      </div>
      <div className="header-diver"></div>

      {loading ? (
        <div className="loading-message">로딩 중...</div>
      ) : (
        <>
          {/* 본인 정보 섹션 */}
          {userType === 'guardian' && (
            <section className="profile-section">
              <h2 className="profile-section-title">본인 정보</h2>
              <div className="profile-cards-container">
                <div className="guardian-info-card">
                  <div className="icon-circle">
                    <img src={user_icon} className="icon-circle-small-img" alt="User Icon" />
                  </div>
                  <div className="profile-info-content">
                    <div className="profile-info-label">이름</div>
                    {isEditingMyInfo ? (
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

                <div className="guardian-info-card">
                  <div className="icon-circle">
                    <img src={email_icon} className="icon-circle-small-img" alt="User Icon" />
                  </div>
                  <div className="profile-info-content">
                    <div className="profile-info-label">이메일</div>
                    <div className="profile-info-value">{guardianData.email}</div>
                  </div>
                </div>

                <div className="guardian-info-card">
                  <div className="icon-circle">
                    <img src={call_icon} className="icon-circle-img" alt="Call Icon" />
                  </div>
                  <div className="profile-info-content">
                    <div className="profile-info-label">전화번호</div>
                    {isEditingMyInfo ? (
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
          )}

          {/* 환자 정보 섹션 */}
          <section className="profile-section">
            <div className="patient-list-header">
              <h2 className="patient-list-title">등록된 환자 정보</h2>
              <div className="patient-list-cnt">{patients.length}명</div>
            </div>
            <div className="profile-cards-container patient-cards-list">
              {patients.length > 0 ? (
                <>
                  {connectedPatients.map(renderPatientCard)}
                  {disconnectedPatients.map(renderPatientCard)}
                </>
              ) : (
                <div className="no-patients-message">
                  <p>등록된 환자가 없습니다.</p>
                  {userType === 'guardian' && (
                    <p>새 환자를 등록하여 가족을 연결하세요.</p>
                  )}
                </div>
              )}
            </div>
            {userType === 'guardian' && (
              <div className="add-patient-button-container">
                <button className="add-patient-button" onClick={handleAddPatient}>
                  <img src={plus_icon} alt="Add Patient" className="add-patient-icon" />
                  새 환자 등록
                </button>
                <button className="add-patient-button" onClick={handleShowExistingPatientPopup}>
                  <img src={plus_icon} alt="Add Patient" className="add-patient-icon" />
                  기존 환자 등록
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {/* Action Buttons */}
      <div className="profile-action-section">
        {userType === 'guardian' && (
          <>
            {!isEditingMyInfo && !isEditingPatientInfo ? (
              <>
                <button 
                  className="profile-action-button"
                  onClick={handleEditMyInfoClick}
                >
                  본인 정보 수정
                </button>
                <button 
                  className="profile-action-button logout-btn"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : isEditingMyInfo ? (
              <>
                <button 
                  className="profile-action-button save-btn"
                  onClick={handleSaveMyInfo}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '본인 정보 저장'}
                </button>
                <button 
                  className="profile-action-button cancel-btn"
                  onClick={handleCancelMyInfoEdit}
                  disabled={isSaving}
                >
                  취소
                </button>
              </>
            ) : isEditingPatientInfo ? (
              <>
                <button 
                  className="profile-action-button save-btn"
                  onClick={handleSavePatientInfo}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '환자 정보 저장'}
                </button>
                <button 
                  className="profile-action-button cancel-btn"
                  onClick={handleCancelPatientInfoEdit}
                  disabled={isSaving}
                >
                  취소
                </button>
              </>
            ) : null}
          </>
        )}

        {userType === 'patient' && (
          <>
            {!isEditingPatientInfo ? (
              <>
                <button 
                  className="profile-action-button"
                  onClick={() => handleEditPatientInfoClick(currentUser.uid)} // 환자 본인 정보 수정
                >
                  내 정보 수정
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
                  onClick={handleSavePatientInfo}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '내 정보 저장'}
                </button>
                <button 
                  className="profile-action-button cancel-btn"
                  onClick={handleCancelPatientInfoEdit}
                  disabled={isSaving}
                >
                  취소
                </button>
              </>
            )}
          </>
        )}

      {showAddPatientPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h2>새 환자 등록</h2>
            <p>새로운 환자의 정보를 입력하여 등록해주세요.</p>
            <form onSubmit={handleSaveNewPatient}>
              <div className="popup-form-field">
                <label htmlFor="addPatientName">이름</label>
                <input
                  type="text"
                  id="addPatientName"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="환자 성함을 입력하세요"
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientPhoneNumber">전화번호</label>
                <input
                  type="tel"
                  id="addPatientPhoneNumber"
                  value={newPatientPhoneNumber}
                  onChange={(e) => setNewPatientPhoneNumber(e.target.value)}
                  placeholder="010-1234-5678"
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientBirthdate">생년월일</label>
                <DatePicker
                  selected={newPatientBirthdate ? new Date(newPatientBirthdate) : null}
                  onChange={(date) => {
                    const formatted = date ? date.toISOString().split('T')[0] : '';
                    setNewPatientBirthdate(formatted);
                  }}
                  dateFormat="yyyy-MM-dd"
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  locale={ko}
                  placeholderText="YYYY-MM-DD"
                  className="profile-info-input"
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientGender">성별</label>
                <div className="popup-gender-buttons">
                  <button
                    type="button"
                    className={`popup-gender-btn ${newPatientGender === '남성' ? 'active' : ''}`}
                    onClick={() => setNewPatientGender('남성')}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    className={`popup-gender-btn ${newPatientGender === '여성' ? 'active' : ''}`}
                    onClick={() => setNewPatientGender('여성')}
                  >
                    여성
                  </button>
                </div>
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientCallTime">통화 시간</label>
                <input
                  type="time"
                  id="addPatientCallTime"
                  value={newPatientCallTime}
                  onChange={(e) => setNewPatientCallTime(e.target.value)}
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientId">아이디</label>
                <input
                  type="text"
                  id="addPatientId"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  required
                />
              </div>
              <div className="popup-form-field">
                <label htmlFor="addPatientPassword">비밀번호</label>
                <input
                  type="password"
                  id="addPatientPassword"
                  value={newPatientPassword}
                  onChange={(e) => setNewPatientPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>

              {/* 위치 정보 섹션 */}
              <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #ddd' }} />
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>위치 정보 (선택사항)</div>
              
              <div className="popup-form-field">
                <label htmlFor="addPatientCity">도시/지역</label>
                <input
                  type="text"
                  id="addPatientCity"
                  value={newPatientCity}
                  onChange={(e) => setNewPatientCity(e.target.value)}
                  placeholder="예: 서울, 경기도"
                />
              </div>

              <div className="popup-form-field">
                <label htmlFor="addPatientPlaceType">장소 유형</label>
                <select
                  id="addPatientPlaceType"
                  value={newPatientPlaceType}
                  onChange={(e) => setNewPatientPlaceType(e.target.value)}
                >
                  <option value="집">집</option>
                  <option value="요양원">요양원</option>
                  <option value="병원">병원</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="popup-form-field">
                <label htmlFor="addPatientPlaceName">장소 이름</label>
                <input
                  type="text"
                  id="addPatientPlaceName"
                  value={newPatientPlaceName}
                  onChange={(e) => setNewPatientPlaceName(e.target.value)}
                  placeholder="예: 우리집, 행복 요양원"
                />
              </div>

              <div className="popup-form-field">
                <label htmlFor="addPatientFloor">층수</label>
                <input
                  type="text"
                  id="addPatientFloor"
                  value={newPatientFloor}
                  onChange={(e) => setNewPatientFloor(e.target.value)}
                  placeholder="예: 1층, 2층, B1"
                />
              </div>

              {addPatientError && <div className="error-message">{addPatientError}</div>}
              <div className="popup-actions">
                <button type="button" className="cancel-button" onClick={handleCloseAddPatientPopup}>
                  취소
                </button>
                <button type="submit" className="confirm-button">
                  환자 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExistingPatientPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h2>기존 환자 등록</h2>
            <p>환자에게 발급된 6자리 임시 코드를 입력해주세요.</p>
            <form onSubmit={handleVerifyAndLinkPatient}>
              <div className="popup-form-field">
                <label htmlFor="existingPatientCode">임시 코드</label>
                <input
                  type="text"
                  id="existingPatientCode"
                  value={existingPatientCode}
                  onChange={(e) => setExistingPatientCode(e.target.value)}
                  placeholder="6자리 코드 입력"
                  maxLength="6"
                  required
                />
              </div>
              {existingPatientError && <div className="error-message">{existingPatientError}</div>}
              <div className="popup-actions">
                <button type="button" className="cancel-button" onClick={handleCloseExistingPatientPopup}>
                  취소
                </button>
                <button type="submit" className="confirm-button">
                  연결하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default ProfileScreen;
