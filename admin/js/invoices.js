// Invoices Management for Lanting Digital Admin Panel
// Handles invoice creation, management, and Stripe integration

// State
let allInvoices = [];
let currentFilter = 'all';
let editingInvoiceId = null;

// DOM Elements
const invoicesBody = document.getElementById('invoices-body');
const invoiceModal = document.getElementById('invoice-modal');
const viewInvoiceModal = document.getElementById('view-invoice-modal');

// Initialize Invoices Section
function initInvoices() {
    setupInvoiceEventListeners();
}

// Setup Event Listeners
function setupInvoiceEventListeners() {
    // Create Invoice button
    const createBtn = document.getElementById('create-invoice-btn');
    if (createBtn) {
        createBtn.addEventListener('click', openCreateInvoiceModal);
    }

    // Filter buttons
    document.querySelectorAll('.invoice-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.invoice-filters .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderInvoices();
        });
    });

    // Add line item button
    const addLineBtn = document.getElementById('add-line-item');
    if (addLineBtn) {
        addLineBtn.addEventListener('click', addLineItem);
    }

    // Setup line item calculations on container
    const lineItemsContainer = document.getElementById('line-items-container');
    if (lineItemsContainer) {
        lineItemsContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('line-quantity') || e.target.classList.contains('line-price')) {
                updateLineTotal(e.target.closest('.line-item'));
                updateInvoiceTotals();
            }
        });
    }

    // Close modals on backdrop click
    [invoiceModal, viewInvoiceModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeInvoiceModal();
                    closeViewInvoiceModal();
                }
            });
        }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInvoiceModal();
            closeViewInvoiceModal();
        }
    });
}

// Load Invoices from Firestore
async function loadInvoices() {
    try {
        const snapshot = await db.collection('invoices')
            .orderBy('createdAt', 'desc')
            .get();

        allInvoices = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderInvoices();
        updateInvoiceStats();
    } catch (error) {
        console.error('Error loading invoices:', error);
        showToast('Failed to load invoices', 'error');
    }
}

