/**
 * Lanting Digital - Client Portal
 * Complete auth system with custom password reset and client onboarding
 */

// Initialize Firebase Functions
const functions = firebase.app().functions('us-central1');

// Cloud Function references
const requestPasswordResetFn = functions.httpsCallable('requestPasswordReset');
const validateAuthTokenFn = functions.httpsCallable('validateAuthToken');
const resetPasswordFn = functions.httpsCallable('resetPassword');
const completeOnboardingFn = functions.httpsCallable('completeOnboarding');
const changePasswordFn = functions.httpsCallable('changePassword');

// DOM Elements - Login
const loginSection = document.getElementById('login-section');
const welcomeSection = document.getElementById('welcome-section');
const googleSignInBtn = document.getElementById('google-signin-btn');
const signOutBtn = document.getElementById('signout-btn');
const userNameSpan = document.getElementById('user-name');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const forgotPasswordLink = document.getElementById('forgot-password-link');

// DOM Elements - Forgot Password
const forgotPasswordSection = document.getElementById('forgot-password-section');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotEmail = document.getElementById('forgot-email');
const forgotError = document.getElementById('forgot-error');
const forgotSuccess = document.getElementById('forgot-success');
const backToLoginLink = document.getElementById('back-to-login');

// DOM Elements - Reset Password
const resetPasswordSection = document.getElementById('reset-password-section');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetPassword = document.getElementById('reset-password');
const resetPasswordConfirm = document.getElementById('reset-password-confirm');
const resetError = document.getElementById('reset-error');
const resetUserName = document.getElementById('reset-user-name');

// DOM Elements - Setup/Onboarding
const setupSection = document.getElementById('setup-section');
const setupForm = document.getElementById('setup-form');
const setupPassword = document.getElementById('setup-password');
const setupPasswordConfirm = document.getElementById('setup-password-confirm');
const setupError = document.getElementById('setup-error');
const setupUserName = document.getElementById('setup-user-name');

// DOM Elements - Token Error
const tokenErrorSection = document.getElementById('token-error-section');
const tokenErrorMessage = document.getElementById('token-error-message');
const tokenErrorLoginLink = document.getElementById('token-error-login');

// State
let currentToken = null;
let currentTokenType = null;
let authCheckComplete = false;

// =====================
// Section Navigation
// =====================

// All sections for easy management
const allSections = [
    loginSection,
    welcomeSection,
    forgotPasswordSection,
    resetPasswordSection,
    setupSection,
    tokenErrorSection
];

// Hide all sections
function hideAllSections() {
    allSections.forEach(section => {
        if (section) section.style.display = 'none';
    });
}

// Show a specific section with animation
function showSection(section) {
    hideAllSections();
    if (section) {
        section.style.display = 'block';
        // Trigger animation
        document.body.classList.add('is-preload');
        setTimeout(() => {
            document.body.classList.remove('is-preload');
        }, 100);
    }
}

// Animate section transition (close current, open new)
function transitionToSection(newSection) {
    document.body.classList.add('is-closing');

    setTimeout(() => {
        document.body.classList.add('is-preload');
        document.body.classList.remove('is-closing');

        hideAllSections();
        if (newSection) newSection.style.display = 'block';

        setTimeout(() => {
            document.body.classList.remove('is-preload');
        }, 150);
    }, 800);
}

// =====================
// Error/Success Messages
// =====================

function showError(element, message) {
    if (!element) return;
    element.innerHTML = message;
    element.classList.add('show');

    setTimeout(() => {
        hideError(element);
    }, 5000);
}

function hideError(element) {
    if (!element) return;
    element.classList.remove('show');
    setTimeout(() => {
        if (!element.classList.contains('show')) {
            element.innerHTML = '';
        }
    }, 300);
}

function showSuccess(element, message) {
    if (!element) return;
    element.innerHTML = message;
    element.classList.add('show');
}

function hideSuccess(element) {
    if (!element) return;
    element.classList.remove('show');
    setTimeout(() => {
        if (!element.classList.contains('show')) {
            element.innerHTML = '';
        }
    }, 300);
}

// =====================
// URL Parameter Handling
// =====================

function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        action: params.get('action'),
        token: params.get('token')
    };
}

function clearURLParams() {
    const url = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, url);
}

// =====================
// Token Validation & Routing
// =====================

async function handleURLAction() {
    const { action, token } = getURLParams();

    if (!action || !token) {
        return false; // No special action needed
    }

    currentToken = token;

    // Validate the token
    try {
        const result = await validateAuthTokenFn({ token });
        const data = result.data;

        if (!data.valid) {
            // Show error section
            tokenErrorMessage.textContent = data.error || 'This link is invalid or has expired.';
            showSection(tokenErrorSection);
            clearURLParams();
            return true;
        }

        currentTokenType = data.type;

        if (data.type === 'password_reset') {
            // Show reset password section
            if (data.clientName) {
                resetUserName.textContent = data.clientName;
            }
            showSection(resetPasswordSection);
            clearURLParams();
            return true;
        } else if (data.type === 'invitation') {
            // Show setup section
            if (data.clientName) {
                setupUserName.textContent = data.clientName;
            }
            showSection(setupSection);
            clearURLParams();
            return true;
        }
    } catch (error) {
        console.error('Token validation error:', error);
        tokenErrorMessage.textContent = 'Unable to validate link. Please try again.';
        showSection(tokenErrorSection);
        clearURLParams();
        return true;
    }

    return false;
}

