// Firebase Configuration for Lanting Digital Contract Signing
const firebaseConfig = {
    apiKey: "AIzaSyBUs5dd7zghmv8dQen9bdqROmHyKSupcEE",
    authDomain: "lantingdigital.com",
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

    // Initialize Firestore
    db = firebase.firestore();

    // Initialize Auth
    auth = firebase.auth();

    // Google Auth Provider - force account selection every time
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({
        prompt: 'select_account'
    });
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Collection name
const CONTRACTS_COLLECTION = 'contracts';

// Signing page base URL
const SIGNING_BASE_URL = 'https://sign.lantingdigital.com';

// Auth subdomain
const AUTH_BASE_URL = 'https://auth.lantingdigital.com';
