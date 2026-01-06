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
let contractModal;
let createContractModal;

// Initialize Contracts Module
function initContracts() {
    // Get DOM elements
    contractsBody = document.getElementById('contracts-body');
    contractsEmptyState = document.getElementById('contracts-empty-state');
    contractsLoadingState = document.getElementById('contracts-loading-state');
    totalContractsEl = document.getElementById('total-contracts');
    sentContractsEl = document.getElementById('sent-contracts');
    signedContractsEl = document.getElementById('signed-contracts');
    contractModal = document.getElementById('contract-modal');
    createContractModal = document.getElementById('create-contract-modal');

    setupContractsEventListeners();
    setupCreateContractModal();
}

// Setup Event Listeners for Contracts
function setupContractsEventListeners() {
    // View toggle buttons (filter pills)
    const viewAllBtn = document.getElementById('view-all-contracts');
    const viewPendingBtn = document.getElementById('view-pending-contracts');
    const viewSignedBtn = document.getElementById('view-signed-contracts');

    if (viewAllBtn) viewAllBtn.addEventListener('click', () => setContractView('all'));
    if (viewPendingBtn) viewPendingBtn.addEventListener('click', () => setContractView('pending'));
    if (viewSignedBtn) viewSignedBtn.addEventListener('click', () => setContractView('signed'));

    // Modal close
    if (contractModal) {
        const closeBtn = contractModal.querySelector('.modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeContractModal);
        contractModal.addEventListener('click', (e) => {
            if (e.target === contractModal) closeContractModal();
        });
    }

    // Copy link button
    const copyLinkBtn = document.getElementById('copy-link-btn');
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', copySigningLink);

    // Delete contract button
    const deleteBtn = document.getElementById('contract-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteContract);

    // Toggle contract content button
    const toggleContentBtn = document.getElementById('toggle-contract-content');
    if (toggleContentBtn) {
        toggleContentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleContractContent();
        });
    }

    // View full contract button
    const viewContractBtn = document.getElementById('view-contract-btn');
    if (viewContractBtn) {
        viewContractBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            viewFullContract();
        });
    }
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
    // Apply view filter
    let filtered = contracts;

    if (currentContractView === 'pending') {
        filtered = filtered.filter(c => c.status === 'sent' || c.status === 'draft');
    } else if (currentContractView === 'signed') {
        filtered = filtered.filter(c => c.status === 'signed');
    }

    // Show empty state if no results
    if (filtered.length === 0) {
        if (contractsBody) contractsBody.innerHTML = '';
        if (contractsEmptyState) contractsEmptyState.classList.remove('hidden');
        return;
    }

    if (contractsEmptyState) contractsEmptyState.classList.add('hidden');

    // Render table rows with new cell-primary/cell-sub structure
    if (contractsBody) {
        contractsBody.innerHTML = filtered.map(contract => `
            <tr class="clickable-row" data-id="${contract.id}">
                <td>
                    <span class="cell-primary">${escapeHtml(contract.clientCompany || 'Unknown')}</span>
                    <span class="cell-sub">${escapeHtml(contract.clientEmail || '')}</span>
                </td>
                <td>
                    <span class="cell-primary">${escapeHtml(contract.contractName || 'Untitled')}</span>
                </td>
                <td>
                    <span class="status-badge status-${contract.status || 'draft'}">
                        ${getStatusLabel(contract.status)}
                    </span>
                </td>
                <td>
                    <span class="cell-primary">${getTimelineInfo(contract)}</span>
                    <span class="cell-sub">${getTimelineSub(contract)}</span>
                </td>
                <td class="actions-cell">
                    ${contract.status === 'sent' ? `
                        <button class="btn btn-sm btn-notify" onclick="event.stopPropagation(); notifyContractClient('${contract.id}')" title="Notify Client">
                            <i class="fas fa-bell"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewContract('${contract.id}')" title="View Details">
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
    const isSigned = contract.status === 'signed';
    const isPending = contract.status === 'sent' || contract.status === 'draft';

    // Populate modal header
    document.getElementById('contract-modal-name').textContent = contract.contractName || 'Untitled Contract';
    document.getElementById('contract-client-company').textContent = contract.clientCompany || 'No company specified';

    // Status
    const statusEl = document.getElementById('contract-status');
    statusEl.textContent = getStatusLabel(contract.status);
    statusEl.className = `status-badge status-${contract.status || 'draft'}`;

    // Timeline - cleaner display
    const effectiveDateEl = document.getElementById('contract-effective-date');
    const sentDateEl = document.getElementById('contract-sent-date');
    const signedDateEl = document.getElementById('contract-signed-date');

    effectiveDateEl.textContent = contract.effectiveDate ? `Effective: ${contract.effectiveDate}` : '';
    sentDateEl.textContent = contract.sentAt ? `Sent: ${formatContractDate(contract.sentAt)}` : '';
    signedDateEl.textContent = contract.clientSignedAt ? `Signed: ${formatContractDate(contract.clientSignedAt)}` : '';

    // Client info section - show/hide based on whether contract is signed
    const clientInfoSection = document.getElementById('contract-client-info');
    if (isSigned && (contract.clientName || contract.clientEmail)) {
        document.getElementById('contract-client-email').textContent = contract.clientEmail || '-';
        document.getElementById('contract-client-name').textContent = contract.clientName || 'Client';
        document.getElementById('contract-client-title').textContent = contract.clientTitle || '';

        // Portfolio permission
        const portfolioEl = document.getElementById('contract-portfolio');
        if (contract.portfolioPermission === true) {
            portfolioEl.innerHTML = '<i class="fas fa-check-circle text-success"></i> Allowed';
        } else if (contract.portfolioPermission === false) {
            portfolioEl.innerHTML = '<i class="fas fa-times-circle text-muted"></i> Not Allowed';
        } else {
            portfolioEl.textContent = 'Not specified';
        }

        clientInfoSection.classList.remove('hidden');
    } else if (isPending) {
        // Show pending state for client info
        document.getElementById('contract-client-email').textContent = contract.clientEmail || '-';
        document.getElementById('contract-client-name').innerHTML = '<span class="awaiting-badge">Awaiting signature</span>';
        document.getElementById('contract-client-title').textContent = '';
        document.getElementById('contract-portfolio').textContent = 'Pending';
        clientInfoSection.classList.remove('hidden');
    } else {
        clientInfoSection.classList.add('hidden');
    }

    // Signature display - only show when signed (if element exists)
    const signatureSection = document.getElementById('signature-display');
    if (signatureSection) {
        if (isSigned && (contract.clientSignature || contract.clientSignatureData)) {
            let signatureHtml = '<span class="detail-label">Client Signature</span>';

            if (contract.clientSignature) {
                signatureHtml += `
                    <div class="signature-preview">
                        <div class="typed-signature">${escapeHtml(contract.clientSignature)}</div>
                    </div>
                `;
            } else if (contract.clientSignatureData) {
                signatureHtml += `
                    <div class="signature-preview">
                        <img src="${contract.clientSignatureData}" alt="Client Signature" style="max-height: 80px;">
                    </div>
                `;
            }

            // Advanced details (IP address) - collapsible
            if (contract.clientIpAddress) {
                signatureHtml += `
                    <details class="advanced-details">
                        <summary><i class="fas fa-cog"></i> Advanced Details</summary>
                        <div class="advanced-content">
                            <div class="detail-row">
                                <span class="detail-key">IP Address:</span>
                                <span class="detail-val">${contract.clientIpAddress}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-key">Signed At:</span>
                                <span class="detail-val">${formatContractDate(contract.clientSignedAt, true)}</span>
                            </div>
                        </div>
                    </details>
                `;
            }

            signatureSection.innerHTML = signatureHtml;
            signatureSection.classList.remove('hidden');
        } else {
            signatureSection.innerHTML = '';
            signatureSection.classList.add('hidden');
        }
    }

    // Signing info - only for pending contracts
    const signingLinkSection = document.getElementById('signing-link-section');
    const signingLinkInput = document.getElementById('signing-link-input');
    if (isPending) {
        // Show portal URL - signing happens in the client portal
        signingLinkInput.value = `Client signs via portal: ${PORTAL_BASE_URL}`;
        signingLinkSection.classList.remove('hidden');
    } else {
        signingLinkSection.classList.add('hidden');
    }

    // Contract content preview - sanitize to prevent style leakage
    const contentPreview = document.getElementById('contract-content-preview');
    const toggleBtn = document.getElementById('toggle-contract-content');
    if (contract.contractHtml) {
        contentPreview.innerHTML = sanitizeContractHtml(contract.contractHtml);
        contentPreview.classList.add('hidden');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show';
    } else {
        contentPreview.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">No contract content available</p>';
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

// Toggle Contract Content Preview
function toggleContractContent() {
    const contentPreview = document.getElementById('contract-content-preview');
    const toggleBtn = document.getElementById('toggle-contract-content');

    if (!contentPreview || !toggleBtn) return;

    if (contentPreview.classList.contains('hidden')) {
        contentPreview.classList.remove('hidden');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide';
    } else {
        contentPreview.classList.add('hidden');
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Show';
    }
}

// View Full Contract in New Window
function viewFullContract() {
    if (!currentContract) {
        showToast('No contract selected', 'error');
        return;
    }

    const contractHtml = buildFullContractHtml(currentContract);

    try {
        // Create a Blob URL so the window has a real URL instead of about:blank
        const blob = new Blob([contractHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');

        if (!newWindow) {
            showToast('Popup blocked. Please allow popups for this site.', 'error');
            URL.revokeObjectURL(url);
            return;
        }

        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        console.error('Error opening contract view:', error);
        showToast('Failed to open contract view', 'error');
    }
}

// Build full contract HTML for viewing/printing
// Uses the SAME styling as the inline preview for consistency
function buildFullContractHtml(contract) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(contract.contractName || 'Contract')} - Lanting Digital</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7;
            color: #1a1f2c;
            background: #f8f9fa;
            min-height: 100vh;
        }

        /* Simple top bar - just actions */
        .top-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #fff;
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 24px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            z-index: 100;
        }

        .btn {
            padding: 8px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
            background: #fff;
            color: #1a1f2c;
        }

        .btn:hover {
            background: #f8f9fa;
            border-color: #94a3b8;
        }

        .btn-primary {
            background: #1a1f2c;
            color: #fff;
            border-color: #1a1f2c;
        }

        .btn-primary:hover {
            background: #000;
        }

        /* Contract container - matches preview exactly */
        .contract-container {
            max-width: 850px;
            margin: 70px auto 40px;
            padding: 0 20px;
        }

        /* Contract content - IDENTICAL to .contract-content-preview in admin.css */
        .contract-content {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 40px;
            font-family: 'Georgia', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }

        .contract-content * {
            box-sizing: border-box;
        }

        /* Main Title */
        .contract-content h1 {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin: 0 0 8px 0;
            padding: 0;
            color: #1a1a1a;
        }

        /* Subtitle */
        .contract-content .subtitle {
            text-align: center;
            font-size: 11pt;
            color: #666;
            margin-bottom: 32px;
        }

        /* Section Headers */
        .contract-content h2 {
            font-family: 'Georgia', serif;
            font-size: 12pt;
            font-weight: bold;
            color: #1a1a1a;
            margin: 24px 0 12px 0;
            padding: 0 0 4px 0;
            border-bottom: 1px solid #ccc;
        }

        .contract-content h3 {
            font-family: 'Georgia', serif;
            font-size: 11pt;
            font-weight: bold;
            color: #1a1a1a;
            margin: 16px 0 8px 0;
            padding: 0;
        }

        /* Paragraphs */
        .contract-content p {
            margin: 0 0 12px 0;
            padding: 0;
            text-align: justify;
        }

        /* Parties Section */
        .contract-content .parties {
            margin: 24px 0;
        }

        .contract-content .parties p {
            margin-bottom: 8px;
        }

        /* Lists */
        .contract-content ul,
        .contract-content ol {
            margin: 12px 0 12px 24px;
            padding: 0;
        }

        .contract-content li {
            margin: 0 0 8px 0;
            padding: 0;
        }

        /* Tables */
        .contract-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }

        .contract-content th,
        .contract-content td {
            border: 1px solid #ccc;
            padding: 8px 12px;
            text-align: left;
            font-size: 10pt;
        }

        .contract-content th {
            background-color: #f5f5f5;
            font-weight: bold;
        }

        /* Inline elements */
        .contract-content strong,
        .contract-content b {
            font-weight: bold !important;
        }

        .contract-content em,
        .contract-content i {
            font-style: italic !important;
        }

        .contract-content u {
            text-decoration: underline !important;
        }

        /* Signature Section */
        .contract-content .signature-section {
            margin-top: 48px;
        }

        .contract-content .signature-block {
            display: inline-block;
            width: 45%;
            vertical-align: top;
            margin-right: 4%;
        }

        .contract-content .signature-line {
            border-bottom: 1px solid #333;
            height: 40px;
            margin: 8px 0;
        }

        .contract-content .signature-block p {
            margin: 4px 0;
            text-align: left;
        }

        /* Exhibit sections */
        .contract-content .exhibit {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 2px solid #333;
        }

        /* Print Styles */
        @media print {
            .top-bar { display: none; }
            body { background: #fff; }
            .contract-container {
                margin: 0;
                padding: 0;
                max-width: 100%;
            }
            .contract-content {
                border: none;
                padding: 20px;
                box-shadow: none;
            }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .contract-content { padding: 24px; }
            .top-bar { padding: 12px 16px; }
        }
    </style>
</head>
<body>
    <div class="top-bar">
        <button class="btn" onclick="window.close()">
            <i class="fas fa-times"></i> Close
        </button>
        <button class="btn btn-primary" onclick="window.print()">
            <i class="fas fa-print"></i> Print / Save PDF
        </button>
    </div>

    <div class="contract-container">
        <div class="contract-content">
            ${contract.contractHtml || '<p>No contract content available.</p>'}
            ${buildSignatureBlock(contract)}
        </div>
    </div>
</body>
</html>
    `;
}

// Build signature block for signed contracts
function buildSignatureBlock(contract) {
    if (contract.status !== 'signed' || !contract.signature) {
        return '';
    }

    const sig = contract.signature;
    const signedDate = contract.signedAt?.toDate
        ? contract.signedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';
    const providerDate = contract.providerSignedAt?.toDate
        ? contract.providerSignedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'January 6, 2026';
    const portfolioText = contract.portfolioPermission ? 'Yes - Client allows portfolio use' : 'No';

    return `
        <div style="margin-top: 48px; padding-top: 24px; border-top: 2px solid #333; page-break-inside: avoid;">
            <h2 style="font-size: 14pt; margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">Signatures</h2>
            <div style="display: flex; gap: 40px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <p style="margin-bottom: 8px;"><strong>PROVIDER: Lanting Digital LLC</strong></p>
                    <p style="margin: 4px 0; font-style: italic; font-size: 1.2em;">${contract.providerName || 'Caleb Lanting'}</p>
                    <p style="margin: 4px 0;">Name: ${contract.providerName || 'Caleb Lanting'}</p>
                    <p style="margin: 4px 0;">Title: ${contract.providerTitle || 'Owner / Member'}</p>
                    <p style="margin: 4px 0;">Date: ${providerDate}</p>
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <p style="margin-bottom: 8px;"><strong>CLIENT: ${escapeHtml(contract.clientCompany || contract.clientName || 'Client')}</strong></p>
                    <p style="margin: 4px 0; font-style: italic; font-size: 1.2em;">${escapeHtml(sig.signatureData || sig.name)}</p>
                    <p style="margin: 4px 0;">Name: ${escapeHtml(sig.name)}</p>
                    <p style="margin: 4px 0;">Title: ${escapeHtml(sig.title || 'N/A')}</p>
                    <p style="margin: 4px 0;">Date: ${signedDate}</p>
                </div>
            </div>
            <p style="margin-top: 20px; font-size: 0.9em; color: #666;"><strong>Portfolio Permission:</strong> ${portfolioText}</p>
            <p style="margin-top: 8px; font-size: 0.8em; color: #888;">
                <em>This contract was signed electronically via the Lanting Digital client portal.</em>
            </p>
        </div>
    `;
}


// Helper Functions
function getStatusLabel(status) {
    switch (status) {
        case 'draft': return 'Draft';
        case 'sent': return 'Pending';
        case 'signed': return 'Signed';
        default: return 'Unknown';
    }
}

function getTimelineInfo(contract) {
    if (contract.status === 'signed' && contract.clientSignedAt) {
        return 'Signed ' + formatContractDate(contract.clientSignedAt);
    } else if (contract.status === 'sent' && contract.sentAt) {
        return 'Sent ' + formatContractDate(contract.sentAt);
    } else if (contract.createdAt) {
        return 'Created ' + formatContractDate(contract.createdAt);
    }
    return '-';
}

function getTimelineSub(contract) {
    if (contract.status === 'signed' && contract.sentAt) {
        return 'Sent ' + formatContractDate(contract.sentAt);
    } else if (contract.effectiveDate) {
        return 'Effective: ' + contract.effectiveDate;
    }
    return '';
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

// Setup Create Contract Modal
function setupCreateContractModal() {
    if (!createContractModal) return;

    // Create button
    const createBtn = document.getElementById('create-contract-btn');
    if (createBtn) {
        createBtn.addEventListener('click', openCreateContractModal);
    }

    // Close buttons
    const closeBtn = createContractModal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCreateContractModal);

    const cancelBtn = createContractModal.querySelector('.modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeCreateContractModal);

    // Backdrop click
    createContractModal.addEventListener('click', (e) => {
        if (e.target === createContractModal) closeCreateContractModal();
    });

    // Save button
    const saveBtn = document.getElementById('save-contract-btn');
    if (saveBtn) saveBtn.addEventListener('click', createContract);
}

// Open Create Contract Modal
function openCreateContractModal() {
    // Reset form
    const form = document.getElementById('create-contract-form');
    if (form) form.reset();

    // Set default values
    document.getElementById('provider-name-input').value = 'Caleb Lanting';
    document.getElementById('provider-title-input').value = 'Owner / Member';

    createContractModal.classList.add('active');
}

// Close Create Contract Modal
function closeCreateContractModal() {
    createContractModal.classList.remove('active');
}

// Create Contract
async function createContract() {
    const contractName = document.getElementById('contract-name-input').value.trim();
    const contractSubtitle = document.getElementById('contract-subtitle-input').value.trim();
    const clientEmail = document.getElementById('client-email-input').value.trim();
    const clientCompany = document.getElementById('client-company-input').value.trim();
    const contractHtml = document.getElementById('contract-html-input').value.trim();
    const providerName = document.getElementById('provider-name-input').value.trim();
    const providerTitle = document.getElementById('provider-title-input').value.trim();

    // Validate required fields
    if (!contractName) {
        showToast('Please enter a contract name', 'error');
        return;
    }

    if (!clientEmail) {
        showToast('Please enter a client email', 'error');
        return;
    }

    if (!contractHtml) {
        showToast('Please enter contract HTML content', 'error');
        return;
    }

    // Get save button for loading state
    const saveBtn = document.getElementById('save-contract-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        // Create contract document
        const contractData = {
            contractName: contractName,
            contractSubtitle: contractSubtitle || 'Service Agreement',
            contractHtml: contractHtml,
            clientEmail: clientEmail.toLowerCase(),
            clientCompany: clientCompany || '',
            providerName: providerName || 'Caleb Lanting',
            providerTitle: providerTitle || 'Owner / Member',
            providerSignedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'sent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            sentAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection(COLLECTIONS.CONTRACTS).add(contractData);

        showToast('Contract created successfully!', 'success');
        closeCreateContractModal();

        // Reload contracts list
        loadContracts();

        // Show success message - signing now happens in the portal
        setTimeout(() => {
            alert(`Contract created!\n\nThe client will sign this contract through their portal.\n\nClick the bell icon (🔔) on the contract to send them a notification email.`);
        }, 300);

    } catch (error) {
        console.error('Error creating contract:', error);
        showToast('Failed to create contract', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Notify Contract Client - Send email notification
async function notifyContractClient(contractId) {
    const contract = allContracts.find(c => c.id === contractId);
    if (!contract) {
        showToast('Contract not found', 'error');
        return;
    }

    if (!contract.clientEmail) {
        showToast('No client email associated with this contract', 'error');
        return;
    }

    if (!confirm(`Send notification email to ${contract.clientEmail}?`)) {
        return;
    }

    try {
        showToast('Sending notification...', 'info');

        const notifyClient = firebase.functions().httpsCallable('notifyClient');
        const result = await notifyClient({
            type: 'contract',
            documentId: contractId
        });

        if (result.data.success) {
            showToast(`Notification sent to ${result.data.sentTo}`, 'success');
            // Reload to show updated notification info
            loadContracts();
        } else {
            throw new Error(result.data.error || 'Failed to send notification');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        showToast(error.message || 'Failed to send notification', 'error');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initContracts);
