// Contracts Logic for Lanting Digital Admin Panel

// State
let currentContractView = 'all'; // 'all', 'pending', 'signed'
let allContracts = [];
let currentContract = null;

// DOM Elements (will be initialized after DOM loads)
let contractsBody;
let contractsEmptyState;
let contractsLoadingState;
let totalContractsEl;
let sentContractsEl;
let signedContractsEl;
let contractsSearchInput;
let contractModal;

// Initialize Contracts Module
function initContracts() {
    // Get DOM elements
    contractsBody = document.getElementById('contracts-body');
    contractsEmptyState = document.getElementById('contracts-empty-state');
    contractsLoadingState = document.getElementById('contracts-loading-state');
    totalContractsEl = document.getElementById('total-contracts');
    sentContractsEl = document.getElementById('sent-contracts');
    signedContractsEl = document.getElementById('signed-contracts');
    contractsSearchInput = document.getElementById('contracts-search-input');
    contractModal = document.getElementById('contract-modal');

    setupContractsEventListeners();
    setupNavigation();
}

// Setup Navigation Between Sections
function setupNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.section-content');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetSection = tab.dataset.section;

            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show target section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `${targetSection}-section`) {
                    section.classList.add('active');
                }
            });

            // Load data for the section
            if (targetSection === 'contracts') {
                loadContracts();
            }
        });
    });
}

// Setup Event Listeners for Contracts
function setupContractsEventListeners() {
    // View toggle buttons
    document.getElementById('view-all-contracts').addEventListener('click', () => setContractView('all'));
    document.getElementById('view-pending-contracts').addEventListener('click', () => setContractView('pending'));
    document.getElementById('view-signed-contracts').addEventListener('click', () => setContractView('signed'));

    // Search
    contractsSearchInput.addEventListener('input', debounce(filterContracts, 300));

    // Refresh
    document.getElementById('refresh-contracts-btn').addEventListener('click', loadContracts);

    // Modal close
    contractModal.querySelector('.modal-close').addEventListener('click', closeContractModal);
    contractModal.addEventListener('click', (e) => {
        if (e.target === contractModal) closeContractModal();
    });

    // Copy link button
    document.getElementById('copy-link-btn').addEventListener('click', copySigningLink);

    // Delete contract button
    document.getElementById('contract-delete-btn').addEventListener('click', deleteContract);
}

// Set Contract View
function setContractView(view) {
    currentContractView = view;

    // Update toggle buttons
    document.getElementById('view-all-contracts').classList.toggle('active', view === 'all');
    document.getElementById('view-pending-contracts').classList.toggle('active', view === 'pending');
    document.getElementById('view-signed-contracts').classList.toggle('active', view === 'signed');

    renderContracts(allContracts);
}

// Load Contracts from Firestore
async function loadContracts() {
    showContractsLoading(true);

    try {
        const snapshot = await db.collection(COLLECTIONS.CONTRACTS)
            .orderBy('createdAt', 'desc')
            .get();

        allContracts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderContracts(allContracts);
        updateContractStats();
    } catch (error) {
        console.error('Error loading contracts:', error);
        showToast('Failed to load contracts', 'error');
    } finally {
        showContractsLoading(false);
    }
}

// Update Contract Stats
function updateContractStats() {
    const total = allContracts.length;
    const sent = allContracts.filter(c => c.status === 'sent').length;
    const signed = allContracts.filter(c => c.status === 'signed').length;

    totalContractsEl.textContent = total;
    sentContractsEl.textContent = sent;
    signedContractsEl.textContent = signed;
}

