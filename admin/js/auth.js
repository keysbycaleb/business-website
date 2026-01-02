// Authentication Logic for Lanting Digital Admin Panel

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const sidebarUserName = document.getElementById('sidebar-user-name');
const logoutBtn = document.getElementById('logout-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // Check if user is an admin
        if (isAdminEmail(user.email)) {
            showDashboard(user);
        } else {
            // Not an admin - sign them out
            auth.signOut();
            loginError.textContent = 'Access denied. This portal is for administrators only.';
            showLogin();
        }
    } else {
        // User is signed out
        showLogin();
    }
});

// Show Login Screen
function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');

    // Reset Google sign-in button state
    if (googleSigninBtn) {
        googleSigninBtn.disabled = false;
        googleSigninBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
    }

    // Reset email/password button state
    const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
}

// Show Dashboard Screen
function showDashboard(user) {
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    loginError.textContent = '';

    // Update sidebar user name
    if (sidebarUserName && user.email) {
        // Use display name if available, otherwise extract from email
        if (user.displayName) {
            sidebarUserName.textContent = user.displayName.split(' ')[0];
        } else {
            const name = user.email.split('@')[0];
            sidebarUserName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        }
    }

    // Initialize dashboard
    if (typeof initDashboard === 'function') {
        initDashboard();
    }
}

// Handle Google Sign-In
if (googleSigninBtn) {
    googleSigninBtn.addEventListener('click', async () => {
        googleSigninBtn.disabled = true;
        googleSigninBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        loginError.textContent = '';

        try {
            await auth.signInWithPopup(googleProvider);
            // Auth state observer will handle the redirect and admin check
        } catch (error) {
            console.error('Google sign-in error:', error);

            if (error.code !== 'auth/popup-closed-by-user') {
                loginError.textContent = 'Google sign-in failed. Please try again.';
            }

            googleSigninBtn.disabled = false;
            googleSigninBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
        }
    });
}

// Handle Email/Password Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    loginError.textContent = '';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Auth state observer will handle the redirect
    } catch (error) {
        console.error('Login error:', error);

        // User-friendly error messages
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                loginError.textContent = 'Invalid email or password';
                break;
            case 'auth/invalid-email':
                loginError.textContent = 'Invalid email address';
                break;
            case 'auth/too-many-requests':
                loginError.textContent = 'Too many failed attempts. Please try again later.';
                break;
            default:
                loginError.textContent = 'Login failed. Please try again.';
        }

        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
});

// Handle Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
});
