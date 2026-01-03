/**
 * Lanting Digital - Client Portal
 * Full-featured client experience with contracts, invoices, and messaging
 */

// =============================================
// INITIALIZATION
// =============================================

// Firebase is already initialized in config.js (auth, db, googleProvider are global)

// State
let currentUser = null;
let clientData = null;
let currentView = 'dashboard';
let unsubscribeListeners = [];

// DOM Elements
const elements = {
    loginScreen: document.getElementById('login-screen'),
    loadingScreen: document.getElementById('loading-screen'),
    accessDeniedScreen: document.getElementById('access-denied-screen'),
    portalApp: document.getElementById('portal-app'),
    googleLoginBtn: document.getElementById('google-login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    tryDifferentAccount: document.getElementById('try-different-account'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('portal-sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    pageTitle: document.getElementById('page-title'),
    pageSubtitle: document.getElementById('page-subtitle'),
    headerActions: document.getElementById('header-actions'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
};

// =============================================
// AUTH STATE
// =============================================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadClientData();
    } else {
        currentUser = null;
        clientData = null;
        showScreen('login');
    }
});

async function loadClientData() {
    showScreen('loading');

    try {
        // Query for client document by email
        const clientQuery = await db.collection('clients')
            .where('email', '==', currentUser.email)
            .limit(1)
            .get();

        if (clientQuery.empty) {
            // Check if they have any contracts assigned to their email
            const contractsQuery = await db.collection('contracts')
                .where('clientEmail', '==', currentUser.email)
                .limit(1)
                .get();

            if (contractsQuery.empty) {
                showScreen('access-denied');
                return;
            }

            // Auto-create client record from contract
            const contract = contractsQuery.docs[0].data();
            const newClient = {
                email: currentUser.email,
                name: contract.clientName || currentUser.displayName || 'Client',
                company: contract.clientCompany || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                uid: currentUser.uid
            };

            const clientRef = await db.collection('clients').add(newClient);
            clientData = { id: clientRef.id, ...newClient };
        } else {
            clientData = { id: clientQuery.docs[0].id, ...clientQuery.docs[0].data() };

            // Update UID if not set
            if (!clientData.uid) {
                await db.collection('clients').doc(clientData.id).update({
                    uid: currentUser.uid
                });
            }
        }

        // Setup user display
        setupUserDisplay();

        // Load portal data
        await loadDashboardData();

        // Setup real-time listeners
        setupRealtimeListeners();

        // Show portal
        showScreen('portal');
        navigateTo('dashboard');

    } catch (error) {
        console.error('Error loading client data:', error);
        showScreen('access-denied');
    }
}

