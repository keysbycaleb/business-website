// Dashboard Logic for Lanting Digital Admin Panel
// Updated for new sidebar navigation layout

// State
let currentView = 'all'; // 'all', 'active', or 'archived'
let allSubmissions = [];
let currentSubmission = null;
let sortField = 'timestamp';
let sortDirection = 'desc';

// DOM Elements
const submissionsBody = document.getElementById('submissions-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const totalSubmissions = document.getElementById('total-submissions');
const todaySubmissions = document.getElementById('today-submissions');
const archivedCount = document.getElementById('archived-count');
const searchInput = document.getElementById('search-input');
const viewActiveBtn = document.getElementById('view-active');
const filterActiveBtn = document.getElementById('filter-active');
const viewArchivedBtn = document.getElementById('view-archived');
const refreshBtn = document.getElementById('refresh-btn');
const detailModal = document.getElementById('detail-modal');
const confirmModal = document.getElementById('confirm-modal');
const pageHeaderTitle = document.getElementById('page-header-title');
const pageHeaderDate = document.getElementById('page-header-date');
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');

// Initialize Dashboard
function initDashboard() {
    loadSubmissions();
    setupEventListeners();
    setupSidebarNavigation();
    updateHeaderDate();
}

// Setup Event Listeners
function setupEventListeners() {
    // Filter buttons
    if (viewActiveBtn) viewActiveBtn.addEventListener('click', () => setView('all'));
    if (filterActiveBtn) filterActiveBtn.addEventListener('click', () => setView('active'));
    if (viewArchivedBtn) viewArchivedBtn.addEventListener('click', () => setView('archived'));

    // Search
    if (searchInput) searchInput.addEventListener('input', debounce(filterSubmissions, 300));

    // Refresh
    if (refreshBtn) refreshBtn.addEventListener('click', loadSubmissions);

    // Mobile menu toggle
    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal actions
    const modalArchiveBtn = document.getElementById('modal-archive');
    const modalDeleteBtn = document.getElementById('modal-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');

    if (modalArchiveBtn) modalArchiveBtn.addEventListener('click', handleArchiveToggle);
    if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', showDeleteConfirm);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDelete);

    // Close modal on backdrop click
    [detailModal, confirmModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeAllModals();
            });
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// Setup Sidebar Navigation
function setupSidebarNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab[data-section]');
    const sections = document.querySelectorAll('.section-content');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('disabled')) return;

            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active section
            const sectionId = tab.dataset.section + '-section';
            sections.forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(sectionId);
            if (targetSection) targetSection.classList.add('active');

            // Update page title
            if (pageHeaderTitle) {
                if (tab.dataset.section === 'leads') {
                    pageHeaderTitle.textContent = 'Leads & Inquiries';
                } else if (tab.dataset.section === 'contracts') {
                    pageHeaderTitle.textContent = 'Contracts & Proposals';
                }
            }

            // Close mobile sidebar
            if (sidebar) sidebar.classList.remove('mobile-open');

            // Load contracts if switching to that section
            if (tab.dataset.section === 'contracts' && typeof loadContracts === 'function') {
                loadContracts();
            }
        });
    });

    // Update sidebar user name
    const sidebarUserName = document.getElementById('sidebar-user-name');
    if (sidebarUserName && auth.currentUser) {
        const email = auth.currentUser.email;
        const name = email.split('@')[0];
        sidebarUserName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    }
}

// Update Header Date
function updateHeaderDate() {
    if (pageHeaderDate) {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        pageHeaderDate.textContent = today.toLocaleDateString('en-US', options);
    }
}

// Set View (All/Active/Archived)
function setView(view) {
    currentView = view;

    // Update filter button states
    if (viewActiveBtn) viewActiveBtn.classList.toggle('active', view === 'all');
    if (filterActiveBtn) filterActiveBtn.classList.toggle('active', view === 'active');
    if (viewArchivedBtn) viewArchivedBtn.classList.toggle('active', view === 'archived');

    loadSubmissions();
}

