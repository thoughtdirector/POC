import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyApEi7CgbADU0urEtkdRBheJubnyEA-qnw",
  authDomain: "acriventas-poc.firebaseapp.com",
  databaseURL: "https://acriventas-poc-default-rtdb.firebaseio.com",
  projectId: "acriventas-poc",
  storageBucket: "acriventas-poc.firebasestorage.app",
  messagingSenderId: "718850780341",
  appId: "1:718850780341:web:aec07ccdad37235dece2fc",
  measurementId: "G-0DGH1RQX2G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };