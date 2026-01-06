/**
 * Admin Clients Management
 * Handles client CRUD operations, portal invitations, and display
 */

// Initialize Firebase Functions
const clientFunctions = firebase.app().functions('us-central1');
const inviteClientFn = clientFunctions.httpsCallable('inviteClient');

// State
let allClients = [];
let currentClientId = null;

// DOM Elements
const clientsBody = document.getElementById('clients-body');
const clientsLoadingState = document.getElementById('clients-loading-state');
const clientsEmptyState = document.getElementById('clients-empty-state');
const clientModal = document.getElementById('client-modal');
const clientDetailModal = document.getElementById('client-detail-modal');
const clientForm = document.getElementById('client-form');
const inviteClientModal = document.getElementById('invite-client-modal');

// =============================================
// LOAD CLIENTS
// =============================================

async function loadClients() {
    if (!clientsBody) return;

    clientsBody.innerHTML = '';
    clientsLoadingState?.classList.remove('hidden');
    clientsEmptyState?.classList.add('hidden');

    try {
        const snapshot = await db.collection('clients')
            .orderBy('createdAt', 'desc')
            .get();

        allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get contract counts for each client
        const contractCounts = {};
        const contractsSnapshot = await db.collection('contracts').get();
        contractsSnapshot.docs.forEach(doc => {
            const email = doc.data().clientEmail;
            if (email) {
                contractCounts[email] = (contractCounts[email] || 0) + 1;
            }
        });

        // Update stats
        document.getElementById('total-clients').textContent = allClients.length;

        // Count active clients (those with pending contracts)
        const pendingContracts = contractsSnapshot.docs.filter(d => d.data().status !== 'signed');
        const activeEmails = [...new Set(pendingContracts.map(d => d.data().clientEmail))];
        document.getElementById('active-clients').textContent = activeEmails.length;

        // Pending invoices
        const invoicesSnapshot = await db.collection('invoices')
            .where('status', 'in', ['pending', 'overdue'])
            .get();
        document.getElementById('clients-pending-invoices').textContent = invoicesSnapshot.size;

        clientsLoadingState?.classList.add('hidden');

        if (allClients.length === 0) {
            clientsEmptyState?.classList.remove('hidden');
            return;
        }

        // Render clients
        renderClients(allClients, contractCounts);

    } catch (error) {
        console.error('Error loading clients:', error);
        clientsLoadingState?.classList.add('hidden');
        clientsEmptyState?.classList.remove('hidden');
        clientsEmptyState.querySelector('p').textContent = 'Error loading clients';
    }
}

function getPortalStatusBadge(client) {
    if (client.hasPortalAccess) {
        return '<span class="status-badge success"><i class="fas fa-check"></i> Active</span>';
    } else if (client.invitedAt) {
        return '<span class="status-badge warning"><i class="fas fa-envelope"></i> Invited</span>';
    } else {
        return '<span class="status-badge muted"><i class="fas fa-minus"></i> Not Set Up</span>';
    }
}

