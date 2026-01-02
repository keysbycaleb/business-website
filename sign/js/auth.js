// Lanting Digital - Client Authentication Logic

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const authScreen = document.getElementById('auth-screen');
const deniedScreen = document.getElementById('denied-screen');

// Forms
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Tabs
const authTabs = document.querySelectorAll('.auth-tab');

// Buttons
const googleSigninBtn = document.getElementById('google-signin');
const signoutBtn = document.getElementById('signout-btn');
const deniedEmail = document.getElementById('denied-email');

// State
let contractId = null;
let contractData = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Get contract ID from URL
    contractId = getContractIdFromUrl();

    // Setup event listeners
    setupEventListeners();

    // Check auth state
    auth.onAuthStateChanged(handleAuthStateChange);
}

function getContractIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || urlParams.get('contract');
}

function setupEventListeners() {
    // Tab switching
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });

    // Login form
    loginForm.addEventListener('submit', handleLogin);

    // Register form
    registerForm.addEventListener('submit', handleRegister);

    // Google sign-in
    googleSigninBtn.addEventListener('click', handleGoogleSignin);

    // Sign out
    if (signoutBtn) {
        signoutBtn.addEventListener('click', handleSignout);
    }
}

function switchTab(tab) {
    authTabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    loginForm.classList.toggle('active', tab === 'login');
    registerForm.classList.toggle('active', tab === 'register');

    // Clear errors
    loginError.textContent = '';
    registerError.textContent = '';
}

async function handleAuthStateChange(user) {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);

        // If no contract ID, just show auth screen with success
        if (!contractId) {
            showScreen('auth');
            showToast('Signed in successfully!', 'success');
            return;
        }

        // Check if user has access to this contract
        const hasAccess = await checkContractAccess(user.email);

        if (hasAccess) {
            // Redirect to signing page
            window.location.href = `index.html?id=${contractId}`;
        } else {
            // Show access denied
            deniedEmail.textContent = user.email;
            showScreen('denied');
        }
    } else {
        // User is signed out - show auth screen
        showScreen('auth');
    }
}

async function checkContractAccess(userEmail) {
    try {
        const doc = await db.collection(CONTRACTS_COLLECTION).doc(contractId).get();

        if (!doc.exists) {
            showToast('Contract not found', 'error');
            return false;
        }

        contractData = doc.data();

        // Check if contract has clientEmail set
        if (!contractData.clientEmail) {
            // No email restriction - allow access
            return true;
        }

        // Check if user email matches contract's client email
        return userEmail.toLowerCase() === contractData.clientEmail.toLowerCase();

    } catch (error) {
        console.error('Error checking contract access:', error);
        showToast('Error verifying access', 'error');
        return false;
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    loginError.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Auth state change handler will take over
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = getErrorMessage(error.code);
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const company = document.getElementById('register-company').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    registerError.textContent = '';

    // Validate passwords match
    if (password !== confirm) {
        registerError.textContent = 'Passwords do not match.';
        return;
    }

    try {
        // Create user
        const credential = await auth.createUserWithEmailAndPassword(email, password);

        // Update profile with display name
        await credential.user.updateProfile({
            displayName: name
        });

        // Store additional user info in Firestore
        await db.collection('users').doc(credential.user.uid).set({
            email: email,
            displayName: name,
            company: company,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            authProvider: 'password'
        });

        // Auth state change handler will take over
    } catch (error) {
        console.error('Registration error:', error);
        registerError.textContent = getErrorMessage(error.code);
    }
}

async function handleGoogleSignin() {
    try {
        const result = await auth.signInWithPopup(googleProvider);

        // Check if this is a new user
        if (result.additionalUserInfo?.isNewUser) {
            // Store user info in Firestore
            await db.collection('users').doc(result.user.uid).set({
                email: result.user.email,
                displayName: result.user.displayName,
                company: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                authProvider: 'google'
            });
        }

        // Auth state change handler will take over
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast(getErrorMessage(error.code), 'error');
        }
    }
}

async function handleSignout() {
    try {
        await auth.signOut();
        // Auth state change handler will show auth screen
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Error signing out', 'error');
    }
}

function showScreen(screen) {
    loadingScreen.classList.remove('active');
    authScreen.classList.remove('active');
    deniedScreen.classList.remove('active');

    switch (screen) {
        case 'loading':
            loadingScreen.classList.add('active');
            break;
        case 'auth':
            authScreen.classList.add('active');
            break;
        case 'denied':
            deniedScreen.classList.add('active');
            break;
    }
}

function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
        'auth/network-request-failed': 'Network error. Please check your connection.'
    };

    return messages[code] || 'An error occurred. Please try again.';
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