function setupUserDisplay() {
    const name = clientData?.name || currentUser.displayName || 'Client';
    const email = currentUser.email;

    elements.userName.textContent = name;
    elements.userEmail.textContent = email;

    // Avatar
    if (currentUser.photoURL) {
        elements.userAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="${name}">`;
    } else {
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        elements.userAvatar.textContent = initials;
    }
}

// =============================================
// SCREEN MANAGEMENT
// =============================================

function showScreen(screen) {
    elements.loginScreen.classList.remove('active');
    elements.loadingScreen.classList.remove('active');
    elements.accessDeniedScreen.classList.remove('active');
    elements.portalApp.classList.add('hidden');

    switch (screen) {
        case 'login':
            elements.loginScreen.classList.add('active');
            break;
        case 'loading':
            elements.loadingScreen.classList.add('active');
            break;
        case 'access-denied':
            elements.accessDeniedScreen.classList.add('active');
            break;
        case 'portal':
            elements.portalApp.classList.remove('hidden');
            break;
    }
}

// =============================================
// NAVIGATION
// =============================================

function navigateTo(view, data = null) {
    currentView = view;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });

    // Update views
    document.querySelectorAll('.portal-view').forEach(v => {
        v.classList.remove('active');
    });

    // Show requested view
    const viewElement = document.getElementById(`view-${view}`);
    if (viewElement) {
        viewElement.classList.add('active');
    }

    // Update header
    updateHeader(view, data);

    // Load view-specific data
    switch (view) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'contracts':
            loadContracts();
            break;
        case 'contract-detail':
            loadContractDetail(data);
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'invoice-detail':
            loadInvoiceDetail(data);
            break;
        case 'messages':
            loadMessages();
            loadAdminStatus();
            break;
    }

    // Close mobile sidebar
    closeMobileSidebar();

    // Update URL hash
    if (view !== 'contract-detail' && view !== 'invoice-detail') {
        window.location.hash = view;
    }
}

function updateHeader(view, data = null) {
    const headers = {
        dashboard: {
            title: 'Dashboard',
            subtitle: `Welcome back, ${clientData?.name?.split(' ')[0] || 'there'}!`
        },
        contracts: {
            title: 'Contracts',
            subtitle: 'View and manage your agreements'
        },
        'contract-detail': {
            title: data?.name || 'Contract',
            subtitle: 'View contract details'
        },
        invoices: {
            title: 'Invoices',
            subtitle: 'View and pay your invoices'
        },
        'invoice-detail': {
            title: `Invoice #${data?.number || ''}`,
            subtitle: 'Invoice details'
        },
        messages: {
            title: 'Messages',
            subtitle: 'Chat with your project team'
        }
    };

    const headerData = headers[view] || headers.dashboard;
    elements.pageTitle.textContent = headerData.title;
    elements.pageSubtitle.textContent = headerData.subtitle;

    // Clear header actions
    elements.headerActions.innerHTML = '';
}

// =============================================
// DASHBOARD
// =============================================

async function loadDashboardData() {
    try {
        // Get contracts count
        const contractsSnapshot = await db.collection('contracts')
            .where('clientEmail', '==', currentUser.email)
            .get();

        const contracts = contractsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pendingContracts = contracts.filter(c => c.status !== 'signed').length;
        const signedContracts = contracts.filter(c => c.status === 'signed').length;

        document.getElementById('stat-contracts').textContent = contracts.length;
        updateBadge('contracts-badge', pendingContracts);

        // Get invoices count
        const invoicesSnapshot = await db.collection('invoices')
            .where('clientEmail', '==', currentUser.email)
            .get();

        const invoices = invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;

        document.getElementById('stat-pending-invoices').textContent = pendingInvoices;
        updateBadge('invoices-badge', pendingInvoices);

        // Get unread messages count
        const messagesSnapshot = await db.collection('messages')
            .where('clientEmail', '==', currentUser.email)
            .where('read', '==', false)
            .where('fromAdmin', '==', true)
            .get();

        const unreadCount = messagesSnapshot.size;
        document.getElementById('stat-unread-messages').textContent = unreadCount;
        updateBadge('messages-badge', unreadCount);

        // Completed projects (signed contracts)
        document.getElementById('stat-completed').textContent = signedContracts;

        // Load recent activity
        loadRecentActivity();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadRecentActivity() {
    const activityFeed = document.getElementById('activity-feed');
    activityFeed.innerHTML = '<li class="loading-spinner"><div class="spinner"></div></li>';

    try {
        const activities = [];

        // Get recent contracts
        const contractsSnapshot = await db.collection('contracts')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('updatedAt', 'desc')
            .limit(5)
            .get();

        contractsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'contract',
                icon: data.status === 'signed' ? 'fa-file-circle-check' : 'fa-file-contract',
                text: data.status === 'signed'
                    ? `Contract <strong>${data.contractName}</strong> was signed`
                    : `New contract <strong>${data.contractName}</strong> awaiting signature`,
                timestamp: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
                status: data.status
            });
        });

        // Get recent invoices
        const invoicesSnapshot = await db.collection('invoices')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        invoicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: data.status === 'paid' ? 'payment' : 'invoice',
                icon: data.status === 'paid' ? 'fa-circle-check' : 'fa-file-invoice-dollar',
                text: data.status === 'paid'
                    ? `Payment received for Invoice <strong>#${data.invoiceNumber}</strong>`
                    : `Invoice <strong>#${data.invoiceNumber}</strong> for $${data.amount?.toFixed(2)} is ${data.status}`,
                timestamp: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
                status: data.status
            });
        });

        // Get recent messages
        const messagesSnapshot = await db.collection('messages')
            .where('clientEmail', '==', currentUser.email)
            .where('fromAdmin', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();

        messagesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'message',
                icon: 'fa-comment',
                text: `New message from <strong>Caleb</strong>: "${truncate(data.content, 50)}"`,
                timestamp: data.createdAt?.toDate() || new Date()
            });
        });

        // Sort by timestamp
        activities.sort((a, b) => b.timestamp - a.timestamp);

        // Render
        if (activities.length === 0) {
            activityFeed.innerHTML = `
                <li class="empty-state">
                    <div class="empty-icon"><i class="fas fa-clock"></i></div>
                    <div class="empty-title">No recent activity</div>
                    <div class="empty-description">Activity will appear here as you interact with your account.</div>
                </li>
            `;
            return;
        }

        activityFeed.innerHTML = activities.slice(0, 8).map(activity => `
            <li class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${formatRelativeTime(activity.timestamp)}</div>
                </div>
            </li>
        `).join('');

    } catch (error) {
        console.error('Error loading activity:', error);
        activityFeed.innerHTML = `
            <li class="empty-state">
                <div class="empty-description">Unable to load recent activity.</div>
            </li>
        `;
    }
}