// Load Submissions from Firestore
async function loadSubmissions() {
    showLoading(true);

    // Set a timeout to show empty state if loading takes too long
    const loadingTimeout = setTimeout(() => {
        console.warn('Loading submissions is taking longer than expected');
        showLoading(false);
        if (allSubmissions.length === 0) {
            emptyState.classList.remove('hidden');
        }
    }, 5000);

    try {
        // 'all' and 'active' both load from submissions, 'archived' loads from archived
        const collection = currentView === 'archived'
            ? COLLECTIONS.ARCHIVED
            : COLLECTIONS.SUBMISSIONS;

        const snapshot = await db.collection(collection)
            .orderBy('timestamp', 'desc')
            .get();

        clearTimeout(loadingTimeout);

        allSubmissions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderSubmissions(allSubmissions);
        updateStats();
    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error('Error loading submissions:', error);
        showToast('Failed to load submissions', 'error');
        // Show empty state with error indication
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>Unable to load submissions</p>
        `;
    } finally {
        showLoading(false);
    }
}

// Update Stats
async function updateStats() {
    try {
        // Get active submissions count
        const activeSnapshot = await db.collection(COLLECTIONS.SUBMISSIONS).get();
        const activeCount = activeSnapshot.size;
        totalSubmissions.textContent = activeCount;

        // Get today's submissions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = activeSnapshot.docs.filter(doc => {
            const timestamp = doc.data().timestamp?.toDate();
            return timestamp && timestamp >= today;
        }).length;
        todaySubmissions.textContent = todayCount;

        // Get archived count
        const archivedSnapshot = await db.collection(COLLECTIONS.ARCHIVED).get();
        archivedCount.textContent = archivedSnapshot.size;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Render Submissions Table
function renderSubmissions(submissions) {
    // Apply search filter
    const searchTerm = searchInput.value.toLowerCase();
    let filtered = submissions;

    if (searchTerm) {
        filtered = submissions.filter(sub =>
            (sub.name || '').toLowerCase().includes(searchTerm) ||
            (sub.email || '').toLowerCase().includes(searchTerm) ||
            (sub.message || '').toLowerCase().includes(searchTerm)
        );
    }

    // Apply sort
    filtered.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Handle timestamp
        if (sortField === 'timestamp') {
            valA = valA?.toDate?.() || new Date(0);
            valB = valB?.toDate?.() || new Date(0);
        }

        // Handle strings
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Show empty state if no results
    if (filtered.length === 0) {
        submissionsBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Render table rows with new cell-primary/cell-sub structure
    submissionsBody.innerHTML = filtered.map(sub => `
        <tr class="clickable-row" data-id="${sub.id}">
            <td>
                <span class="cell-primary">${escapeHtml(sub.name || 'No name')}</span>
                <span class="cell-sub">${escapeHtml(sub.email || 'No email')}</span>
            </td>
            <td class="message-preview">${escapeHtml(truncateMessage(sub.message || 'No message'))}</td>
            <td class="date-cell">${formatDate(sub.timestamp)}</td>
            <td class="actions-cell">
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewSubmission('${sub.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); quickArchive('${sub.id}')" title="${currentView === 'archived' ? 'Restore' : 'Archive'}">
                    <i class="fas fa-${currentView === 'archived' ? 'undo' : 'archive'}"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Add click handlers to rows (scoped to submissions table only)
    submissionsBody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => viewSubmission(row.dataset.id));
    });
}

// Filter Submissions
function filterSubmissions() {
    renderSubmissions(allSubmissions);
}

