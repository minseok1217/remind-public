// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDiGHtBF69iR3w8BRaR8PnVfGf0k1pbogg",
  authDomain: "remind-aa99f.firebaseapp.com",
  databaseURL: "https://remind-aa99f-default-rtdb.firebaseio.com",
  projectId: "remind-aa99f",
  storageBucket: "remind-aa99f.firebasestorage.app",
  messagingSenderId: "286493951038",
  appId: "1:286493951038:web:e167943198eaba8fee7d6f",
  measurementId: "G-SVS8W4HX01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);