function renderClients(clients, contractCounts = {}) {
    clientsBody.innerHTML = clients.map(client => {
        const contracts = contractCounts[client.email] || 0;
        const initials = (client.name || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const portalBadge = getPortalStatusBadge(client);

        return `
            <tr data-id="${client.id}">
                <td>
                    <div class="client-name-cell">
                        <div class="client-avatar">${initials}</div>
                        <span>${escapeHtml(client.name || 'Unknown')}</span>
                    </div>
                </td>
                <td>${escapeHtml(client.company || '-')}</td>
                <td>
                    <a href="mailto:${client.email}" class="email-link">${escapeHtml(client.email)}</a>
                </td>
                <td>${portalBadge}</td>
                <td>
                    <span class="contracts-count">${contracts}</span>
                </td>
                <td>
                    <button class="btn btn-ghost btn-sm view-client-btn" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm message-client-quick-btn" title="Message">
                        <i class="fas fa-comment"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners
    document.querySelectorAll('.view-client-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = btn.closest('tr');
            const id = row.dataset.id;
            showClientDetail(id);
        });
    });

    document.querySelectorAll('.message-client-quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = btn.closest('tr');
            const id = row.dataset.id;
            openMessageForClient(id);
        });
    });

    // Row click to view
    document.querySelectorAll('#clients-body tr').forEach(row => {
        row.addEventListener('click', () => {
            showClientDetail(row.dataset.id);
        });
        row.style.cursor = 'pointer';
    });
}

// =============================================
// CLIENT DETAIL
// =============================================

async function showClientDetail(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    currentClientId = clientId;

    // Populate modal
    document.getElementById('client-detail-name').textContent = client.name || 'Unknown';
    document.getElementById('client-detail-company').textContent = client.company || '-';
    document.getElementById('client-detail-email').textContent = client.email || '-';
    document.getElementById('client-detail-phone').textContent = client.phone || '-';
    document.getElementById('client-detail-notes').textContent = client.notes || 'No notes';

    // Portal status
    const portalStatusEl = document.getElementById('client-detail-portal-status');
    const portalDateEl = document.getElementById('client-detail-portal-date');
    const inviteBtn = document.getElementById('invite-client-btn');
    const resetPasswordBtn = document.getElementById('reset-password-btn');

    if (client.hasPortalAccess) {
        portalStatusEl.innerHTML = '<span class="status-badge success"><i class="fas fa-check"></i> Active</span>';
        const activatedDate = client.portalActivatedAt?.toDate();
        portalDateEl.textContent = activatedDate ? formatDate(activatedDate) : '-';
        inviteBtn.style.display = 'none';
        resetPasswordBtn.style.display = 'inline-flex';
    } else if (client.invitedAt) {
        portalStatusEl.innerHTML = '<span class="status-badge warning"><i class="fas fa-envelope"></i> Invited</span>';
        const invitedDate = client.invitedAt?.toDate();
        portalDateEl.textContent = invitedDate ? `Invited ${formatDate(invitedDate)}` : '-';
        inviteBtn.style.display = 'inline-flex';
        inviteBtn.innerHTML = '<i class="fas fa-redo"></i> Resend Invite';
        resetPasswordBtn.style.display = 'none';
    } else {
        portalStatusEl.innerHTML = '<span class="status-badge muted"><i class="fas fa-minus"></i> Not Set Up</span>';
        portalDateEl.textContent = '-';
        inviteBtn.style.display = 'inline-flex';
        inviteBtn.innerHTML = '<i class="fas fa-envelope"></i> Send Invite';
        resetPasswordBtn.style.display = 'none';
    }

    // Load contracts for this client
    const contractsList = document.getElementById('client-contracts-list');
    contractsList.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const contractsSnapshot = await db.collection('contracts')
            .where('clientEmail', '==', client.email)
            .orderBy('createdAt', 'desc')
            .get();

        if (contractsSnapshot.empty) {
            contractsList.innerHTML = '<p class="text-muted">No contracts found</p>';
        } else {
            contractsList.innerHTML = contractsSnapshot.docs.map(doc => {
                const data = doc.data();
                const statusClass = data.status === 'signed' ? 'success' : 'warning';
                return `
                    <div class="client-contract-item">
                        <div class="contract-item-info">
                            <strong>${escapeHtml(data.contractName || 'Contract')}</strong>
                            <span class="text-muted">${formatDate(data.createdAt?.toDate())}</span>
                        </div>
                        <span class="status-badge ${statusClass}">
                            ${data.status === 'signed' ? 'Signed' : 'Pending'}
                        </span>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading client contracts:', error);
        contractsList.innerHTML = '<p class="text-muted">Error loading contracts</p>';
    }

    clientDetailModal.classList.add('active');
}

// =============================================
// INVITE CLIENT TO PORTAL
// =============================================

function openInviteClientModal(prefillData = null) {
    // Reset modal state
    document.getElementById('invite-client-form').reset();
    document.getElementById('invite-success').classList.add('hidden');
    document.getElementById('invite-client-form').classList.remove('hidden');
    document.getElementById('invite-modal-footer').classList.remove('hidden');
    document.getElementById('invite-success-footer').classList.add('hidden');

    // Pre-fill if data provided
    if (prefillData) {
        document.getElementById('invite-name').value = prefillData.name || '';
        document.getElementById('invite-email').value = prefillData.email || '';
        document.getElementById('invite-company').value = prefillData.company || '';
    }

    inviteClientModal.classList.add('active');
}

async function sendInvite() {
    const name = document.getElementById('invite-name').value.trim();
    const email = document.getElementById('invite-email').value.trim();
    const company = document.getElementById('invite-company').value.trim();

    if (!name || !email) {
        alert('Please fill in the required fields');
        return;
    }

    const sendBtn = document.getElementById('send-invite-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const result = await inviteClientFn({ email, name, company });

        if (result.data.success) {
            // Show success state
            document.getElementById('invite-client-form').classList.add('hidden');
            document.getElementById('invite-modal-footer').classList.add('hidden');
            document.getElementById('invite-success').classList.remove('hidden');
            document.getElementById('invite-success-footer').classList.remove('hidden');

            document.getElementById('invite-success-email').textContent = email;
            document.getElementById('invite-link').value = result.data.inviteLink;

            // Reload clients to show updated status
            loadClients();
        }
    } catch (error) {
        console.error('Error sending invite:', error);
        alert(error.message || 'Failed to send invitation. Please try again.');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invitation';
    }
}

function copyInviteLink() {
    const linkInput = document.getElementById('invite-link');
    linkInput.select();
    document.execCommand('copy');

    const copyBtn = document.getElementById('copy-invite-link');
    const originalHTML = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
    }, 2000);
}

