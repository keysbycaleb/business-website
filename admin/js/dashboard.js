// Dashboard Logic for Lanting Digital Admin Panel

// State
let currentView = 'active'; // 'active' or 'archived'
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
const viewArchivedBtn = document.getElementById('view-archived');
const exportBtn = document.getElementById('export-btn');
const refreshBtn = document.getElementById('refresh-btn');
const detailModal = document.getElementById('detail-modal');
const confirmModal = document.getElementById('confirm-modal');

// Initialize Dashboard
function initDashboard() {
    loadSubmissions();
    setupEventListeners();
}

// Setup Event Listeners
function setupEventListeners() {
    // View toggle
    viewActiveBtn.addEventListener('click', () => setView('active'));
    viewArchivedBtn.addEventListener('click', () => setView('archived'));

    // Search
    searchInput.addEventListener('input', debounce(filterSubmissions, 300));

    // Export
    exportBtn.addEventListener('click', exportToCSV);

    // Refresh
    refreshBtn.addEventListener('click', loadSubmissions);

    // Table sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'desc';
            }
            renderSubmissions(allSubmissions);
        });
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal actions
    document.getElementById('modal-archive').addEventListener('click', handleArchiveToggle);
    document.getElementById('modal-delete').addEventListener('click', showDeleteConfirm);
    document.getElementById('confirm-delete').addEventListener('click', handleDelete);

    // Close modal on backdrop click
    [detailModal, confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// Set View (Active/Archived)
function setView(view) {
    currentView = view;
    viewActiveBtn.classList.toggle('active', view === 'active');
    viewArchivedBtn.classList.toggle('active', view === 'archived');
    loadSubmissions();
}

// Load Submissions from Firestore
async function loadSubmissions() {
    showLoading(true);

    try {
        const collection = currentView === 'active'
            ? COLLECTIONS.SUBMISSIONS
            : COLLECTIONS.ARCHIVED;

        const snapshot = await db.collection(collection)
            .orderBy('timestamp', 'desc')
            .get();

        allSubmissions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderSubmissions(allSubmissions);
        updateStats();
    } catch (error) {
        console.error('Error loading submissions:', error);
        showToast('Failed to load submissions', 'error');
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

    // Render table rows
    submissionsBody.innerHTML = filtered.map(sub => `
        <tr class="clickable-row" data-id="${sub.id}">
            <td><strong>${escapeHtml(sub.name || 'No name')}</strong></td>
            <td>${escapeHtml(sub.email || 'No email')}</td>
            <td class="message-preview">${escapeHtml(sub.message || 'No message')}</td>
            <td class="date-cell">${formatDate(sub.timestamp)}</td>
            <td class="actions-cell">
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewSubmission('${sub.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); quickArchive('${sub.id}')">
                    <i class="fas fa-${currentView === 'active' ? 'archive' : 'undo'}"></i>
                </button>
            </td>
        </tr>
    `).join('');

    // Add click handlers to rows
    document.querySelectorAll('.clickable-row').forEach(row => {
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