// Render Contracts Table
function renderContracts(contracts) {
    // Apply search filter
    const searchTerm = contractsSearchInput.value.toLowerCase();
    let filtered = contracts;

    if (searchTerm) {
        filtered = contracts.filter(c =>
            (c.contractName || '').toLowerCase().includes(searchTerm) ||
            (c.clientCompany || '').toLowerCase().includes(searchTerm) ||
            (c.clientEmail || '').toLowerCase().includes(searchTerm)
        );
    }

    // Apply view filter
    if (currentContractView === 'pending') {
        filtered = filtered.filter(c => c.status === 'sent' || c.status === 'draft');
    } else if (currentContractView === 'signed') {
        filtered = filtered.filter(c => c.status === 'signed');
    }

    // Show empty state if no results
    if (filtered.length === 0) {
        contractsBody.innerHTML = '';
        contractsEmptyState.classList.remove('hidden');
        return;
    }

    contractsEmptyState.classList.add('hidden');

    // Render table rows
    contractsBody.innerHTML = filtered.map(contract => `
        <tr class="clickable-row" data-id="${contract.id}">
            <td>
                <strong>${escapeHtml(contract.clientCompany || 'Unknown')}</strong>
                <br><small>${escapeHtml(contract.clientEmail || '')}</small>
            </td>
            <td>${escapeHtml(contract.contractName || 'Untitled')}</td>
            <td>
                <span class="status-badge status-${contract.status || 'draft'}">
                    ${getStatusLabel(contract.status)}
                </span>
            </td>
            <td>${formatContractDate(contract.sentAt)}</td>
            <td>${formatContractDate(contract.clientSignedAt)}</td>
            <td class="actions-cell">
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewContract('${contract.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Add click handlers
    contractsBody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => viewContract(row.dataset.id));
    });
}

// Filter Contracts
function filterContracts() {
    renderContracts(allContracts);
}

// View Contract Details
function viewContract(id) {
    const contract = allContracts.find(c => c.id === id);
    if (!contract) return;

    currentContract = contract;

    // Populate modal
    document.getElementById('contract-modal-name').textContent = contract.contractName || 'Contract';
    document.getElementById('contract-client-company').textContent = contract.clientCompany || '-';
    document.getElementById('contract-client-email').textContent = contract.clientEmail || '-';
    document.getElementById('contract-client-name').textContent = contract.clientName || '-';
    document.getElementById('contract-client-title').textContent = contract.clientTitle || '-';

    // Status
    const statusEl = document.getElementById('contract-status');
    statusEl.textContent = getStatusLabel(contract.status);
    statusEl.className = `status-badge status-${contract.status || 'draft'}`;

    // Dates
    document.getElementById('contract-effective-date').textContent = contract.effectiveDate || '-';
    document.getElementById('contract-sent-date').textContent = formatContractDate(contract.sentAt, true);
    document.getElementById('contract-signed-date').textContent = formatContractDate(contract.clientSignedAt, true);

    // Portfolio permission
    const portfolioEl = document.getElementById('contract-portfolio');
    if (contract.portfolioPermission === true) {
        portfolioEl.textContent = 'Yes - Allowed';
        portfolioEl.className = 'text-success';
    } else if (contract.portfolioPermission === false) {
        portfolioEl.textContent = 'No - Not Allowed';
        portfolioEl.className = 'text-muted';
    } else {
        portfolioEl.textContent = '-';
        portfolioEl.className = '';
    }

    // Signature display
    const signatureSection = document.getElementById('signature-display');
    if (contract.clientSignatureData) {
        document.getElementById('contract-signature-img').src = contract.clientSignatureData;
        document.getElementById('contract-ip').textContent = contract.clientIpAddress || 'Unknown';
        signatureSection.classList.remove('hidden');
    } else {
        signatureSection.classList.add('hidden');
    }

    // Signing link
    const signingLinkSection = document.getElementById('signing-link-section');
    const signingLinkInput = document.getElementById('signing-link-input');
    if (contract.status !== 'signed') {
        signingLinkInput.value = `${SIGNING_BASE_URL}/?id=${contract.id}`;
        signingLinkSection.classList.remove('hidden');
    } else {
        signingLinkSection.classList.add('hidden');
    }

    // Show modal
    contractModal.classList.add('active');
}

// Close Contract Modal
function closeContractModal() {
    contractModal.classList.remove('active');
    currentContract = null;
}

// Copy Signing Link
function copySigningLink() {
    const input = document.getElementById('signing-link-input');
    input.select();
    document.execCommand('copy');

    showToast('Signing link copied to clipboard', 'success');
}

// Delete Contract
async function deleteContract() {
    if (!currentContract) return;

    if (!confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
        return;
    }

    try {
        await db.collection(COLLECTIONS.CONTRACTS).doc(currentContract.id).delete();
        showToast('Contract deleted successfully', 'success');
        closeContractModal();
        loadContracts();
    } catch (error) {
        console.error('Error deleting contract:', error);
        showToast('Failed to delete contract', 'error');
    }
}

// Helper Functions
function getStatusLabel(status) {
    switch (status) {
        case 'draft': return 'Draft';
        case 'sent': return 'Sent';
        case 'signed': return 'Signed';
        default: return 'Unknown';
    }
}

function formatContractDate(timestamp, full = false) {
    if (!timestamp) return '-';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    if (full) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showContractsLoading(show) {
    if (contractsLoadingState) {
        contractsLoadingState.classList.toggle('hidden', !show);
    }
    if (show && contractsBody) {
        contractsBody.innerHTML = '';
        if (contractsEmptyState) {
            contractsEmptyState.classList.add('hidden');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initContracts);