// =============================================
// CONTRACTS
// =============================================

async function loadContracts() {
    const contractsList = document.getElementById('contracts-list');
    contractsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        const snapshot = await db.collection('contracts')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            contractsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-file-contract"></i></div>
                    <div class="empty-title">No Contracts Yet</div>
                    <div class="empty-description">When you receive a contract, it will appear here for review and signature.</div>
                </div>
            `;
            return;
        }

        const contracts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        contractsList.innerHTML = contracts.map(contract => `
            <div class="contract-card ${contract.status}" data-contract-id="${contract.id}">
                <div class="contract-icon">
                    <i class="fas ${contract.status === 'signed' ? 'fa-file-circle-check' : 'fa-file-contract'}"></i>
                </div>
                <div class="contract-info">
                    <div class="contract-name">${escapeHtml(contract.contractName || 'Service Agreement')}</div>
                    <div class="contract-meta">
                        <span><i class="fas fa-calendar"></i> ${formatDate(contract.createdAt?.toDate())}</span>
                        ${contract.status === 'signed' && contract.signedAt ?
                            `<span><i class="fas fa-check"></i> Signed ${formatDate(contract.signedAt?.toDate())}</span>` : ''}
                    </div>
                </div>
                <div class="contract-status">
                    <span class="status-badge ${contract.status}">
                        <i class="fas ${contract.status === 'signed' ? 'fa-check' : 'fa-clock'}"></i>
                        ${contract.status === 'signed' ? 'Signed' : 'Pending'}
                    </span>
                </div>
                <div class="contract-actions">
                    ${contract.status !== 'signed' ?
                        `<a href="https://sign.lantingdigital.com?id=${contract.id}" class="btn btn-primary btn-sm">
                            <i class="fas fa-pen"></i> Sign
                        </a>` :
                        `<button class="btn btn-secondary btn-sm view-contract-btn" data-id="${contract.id}">
                            <i class="fas fa-eye"></i> View
                        </button>`
                    }
                </div>
            </div>
        `).join('');

        // Add click handlers
        contractsList.querySelectorAll('.contract-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.contract-actions')) return;
                const id = card.dataset.contractId;
                const contract = contracts.find(c => c.id === id);
                navigateTo('contract-detail', { id, name: contract?.contractName });
            });
        });

        contractsList.querySelectorAll('.view-contract-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const contract = contracts.find(c => c.id === id);
                navigateTo('contract-detail', { id, name: contract?.contractName });
            });
        });

    } catch (error) {
        console.error('Error loading contracts:', error);
        contractsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="empty-title">Error Loading Contracts</div>
                <div class="empty-description">Please try refreshing the page.</div>
            </div>
        `;
    }
}

