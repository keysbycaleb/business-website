/**
 * Lanting Digital - Client Portal
 * Handles authentication, navigation, and data loading
 */

// ==================== DOM ELEMENTS ====================
const loginView = document.getElementById('login-view');
const portalView = document.getElementById('portal-view');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const googleSignInBtn = document.getElementById('google-signin-btn');

// Setup elements
const loginSection = document.getElementById('login-section');
const setupSection = document.getElementById('setup-section');
const setupForm = document.getElementById('setup-form');
const setupPassword = document.getElementById('setup-password');
const setupPasswordConfirm = document.getElementById('setup-password-confirm');
const setupError = document.getElementById('setup-error');
const setupEmailDisplay = document.getElementById('setup-email-display');

// Already setup elements
const alreadySetupSection = document.getElementById('already-setup-section');
const alreadySetupWelcome = document.getElementById('already-setup-welcome');
const proceedToPortalBtn = document.getElementById('proceed-to-portal-btn');

// Setup state
let setupToken = null;
let setupEmail = null;

// Portal elements
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const sidebarUserName = document.getElementById('sidebar-user-name');
const sidebarUserEmail = document.getElementById('sidebar-user-email');
const welcomeName = document.getElementById('welcome-name');

// Navigation
const sidebarNavItems = document.querySelectorAll('#sidebar .nav-item[data-section]');
const mobileNavItems = document.querySelectorAll('#mobile-menu .nav-item[data-section]');
const contentSections = document.querySelectorAll('.content-section');
const dashboardCards = document.querySelectorAll('.dashboard-card[data-section]');

// Sign out buttons
const sidebarSignoutBtn = document.getElementById('sidebar-signout-btn');
const mobileSignoutBtn = document.getElementById('mobile-signout-btn');

// Current user data
let currentUser = null;
let currentClientData = null;

// ==================== URL PARAMETER HANDLING ====================
// Check for setup action on page load - runs synchronously first to set flags
const urlParams = new URLSearchParams(window.location.search);
const urlAction = urlParams.get('action');
const urlToken = urlParams.get('token');
const urlEmail = urlParams.get('email');
const urlContractId = urlParams.get('contractId');

// Contract notification tracking
let pendingContractNavigation = null;
let requiredEmail = null;

// Set setup mode flag IMMEDIATELY (before any async operations)
if (urlAction === 'setup' && urlToken) {
    console.log('Setup action detected in URL');
    setupToken = urlToken;

    // Hide login section and show setup section immediately (before validation)
    if (loginSection) loginSection.style.display = 'none';
    if (setupSection) setupSection.style.display = 'block';
}

// Handle contract notification links
if (urlAction === 'contract' && urlEmail) {
    console.log('Contract notification detected in URL');
    requiredEmail = urlEmail.toLowerCase();
    pendingContractNavigation = urlContractId || null;
}

// Process setup action asynchronously
(async function processSetupAction() {
    if (!setupToken) return;

    console.log('Processing setup token...');

    // Force sign out any existing user first
    if (auth.currentUser) {
        console.log('Signing out existing user for setup flow...');
        await auth.signOut();
    }

    // Validate the token
    await validateSetupToken(setupToken);
})();

// Process contract notification asynchronously
(async function processContractNotification() {
    if (!requiredEmail) return;

    console.log('Processing contract notification for:', requiredEmail);

    // If there's a logged-in user but wrong email, sign them out
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() !== requiredEmail) {
        console.log('Signed in as wrong user, signing out for contract flow...');
        await auth.signOut();
        // Prefill login email after signout
        setTimeout(() => {
            if (loginEmail) {
                loginEmail.value = requiredEmail;
            }
        }, 100);
    } else if (!auth.currentUser && loginEmail) {
        // No user logged in - prefill the email field
        loginEmail.value = requiredEmail;
    }
})();

// Validate setup token and show setup form
async function validateSetupToken(token) {
    console.log('Validating setup token...');
    try {
        const validateFn = firebase.functions().httpsCallable('validateAuthToken');
        const result = await validateFn({ token });
        console.log('Token validation result:', result.data);

        if (result.data.valid && result.data.type === 'invitation') {
            setupEmail = result.data.email;
            const clientName = result.data.clientName || '';

            // Update UI with email
            if (setupEmailDisplay) {
                setupEmailDisplay.textContent = setupEmail;
            }

            // Update welcome message if we have a name
            if (clientName) {
                const welcomeH1 = setupSection?.querySelector('h1');
                if (welcomeH1) {
                    welcomeH1.textContent = `Welcome, ${clientName.split(' ')[0]}!`;
                }
            }

            console.log('Token valid - setup form ready for:', setupEmail);
        } else if (result.data.error && result.data.error.includes('already been used')) {
            // Token already used - show the "already set up" screen
            console.log('Token already used - showing welcome back screen');
            showAlreadySetupSection(result.data.clientName || '');
        } else {
            // Invalid/expired token - show error on the setup form
            console.error('Invalid setup token:', result.data.error);
            showSetupError(result.data.error || 'Invalid or expired invitation link. Please contact support.');
            // Clear the token so they can't submit
            setupToken = null;
        }
    } catch (error) {
        console.error('Error validating token:', error);
        showSetupError('Unable to validate invitation. Please try again or contact support.');
        // Clear the token so they can't submit
        setupToken = null;
    }
}