// View Submission Detail
function viewSubmission(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;

    currentSubmission = submission;

    // Update modal content
    document.getElementById('modal-name').textContent = submission.name || 'No name';
    document.getElementById('modal-email').textContent = submission.email || 'No email';
    document.getElementById('modal-date').textContent = formatDate(submission.timestamp, true);
    document.getElementById('modal-message').textContent = submission.message || 'No message';

    // Update email link
    const emailLink = document.getElementById('modal-email-link');
    if (submission.email) {
        emailLink.href = `mailto:${submission.email}`;
        emailLink.style.display = 'inline-flex';
    } else {
        emailLink.style.display = 'none';
    }

    // Update archive button text
    const archiveBtn = document.getElementById('modal-archive');
    if (currentView === 'active') {
        archiveBtn.innerHTML = '<i class="fas fa-archive"></i> Archive';
    } else {
        archiveBtn.innerHTML = '<i class="fas fa-undo"></i> Restore';
    }

    detailModal.classList.add('active');
}

// Quick Archive/Restore
async function quickArchive(id) {
    const submission = allSubmissions.find(s => s.id === id);
    if (!submission) return;

    currentSubmission = submission;
    await handleArchiveToggle();
}

// Handle Archive/Restore
async function handleArchiveToggle() {
    if (!currentSubmission) return;

    const fromCollection = currentView === 'active'
        ? COLLECTIONS.SUBMISSIONS
        : COLLECTIONS.ARCHIVED;
    const toCollection = currentView === 'active'
        ? COLLECTIONS.ARCHIVED
        : COLLECTIONS.SUBMISSIONS;

    try {
        // Copy to new collection
        const data = { ...currentSubmission };
        delete data.id;
        await db.collection(toCollection).doc(currentSubmission.id).set(data);

        // Delete from old collection
        await db.collection(fromCollection).doc(currentSubmission.id).delete();

        const action = currentView === 'active' ? 'archived' : 'restored';
        showToast(`Submission ${action} successfully`, 'success');

        closeAllModals();
        loadSubmissions();
    } catch (error) {
        console.error('Error archiving/restoring:', error);
        showToast('Operation failed', 'error');
    }
}

// Show Delete Confirmation
function showDeleteConfirm() {
    detailModal.classList.remove('active');
    confirmModal.classList.add('active');
}

// Handle Delete
async function handleDelete() {
    if (!currentSubmission) return;

    const collection = currentView === 'active'
        ? COLLECTIONS.SUBMISSIONS
        : COLLECTIONS.ARCHIVED;

    try {
        await db.collection(collection).doc(currentSubmission.id).delete();

        showToast('Submission deleted permanently', 'success');

        closeAllModals();
        loadSubmissions();
    } catch (error) {
        console.error('Error deleting:', error);
        showToast('Delete failed', 'error');
    }
}

// Export to CSV
function exportToCSV() {
    if (allSubmissions.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    const headers = ['Name', 'Email', 'Message', 'Date', 'Form ID'];
    const rows = allSubmissions.map(sub => [
        sub.name || '',
        sub.email || '',
        (sub.message || '').replace(/"/g, '""'), // Escape quotes
        formatDate(sub.timestamp, true),
        sub.formId || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lanting-digital-leads-${currentView}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully', 'success');
}

// Close All Modals
function closeAllModals() {
    detailModal.classList.remove('active');
    confirmModal.classList.remove('active');
    currentSubmission = null;
}

// Show Loading State
function showLoading(show) {
    loadingState.classList.toggle('hidden', !show);
    if (show) {
        submissionsBody.innerHTML = '';
        emptyState.classList.add('hidden');
    }
}

// Show Toast Notification
function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility Functions
function formatDate(timestamp, full = false) {
    if (!timestamp) return 'Unknown';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    if (full) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Relative time for recent, absolute for older
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) {
            const minutes = Math.floor(diff / (1000 * 60));
            return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
        }
        return `${hours}h ago`;
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days}d ago`;
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function truncateMessage(message, maxLength = 80) {
    if (!message || message.length <= maxLength) return message;
    return message.substring(0, maxLength).trim() + '...';
}