async function loadContractDetail(data) {
    const contractDocument = document.getElementById('contract-document');
    const actionsContainer = document.getElementById('contract-detail-actions');

    contractDocument.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    actionsContainer.innerHTML = '';

    try {
        const doc = await db.collection('contracts').doc(data.id).get();

        if (!doc.exists) {
            contractDocument.innerHTML = '<p>Contract not found.</p>';
            return;
        }

        const contract = { id: doc.id, ...doc.data() };

        // Check authorization
        if (contract.clientEmail !== currentUser.email) {
            contractDocument.innerHTML = '<p>You do not have permission to view this contract.</p>';
            return;
        }

        // Render contract HTML
        if (contract.contractHtml) {
            contractDocument.innerHTML = contract.contractHtml;
        } else {
            contractDocument.innerHTML = '<p>Contract content not available.</p>';
        }

        // Add sign button if pending
        if (contract.status !== 'signed') {
            actionsContainer.innerHTML = `
                <a href="https://sign.lantingdigital.com?id=${contract.id}" class="btn btn-primary">
                    <i class="fas fa-pen"></i> Sign Contract
                </a>
            `;
        }

    } catch (error) {
        console.error('Error loading contract:', error);
        contractDocument.innerHTML = '<p>Error loading contract. Please try again.</p>';
    }
}

// =============================================
// INVOICES (with Stripe)
// =============================================

async function loadInvoices() {
    const invoicesList = document.getElementById('invoices-list');
    invoicesList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        const snapshot = await db.collection('invoices')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            invoicesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                    <div class="empty-title">No Invoices</div>
                    <div class="empty-description">Invoices for your projects will appear here once generated.</div>
                </div>
            `;
            return;
        }

        const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        invoicesList.innerHTML = invoices.map(invoice => {
            const isPaid = invoice.status === 'paid';
            const isOverdue = invoice.status === 'overdue';
            const isPending = invoice.status === 'pending';
            const statusClass = isPaid ? 'paid' : (isOverdue ? 'overdue' : (isPending ? 'pending' : 'draft'));

            // Get description from line items or use fallback
            const description = invoice.lineItems && invoice.lineItems.length > 0
                ? invoice.lineItems.map(item => item.description).join(', ')
                : (invoice.description || 'Service Invoice');

            // Use total field (from admin) or amount (legacy)
            const amount = invoice.total || invoice.amount || 0;

            return `
                <div class="invoice-card ${statusClass}" data-invoice-id="${invoice.id}">
                    <div class="invoice-icon">
                        <i class="fas ${isPaid ? 'fa-circle-check' : 'fa-file-invoice-dollar'}"></i>
                    </div>
                    <div class="invoice-info">
                        <div class="invoice-number">Invoice #${escapeHtml(invoice.invoiceNumber || invoice.id.slice(0, 8))}</div>
                        <div class="invoice-description">${escapeHtml(truncate(description, 60))}</div>
                        <div class="invoice-meta">
                            ${invoice.dueDate ? `Due: ${formatDate(invoice.dueDate?.toDate())}` : ''}
                            ${invoice.paidAt ? `Paid: ${formatDate(invoice.paidAt?.toDate())}` : ''}
                        </div>
                    </div>
                    <div class="invoice-amount">
                        <div class="amount-value">$${amount.toFixed(2)}</div>
                        <div class="amount-status ${statusClass}">
                            ${isPaid ? 'Paid' : (isOverdue ? 'Overdue' : (isPending ? 'Pending' : 'Draft'))}
                        </div>
                    </div>
                    <div class="invoice-actions">
                        ${isPending && invoice.stripePaymentLink ?
                            `<a href="${invoice.stripePaymentLink}" class="btn btn-success btn-sm pay-now-btn">
                                <i class="fas fa-credit-card"></i> Pay Now
                            </a>` : ''}
                        ${isPending && !invoice.stripePaymentLink ?
                            `<span class="btn btn-secondary btn-sm" disabled>
                                <i class="fas fa-spinner fa-spin"></i> Processing...
                            </span>` : ''}
                        ${isPaid ?
                            `<span class="btn btn-secondary btn-sm paid-badge">
                                <i class="fas fa-check"></i> Paid
                            </span>` : ''}
                        ${!isPending && !isPaid ?
                            `<span class="btn btn-secondary btn-sm">
                                <i class="fas fa-clock"></i> Draft
                            </span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading invoices:', error);
        invoicesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="empty-title">Error Loading Invoices</div>
                <div class="empty-description">Please try refreshing the page.</div>
            </div>
        `;
    }
}

