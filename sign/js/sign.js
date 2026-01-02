// Lanting Digital - Contract Signing Logic
// Typed signature with modal acknowledgment

// DOM Elements - Screens
const loadingScreen = document.getElementById('loading-screen');
const errorScreen = document.getElementById('error-screen');
const signedScreen = document.getElementById('signed-screen');
const signingScreen = document.getElementById('signing-screen');
const successScreen = document.getElementById('success-screen');
const errorMessage = document.getElementById('error-message');
const signedDate = document.getElementById('signed-date');

// Contract display
const contractContent = document.getElementById('contract-content');

// Form elements
const signingForm = document.getElementById('signing-form');
const inputName = document.getElementById('input-name');
const inputTitle = document.getElementById('input-title');
const inputEntity = document.getElementById('input-entity');
const inputSignature = document.getElementById('input-signature');
const signatureHint = document.getElementById('signature-hint');
const signatureAcknowledged = document.getElementById('signature-acknowledged');
const submitBtn = document.getElementById('submit-btn');

// Signature Modal elements
const signatureModal = document.getElementById('signature-modal');
const modalSignatureInput = document.getElementById('modal-signature-input');
const signaturePreview = document.getElementById('signature-preview');
const signatureAcknowledgeCheckbox = document.getElementById('signature-acknowledge-checkbox');
const signatureConfirmBtn = document.getElementById('signature-confirm-btn');
const signatureCancelBtn = document.getElementById('signature-cancel-btn');
const signatureModalClose = document.getElementById('signature-modal-close');

// Success screen elements
const successContractName = document.getElementById('success-contract-name');
const successTimestamp = document.getElementById('success-timestamp');

// State
let currentContract = null;
let signatureConfirmed = false;
let currentUser = null;
let contractId = null;
let isProcessingAuth = false;
let hasInitialized = false;
let authProcessedOnce = false;
let lastAuthTime = 0;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Prevent double initialization
    if (hasInitialized) return;
    hasInitialized = true;

    console.log('[Sign] Initializing...');

    // Get contract ID from URL
    contractId = getContractIdFromUrl();

    if (!contractId) {
        showError('No contract ID provided in the URL.');
        return;
    }

    // SECURITY: Set session-only persistence (doesn't persist after browser/tab close)
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        console.log('[Sign] Auth persistence set to SESSION');
    } catch (e) {
        console.warn('[Sign] Could not set auth persistence:', e);
    }

    // SECURITY: Sign out any existing session on page load - require fresh sign-in every time
    if (auth.currentUser) {
        console.log('[Sign] Clearing existing session for security...');
        await auth.signOut();
    }

    // Setup login button handler
    setupLoginHandler();

    // Setup inactivity timeout (5 minutes)
    setupInactivityTimeout();

    // Show login screen - always require sign-in
    showScreen('login');

    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
        const now = Date.now();

        // Debounce: ignore auth changes within 1 second of each other
        if (now - lastAuthTime < 1000) {
            console.log('[Sign] Auth change debounced (too fast)');
            return;
        }
        lastAuthTime = now;

        // Prevent multiple simultaneous auth processing
        if (isProcessingAuth) {
            console.log('[Sign] Auth already processing, skipping...');
            return;
        }

        isProcessingAuth = true;
        console.log('[Sign] Processing auth state change, user:', user ? user.email : 'none');

        try {
            if (user) {
                currentUser = user;

                // If we already processed auth once and user is the same, skip
                if (authProcessedOnce && currentContract) {
                    console.log('[Sign] Auth already processed, contract loaded, skipping...');
                    isProcessingAuth = false;
                    return;
                }

                // Load contract and verify access
                const hasAccess = await loadContractWithAccessCheck(contractId, user.email);

                if (hasAccess) {
                    authProcessedOnce = true;

                    // Setup form handlers (only once)
                    if (!signingForm.dataset.handlersAttached) {
                        setupFormHandlers();
                        setupLivePreview();
                        setupSignatureModal();
                        signingForm.dataset.handlersAttached = 'true';
                    }

                    // Pre-fill name from user profile if available
                    if (user.displayName && !inputName.value) {
                        inputName.value = user.displayName;
                        inputName.dispatchEvent(new Event('input'));
                    }
                }
            } else {
                console.log('[Sign] User not authenticated, showing login');
                currentUser = null;
                authProcessedOnce = false;
                showLoginScreen();
            }
        } catch (error) {
            console.error('[Sign] Auth processing error:', error);
            showError('An error occurred. Please refresh the page and try again.');
        } finally {
            isProcessingAuth = false;
        }
    });
}

// Setup login button handler
function setupLoginHandler() {
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }
}