function showSetupSection(clientName) {
    if (loginSection) loginSection.style.display = 'none';
    if (setupSection) setupSection.style.display = 'block';
    if (alreadySetupSection) alreadySetupSection.style.display = 'none';

    // Update welcome message if we have a name
    const welcomeH1 = setupSection?.querySelector('h1');
    if (welcomeH1 && clientName) {
        welcomeH1.textContent = `Welcome, ${clientName.split(' ')[0]}!`;
    }
}

function showAlreadySetupSection(clientName) {
    if (loginSection) loginSection.style.display = 'none';
    if (setupSection) setupSection.style.display = 'none';
    if (alreadySetupSection) alreadySetupSection.style.display = 'block';

    // Update welcome message if we have a name
    if (alreadySetupWelcome && clientName) {
        alreadySetupWelcome.textContent = `Welcome back, ${clientName.split(' ')[0]}!`;
    }

    // Clear token since it's already used
    setupToken = null;
}

function showLoginSection() {
    if (setupSection) setupSection.style.display = 'none';
    if (alreadySetupSection) alreadySetupSection.style.display = 'none';
    if (loginSection) loginSection.style.display = 'block';
}

function showSetupError(message) {
    if (setupError) {
        setupError.textContent = message;
        setupError.classList.add('show');
    }
}

function hideSetupError() {
    if (setupError) {
        setupError.classList.remove('show');
        setupError.textContent = '';
    }
}

function clearUrlParams() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ==================== AUTH STATE ====================
auth.onAuthStateChanged(async (user) => {
    // If we're in setup mode, don't interfere
    if (setupToken && !user) {
        return; // Setup flow will handle UI
    }

    if (user) {
        // Check if user is an approved client
        try {
            const clientQuery = await db.collection('clients')
                .where('email', '==', user.email)
                .limit(1)
                .get();

            if (clientQuery.empty) {
                // Not an approved client
                await auth.signOut();
                setTimeout(() => {
                    showError('No account found.<br>Contact caleb@lantingdigital.com to get started.');
                }, 400);
                return;
            }

            // Store client data
            currentUser = user;
            currentClientData = clientQuery.docs[0].data();
            currentClientData.id = clientQuery.docs[0].id;

            // Clear URL params and setup state
            clearUrlParams();
            setupToken = null;
            setupEmail = null;

            // Show portal
            showPortal(user);
            loadDashboardData();
        } catch (error) {
            console.error('Error checking client:', error);
            showError('Error verifying account. Please try again.');
        }
    } else {
        // Show login (unless in setup mode)
        currentUser = null;
        currentClientData = null;
        if (!setupToken) {
            showLogin();
        }
    }
});

// ==================== VIEW SWITCHING ====================
function showLogin() {
    loginView.style.display = 'block';
    portalView.style.display = 'none';

    // Reset form
    if (loginForm) {
        loginForm.reset();
    }
    hideError();

    // Reset buttons
    if (googleSignInBtn) {
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
    }

    const submitBtn = loginForm?.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }

    // Trigger opening animation
    document.body.classList.add('is-preload');
    setTimeout(() => {
        document.body.classList.remove('is-preload');
    }, 100);
}

function showPortal(user) {
    loginView.style.display = 'none';
    portalView.style.display = 'flex';

    // Update user info
    const displayName = currentClientData?.name || user.displayName || user.email.split('@')[0];
    if (sidebarUserName) sidebarUserName.textContent = displayName;
    if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;
    if (welcomeName) welcomeName.textContent = displayName.split(' ')[0];

    // Check if we came from a contract notification link
    if (pendingContractNavigation || requiredEmail) {
        // Navigate to contracts section
        navigateToSection('contracts');

        // If specific contract ID, navigate to it after contracts load
        if (pendingContractNavigation) {
            setTimeout(() => {
                // After contracts load, try to open the specific contract
                if (contractsCache[pendingContractNavigation]) {
                    const contract = contractsCache[pendingContractNavigation];
                    if (contract.status !== 'signed') {
                        navigateToContractSigning(pendingContractNavigation);
                    } else {
                        viewContract(pendingContractNavigation);
                    }
                }
            }, 1500); // Give time for contracts to load
        }

        // Clear pending navigation
        pendingContractNavigation = null;
        requiredEmail = null;
    } else {
        // Show dashboard by default
        navigateToSection('dashboard');
    }
}

// ==================== ERROR HANDLING ====================
function showError(message) {
    if (loginError) {
        loginError.innerHTML = message;
        loginError.classList.add('show');

        setTimeout(() => {
            hideError();
        }, 5000);
    }
}

function hideError() {
    if (loginError) {
        loginError.classList.remove('show');
        setTimeout(() => {
            if (!loginError.classList.contains('show')) {
                loginError.innerHTML = '';
            }
        }, 300);
    }
}

// ==================== AUTHENTICATION ====================
// Google Sign In
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        try {
            googleSignInBtn.disabled = true;
            googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

            await auth.signInWithPopup(googleProvider);
            // Auth state change handler will update UI
        } catch (error) {
            console.error('Google sign in error:', error);

            googleSignInBtn.disabled = false;
            googleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';

            if (error.code !== 'auth/popup-closed-by-user') {
                showError('Google sign in failed. Please try again.');
            }
        }
    });
}

// Email/Password Sign In
if (loginForm) {
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

            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

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
}

