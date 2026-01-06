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

// Detect if running locally
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Initialize Firebase
let db, auth, googleProvider;

try {
    firebase.initializeApp(firebaseConfig);

    // Initialize Firestore
    db = firebase.firestore();

    // Initialize Auth
    auth = firebase.auth();

    // Connect to emulators if running locally
    if (isLocalDev) {
        console.log('🔧 Running in LOCAL DEV MODE - Using Firebase Emulators');
        db.useEmulator('localhost', 9199);
        auth.useEmulator('http://localhost:9099');
    }

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