// Handle Google login on sign page
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    }

    try {
        await auth.signInWithPopup(googleProvider);
        // Auth state change handler will take over
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast('Sign-in failed. Please try again.', 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
        }
    }
}

// Show login screen
function showLoginScreen() {
    showScreen('login');
}

async function loadContractWithAccessCheck(contractId, userEmail) {
    try {
        console.log('[Sign] Loading contract:', contractId, 'for user:', userEmail);
        console.log('[Sign] Fetching from Firestore...');
        const doc = await db.collection(CONTRACTS_COLLECTION).doc(contractId).get();
        console.log('[Sign] Firestore response received, exists:', doc.exists);

        if (!doc.exists) {
            showError('This contract does not exist or has been removed.');
            return false;
        }

        currentContract = { id: doc.id, ...doc.data() };
        console.log('[Sign] Contract data loaded, status:', currentContract.status);

        // SECURITY: Check if contract has email restriction
        console.log('[Sign] Contract clientEmail:', currentContract.clientEmail || 'NOT SET');
        console.log('[Sign] User signed in as:', userEmail);

        if (currentContract.clientEmail) {
            const contractEmail = String(currentContract.clientEmail).toLowerCase().trim();
            const signInEmail = String(userEmail).toLowerCase().trim();

            console.log('[Sign] Email comparison:', signInEmail, '===', contractEmail, '?', signInEmail === contractEmail);

            if (signInEmail !== contractEmail) {
                console.log('[Sign] ACCESS DENIED - Email mismatch');
                showAccessDenied(userEmail, currentContract.clientEmail);
                return false;
            }
            console.log('[Sign] Email verified - access granted');
        } else {
            // SECURITY WARNING: Contract has no email restriction!
            console.warn('[Sign] WARNING: Contract has no clientEmail restriction - anyone can access!');
        }

        // Check if already signed
        if (currentContract.status === 'signed' && currentContract.clientSignedAt) {
            showAlreadySigned(currentContract.clientSignedAt);
            return false;
        }

        // Display contract
        displayContract(currentContract);

        // Pre-fill entity if available
        if (currentContract.clientCompany) {
            inputEntity.value = currentContract.clientCompany;
        }

        showScreen('signing');
        return true;

    } catch (error) {
        console.error('[Sign] Error loading contract:', error);
        showError('Failed to load contract. Please try again later.');
        return false;
    }
}

// Show access denied with option to sign out
function showAccessDenied(currentEmail, expectedEmail) {
    const maskedExpected = expectedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    errorMessage.innerHTML = `
        This contract is for <strong>${maskedExpected}</strong>, but you're signed in as <strong>${currentEmail}</strong>.
        <br><br>
        <button onclick="signOutAndRetry()" class="btn-secondary" style="margin-top: 10px;">
            <i class="fas fa-sign-out-alt"></i> Sign out and try again
        </button>
    `;
    showScreen('error');
}

// Sign out and let user retry
async function signOutAndRetry() {
    try {
        await auth.signOut();
        authProcessedOnce = false;
        currentContract = null;
        // Auth state observer will handle showing login screen
    } catch (error) {
        console.error('[Sign] Error signing out:', error);
        showError('Failed to sign out. Please try refreshing the page.');
    }
}

function getContractIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let contractId = urlParams.get('id');

    if (!contractId) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            contractId = pathParts[pathParts.length - 1];
            if (contractId === 'index.html') {
                contractId = null;
            }
        }
    }

    return contractId;
}