// Sign Out
async function handleSignOut() {
    try {
        // Clear setup state and URL params
        setupToken = null;
        setupEmail = null;
        clearUrlParams();

        await auth.signOut();
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

if (sidebarSignoutBtn) {
    sidebarSignoutBtn.addEventListener('click', handleSignOut);
}

if (mobileSignoutBtn) {
    mobileSignoutBtn.addEventListener('click', handleSignOut);
}

// Proceed to Portal button (for already set up users)
if (proceedToPortalBtn) {
    proceedToPortalBtn.addEventListener('click', () => {
        clearUrlParams();
        showLoginSection();
    });
}

// ==================== ACCOUNT SETUP ====================
// Handle setup form submission
if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideSetupError();

        const password = setupPassword?.value;
        const confirmPassword = setupPasswordConfirm?.value;

        // Validate inputs
        if (!password || !confirmPassword) {
            showSetupError('Please fill in all fields.');
            return;
        }

        if (password.length < 8) {
            showSetupError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showSetupError('Passwords do not match.');
            return;
        }

        if (!setupToken) {
            showSetupError('Invalid setup session. Please use the link from your email.');
            return;
        }

        const submitBtn = setupForm.querySelector('.btn-submit');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

            // Call completeOnboarding function
            const completeFn = firebase.functions().httpsCallable('completeOnboarding');
            const result = await completeFn({
                token: setupToken,
                password: password
            });

            if (result.data.success && result.data.customToken) {
                // Sign in with the custom token
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
                await auth.signInWithCustomToken(result.data.customToken);
                // Auth state handler will take over from here
            } else {
                throw new Error(result.data.message || 'Failed to create account');
            }

        } catch (error) {
            console.error('Setup error:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

            // Show appropriate error message
            const message = error.message || 'Failed to create account. Please try again.';
            showSetupError(message);
        }
    });
}

// ==================== NAVIGATION ====================
function navigateToSection(sectionId) {
    // Update nav items
    sidebarNavItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    mobileNavItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Update content sections
    contentSections.forEach(section => {
        section.classList.toggle('active', section.id === `section-${sectionId}`);
    });

    // Close mobile menu
    if (mobileMenu) {
        mobileMenu.classList.remove('open');
    }

    // Load section data
    loadSectionData(sectionId);
}

// Sidebar navigation
sidebarNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToSection(item.dataset.section);
    });
});

// Mobile navigation
mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToSection(item.dataset.section);
    });
});

// Dashboard cards navigation
dashboardCards.forEach(card => {
    card.addEventListener('click', () => {
        navigateToSection(card.dataset.section);
    });
});

// Mobile menu toggle
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
    });
}

// ==================== DATA LOADING ====================
async function loadDashboardData() {
    if (!currentUser || !currentClientData) return;

    const email = currentUser.email;

    try {
        // Load contracts count
        const contractsSnap = await db.collection('contracts')
            .where('clientEmail', '==', email)
            .where('status', '==', 'signed')
            .get();

        const statContracts = document.getElementById('stat-contracts');
        if (statContracts) {
            statContracts.textContent = contractsSnap.size;
        }

        // Load unread messages count
        const messagesSnap = await db.collection('messages')
            .where('clientEmail', '==', email)
            .where('read', '==', false)
            .where('direction', '==', 'to_client')
            .get();

        const statMessages = document.getElementById('stat-messages');
        if (statMessages) {
            statMessages.textContent = messagesSnap.size;
        }

        // Update badges
        updateMessageBadge(messagesSnap.size);

        // Load unpaid invoices
        const invoicesSnap = await db.collection('invoices')
            .where('clientEmail', '==', email)
            .where('status', 'in', ['pending', 'overdue'])
            .get();

        let totalDue = 0;
        invoicesSnap.forEach(doc => {
            totalDue += doc.data().amount || 0;
        });

        const statInvoices = document.getElementById('stat-invoices');
        if (statInvoices) {
            statInvoices.textContent = formatCurrency(totalDue);
        }

        // Load recent activity
        loadRecentActivity(email);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'contracts':
            loadContracts();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'payments':
            loadPaymentPlans();
            break;
    }
}

// Store contracts data for viewing
let contractsCache = {};

async function loadContracts() {
    if (!currentUser) return;

    const contractsList = document.getElementById('contracts-list');
    if (!contractsList) return;

    contractsList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading contracts...</p></div>';

    try {
        const snapshot = await db.collection('contracts')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            contractsList.innerHTML = '<div class="empty-state"><i class="fas fa-file-contract"></i><p>No contracts yet</p><span class="empty-hint">Your contracts will appear here once they\'re ready.</span></div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const contract = doc.data();
            contractsCache[doc.id] = contract; // Cache for viewing

            const status = contract.status || 'pending';
            const statusClass = status === 'signed' ? 'signed' : 'pending';
            const statusText = status === 'signed' ? 'Signed' : 'Pending';
            const createdDate = contract.createdAt?.toDate ? formatDate(contract.createdAt.toDate()) : 'N/A';
            const amount = contract.amount ? formatCurrency(contract.amount) : 'N/A';

            // Sign button for unsigned contracts - uses in-portal signing
            const signBtn = status !== 'signed'
                ? `<button class="btn-sign" onclick="navigateToContractSigning('${doc.id}')"><i class="fas fa-signature"></i> Sign</button>`
                : '';

            html += `
                <div class="contract-card">
                    <div class="contract-header">
                        <h3 class="contract-title">${contract.contractName || contract.title || contract.projectName || 'Contract'}</h3>
                        <span class="contract-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="contract-meta">
                        <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                        <span><i class="fas fa-dollar-sign"></i> ${amount}</span>
                    </div>
                    <div class="contract-actions">
                        <button class="btn-view" onclick="viewContract('${doc.id}')"><i class="fas fa-eye"></i> View</button>
                        ${signBtn}
                    </div>
                </div>
            `;
        });

        contractsList.innerHTML = html;

    } catch (error) {
        console.error('Error loading contracts:', error);
        contractsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading contracts</p></div>';
    }
}

