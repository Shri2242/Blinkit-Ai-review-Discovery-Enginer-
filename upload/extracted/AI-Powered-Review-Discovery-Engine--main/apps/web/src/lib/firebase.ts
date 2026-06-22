// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyAMhP8JycVj8Gv7HpIub4BT4NMhnjJuII8',
  authDomain: 'ai-review-discovery.firebaseapp.com',
  projectId: 'ai-review-discovery',
  storageBucket: 'ai-review-discovery.firebasestorage.app',
  messagingSenderId: '844959365494',
  appId: '1:844959365494:web:21d3f349d9b946a11ae257',
  measurementId: 'G-D7ZS186Q7K',
};

// Initialize Firebase
// Ensure it only initializes once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };
