import { db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc, setDoc, writeBatch, deleteDoc, getDoc } from "firebase/firestore";

/**
 * 보호자와 연결된 모든 환자의 연결 상태를 '연결안됨'으로 설정하고,
 * 지정된 환자만 '연결됨'으로 설정합니다.
 * @param {string} guardianId 보호자 ID
 * @param {string} patientIdToConnect '연결됨'으로 설정할 환자 ID (선택 사항)
 */
export const updatePatientConnectionStatus = async (guardianId, patientIdToConnect = null) => {
  const batch = writeBatch(db);
  const familyLinksRef = collection(db, 'family_links');
  const q = query(familyLinksRef, where('guardian_id', '==', guardianId));

  try {
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((document) => {
      const linkData = document.data();
      const linkDocRef = doc(db, 'family_links', document.id);
      if (linkData.patient_id === patientIdToConnect) {
        batch.update(linkDocRef, { status: '연결됨' });
      } else {
        batch.update(linkDocRef, { status: '연결안됨' });
      }
    });

    await batch.commit();
    console.log(`[familyLinkService] Guardian ${guardianId}의 환자 연결 상태가 업데이트되었습니다.`);
  } catch (error) {
    console.error("[familyLinkService] 환자 연결 상태 업데이트 중 오류 발생:", error);
    throw error;
  }
};

/**
 * 새로운 보호자-환자 연결 문서를 생성하고 '연결됨' 상태로 설정합니다.
 * @param {string} guardianId 보호자 ID
 * @param {string} patientId 환자 ID
 */

/**
 * 6자리 임시 코드를 생성하고 Firestore의 temp_codes 컬렉션에 저장합니다.
 * @param {string} patientId 코드를 생성할 환자 ID
 * @returns {string} 생성된 6자리 임시 코드
 */
export const generateAndStoreTempCode = async (patientId) => {
  const tempCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6자리 숫자 코드 생성
  const expiresAt = new Date(Date.now() + 60 * 1000); // 1분 후 만료

  try {
    await setDoc(doc(db, 'temp_codes', tempCode), {
      code: tempCode,
      patient_id: patientId,
      expires_at: expiresAt,
      created_at: new Date()
    });
    console.log(`[familyLinkService] 임시 코드 생성 및 저장: ${tempCode} (환자: ${patientId}, 만료: ${expiresAt})`);
    return tempCode;
  } catch (error) {
    console.error("[familyLinkService] 임시 코드 생성 및 저장 중 오류 발생:", error);
    throw error;
  }
};

/**
 * 보호자가 입력한 코드를 검증하고, 유효한 경우 보호자와 환자를 연결합니다.
 * @param {string} guardianId 보호자 ID
 * @param {string} tempCode 보호자가 입력한 6자리 임시 코드
 * @returns {boolean} 연결 성공 여부
 */
export const verifyAndLinkGuardian = async (guardianId, tempCode) => {
  const batch = writeBatch(db); // Initialize batch
  try {
    const tempCodeDocRef = doc(db, 'temp_codes', tempCode);
    const tempCodeDocSnap = await getDoc(tempCodeDocRef);

    if (!tempCodeDocSnap.exists()) {
      console.log("[familyLinkService] 유효하지 않은 임시 코드입니다.");
      return false; // 코드가 존재하지 않음
    }

    const codeData = tempCodeDocSnap.data();
    const expiresAt = codeData.expires_at.toDate();

    if (expiresAt < new Date()) {
      console.log("[familyLinkService] 만료된 임시 코드입니다.");
      batch.delete(tempCodeDocRef); // 만료된 코드 삭제 (Batch)
      await batch.commit(); // Commit the batch
      return false; // 코드 만료
    }

    const patientId = codeData.patient_id;
    const linkId = `${guardianId}_${patientId}`;
    const familyLinkDocRef = doc(db, 'family_links', linkId);

    // 이미 연결된 경우를 대비하여 확인
    const existingLinkSnap = await getDoc(familyLinkDocRef);
    if (existingLinkSnap.exists()) {
      console.log(`[familyLinkService] 이미 연결된 환자입니다: ${patientId}`);
      batch.delete(tempCodeDocRef); // 사용된 임시 코드 삭제 (Batch)
      await batch.commit(); // Commit the batch
      return true; // 이미 연결되어 있다면 성공으로 처리
    }

    batch.set(familyLinkDocRef, {
      guardian_id: guardianId,
      patient_id: patientId,
      status: '연결됨',
      created_at: new Date(),
    });
    console.log(`[familyLinkService] 새로운 가족 연결이 생성되었습니다: ${linkId}`);

    batch.delete(tempCodeDocRef); // 사용된 임시 코드 삭제 (Batch)
    console.log(`[familyLinkService] 임시 코드 ${tempCode} 삭제 완료.`);

    await batch.commit(); // Commit the batch

    // 기존 환자 연결 끊기 로직 추가
    await updatePatientConnectionStatus(guardianId, patientId);
    return true;
  } catch (error) {
    console.error("[familyLinkService] 코드 검증 및 연결 중 오류 발생:", error);
    throw error;
  }
};

export const addFamilyLink = async (guardianId, patientId) => {
  try {
    const linkId = `${guardianId}_${patientId}`;
    const familyLinkDocRef = doc(db, 'family_links', linkId);
    await setDoc(familyLinkDocRef, {
      guardian_id: guardianId,
      patient_id: patientId,
      status: '연결됨',
      created_at: new Date(),
    });
    console.log(`[familyLinkService] 새로운 가족 연결이 생성되었습니다: ${linkId}`);

    // 기존 환자 연결 끊기 로직 추가
    await updatePatientConnectionStatus(guardianId, patientId);
  } catch (error) {
    console.error("[familyLinkService] 새로운 가족 연결 생성 중 오류 발생:", error);
    throw error;
  }
};

/**
 * 보호자와 연결된 환자의 ID를 가져옵니다.
 * @param {string} guardianId 보호자 ID
 * @returns {string | null} 연결된 환자 ID (없으면 null)
 */
export const getConnectedPatientId = async (guardianId) => {
  const familyLinksRef = collection(db, 'family_links');
  const q = query(familyLinksRef, where('guardian_id', '==', guardianId), where('status', '==', '연결됨'));

  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // 첫 번째로 발견된 연결된 환자의 ID를 반환 (단일 연결을 가정)
      const patientId = querySnapshot.docs[0].data().patient_id;
      console.log(`[familyLinkService] 보호자 ${guardianId}에 연결된 환자 ID: ${patientId}`);
      return patientId;
    } else {
      console.log(`[familyLinkService] 보호자 ${guardianId}에 연결된 환자를 찾을 수 없습니다.`);
      return null;
    }
  } catch (error) {
    console.error("[familyLinkService] 연결된 환자 ID 조회 중 오류 발생:", error);
    throw error;
  }
};
