/**
 * Lanting Digital - Client Portal Landing
 * Auth for "Coming Soon" landing page
 */

// DOM Elements
const loginSection = document.getElementById('login-section');
const welcomeSection = document.getElementById('welcome-section');
const googleSignInBtn = document.getElementById('google-signin-btn');
const signOutBtn = document.getElementById('signout-btn');
const userNameSpan = document.getElementById('user-name');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// Auth State Handler
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        showWelcome(user);
    } else {
        // User is signed out
        showLogin();
    }
});

// Show Login Section
function showLogin() {
    loginSection.style.display = 'block';
    welcomeSection.style.display = 'none';

    // Reset all buttons to default state
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';

    const submitBtn = loginForm.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }

    // Clear any error messages
    hideError();

    // Clear form fields
    loginEmail.value = '';
    loginPassword.value = '';
}

// Show Welcome Section
function showWelcome(user) {
    loginSection.style.display = 'none';
    welcomeSection.style.display = 'block';

    // Set user's name
    const displayName = user.displayName || user.email.split('@')[0];
    userNameSpan.textContent = displayName;

    // Trigger opening animation
    document.body.classList.add('is-preload');
    setTimeout(() => {
        document.body.classList.remove('is-preload');
    }, 100);
}

// Show Error Message with animation
function showError(message) {
    loginError.innerHTML = message;
    loginError.classList.add('show');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideError();
    }, 5000);
}

// Hide Error Message with animation
function hideError() {
    loginError.classList.remove('show');
    // Clear text after animation completes
    setTimeout(() => {
        if (!loginError.classList.contains('show')) {
            loginError.innerHTML = '';
        }
    }, 300);
}

// Google Sign In
googleSignInBtn.addEventListener('click', async () => {
    try {
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;

        // Check if user is an approved client in Firestore
        const clientDoc = await db.collection('clients').where('email', '==', user.email).limit(1).get();

        if (clientDoc.empty) {
            // User not found - sign them out and show message
            await auth.signOut();
            // Delay to let login screen settle, then animate error in
            setTimeout(() => {
                showError('No account found.<br>Contact caleb@lantingdigital.com to get started.');
            }, 400);
            return;
        }

        // User is approved - auth state change handler will update UI
    } catch (error) {
        console.error('Sign in error:', error);

        // Reset button
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';

        // Show error to user
        if (error.code !== 'auth/popup-closed-by-user') {
            showError('Google sign in failed. Please try again.');
        }
    }
});

// Email/Password Sign In
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }

    const submitBtn = loginForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

        await auth.signInWithEmailAndPassword(email, password);
        // Auth state change handler will update UI
    } catch (error) {
        console.error('Sign in error:', error);

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        // Show user-friendly error
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                showError('Invalid email or password.');
                break;
            case 'auth/too-many-requests':
                showError('Too many attempts. Please try again later.');
                break;
            case 'auth/invalid-email':
                showError('Please enter a valid email address.');
                break;
            default:
                showError('Sign in failed. Please try again.');
        }
    }
});

// Sign Out with closing animation
signOutBtn.addEventListener('click', async () => {
    try {
        // Step 1: Trigger closing animation (collapse + fade background)
        document.body.classList.add('is-closing');

        // Step 2: Wait for close animation to fully complete, then switch sections
        setTimeout(async () => {
            // Keep closing class, add preload for the switch
            document.body.classList.add('is-preload');
            document.body.classList.remove('is-closing');

            await auth.signOut();
            // showLogin will be called by auth state change

            // Step 3: After section switch, animate login open
            setTimeout(() => {
                document.body.classList.remove('is-preload');
            }, 150);
        }, 1000);
    } catch (error) {
        console.error('Sign out error:', error);
    }
});
