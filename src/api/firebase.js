// 1. 브라우저가 인식할 수 있는 전체 URL(CDN)로 변경합니다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"; // 1. 추가

// 2. 사용자가 제공한 설정값
const firebaseConfig = {
  apiKey: "AIzaSyDiGHtBF69iR3w8BRaR8PnVfGf0k1pbogg",
  authDomain: "remind-aa99f.firebaseapp.com",
  databaseURL: "https://remind-aa99f-default-rtdb.firebaseio.com",
  projectId: "remind-aa99f",
  storageBucket: "remind-aa99f.firebasestorage.app",
  messagingSenderId: "286493951038",
  appId: "1:286493951038:web:3ef51a2a8cd0097bee7d6f",
  measurementId: "G-EETMBV7C00"
};

// 3. Firebase 초기화
const app = initializeApp(firebaseConfig);

// 4. 서비스들을 초기화하고 'export'를 붙여 외부에서 쓸 수 있게 합니다.
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);