// View contract in modal
function viewContract(contractId) {
    const contract = contractsCache[contractId];
    if (!contract) return;

    const modal = document.getElementById('contract-modal');
    const title = document.getElementById('contract-modal-title');
    const meta = document.getElementById('contract-modal-meta');
    const content = document.getElementById('contract-modal-content');
    const signLink = document.getElementById('contract-sign-link');

    title.textContent = contract.contractName || contract.title || 'Contract';

    // Build meta info
    const createdDate = contract.createdAt?.toDate ? formatDate(contract.createdAt.toDate()) : 'N/A';
    const signedDate = contract.signedAt?.toDate ? formatDate(contract.signedAt.toDate()) : null;
    const status = contract.status || 'pending';

    let metaHtml = `
        <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">${status === 'signed' ? '✓ Signed' : 'Pending Signature'}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Created</span>
            <span class="meta-value">${createdDate}</span>
        </div>
    `;

    if (signedDate) {
        metaHtml += `
            <div class="meta-item">
                <span class="meta-label">Signed</span>
                <span class="meta-value">${signedDate}</span>
            </div>
        `;
    }

    if (contract.amount) {
        metaHtml += `
            <div class="meta-item">
                <span class="meta-label">Amount</span>
                <span class="meta-value">${formatCurrency(contract.amount)}</span>
            </div>
        `;
    }

    meta.innerHTML = metaHtml;

    // Contract content - sanitize to prevent style leakage
    const rawHtml = contract.contractHtml || '';
    let displayHtml = sanitizeContractHtml(rawHtml) || '<p>Contract content not available.</p>';

    // If signed, append the signature block dynamically
    if (status === 'signed' && contract.signature) {
        const sig = contract.signature;
        const sigDate = contract.signedAt?.toDate ? formatDate(contract.signedAt.toDate()) : 'N/A';
        const portfolioText = contract.portfolioPermission ? 'Yes - Client allows portfolio use' : 'No';

        displayHtml += `
            <div class="signed-signature-block" style="margin-top: 48px; padding-top: 24px; border-top: 2px solid #333;">
                <h2 style="color: #1a1a2e; font-size: 14pt; margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Signatures</h2>
                <div style="display: flex; gap: 40px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <p style="margin-bottom: 4px;"><strong>PROVIDER: Lanting Digital LLC</strong></p>
                        <p style="margin: 4px 0; font-style: italic;">Caleb Lanting</p>
                        <p style="margin: 4px 0;">Name: Caleb Lanting</p>
                        <p style="margin: 4px 0;">Title: Owner / Member</p>
                        <p style="margin: 4px 0;">Date: January 6, 2026</p>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <p style="margin-bottom: 4px;"><strong>CLIENT: ${contract.clientCompany || contract.clientName || 'Client'}</strong></p>
                        <p style="margin: 4px 0; font-style: italic; font-size: 1.2em;">${sig.signatureData || sig.name}</p>
                        <p style="margin: 4px 0;">Name: ${sig.name}</p>
                        <p style="margin: 4px 0;">Title: ${sig.title || 'N/A'}</p>
                        <p style="margin: 4px 0;">Date: ${sigDate}</p>
                    </div>
                </div>
                <p style="margin-top: 16px; font-size: 0.9em; color: #666;"><strong>Portfolio Permission:</strong> ${portfolioText}</p>
            </div>
        `;
    }

    content.innerHTML = displayHtml;

    // Sign button - navigates to in-portal signing
    if (status !== 'signed') {
        signLink.style.display = 'inline-flex';
        signLink.href = '#';
        signLink.onclick = (e) => {
            e.preventDefault();
            closeContractModal();
            navigateToContractSigning(contractId);
        };
    } else {
        signLink.style.display = 'none';
        signLink.onclick = null;
    }

    modal.classList.add('active');
}

function closeContractModal() {
    const modal = document.getElementById('contract-modal');
    modal.classList.remove('active');
}

async function loadMessages() {
    if (!currentUser) return;

    const messagesList = document.getElementById('messages-list');
    if (!messagesList) return;

    messagesList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading messages...</p></div>';

    try {
        const snapshot = await db.collection('messages')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            messagesList.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>No messages yet</p><span class="empty-hint">Send a message below to start a conversation.</span></div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isFromAdmin = msg.direction === 'to_client';
            const from = isFromAdmin ? 'Lanting Digital' : 'You';
            const unreadClass = (isFromAdmin && !msg.read) ? 'unread' : '';
            const time = msg.createdAt?.toDate ? formatRelativeTime(msg.createdAt.toDate()) : '';

            html += `
                <div class="message-item ${unreadClass}" data-id="${doc.id}">
                    <div class="message-header">
                        <span class="message-from">${from}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-body">${msg.content || ''}</div>
                </div>
            `;

            // Mark as read if from admin
            if (isFromAdmin && !msg.read) {
                db.collection('messages').doc(doc.id).update({ read: true });
            }
        });

        messagesList.innerHTML = html;

        // Update badge after marking as read
        updateMessageBadge(0);

    } catch (error) {
        console.error('Error loading messages:', error);
        messagesList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading messages</p></div>';
    }
}

