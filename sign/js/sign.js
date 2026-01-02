// Lanting Digital - Contract Signing Logic

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const errorScreen = document.getElementById('error-screen');
const signedScreen = document.getElementById('signed-screen');
const signingScreen = document.getElementById('signing-screen');
const successScreen = document.getElementById('success-screen');
const errorMessage = document.getElementById('error-message');
const signedDate = document.getElementById('signed-date');

// Contract display elements
const contractContent = document.getElementById('contract-content');

// Form elements
const signingForm = document.getElementById('signing-form');
const agreeTermsCheckbox = document.getElementById('agree-terms');
const submitBtn = document.getElementById('submit-btn');
const clearSignatureBtn = document.getElementById('clear-signature');

// Success screen elements
const successEmail = document.getElementById('success-email');
const successContractName = document.getElementById('success-contract-name');
const successTimestamp = document.getElementById('success-timestamp');

// Signature Pad
let signaturePad;
let currentContract = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Get contract ID from URL
    const contractId = getContractIdFromUrl();

    if (!contractId) {
        showError('No contract ID provided in the URL.');
        return;
    }

    // Initialize signature pad
    initSignaturePad();

    // Load contract
    await loadContract(contractId);

    // Setup form handlers
    setupFormHandlers();
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

function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    const container = canvas.parentElement;

    // Set canvas size
    function setCanvasSize() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 200;
    }

    setCanvasSize();

    // Initialize SignaturePad
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 1,
        maxWidth: 3
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const data = signaturePad.toData();
            setCanvasSize();
            signaturePad.clear();
            if (data && data.length > 0) {
                signaturePad.fromData(data);
            }
        }, 100);
    });

    // Clear button
    clearSignatureBtn.addEventListener('click', () => {
        signaturePad.clear();
    });
}

async function loadContract(contractId) {
    try {
        const doc = await db.collection(CONTRACTS_COLLECTION).doc(contractId).get();

        if (!doc.exists) {
            showError('This contract does not exist or has been removed.');
            return;
        }

        currentContract = { id: doc.id, ...doc.data() };

        // Check if already signed
        if (currentContract.status === 'signed' && currentContract.clientSignedAt) {
            showAlreadySigned(currentContract.clientSignedAt);
            return;
        }

        // Display contract with signature section
        displayContract(currentContract);
        showScreen('signing');

    } catch (error) {
        console.error('Error loading contract:', error);
        showError('Failed to load contract. Please try again later.');
    }
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

    // Get today's date for default
    const today = new Date().toISOString().split('T')[0];

    // Build the signature section HTML that will be appended to the contract
    const signatureHtml = `
<div class="signature-section">
    <div class="signature-block">
        <p><strong>PROVIDER: Lanting Digital LLC</strong></p>
        <p>Signature:</p>
        <div class="signature-line">
            <span class="provider-signature-text">${contract.providerName || 'Caleb Lanting'}</span>
        </div>
        <p>Name: ${contract.providerName || 'Caleb Lanting'}</p>
        <p>Title: ${contract.providerTitle || 'Owner / Member'}</p>
        <p>Date: ${providerDateStr}</p>
    </div>
    <div class="signature-block">
        <p><strong>CLIENT: ${contract.clientCompany || 'Client'}</strong></p>
        <p>Signature: <em style="color: #666; font-size: 10pt;">(Draw below)</em></p>
        <div class="signature-line" id="client-signature-display">
            <!-- Signature image will appear here after signing -->
        </div>
        <p>Name: <input type="text" class="client-input" id="client-name" required placeholder="Your full name"></p>
        <p>Title: <input type="text" class="client-input" id="client-title" required placeholder="Your title"></p>
        <p>Date: <input type="date" class="date-input" id="effective-date" value="${today}" required></p>
    </div>
</div>
`;

    // Inject contract HTML with signature section
    contractContent.innerHTML = contract.contractHtml + signatureHtml;
}

function setupFormHandlers() {
    signingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitSignature();
    });
}

async function submitSignature() {
    // Get form values from inputs inside the contract
    const clientNameInput = document.getElementById('client-name');
    const clientTitleInput = document.getElementById('client-title');
    const effectiveDateInput = document.getElementById('effective-date');

    // Validate
    if (!clientNameInput.value.trim()) {
        showToast('Please enter your full name in the contract.', 'error');
        clientNameInput.focus();
        clientNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (!clientTitleInput.value.trim()) {
        showToast('Please enter your title in the contract.', 'error');
        clientTitleInput.focus();
        clientTitleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (signaturePad.isEmpty()) {
        showToast('Please draw your signature below.', 'error');
        document.querySelector('.signature-pad-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const portfolioRadio = document.querySelector('input[name="portfolio"]:checked');
    if (!portfolioRadio) {
        showToast('Please select a portfolio permission option.', 'error');
        return;
    }

    if (!agreeTermsCheckbox.checked) {
        showToast('Please agree to the terms of the agreement.', 'error');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
        // Get signature as base64
        const signatureData = signaturePad.toDataURL('image/png');

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
            clientName: clientNameInput.value.trim(),
            clientTitle: clientTitleInput.value.trim(),
            clientSignatureData: signatureData,
            clientSignedAt: firebase.firestore.FieldValue.serverTimestamp(),
            clientIpAddress: clientIp,
            portfolioPermission: portfolioPermission,
            effectiveDate: effectiveDateInput.value,
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
        submitBtn.innerHTML = '<i class="fas fa-file-signature"></i> Sign & Submit Contract';
    }
}

function showSuccess() {
    successEmail.textContent = currentContract.clientEmail || 'your email';
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
    // Hide all screens
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
