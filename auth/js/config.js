// Firebase Configuration for Lanting Digital Auth
const firebaseConfig = {
    apiKey: "AIzaSyBUs5dd7zghmv8dQen9bdqROmHyKSupcEE",
    authDomain: "lanting-digital-website.firebaseapp.com",
    projectId: "lanting-digital-website",
    storageBucket: "lanting-digital-website.firebasestorage.app",
    messagingSenderId: "48115587377",
    appId: "1:48115587377:web:91fbc8910735c788517810",
    measurementId: "G-8J16C9BMXS"
};

// Initialize Firebase
let db, auth, googleProvider;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Collection name
const CONTRACTS_COLLECTION = 'contracts';

// URLs
const SIGN_BASE_URL = 'https://sign.lantingdigital.com';
const AUTH_BASE_URL = 'https://auth.lantingdigital.com';