function displayContract(contract) {
    // Get provider date
    let providerDateStr = '';
    if (contract.providerSignedAt) {
        const date = contract.providerSignedAt.toDate ?
            contract.providerSignedAt.toDate() :
            new Date(contract.providerSignedAt);
        providerDateStr = formatDate(date);
    } else {
        providerDateStr = formatDate(new Date());
    }

    // Build the signature section HTML
    const signatureHtml = `
<div class="signature-area-preview">
    <div class="sig-block">
        <p><strong>Provider:</strong> Lanting Digital LLC</p>
        <div class="sig-line">${contract.providerName || 'Caleb Lanting'}</div>
        <p style="font-size: 0.9em; color: #666;">${contract.providerName || 'Caleb Lanting'}, ${contract.providerTitle || 'Owner / Member'}</p>
        <p style="font-size: 0.9em; color: #666;">Date: ${providerDateStr}</p>
    </div>
    <div class="sig-block">
        <p><strong>Client:</strong> <span id="doc-preview-entity" class="placeholder-text">${contract.clientCompany || '[Company Name]'}</span></p>
        <div class="sig-line client-sig" id="doc-preview-sig">
            <span class="placeholder-text" style="font-family: 'Inter', sans-serif; font-size: 10pt; align-self: center;">Signature will appear here</span>
        </div>
        <p style="font-size: 0.9em; color: #666;">
            <span id="doc-preview-name">[Client Name]</span>,
            <span id="doc-preview-title">[Title]</span>
        </p>
        <p style="font-size: 0.9em; color: #666;">Date: ${formatDate(new Date())}</p>
    </div>
</div>
`;

    // Build document content
    let documentHtml = '';

    // Add title if contract has a name
    if (contract.contractName) {
        documentHtml += `<h1 class="doc-title">${escapeHtml(contract.contractName)}</h1>`;
        if (contract.contractSubtitle) {
            documentHtml += `<p class="doc-subtitle">${escapeHtml(contract.contractSubtitle)}</p>`;
        } else {
            documentHtml += `<p class="doc-subtitle">Service Agreement</p>`;
        }
    }

    // Add contract HTML content
    if (contract.contractHtml) {
        documentHtml += contract.contractHtml;
    }

    // Add signature section
    documentHtml += signatureHtml;

    // Inject into document
    contractContent.innerHTML = documentHtml;

    // Update placeholders if entity is pre-filled
    if (contract.clientCompany) {
        const entityPreview = document.getElementById('doc-preview-entity');
        if (entityPreview) {
            entityPreview.textContent = contract.clientCompany;
            entityPreview.classList.remove('placeholder-text');
        }
    }
}

function setupLivePreview() {
    // Mirror inputs to document preview
    const previews = {
        name: document.getElementById('doc-preview-name'),
        title: document.getElementById('doc-preview-title'),
        entity: document.getElementById('doc-preview-entity')
    };

    // Name input
    inputName.addEventListener('input', (e) => {
        const val = e.target.value;
        if (previews.name) {
            previews.name.textContent = val || '[Client Name]';
            previews.name.classList.toggle('placeholder-text', !val);
        }
    });

    // Title input
    inputTitle.addEventListener('input', (e) => {
        const val = e.target.value;
        if (previews.title) {
            previews.title.textContent = val || '[Title]';
            previews.title.classList.toggle('placeholder-text', !val);
        }
    });

    // Entity input
    inputEntity.addEventListener('input', (e) => {
        const val = e.target.value;
        if (previews.entity) {
            previews.entity.textContent = val || '[Company Name]';
            previews.entity.classList.toggle('placeholder-text', !val);
        }
    });
}

function setupSignatureModal() {
    // Open modal when clicking signature input or hint
    inputSignature.addEventListener('click', openSignatureModal);
    inputSignature.addEventListener('focus', openSignatureModal);
    signatureHint.addEventListener('click', openSignatureModal);

    // Close modal
    signatureModalClose.addEventListener('click', closeSignatureModal);
    signatureCancelBtn.addEventListener('click', closeSignatureModal);

    // Close on backdrop click
    signatureModal.addEventListener('click', (e) => {
        if (e.target === signatureModal) closeSignatureModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && signatureModal.classList.contains('active')) {
            closeSignatureModal();
        }
    });

    // Update preview as user types
    modalSignatureInput.addEventListener('input', updateModalSignaturePreview);

    // Checkbox enables/disables confirm button
    signatureAcknowledgeCheckbox.addEventListener('change', updateConfirmButtonState);

    // Confirm signature
    signatureConfirmBtn.addEventListener('click', confirmSignature);
}

function openSignatureModal() {
    // Pre-fill with name if available
    if (inputName.value && !modalSignatureInput.value) {
        modalSignatureInput.value = inputName.value;
        updateModalSignaturePreview();
    }

    signatureModal.classList.add('active');
    modalSignatureInput.focus();
}

function closeSignatureModal() {
    signatureModal.classList.remove('active');
}

function updateModalSignaturePreview() {
    const val = modalSignatureInput.value.trim();
    if (val) {
        signaturePreview.textContent = val;
        signaturePreview.classList.remove('empty');
    } else {
        signaturePreview.textContent = 'Your signature will appear here';
        signaturePreview.classList.add('empty');
    }
    updateConfirmButtonState();
}

function updateConfirmButtonState() {
    const hasSignature = modalSignatureInput.value.trim().length > 0;
    const isAcknowledged = signatureAcknowledgeCheckbox.checked;
    signatureConfirmBtn.disabled = !(hasSignature && isAcknowledged);
}

function confirmSignature() {
    const signatureValue = modalSignatureInput.value.trim();
    if (!signatureValue || !signatureAcknowledgeCheckbox.checked) return;

    // Set signature in main form
    inputSignature.value = signatureValue;
    signatureConfirmed = true;

    // Update UI
    signatureHint.classList.add('hidden');
    signatureAcknowledged.classList.remove('hidden');

    // Update document preview
    updateSignaturePreview(signatureValue);

    // Close modal
    closeSignatureModal();
}

