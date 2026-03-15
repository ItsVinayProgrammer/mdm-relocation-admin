import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : undefined;

export const db = hasFirebaseConfig
  ? getFirestore(app!)
  : null;

export const auth = hasFirebaseConfig
  ? getAuth(app!)
  : null;

export const googleProvider = new GoogleAuthProvider();

export const firebaseConfigError = hasFirebaseConfig
  ? null
  : "Firebase config is missing. Set VITE_FIREBASE_* values to load live booking data.";