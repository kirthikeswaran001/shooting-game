import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your config (already correct ✅)
const firebaseConfig = {
  apiKey: "AIzaSyC4s_b_BfF7AcvTYRsTHZDHcDphDV6Nv8Q",
  authDomain: "shooting-game-95cbf.firebaseapp.com",
  projectId: "shooting-game-95cbf",
  storageBucket: "shooting-game-95cbf.firebasestorage.app",
  messagingSenderId: "779794224913",
  appId: "1:779794224913:web:26f6cc44fb7a43e2f45eb0",
  measurementId: "G-S95FFD59F4"
};

// ✅ IMPORTANT PART (you missed this)
const app = initializeApp(firebaseConfig);

// ✅ EXPORT DATABASE
export const db = getFirestore(app);