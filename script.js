// 1. KONFIGURASI FIREBASE (Pakai punya Anda)
const firebaseConfig = {
  apiKey: "AIzaSyB-nAMpSMXfomAxtq5Ntebv0IYOmuKitj0",
  authDomain: "sistem-antrian-puskesmas.firebaseapp.com",
  databaseURL: "https://sistem-antrian-puskesmas-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sistem-antrian-puskesmas",
  storageBucket: "sistem-antrian-puskesmas.firebasestorage.app",
  messagingSenderId: "727104534075",
  appId: "1:727104534075:web:9814d1598c9f846e050e1e"
};

// 2. INISIALISASI FIREBASE
firebase.initializeApp(firebaseConfig);
const database = firebase.database();