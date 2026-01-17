import DummyDataGenerator from './DummyDataGenerator';
import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

function App() {
  const [status, setStatus] = useState("데이터베이스 연결 시도 중...");
  const [dataList, setDataList] = useState([]);

  useEffect(() => {
    const testDB = async () => {
      try {
        await addDoc(collection(db, "connection_test"), {
          message: "Hello Firebase!",
          timestamp: new Date()
        });
        console.log("✅ 데이터 쓰기 성공!");
        const querySnapshot = await getDocs(collection(db, "connection_test"));
        
        const loadedData = [];
        querySnapshot.forEach((doc) => {
          loadedData.push({ id: doc.id, ...doc.data() });
        });
        
        console.log("✅ 데이터 읽기 성공!", loadedData);
        setDataList(loadedData);
        setStatus("🎉 DB 연결 성공! (콘솔창도 확인해보세요)");

      } catch (error) {
        console.error("❌ 에러 발생:", error);
        setStatus(`연결 실패: ${error.message}`);
      }
    };

    testDB();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Remind Web DB 테스트</h1>
      <h2>상태: {status}</h2>
      
      <h3>불러온 데이터 목록:</h3>
      <ul>
        {dataList.map((item) => (
          <li key={item.id}>
            <strong>ID:</strong> {item.id} <br/>
            <strong>메시지:</strong> {item.message}
          </li>
        ))}
      </ul>

      {/* 👇 더미 데이터 생성기 */}
      <DummyDataGenerator />
    </div>
  );
}

export default App;