// Store invoices data for viewing
let invoicesCache = {};

async function loadInvoices() {
    if (!currentUser) return;

    const invoicesList = document.getElementById('invoices-list');
    const totalDueEl = document.getElementById('total-due');
    const lastPaymentEl = document.getElementById('last-payment');

    if (!invoicesList) return;

    invoicesList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading invoices...</p></div>';

    try {
        const snapshot = await db.collection('invoices')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            invoicesList.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No invoices yet</p><span class="empty-hint">Invoices will appear here when billing begins.</span></div>';
            if (totalDueEl) totalDueEl.textContent = '$0.00';
            if (lastPaymentEl) lastPaymentEl.textContent = '--';
            return;
        }

        let html = '';
        let totalDue = 0;
        let lastPayment = null;

        snapshot.forEach(doc => {
            const invoice = doc.data();
            invoicesCache[doc.id] = invoice; // Cache for viewing

            const status = invoice.status || 'pending';
            const statusClass = status;
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const date = invoice.createdAt?.toDate ? formatDate(invoice.createdAt.toDate()) : 'N/A';
            const amount = invoice.total || invoice.amount || 0;

            if (status === 'pending' || status === 'overdue') {
                totalDue += amount;
            }

            if (status === 'paid' && invoice.paidAt) {
                const paidDate = invoice.paidAt.toDate ? invoice.paidAt.toDate() : null;
                if (!lastPayment || (paidDate && paidDate > lastPayment)) {
                    lastPayment = paidDate;
                }
            }

            // Pay button for unpaid invoices with payment link
            const canPay = (status === 'pending' || status === 'overdue') && invoice.stripePaymentLink;
            const payBtn = canPay
                ? `<a href="${invoice.stripePaymentLink}" target="_blank" class="btn-pay"><i class="fas fa-credit-card"></i> Pay</a>`
                : '';

            html += `
                <div class="invoice-item">
                    <div class="invoice-info">
                        <span class="invoice-number">${invoice.invoiceNumber || invoice.number || 'Invoice'}</span>
                        <span class="invoice-date">${date}</span>
                    </div>
                    <div>
                        <span class="invoice-amount">${formatCurrency(amount)}</span>
                        <span class="invoice-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="invoice-actions">
                        <button class="btn-view" onclick="viewInvoice('${doc.id}')"><i class="fas fa-eye"></i> View</button>
                        ${payBtn}
                    </div>
                </div>
            `;
        });

        invoicesList.innerHTML = html;

        if (totalDueEl) totalDueEl.textContent = formatCurrency(totalDue);
        if (lastPaymentEl) lastPaymentEl.textContent = lastPayment ? formatDate(lastPayment) : '--';

    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading invoices</p></div>';
    }
}

// View invoice in modal
function viewInvoice(invoiceId) {
    const invoice = invoicesCache[invoiceId];
    if (!invoice) return;

    const modal = document.getElementById('invoice-modal');
    const title = document.getElementById('invoice-modal-title');
    const content = document.getElementById('invoice-modal-content');
    const payLink = document.getElementById('invoice-pay-link');

    title.textContent = invoice.invoiceNumber || invoice.number || 'Invoice';

    const status = invoice.status || 'pending';
    const createdDate = invoice.createdAt?.toDate ? formatDate(invoice.createdAt.toDate()) : 'N/A';
    const dueDate = invoice.dueDate?.toDate ? formatDate(invoice.dueDate.toDate()) : 'Upon Receipt';
    const paidDate = invoice.paidAt?.toDate ? formatDate(invoice.paidAt.toDate()) : null;

    let contentHtml = `
        <div class="invoice-details">
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value invoice-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Invoice Date</span>
                <span class="detail-value">${createdDate}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Due Date</span>
                <span class="detail-value">${dueDate}</span>
            </div>
            ${paidDate ? `
            <div class="detail-row">
                <span class="detail-label">Paid On</span>
                <span class="detail-value">${paidDate}</span>
            </div>
            ` : ''}
    `;

    // Line items
    if (invoice.lineItems && invoice.lineItems.length > 0) {
        contentHtml += `<div class="line-items">`;
        invoice.lineItems.forEach(item => {
            const itemTotal = (item.quantity || 1) * (item.rate || item.unitPrice || 0);
            contentHtml += `
                <div class="line-item">
                    <span>${item.description || 'Item'} × ${item.quantity || 1}</span>
                    <span>${formatCurrency(itemTotal)}</span>
                </div>
            `;
        });
        contentHtml += `</div>`;
    }

    // Total
    const total = invoice.total || invoice.amount || 0;
    contentHtml += `
            <div class="invoice-total">
                <span>Total</span>
                <span>${formatCurrency(total)}</span>
            </div>
        </div>
    `;

    // Notes
    if (invoice.notes) {
        contentHtml += `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <p style="color: rgba(255,255,255,0.6); font-size: 0.875rem;">${invoice.notes}</p>
            </div>
        `;
    }

    content.innerHTML = contentHtml;

    // Pay link
    const canPay = (status === 'pending' || status === 'overdue') && invoice.stripePaymentLink;
    if (canPay) {
        payLink.href = invoice.stripePaymentLink;
        payLink.style.display = 'inline-flex';
    } else {
        payLink.style.display = 'none';
    }

    modal.classList.add('active');
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoice-modal');
    modal.classList.remove('active');
}