// =====================
// Auth State Handler
// =====================

auth.onAuthStateChanged(async (user) => {
    // First check URL params for special actions
    if (!authCheckComplete) {
        const handled = await handleURLAction();
        authCheckComplete = true;

        if (handled) {
            return; // URL action took over, don't process auth state
        }
    }

    // If we're on a special section (reset, setup, error), don't switch away
    if (resetPasswordSection.style.display === 'block' ||
        setupSection.style.display === 'block' ||
        tokenErrorSection.style.display === 'block') {
        return;
    }

    if (user) {
        showWelcome(user);
    } else {
        showLogin();
    }
});

// =====================
// Login Functions
// =====================

function showLogin() {
    showSection(loginSection);

    // Reset all buttons to default state
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';

    const submitBtn = loginForm.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }

    // Clear any error messages
    hideError(loginError);

    // Clear form fields
    loginEmail.value = '';
    loginPassword.value = '';
}

function showWelcome(user) {
    hideAllSections();
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

// =====================
// Google Sign In
// =====================

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
            setTimeout(() => {
                showError(loginError, 'No account found.<br>Contact caleb@lantingdigital.com to get started.');
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
            showError(loginError, 'Google sign in failed. Please try again.');
        }
    }
});

// =====================
// Email/Password Sign In
// =====================

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showError(loginError, 'Please enter both email and password.');
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
                showError(loginError, 'Invalid email or password.');
                break;
            case 'auth/too-many-requests':
                showError(loginError, 'Too many attempts. Please try again later.');
                break;
            case 'auth/invalid-email':
                showError(loginError, 'Please enter a valid email address.');
                break;
            default:
                showError(loginError, 'Sign in failed. Please try again.');
        }
    }
});

// =====================
// Sign Out
// =====================

signOutBtn.addEventListener('click', async () => {
    try {
        // Trigger closing animation
        document.body.classList.add('is-closing');

        setTimeout(async () => {
            document.body.classList.add('is-preload');
            document.body.classList.remove('is-closing');

            await auth.signOut();

            setTimeout(() => {
                document.body.classList.remove('is-preload');
            }, 150);
        }, 1000);
    } catch (error) {
        console.error('Sign out error:', error);
    }
});

// =====================
// Forgot Password
// =====================

forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    transitionToSection(forgotPasswordSection);
    hideError(forgotError);
    hideSuccess(forgotSuccess);
    forgotEmail.value = '';
});

backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    transitionToSection(loginSection);
});

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = forgotEmail.value.trim();

    if (!email) {
        showError(forgotError, 'Please enter your email address.');
        return;
    }

    const submitBtn = forgotPasswordForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        hideError(forgotError);
        hideSuccess(forgotSuccess);

        await requestPasswordResetFn({ email });

        // Always show success (to prevent email enumeration)
        showSuccess(forgotSuccess, '<i class="fas fa-check-circle"></i> If an account exists, a reset link has been sent to your email.');
        forgotEmail.value = '';

    } catch (error) {
        console.error('Password reset error:', error);
        showError(forgotError, 'Unable to send reset email. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// =====================
// Reset Password
// =====================

resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = resetPassword.value;
    const confirmPassword = resetPasswordConfirm.value;

    if (!password || !confirmPassword) {
        showError(resetError, 'Please fill in both password fields.');
        return;
    }

    if (password.length < 8) {
        showError(resetError, 'Password must be at least 8 characters.');
        return;
    }

    if (password !== confirmPassword) {
        showError(resetError, 'Passwords do not match.');
        return;
    }

    const submitBtn = resetPasswordForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting password...';

        hideError(resetError);

        await resetPasswordFn({ token: currentToken, newPassword: password });

        // Success - show login with success message
        currentToken = null;
        currentTokenType = null;

        transitionToSection(loginSection);

        setTimeout(() => {
            showSuccess(loginError, '<i class="fas fa-check-circle"></i> Password reset successfully. Please sign in.');
            loginError.classList.add('show');
            loginError.style.color = '#22c55e';
        }, 1000);

    } catch (error) {
        console.error('Reset password error:', error);
        showError(resetError, error.message || 'Failed to reset password. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// =====================
// Account Setup (Onboarding)
// =====================

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = setupPassword.value;
    const confirmPassword = setupPasswordConfirm.value;

    if (!password || !confirmPassword) {
        showError(setupError, 'Please fill in both password fields.');
        return;
    }

    if (password.length < 8) {
        showError(setupError, 'Password must be at least 8 characters.');
        return;
    }

    if (password !== confirmPassword) {
        showError(setupError, 'Passwords do not match.');
        return;
    }

    const submitBtn = setupForm.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting up...';

        hideError(setupError);

        const result = await completeOnboardingFn({ token: currentToken, password });

        // Auto-login with custom token
        if (result.data.customToken) {
            await auth.signInWithCustomToken(result.data.customToken);
            // Auth state change will handle showing welcome
        } else {
            // Fallback - show login
            currentToken = null;
            currentTokenType = null;
            transitionToSection(loginSection);

            setTimeout(() => {
                showSuccess(loginError, '<i class="fas fa-check-circle"></i> Account created! Please sign in.');
                loginError.classList.add('show');
                loginError.style.color = '#22c55e';
            }, 1000);
        }

    } catch (error) {
        console.error('Setup error:', error);
        showError(setupError, error.message || 'Failed to complete setup. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// =====================
// Token Error - Back to Login
// =====================

tokenErrorLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    transitionToSection(loginSection);
});