function updateSignaturePreview(signatureValue) {
    const docSig = document.getElementById('doc-preview-sig');
    if (!docSig) return;

    if (signatureValue) {
        docSig.innerHTML = signatureValue;
        docSig.style.fontFamily = "'Dancing Script', cursive";
    } else {
        docSig.innerHTML = '<span class="placeholder-text" style="font-family: \'Inter\', sans-serif; font-size: 10pt; align-self: center;">Signature will appear here</span>';
    }
}

function setupFormHandlers() {
    // Submit button click
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await submitSignature();
    });

    // Also handle form submit event
    signingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitSignature();
    });
}

async function submitSignature() {
    // Validate
    if (!inputName.value.trim()) {
        showToast('Please enter your full name.', 'error');
        inputName.focus();
        return;
    }

    if (!inputTitle.value.trim()) {
        showToast('Please enter your title.', 'error');
        inputTitle.focus();
        return;
    }

    if (!signatureConfirmed || !inputSignature.value.trim()) {
        showToast('Please add your signature.', 'error');
        openSignatureModal();
        return;
    }

    const portfolioRadio = document.querySelector('input[name="portfolio"]:checked');
    if (!portfolioRadio) {
        showToast('Please select a portfolio permission option.', 'error');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Get portfolio permission
        const portfolioPermission = portfolioRadio.value === 'true';

        // Get client IP (optional)
        let clientIp = null;
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            clientIp = ipData.ip;
        } catch (e) {
            console.log('Could not get client IP');
        }

        // Prepare update data
        const updateData = {
            clientName: inputName.value.trim(),
            clientTitle: inputTitle.value.trim(),
            clientCompany: inputEntity.value.trim() || currentContract.clientCompany || '',
            clientSignature: inputSignature.value.trim(),
            clientSignedAt: firebase.firestore.FieldValue.serverTimestamp(),
            clientIpAddress: clientIp,
            portfolioPermission: portfolioPermission,
            effectiveDate: new Date().toISOString().split('T')[0],
            status: 'signed'
        };

        // Update contract in Firestore
        await db.collection(CONTRACTS_COLLECTION).doc(currentContract.id).update(updateData);

        // Show success
        showSuccess();

    } catch (error) {
        console.error('Error submitting signature:', error);
        showToast('Failed to submit signature. Please try again.', 'error');

        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-file-signature"></i> Sign Agreement';
    }
}

function showSuccess() {
    successContractName.textContent = currentContract.contractName || 'Contract';
    successTimestamp.textContent = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    showScreen('success');
}

function showAlreadySigned(signedAt) {
    const date = signedAt.toDate ? signedAt.toDate() : new Date(signedAt);
    signedDate.textContent = formatDate(date, true);
    showScreen('signed');
}

function showError(message) {
    errorMessage.textContent = message;
    showScreen('error');
}

function showScreen(screen) {
    // Hide all screens (including login screen)
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.classList.remove('active');
    loadingScreen.classList.remove('active');
    errorScreen.classList.remove('active');
    signedScreen.classList.remove('active');
    signingScreen.classList.remove('active');
    successScreen.classList.remove('active');

    // Show requested screen
    switch (screen) {
        case 'loading':
            loadingScreen.classList.add('active');
            break;
        case 'error':
            errorScreen.classList.add('active');
            break;
        case 'signed':
            signedScreen.classList.add('active');
            break;
        case 'signing':
            signingScreen.classList.add('active');
            break;
        case 'success':
            successScreen.classList.add('active');
            break;
        case 'login':
            if (loginScreen) loginScreen.classList.add('active');
            break;
    }
}

function formatDate(date, includeTime = false) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    if (includeTime) {
        options.hour = 'numeric';
        options.minute = '2-digit';
        options.timeZoneName = 'short';
    }

    return date.toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =============================================
// SECURITY: Inactivity Timeout
// =============================================
function setupInactivityTimeout() {
    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(handleInactivityTimeout, INACTIVITY_TIMEOUT);
    };

    // Reset timer on any user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
    });

    // Start the timer
    resetTimer();
}

async function handleInactivityTimeout() {
    if (auth.currentUser) {
        console.log('[Sign] Session timeout due to inactivity');
        showToast('Session expired due to inactivity. Please sign in again.', 'info');

        // Sign out and reset state
        await auth.signOut();
        currentContract = null;
        currentUser = null;
        authProcessedOnce = false;
        signatureConfirmed = false;

        // Show login screen
        showScreen('login');
    }
}
