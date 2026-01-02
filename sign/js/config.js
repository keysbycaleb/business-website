// Firebase Configuration for Lanting Digital Contract Signing
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
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Collection name
const CONTRACTS_COLLECTION = 'contracts';