// =============================================
// ADD/EDIT CLIENT
// =============================================

function openAddClientModal() {
    currentClientId = null;
    document.getElementById('client-modal-title').textContent = 'Add Client';
    clientForm.reset();
    clientModal.classList.add('active');
}

function openEditClientModal(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    currentClientId = clientId;
    document.getElementById('client-modal-title').textContent = 'Edit Client';

    // Populate form
    document.getElementById('client-name').value = client.name || '';
    document.getElementById('client-email').value = client.email || '';
    document.getElementById('client-company').value = client.company || '';
    document.getElementById('client-phone').value = client.phone || '';
    document.getElementById('client-notes').value = client.notes || '';

    clientDetailModal.classList.remove('active');
    clientModal.classList.add('active');
}

async function saveClient() {
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const company = document.getElementById('client-company').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const notes = document.getElementById('client-notes').value.trim();

    if (!name || !email) {
        alert('Please fill in required fields');
        return;
    }

    const saveBtn = document.getElementById('save-client-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const clientData = {
            name,
            email,
            company,
            phone,
            notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentClientId) {
            // Update existing
            await db.collection('clients').doc(currentClientId).update(clientData);
        } else {
            // Create new
            clientData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('clients').add(clientData);
        }

        clientModal.classList.remove('active');
        loadClients();

    } catch (error) {
        console.error('Error saving client:', error);
        alert('Error saving client. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Client';
    }
}

async function deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client? This will not delete their contracts.')) {
        return;
    }

    try {
        await db.collection('clients').doc(clientId).delete();
        clientDetailModal.classList.remove('active');
        loadClients();
    } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client. Please try again.');
    }
}

function openMessageForClient(clientId) {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    // Switch to messages section and open chat with this client
    document.querySelector('[data-section="messages"]').click();

    // Small delay to let the section render
    setTimeout(() => {
        selectConversation(clientId);
    }, 100);
}

// Invite from client detail modal
function inviteCurrentClient() {
    const client = allClients.find(c => c.id === currentClientId);
    if (!client) return;

    clientDetailModal.classList.remove('active');
    openInviteClientModal({
        name: client.name,
        email: client.email,
        company: client.company
    });
}

// =============================================
// EVENT LISTENERS
// =============================================

document.getElementById('add-client-btn')?.addEventListener('click', openAddClientModal);
document.getElementById('save-client-btn')?.addEventListener('click', saveClient);
document.getElementById('edit-client-btn')?.addEventListener('click', () => openEditClientModal(currentClientId));
document.getElementById('delete-client-btn')?.addEventListener('click', () => deleteClient(currentClientId));
document.getElementById('message-client-btn')?.addEventListener('click', () => openMessageForClient(currentClientId));

// Invite buttons
document.getElementById('invite-new-client-btn')?.addEventListener('click', () => openInviteClientModal());
document.getElementById('invite-client-btn')?.addEventListener('click', inviteCurrentClient);
document.getElementById('send-invite-btn')?.addEventListener('click', sendInvite);
document.getElementById('copy-invite-link')?.addEventListener('click', copyInviteLink);
document.getElementById('invite-done-btn')?.addEventListener('click', () => {
    inviteClientModal.classList.remove('active');
});

// Close modals
clientModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    clientModal.classList.remove('active');
});

clientModal?.querySelector('.modal-cancel')?.addEventListener('click', () => {
    clientModal.classList.remove('active');
});

clientDetailModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    clientDetailModal.classList.remove('active');
});

inviteClientModal?.querySelector('.modal-close')?.addEventListener('click', () => {
    inviteClientModal.classList.remove('active');
});

inviteClientModal?.querySelector('.modal-cancel')?.addEventListener('click', () => {
    inviteClientModal.classList.remove('active');
});

// =============================================
// UTILITIES
// =============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

// Export for use in dashboard.js
window.loadClients = loadClients;
