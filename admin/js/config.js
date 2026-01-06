// Firebase Configuration for Lanting Digital Admin Panel
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
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Connect to emulators if running locally
if (isLocalDev) {
    console.log('🔧 Running in LOCAL DEV MODE - Using Firebase Emulators');
    db.useEmulator('localhost', 9199);
    auth.useEmulator('http://localhost:9099');
}

// Admin email(s) - only these can access admin portal
const ADMIN_EMAILS = [
    'caleb@lantingdigital.com'
];

// Collection names
const COLLECTIONS = {
    SUBMISSIONS: 'submissions',
    ARCHIVED: 'archived-submissions',
    FORMS: 'forms',
    CONTRACTS: 'contracts'
};

// Signing page URL
const SIGNING_BASE_URL = 'https://sign.lantingdigital.com';

// Helper function to check if email is admin
function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(email.toLowerCase());
}