async function loadInvoiceDetail(data) {
    // Invoice detail view - can expand later
    navigateTo('invoices');
}

// =============================================
// MESSAGES
// =============================================

let messagesUnsubscribe = null;
let adminStatusUnsubscribe = null;

// Load admin status for display in messages
function loadAdminStatus() {
    const statusIndicator = document.getElementById('admin-status-indicator');
    const statusLabel = document.getElementById('admin-status-label');

    if (!statusIndicator || !statusLabel) return;

    // Clean up existing listener
    if (adminStatusUnsubscribe) {
        adminStatusUnsubscribe();
    }

    // Set up real-time listener for admin status
    adminStatusUnsubscribe = db.collection('settings').doc('admin')
        .onSnapshot(doc => {
            const status = doc.exists ? doc.data().status : 'available';

            const statusConfig = {
                available: {
                    label: 'Typically responds in ~5 minutes',
                    class: 'available'
                },
                busy: {
                    label: 'Typically responds in 30-60 minutes',
                    class: 'busy'
                },
                away: {
                    label: 'Away - responds in 1-2 business days',
                    class: 'away'
                }
            };

            const config = statusConfig[status] || statusConfig.available;

            statusIndicator.className = 'admin-status-indicator ' + config.class;
            statusLabel.textContent = config.label;
        }, error => {
            console.error('Error loading admin status:', error);
            statusLabel.textContent = 'Status unavailable';
        });
}

async function loadMessages() {
    const messagesList = document.getElementById('messages-list');
    messagesList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    // Unsubscribe from previous listener
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    try {
        // Set up real-time listener for messages
        messagesUnsubscribe = db.collection('messages')
            .where('clientEmail', '==', currentUser.email)
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    messagesList.innerHTML = `
                        <div class="messages-empty">
                            <i class="fas fa-comments"></i>
                            <p>No messages yet. Start a conversation!</p>
                        </div>
                    `;
                    return;
                }

                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                messagesList.innerHTML = messages.map(msg => {
                    const isSent = !msg.fromAdmin;
                    return `
                        <div class="message ${isSent ? 'sent' : 'received'}">
                            <div class="message-bubble">${escapeHtml(msg.content)}</div>
                            <div class="message-time">${formatMessageTime(msg.createdAt?.toDate())}</div>
                        </div>
                    `;
                }).join('');

                // Scroll to bottom
                messagesList.scrollTop = messagesList.scrollHeight;

                // Mark unread messages as read
                markMessagesAsRead(messages);
            }, error => {
                console.error('Error loading messages:', error);
                messagesList.innerHTML = `
                    <div class="messages-empty">
                        <p>Unable to load messages.</p>
                    </div>
                `;
            });

    } catch (error) {
        console.error('Error setting up messages:', error);
    }
}

