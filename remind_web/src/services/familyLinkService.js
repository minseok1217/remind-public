import { db } from "../firebase";
import { collection, query, where, getDocs, doc, updateDoc, setDoc, writeBatch } from "firebase/firestore";

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
  } catch (error) {
    console.error("[familyLinkService] 새로운 가족 연결 생성 중 오류 발생:", error);
    throw error;
  }
};