// Load payment plans and subscriptions
async function loadPaymentPlans() {
    if (!currentUser) return;

    const plansListEl = document.getElementById('payment-plans-list');
    const subsListEl = document.getElementById('subscriptions-list');
    const activePlansEl = document.getElementById('active-plans-count');
    const monthlyAmountEl = document.getElementById('monthly-amount');

    if (plansListEl) {
        plansListEl.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    }
    if (subsListEl) {
        subsListEl.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';
    }

    try {
        // Load payment plans
        const plansSnapshot = await db.collection('paymentPlans')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        // Load subscriptions
        const subsSnapshot = await db.collection('subscriptions')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        let activePlans = 0;
        let monthlyTotal = 0;

        // Render payment plans
        if (plansSnapshot.empty) {
            if (plansListEl) {
                plansListEl.innerHTML = '<div class="empty-state"><i class="fas fa-credit-card"></i><p>No payment plans</p><span class="empty-hint">Payment plans will appear here if applicable.</span></div>';
            }
        } else {
            let plansHtml = '';
            plansSnapshot.forEach(doc => {
                const plan = doc.data();
                const status = plan.status || 'pending';
                const paidCount = plan.paymentsCompleted || 0;
                const totalPayments = plan.numberOfPayments || 1;
                const progressPercent = Math.round((paidCount / totalPayments) * 100);
                const monthlyAmount = plan.monthlyAmount || (plan.totalAmount / totalPayments) || 0;

                if (status === 'active' || status === 'pending') {
                    activePlans++;
                    monthlyTotal += monthlyAmount;
                }

                const payBtn = (status === 'active' || status === 'pending') && plan.stripePaymentLink
                    ? `<a href="${plan.stripePaymentLink}" target="_blank" class="btn-pay"><i class="fas fa-credit-card"></i> Make Payment</a>`
                    : '';

                plansHtml += `
                    <div class="payment-card">
                        <div class="payment-card-header">
                            <h3 class="payment-card-title">${plan.projectName || 'Payment Plan'}</h3>
                            <span class="payment-card-type payment-plan">Payment Plan</span>
                        </div>
                        <div class="payment-card-meta">
                            <span><i class="fas fa-dollar-sign"></i> ${formatCurrency(monthlyAmount)}/month</span>
                            <span><i class="fas fa-coins"></i> ${formatCurrency(plan.totalAmount || 0)} total</span>
                        </div>
                        <div class="payment-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                            <span class="progress-text">${paidCount} of ${totalPayments} payments completed</span>
                        </div>
                        <span class="payment-card-status ${status}">${status}</span>
                        ${payBtn ? `<div class="payment-card-actions">${payBtn}</div>` : ''}
                    </div>
                `;
            });
            if (plansListEl) plansListEl.innerHTML = plansHtml;
        }

        // Render subscriptions
        if (subsSnapshot.empty) {
            if (subsListEl) {
                subsListEl.innerHTML = '<div class="empty-state"><i class="fas fa-sync-alt"></i><p>No subscriptions</p><span class="empty-hint">Recurring subscriptions will appear here.</span></div>';
            }
        } else {
            let subsHtml = '';
            subsSnapshot.forEach(doc => {
                const sub = doc.data();
                const status = sub.status || 'pending';
                const monthlyAmount = sub.monthlyAmount || sub.amount || 0;

                if (status === 'active') {
                    activePlans++;
                    monthlyTotal += monthlyAmount;
                }

                // Plan name display
                const planName = sub.planTier
                    ? `${sub.planType?.charAt(0).toUpperCase()}${sub.planType?.slice(1)} - ${sub.planTier.charAt(0).toUpperCase()}${sub.planTier.slice(1)}`
                    : (sub.planName || 'Subscription');

                const nextBilling = sub.currentPeriodEnd?.toDate
                    ? formatDate(sub.currentPeriodEnd.toDate())
                    : 'N/A';

                const payBtn = status === 'pending' && sub.stripePaymentLink
                    ? `<a href="${sub.stripePaymentLink}" target="_blank" class="btn-pay"><i class="fas fa-credit-card"></i> Activate</a>`
                    : '';

                subsHtml += `
                    <div class="payment-card">
                        <div class="payment-card-header">
                            <h3 class="payment-card-title">${planName}</h3>
                            <span class="payment-card-type subscription">Subscription</span>
                        </div>
                        <div class="payment-card-meta">
                            <span><i class="fas fa-dollar-sign"></i> ${formatCurrency(monthlyAmount)}/month</span>
                            ${status === 'active' ? `<span><i class="fas fa-calendar"></i> Next: ${nextBilling}</span>` : ''}
                        </div>
                        <span class="payment-card-status ${status}">${status}</span>
                        ${payBtn ? `<div class="payment-card-actions">${payBtn}</div>` : ''}
                    </div>
                `;
            });
            if (subsListEl) subsListEl.innerHTML = subsHtml;
        }

        // Update summary
        if (activePlansEl) activePlansEl.textContent = activePlans;
        if (monthlyAmountEl) monthlyAmountEl.textContent = formatCurrency(monthlyTotal);

    } catch (error) {
        console.error('Error loading payment plans:', error);
        if (plansListEl) {
            plansListEl.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading data</p></div>';
        }
        if (subsListEl) {
            subsListEl.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading data</p></div>';
        }
    }
}

