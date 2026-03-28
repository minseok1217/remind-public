// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
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
export const storage = getStorage(app);
export const auth = getAuth(app);