async function markMessagesAsRead(messages) {
    const unread = messages.filter(m => m.fromAdmin && !m.read);

    for (const msg of unread) {
        try {
            await db.collection('messages').doc(msg.id).update({
                read: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            // Ignore errors
        }
    }

    // Update badge
    const remainingUnread = await db.collection('messages')
        .where('clientEmail', '==', currentUser.email)
        .where('read', '==', false)
        .where('fromAdmin', '==', true)
        .get();

    updateBadge('messages-badge', remainingUnread.size);
    document.getElementById('stat-unread-messages').textContent = remainingUnread.size;
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content) return;

    const sendBtn = document.getElementById('send-message-btn');
    sendBtn.disabled = true;

    try {
        await db.collection('messages').add({
            clientId: clientData.id,
            clientEmail: currentUser.email,
            clientName: clientData.name,
            content: content,
            fromAdmin: false,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        input.value = '';

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// =============================================
// REAL-TIME LISTENERS
// =============================================

function setupRealtimeListeners() {
    // Clean up existing listeners
    unsubscribeListeners.forEach(unsub => unsub());
    unsubscribeListeners = [];

    // Listen for new contracts
    const contractsUnsub = db.collection('contracts')
        .where('clientEmail', '==', currentUser.email)
        .onSnapshot(snapshot => {
            const pending = snapshot.docs.filter(d => d.data().status !== 'signed').length;
            updateBadge('contracts-badge', pending);
        });
    unsubscribeListeners.push(contractsUnsub);

    // Listen for invoice updates
    const invoicesUnsub = db.collection('invoices')
        .where('clientEmail', '==', currentUser.email)
        .onSnapshot(snapshot => {
            const pending = snapshot.docs.filter(d =>
                d.data().status === 'pending' || d.data().status === 'overdue'
            ).length;
            updateBadge('invoices-badge', pending);
        });
    unsubscribeListeners.push(invoicesUnsub);

    // Listen for new messages
    const messagesUnsub = db.collection('messages')
        .where('clientEmail', '==', currentUser.email)
        .where('read', '==', false)
        .where('fromAdmin', '==', true)
        .onSnapshot(snapshot => {
            updateBadge('messages-badge', snapshot.size);
        });
    unsubscribeListeners.push(messagesUnsub);
}

// =============================================
// EVENT LISTENERS
// =============================================

// Google Sign In
elements.googleLoginBtn?.addEventListener('click', async () => {
    try {
        // Force account selection every time
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to sign in. Please try again.');
    }
});

// Logout
elements.logoutBtn?.addEventListener('click', async () => {
    try {
        // Clean up listeners
        unsubscribeListeners.forEach(unsub => unsub());
        if (messagesUnsubscribe) messagesUnsubscribe();
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Try Different Account
elements.tryDifferentAccount?.addEventListener('click', async () => {
    try {
        await auth.signOut();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Error:', error);
    }
});

// Mobile Menu
elements.mobileMenuBtn?.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
    elements.sidebarOverlay.classList.toggle('active');
});

elements.sidebarOverlay?.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('active');
}

// Navigation
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.view);
    });
});

// Quick actions
document.querySelectorAll('.quick-action-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(btn.dataset.view);
    });
});

// Stat cards
document.querySelectorAll('.stat-card[data-navigate]').forEach(card => {
    card.addEventListener('click', () => {
        navigateTo(card.dataset.navigate);
    });
});

// Back to contracts
document.getElementById('back-to-contracts')?.addEventListener('click', () => {
    navigateTo('contracts');
});

// Send message
document.getElementById('send-message-btn')?.addEventListener('click', sendMessage);

document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Handle hash changes
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'contracts', 'invoices', 'messages'].includes(hash)) {
        if (currentUser && clientData) {
            navigateTo(hash);
        }
    }
});

// Initial hash check
window.addEventListener('load', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'contracts', 'invoices', 'messages'].includes(hash)) {
        // Will be handled after auth
    }
});

// =============================================
// UTILITY FUNCTIONS
// =============================================

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.slice(0, length) + '...' : str;
}

function formatDate(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

function formatRelativeTime(date) {
    if (!date) return '';

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

function formatMessageTime(date) {
    if (!date) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
}
