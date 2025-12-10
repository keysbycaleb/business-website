// Authentication Logic for Lanting Digital Admin Panel

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        showDashboard(user);
    } else {
        // User is signed out
        showLogin();
    }
});

// Show Login Screen
function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
    loginError.textContent = '';
}

// Show Dashboard Screen
function showDashboard(user) {
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    userEmailSpan.textContent = user.email;

    // Initialize dashboard
    if (typeof initDashboard === 'function') {
        initDashboard();
    }
}

// Handle Login
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