// Render Invoices Table
function renderInvoices() {
    let filtered = allInvoices;

    if (currentFilter !== 'all') {
        filtered = allInvoices.filter(inv => inv.status === currentFilter);
    }

    if (filtered.length === 0) {
        invoicesBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-file-invoice"></i>
                        <p>${currentFilter === 'all' ? 'No invoices yet' : `No ${currentFilter} invoices`}</p>
                        ${currentFilter === 'all' ? '<button class="btn btn-primary btn-sm" onclick="openCreateInvoiceModal()">Create Your First Invoice</button>' : ''}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    invoicesBody.innerHTML = filtered.map(invoice => `
        <tr onclick="viewInvoice('${invoice.id}')">
            <td><strong>${escapeHtml(invoice.invoiceNumber || 'Draft')}</strong></td>
            <td>
                <span class="cell-primary">${escapeHtml(invoice.clientName || 'Unknown')}</span>
                <span class="cell-sub">${escapeHtml(invoice.clientEmail || '')}</span>
            </td>
            <td><strong>$${(invoice.total || 0).toFixed(2)}</strong></td>
            <td><span class="status-badge ${invoice.status}">${invoice.status}</span></td>
            <td>${formatDate(invoice.createdAt)}</td>
            <td class="actions-cell">
                ${invoice.status === 'draft' ? `
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); editInvoice('${invoice.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); sendInvoiceById('${invoice.id}')" title="Send">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                ` : ''}
                ${invoice.status === 'pending' && invoice.stripePaymentLink ? `
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); copyPaymentLink('${invoice.stripePaymentLink}')" title="Copy Payment Link">
                        <i class="fas fa-link"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewInvoice('${invoice.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                ${invoice.status !== 'paid' ? `
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteInvoice('${invoice.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// Update Invoice Stats
function updateInvoiceStats() {
    const total = allInvoices.length;
    const pending = allInvoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;
    const paid = allInvoices.filter(i => i.status === 'paid').length;
    const revenue = allInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);

    document.getElementById('total-invoices').textContent = total;
    document.getElementById('pending-invoices').textContent = pending;
    document.getElementById('paid-invoices').textContent = paid;
    document.getElementById('total-revenue').textContent = `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Open Create Invoice Modal
async function openCreateInvoiceModal() {
    editingInvoiceId = null;
    document.getElementById('invoice-modal-title').textContent = 'Create Invoice';
    document.getElementById('invoice-form').reset();

    // Reset line items to single empty row
    const container = document.getElementById('line-items-container');
    container.innerHTML = `
        <div class="line-item" data-index="0">
            <input type="text" class="line-description" placeholder="Description (e.g., Web Development)" required>
            <input type="number" class="line-quantity" placeholder="Qty" value="1" min="1" required>
            <input type="number" class="line-price" placeholder="Price" step="0.01" min="0" required>
            <span class="line-total">$0.00</span>
            <button type="button" class="btn-remove-line" onclick="removeLineItem(this)" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Reset totals
    document.getElementById('invoice-subtotal').textContent = '$0.00';
    document.getElementById('invoice-total').textContent = '$0.00';

    // Load clients for dropdown
    await loadClientsForDropdown();

    invoiceModal.classList.add('active');
}

// Load Clients for Dropdown
async function loadClientsForDropdown() {
    const select = document.getElementById('invoice-client');
    select.innerHTML = '<option value="">Select a client...</option>';

    try {
        const snapshot = await db.collection('clients').orderBy('name').get();

        snapshot.docs.forEach(doc => {
            const client = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.dataset.email = client.email || '';
            option.dataset.name = client.name || '';
            option.textContent = `${client.name || 'Unknown'} (${client.email || 'No email'})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Close Invoice Modal
function closeInvoiceModal() {
    invoiceModal.classList.remove('active');
    editingInvoiceId = null;
}

// Add Line Item
function addLineItem() {
    const container = document.getElementById('line-items-container');
    const index = container.children.length;

    const lineItem = document.createElement('div');
    lineItem.className = 'line-item';
    lineItem.dataset.index = index;
    lineItem.innerHTML = `
        <input type="text" class="line-description" placeholder="Description" required>
        <input type="number" class="line-quantity" placeholder="Qty" value="1" min="1" required>
        <input type="number" class="line-price" placeholder="Price" step="0.01" min="0" required>
        <span class="line-total">$0.00</span>
        <button type="button" class="btn-remove-line" onclick="removeLineItem(this)" title="Remove">
            <i class="fas fa-trash"></i>
        </button>
    `;

    container.appendChild(lineItem);
}

// Remove Line Item
function removeLineItem(btn) {
    const container = document.getElementById('line-items-container');
    if (container.children.length > 1) {
        btn.closest('.line-item').remove();
        updateInvoiceTotals();
    } else {
        showToast('Invoice must have at least one line item', 'error');
    }
}

// Update Line Total
function updateLineTotal(lineItem) {
    const qty = parseFloat(lineItem.querySelector('.line-quantity').value) || 0;
    const price = parseFloat(lineItem.querySelector('.line-price').value) || 0;
    const total = qty * price;
    lineItem.querySelector('.line-total').textContent = `$${total.toFixed(2)}`;
}

// Update Invoice Totals
function updateInvoiceTotals() {
    const lineItems = document.querySelectorAll('#line-items-container .line-item');
    let subtotal = 0;

    lineItems.forEach(item => {
        const qty = parseFloat(item.querySelector('.line-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.line-price').value) || 0;
        subtotal += qty * price;
    });

    document.getElementById('invoice-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('invoice-total').textContent = `$${subtotal.toFixed(2)}`;
}

// Get Form Data
function getInvoiceFormData() {
    const clientSelect = document.getElementById('invoice-client');
    const selectedOption = clientSelect.options[clientSelect.selectedIndex];

    const lineItems = [];
    document.querySelectorAll('#line-items-container .line-item').forEach(item => {
        const description = item.querySelector('.line-description').value.trim();
        const quantity = parseFloat(item.querySelector('.line-quantity').value) || 0;
        const unitPrice = parseFloat(item.querySelector('.line-price').value) || 0;

        if (description && quantity > 0 && unitPrice >= 0) {
            lineItems.push({
                description,
                quantity,
                unitPrice,
                total: quantity * unitPrice
            });
        }
    });

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    return {
        clientId: clientSelect.value,
        clientEmail: selectedOption?.dataset.email || '',
        clientName: selectedOption?.dataset.name || '',
        dueInDays: parseInt(document.getElementById('invoice-due-date').value) || 0,
        lineItems,
        subtotal,
        total: subtotal, // Could add tax here later
        notes: document.getElementById('invoice-notes').value.trim()
    };
}

// Generate Invoice Number
async function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `${year}-`;

    // Get the highest invoice number for this year
    const snapshot = await db.collection('invoices')
        .where('invoiceNumber', '>=', prefix)
        .where('invoiceNumber', '<', `${year + 1}-`)
        .orderBy('invoiceNumber', 'desc')
        .limit(1)
        .get();

    let nextNum = 1;
    if (!snapshot.empty) {
        const lastNumber = snapshot.docs[0].data().invoiceNumber;
        const lastNum = parseInt(lastNumber.split('-')[1]) || 0;
        nextNum = lastNum + 1;
    }

    return `${year}-${String(nextNum).padStart(3, '0')}`;
}

// Save Invoice as Draft
async function saveInvoiceDraft() {
    const formData = getInvoiceFormData();

    // Validate
    if (!formData.clientId) {
        showToast('Please select a client', 'error');
        return;
    }

    if (formData.lineItems.length === 0) {
        showToast('Please add at least one line item', 'error');
        return;
    }

    try {
        const invoiceData = {
            ...formData,
            status: 'draft',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingInvoiceId) {
            await db.collection('invoices').doc(editingInvoiceId).update(invoiceData);
            showToast('Invoice updated', 'success');
        } else {
            invoiceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('invoices').add(invoiceData);
            showToast('Draft saved', 'success');
        }

        closeInvoiceModal();
        loadInvoices();
    } catch (error) {
        console.error('Error saving invoice:', error);
        showToast('Failed to save invoice', 'error');
    }
}

// Send Invoice (creates in Stripe and sends)
async function sendInvoice() {
    const formData = getInvoiceFormData();

    // Validate
    if (!formData.clientId) {
        showToast('Please select a client', 'error');
        return;
    }

    if (!formData.clientEmail) {
        showToast('Selected client must have an email address', 'error');
        return;
    }

    if (formData.lineItems.length === 0) {
        showToast('Please add at least one line item', 'error');
        return;
    }

    const sendBtn = document.getElementById('send-invoice-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Calculate due date
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + formData.dueInDays);

        const invoiceData = {
            ...formData,
            invoiceNumber,
            status: 'pending',
            dueDate: firebase.firestore.Timestamp.fromDate(dueDate),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Save to Firestore first
        let invoiceRef;
        if (editingInvoiceId) {
            invoiceRef = db.collection('invoices').doc(editingInvoiceId);
            await invoiceRef.update(invoiceData);
        } else {
            invoiceRef = await db.collection('invoices').add(invoiceData);
        }

        // TODO: Call Cloud Function to create Stripe invoice and payment link
        // For now, we'll create a placeholder that the webhook handler will update
        // In the next step, we'll create the Cloud Function

        showToast(`Invoice ${invoiceNumber} created!`, 'success');
        closeInvoiceModal();
        loadInvoices();

    } catch (error) {
        console.error('Error sending invoice:', error);
        showToast('Failed to send invoice', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invoice';
    }
}

// Send Invoice by ID (for draft invoices)
async function sendInvoiceById(invoiceId) {
    const invoice = allInvoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    if (!invoice.clientEmail) {
        showToast('Invoice client must have an email address', 'error');
        return;
    }

    try {
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Calculate due date
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (invoice.dueInDays || 0));

        await db.collection('invoices').doc(invoiceId).update({
            invoiceNumber,
            status: 'pending',
            dueDate: firebase.firestore.Timestamp.fromDate(dueDate),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`Invoice ${invoiceNumber} sent!`, 'success');
        loadInvoices();

    } catch (error) {
        console.error('Error sending invoice:', error);
        showToast('Failed to send invoice', 'error');
    }
}

// Edit Invoice
async function editInvoice(invoiceId) {
    const invoice = allInvoices.find(i => i.id === invoiceId);
    if (!invoice || invoice.status !== 'draft') {
        showToast('Can only edit draft invoices', 'error');
        return;
    }

    editingInvoiceId = invoiceId;
    document.getElementById('invoice-modal-title').textContent = 'Edit Invoice';

    // Load clients first
    await loadClientsForDropdown();

    // Populate form
    document.getElementById('invoice-client').value = invoice.clientId || '';
    document.getElementById('invoice-due-date').value = invoice.dueInDays || 0;
    document.getElementById('invoice-notes').value = invoice.notes || '';

    // Populate line items
    const container = document.getElementById('line-items-container');
    container.innerHTML = '';

    (invoice.lineItems || []).forEach((item, index) => {
        const lineItem = document.createElement('div');
        lineItem.className = 'line-item';
        lineItem.dataset.index = index;
        lineItem.innerHTML = `
            <input type="text" class="line-description" placeholder="Description" value="${escapeHtml(item.description)}" required>
            <input type="number" class="line-quantity" placeholder="Qty" value="${item.quantity}" min="1" required>
            <input type="number" class="line-price" placeholder="Price" value="${item.unitPrice}" step="0.01" min="0" required>
            <span class="line-total">$${(item.quantity * item.unitPrice).toFixed(2)}</span>
            <button type="button" class="btn-remove-line" onclick="removeLineItem(this)" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(lineItem);
    });

    // If no line items, add empty one
    if (container.children.length === 0) {
        addLineItem();
    }

    updateInvoiceTotals();
    invoiceModal.classList.add('active');
}

// Delete Invoice
async function deleteInvoice(invoiceId) {
    const invoice = allInvoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    // Only allow deleting draft or pending invoices (not paid ones)
    if (invoice.status === 'paid') {
        showToast('Cannot delete paid invoices', 'error');
        return;
    }

    const confirmMsg = invoice.status === 'pending'
        ? `Delete Invoice ${invoice.invoiceNumber}? This will also invalidate any payment links.`
        : `Delete this draft invoice?`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        await db.collection('invoices').doc(invoiceId).delete();
        showToast('Invoice deleted', 'success');
        loadInvoices();
    } catch (error) {
        console.error('Error deleting invoice:', error);
        showToast('Failed to delete invoice', 'error');
    }
}

// View Invoice
function viewInvoice(invoiceId) {
    const invoice = allInvoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    document.getElementById('view-invoice-number').textContent = invoice.invoiceNumber || 'Draft';

    const statusColors = {
        draft: 'background: #f3f4f6; color: #6b7280;',
        pending: 'background: #fef3c7; color: #d97706;',
        paid: 'background: #dcfce7; color: #059669;',
        overdue: 'background: #fee2e2; color: #dc2626;'
    };

    const content = document.getElementById('view-invoice-content');
    content.innerHTML = `
        <div class="invoice-detail-header">
            <div>
                <div class="invoice-detail-number">Invoice ${invoice.invoiceNumber || '(Draft)'}</div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">
                    Created: ${formatDate(invoice.createdAt)}
                    ${invoice.dueDate ? `<br>Due: ${formatDate(invoice.dueDate)}` : ''}
                </div>
            </div>
            <span class="invoice-detail-status" style="${statusColors[invoice.status] || statusColors.draft}">
                ${invoice.status.toUpperCase()}
            </span>
        </div>

        <div class="invoice-detail-client">
            <h4>Bill To</h4>
            <p><strong>${escapeHtml(invoice.clientName || 'Unknown')}</strong></p>
            <p>${escapeHtml(invoice.clientEmail || '')}</p>
        </div>

        <div class="invoice-detail-items">
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${(invoice.lineItems || []).map(item => `
                        <tr>
                            <td>${escapeHtml(item.description)}</td>
                            <td>${item.quantity}</td>
                            <td>$${item.unitPrice.toFixed(2)}</td>
                            <td class="item-total">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="invoice-totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>$${(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div class="total-row grand-total">
                <span>Total:</span>
                <span>$${(invoice.total || 0).toFixed(2)}</span>
            </div>
        </div>

        ${invoice.notes ? `
            <div style="margin-top: 20px; padding: 16px; background: var(--bg-app); border-radius: 8px;">
                <strong style="font-size: 0.85rem; color: var(--text-muted);">NOTES</strong>
                <p style="margin-top: 8px; white-space: pre-wrap;">${escapeHtml(invoice.notes)}</p>
            </div>
        ` : ''}
    `;

    // Actions based on status
    const actions = document.getElementById('view-invoice-actions');
    let actionsHtml = '<button class="btn btn-outline" onclick="closeViewInvoiceModal()">Close</button>';

    if (invoice.status === 'draft') {
        actionsHtml = `
            <button class="btn btn-outline" onclick="closeViewInvoiceModal()">Close</button>
            <button class="btn btn-secondary" onclick="closeViewInvoiceModal(); editInvoice('${invoice.id}')">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-primary" onclick="closeViewInvoiceModal(); sendInvoiceById('${invoice.id}')">
                <i class="fas fa-paper-plane"></i> Send Invoice
            </button>
        `;
    } else if (invoice.status === 'pending' && invoice.stripePaymentLink) {
        actionsHtml = `
            <button class="btn btn-outline" onclick="closeViewInvoiceModal()">Close</button>
            <button class="btn btn-secondary" onclick="copyPaymentLink('${invoice.stripePaymentLink}')">
                <i class="fas fa-link"></i> Copy Payment Link
            </button>
            <a href="${invoice.stripePaymentLink}" target="_blank" class="btn btn-primary">
                <i class="fas fa-external-link-alt"></i> Open Payment Page
            </a>
        `;
    }

    actions.innerHTML = actionsHtml;
    viewInvoiceModal.classList.add('active');
}

// Close View Invoice Modal
function closeViewInvoiceModal() {
    viewInvoiceModal.classList.remove('active');
}

// Copy Payment Link
function copyPaymentLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        showToast('Payment link copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy link', 'error');
    });
}

// Format Date
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initInvoices);
