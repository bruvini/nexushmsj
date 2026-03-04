// src/services/firebase.js

// Importando as funções principais do SDK do Firebase
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// A configuração do seu projeto Nexus (pmj-hmsj)
const firebaseConfig = {
  apiKey: "AIzaSyA0vqM9mdXDo7F4Kq3daBWhxoHMaiY8-nE",
  authDomain: "pmj-hmsj.firebaseapp.com",
  projectId: "pmj-hmsj",
  storageBucket: "pmj-hmsj.firebasestorage.app",
  messagingSenderId: "226296836721",
  appId: "1:226296836721:web:5fc9e2d01a0c433ee6e1d0",
  measurementId: "G-4Z4WG48NPV"
};

// Inicializando o Firebase App
const app = initializeApp(firebaseConfig);

// Inicializando os serviços que usaremos no Nexus
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Exportando os serviços para que outros arquivos (como Eletivas.jsx) possam usá-los
export { app, analytics, auth, db };