async function loadRecentActivity(email) {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    try {
        // Get recent contracts, messages, invoices
        const activities = [];

        // Recent contracts
        const contracts = await db.collection('contracts')
            .where('clientEmail', '==', email)
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();

        contracts.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'contract',
                icon: 'fa-file-contract',
                text: `Contract "${data.title || 'Contract'}" ${data.status === 'signed' ? 'signed' : 'created'}`,
                time: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
            });
        });

        // Recent messages from admin
        const messages = await db.collection('messages')
            .where('clientEmail', '==', email)
            .where('direction', '==', 'to_client')
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();

        messages.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'message',
                icon: 'fa-comment',
                text: 'New message from Lanting Digital',
                time: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
            });
        });

        // Sort by time
        activities.sort((a, b) => b.time - a.time);

        if (activities.length === 0) {
            activityList.innerHTML = '<div class="activity-empty"><i class="fas fa-clock"></i><p>No recent activity</p></div>';
            return;
        }

        let html = '';
        activities.slice(0, 5).forEach(activity => {
            html += `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas ${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">${activity.text}</p>
                        <span class="activity-time">${formatRelativeTime(activity.time)}</span>
                    </div>
                </div>
            `;
        });

        activityList.innerHTML = html;

    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// ==================== MESSAGE SENDING ====================
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser || !messageInput.value.trim()) return;

        const submitBtn = messageForm.querySelector('.btn-send');
        const originalText = submitBtn.innerHTML;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            await db.collection('messages').add({
                clientEmail: currentUser.email,
                clientName: currentClientData?.name || currentUser.displayName || 'Client',
                content: messageInput.value.trim(),
                direction: 'to_admin',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            messageInput.value = '';
            loadMessages();

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// ==================== UTILITIES ====================

// Sanitize contract HTML to prevent style leakage
function sanitizeContractHtml(html) {
    if (!html) return '';

    // Remove <style> tags and their content
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove <head> tags and their content
    html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');

    // Remove <meta> tags
    html = html.replace(/<meta[^>]*>/gi, '');

    // Remove <title> tags and their content
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');

    // Remove <html> and </html> tags
    html = html.replace(/<\/?html[^>]*>/gi, '');

    // Remove <body> and </body> tags (but keep content)
    html = html.replace(/<\/?body[^>]*>/gi, '');

    // Remove <!DOCTYPE> declarations
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

    return html.trim();
}

function updateMessageBadge(count) {
    const sidebarBadge = document.getElementById('sidebar-msg-badge');
    const mobileBadge = document.getElementById('mobile-msg-badge');

    if (sidebarBadge) {
        sidebarBadge.textContent = count;
        sidebarBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    if (mobileBadge) {
        mobileBadge.textContent = count;
        mobileBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
}

// ==================== MODAL HELPERS ====================
// Close modals on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeContractModal();
        closeInvoiceModal();
        closeLegalModal();
    }
});

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeContractModal();
            closeInvoiceModal();
            closeLegalModal();
        }
    });
});

// ==================== CONTRACT SIGNING ====================
let currentSigningContractId = null;
let currentSigningContract = null;

// Contract signing elements
const signingContractTitle = document.getElementById('signing-contract-title');
const signingContractContent = document.getElementById('signing-contract-content');
const signatureForm = document.getElementById('signature-form');
const signerName = document.getElementById('signer-name');
const signerTitle = document.getElementById('signer-title');
const signerEmail = document.getElementById('signer-email');
const portfolioPermission = document.getElementById('portfolio-permission');
const signatureError = document.getElementById('signature-error');
const backToContractsBtn = document.getElementById('back-to-contracts');

// Inline signature elements
const signatureInput = document.getElementById('signature-input');
const legalAcknowledgment = document.getElementById('legal-acknowledgment');
const signContractBtn = document.getElementById('sign-contract-btn');

