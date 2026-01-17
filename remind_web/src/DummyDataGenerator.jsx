// src/DummyDataGenerator.jsx
import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

const DummyDataGenerator = () => {

  // 랜덤 값을 뽑는 도우미 함수들
  const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const getRandomDate = () => {
    const start = new Date(2025, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  // 1. 랜덤 환자 데이터
  const createDummyPatient = async () => {
    const names = ["김철수", "이영희", "박민수", "최정숙", "정상훈"];
    const stages = ["경도인지장애", "초기", "중기"];
    
    try {
      await addDoc(collection(db, "patients"), {
        name: getRandomItem(names),
        age: getRandomInt(70, 90),
        dementiaStage: getRandomItem(stages),
        guardianPhone: `010-${getRandomInt(1000, 9999)}-${getRandomInt(1000, 9999)}`,
        createdAt: Timestamp.now()
      });
      alert("✅ 랜덤 환자 생성 완료!");
    } catch (error) {
      console.error("에러:", error);
    }
  };

  // 2. 랜덤 추억(사진) 데이터
  const createDummyMemory = async () => {
    const locations = ["서울 경복궁", "부산 해운대", "제주도 가족여행", "천안 본가", "설날 아침"];
    
    try {
      // picsum.photos 뒤에 random 숫자를 붙이면 매번 다른 이미지가 나옵니다.
      const randomId = getRandomInt(1, 1000);
      
      await addDoc(collection(db, "memories"), {
        patientId: "temp_patient_id", 
        imageUrl: `https://picsum.photos/400/300?random=${randomId}`,
        caption: `${getRandomInt(1960, 1990)}년 ${getRandomItem(locations)}에서 찍은 사진`,
        date: getRandomDate().toISOString().split('T')[0], // YYYY-MM-DD 형식
        location: getRandomItem(locations),
        createdAt: Timestamp.now()
      });
      alert("✅ 랜덤 사진 생성 완료!");
    } catch (error) {
      console.error("에러:", error);
    }
  };

  // 3. 랜덤 통화 기록 (그래프 테스트용)
  const createDummyLog = async () => {
    try {
      await addDoc(collection(db, "call_logs"), {
        date: Timestamp.fromDate(getRandomDate()), // 랜덤 날짜 (그래프 그릴 때 필수!)
        duration: getRandomInt(300, 3600), // 5분 ~ 60분
        summary: "오늘 대화에서는 주로 옛날 고향 이야기를 하셨습니다.",
        emotionScore: getRandomInt(40, 100), // 감정 점수 (그래프 변화 확인용)
        createdAt: Timestamp.now()
      });
      alert("✅ 랜덤 기록 생성 완료!");
    } catch (error) {
      console.error("에러:", error);
    }
  };

  return (
    <div style={{ padding: '20px', border: '2px dashed blue', margin: '20px' }}>
      <h3>[개발자용] 랜덤 더미 데이터 생성기</h3>
      <p>버튼을 누를 때마다 다른 데이터가 들어갑니다.</p>
      <button onClick={createDummyPatient}>🎲 환자 생성</button> &nbsp;
      <button onClick={createDummyMemory}>🖼️ 추억 생성</button> &nbsp;
      <button onClick={createDummyLog}>📊 기록 생성</button>
    </div>
  );
};

export default DummyDataGenerator;