// Navigate to contract signing section
function navigateToContractSigning(contractId) {
    const contract = contractsCache[contractId];
    if (!contract) {
        console.error('Contract not found:', contractId);
        return;
    }

    // Debug: log the contract data
    console.log('Contract data:', contract);
    console.log('Contract HTML field:', contract.contractHtml ? 'EXISTS (' + contract.contractHtml.length + ' chars)' : 'MISSING');

    // Check if already signed
    if (contract.status === 'signed') {
        alert('This contract has already been signed.');
        return;
    }

    currentSigningContractId = contractId;
    currentSigningContract = contract;

    // Update title
    if (signingContractTitle) {
        signingContractTitle.textContent = contract.contractName || contract.title || 'Contract';
    }

    // Load contract content - sanitize to prevent style leakage
    if (signingContractContent) {
        const rawHtmlContent = contract.contractHtml || contract.htmlContent || contract.content;
        console.log('Using HTML content:', rawHtmlContent ? 'Found (' + rawHtmlContent.length + ' chars)' : 'Not found');
        const sanitizedHtml = sanitizeContractHtml(rawHtmlContent);
        signingContractContent.innerHTML = sanitizedHtml || '<p>Contract content not available. Please contact admin.</p>';
    }

    // Pre-fill signer info
    if (signerName && currentClientData?.name) {
        signerName.value = currentClientData.name;
    }
    if (signerEmail && currentUser?.email) {
        signerEmail.value = currentUser.email;
    }
    if (signerTitle) {
        signerTitle.value = '';
    }
    if (portfolioPermission) {
        portfolioPermission.checked = false;
    }

    // Reset inline signature fields
    if (signatureInput) {
        signatureInput.value = '';
    }
    if (legalAcknowledgment) {
        legalAcknowledgment.checked = false;
    }
    if (signContractBtn) {
        signContractBtn.disabled = true;
    }

    // Clear any previous errors
    hideSignatureError();

    // Navigate to signing section
    contentSections.forEach(section => {
        section.classList.remove('active');
    });

    const signingSection = document.getElementById('section-contract-signing');
    if (signingSection) {
        signingSection.classList.add('active');
    }

    // Clear nav active states (signing isn't a main nav item)
    sidebarNavItems.forEach(item => item.classList.remove('active'));
    mobileNavItems.forEach(item => item.classList.remove('active'));
}

// Back to contracts button
if (backToContractsBtn) {
    backToContractsBtn.addEventListener('click', () => {
        currentSigningContractId = null;
        currentSigningContract = null;
        navigateToSection('contracts');
    });
}

// Enable/disable sign button based on signature input and checkbox
function updateSignButtonState() {
    if (!signContractBtn) return;

    const hasSignature = signatureInput?.value?.trim().length > 0;
    const hasAcknowledgment = legalAcknowledgment?.checked || false;
    const hasName = signerName?.value?.trim().length > 0;

    signContractBtn.disabled = !(hasSignature && hasAcknowledgment && hasName);
}

// Listen for changes to enable/disable sign button
if (signatureInput) {
    signatureInput.addEventListener('input', updateSignButtonState);
}
if (legalAcknowledgment) {
    legalAcknowledgment.addEventListener('change', updateSignButtonState);
}
if (signerName) {
    signerName.addEventListener('input', updateSignButtonState);
}

// Signature form submission - submits directly
if (signatureForm) {
    signatureForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideSignatureError();

        // Validate form
        const name = signerName?.value?.trim();
        const email = signerEmail?.value?.trim();
        const signature = signatureInput?.value?.trim();
        const acknowledged = legalAcknowledgment?.checked;

        if (!name) {
            showSignatureError('Please enter your full legal name.');
            return;
        }

        if (!email) {
            showSignatureError('Email is required.');
            return;
        }

        if (!signature) {
            showSignatureError('Please type your signature.');
            return;
        }

        if (!acknowledged) {
            showSignatureError('Please acknowledge the legal terms.');
            return;
        }

        if (!currentSigningContractId) {
            showSignatureError('No contract selected. Please try again.');
            return;
        }

        // Submit directly
        await submitSignature();
    });
}

// Submit signature to backend
async function submitSignature() {
    const signatureData = signatureInput?.value?.trim();
    const name = signerName?.value?.trim();
    const title = signerTitle?.value?.trim();
    const email = signerEmail?.value?.trim();
    const allowPortfolio = portfolioPermission?.checked || false;

    if (!signatureData || !name || !email || !currentSigningContractId) {
        showSignatureError('Missing required information. Please try again.');
        return;
    }

    // Update button state
    if (signContractBtn) {
        signContractBtn.disabled = true;
        signContractBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing...';
    }

    try {
        // Call signContract Cloud Function
        const signContractFn = firebase.functions().httpsCallable('signContract');
        const result = await signContractFn({
            contractId: currentSigningContractId,
            signature: {
                name: name,
                title: title || '',
                email: email,
                signatureData: signatureData
            },
            portfolioPermission: allowPortfolio
        });

        if (result.data.success) {
            // Update cache
            if (contractsCache[currentSigningContractId]) {
                contractsCache[currentSigningContractId].status = 'signed';
            }

            // Show success message and go back to contracts
            alert('Contract signed successfully!');
            currentSigningContractId = null;
            currentSigningContract = null;
            navigateToSection('contracts');

            // Reload dashboard data
            loadDashboardData();
        } else {
            throw new Error(result.data.message || 'Failed to sign contract');
        }

    } catch (error) {
        console.error('Error signing contract:', error);
        showSignatureError(error.message || 'Failed to sign contract. Please try again.');
    } finally {
        // Reset button state
        if (signContractBtn) {
            signContractBtn.disabled = false;
            signContractBtn.innerHTML = '<i class="fas fa-signature"></i> Sign Contract';
        }
    }
}

function showSignatureError(message) {
    if (signatureError) {
        signatureError.textContent = message;
        signatureError.classList.add('show');
    }
}

function hideSignatureError() {
    if (signatureError) {
        signatureError.classList.remove('show');
        signatureError.textContent = '';
    }
}

// Make navigateToContractSigning available globally for contract cards
window.navigateToContractSigning = navigateToContractSigning;

// ==================== PAGE LOAD ====================
window.addEventListener('load', function() {
    setTimeout(function() {
        document.body.classList.remove('is-preload');
    }, 100);
});
