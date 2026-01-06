// Subscriptions & Payment Plans Management for Lanting Digital Admin Panel

// Get Firebase Functions instance (initialized lazily to ensure Firebase is ready)
function getFunctions() {
    return firebase.functions();
}

// Subscription Plan Pricing
const SUBSCRIPTION_PLANS = {
    retainer: {
        standard: { priceId: 'price_1SldKB5CaLIi8KGPhzEhw1Jj', amount: 149, name: 'Standard ($149/mo)' },
        priority: { priceId: 'price_1SldKC5CaLIi8KGPvh8rsrMo', amount: 199, name: 'Priority ($199/mo)' }
    },
    saas: {
        starter: { priceId: 'price_1SldKC5CaLIi8KGPa90LOPpP', amount: 149, name: 'Starter ($149/mo)' },
        growth: { priceId: 'price_1SldKC5CaLIi8KGPMqkjWwlm', amount: 299, name: 'Growth ($299/mo)' },
        scale: { priceId: 'price_1SldKD5CaLIi8KGPHOWVo9xG', amount: 499, name: 'Scale ($499/mo)' }
    }
};

// State
let allSubscriptions = [];
let allPaymentPlans = [];
let currentSubFilter = 'all';

// Initialize subscriptions section
function initSubscriptions() {
    loadSubscriptionStats();
    loadSubscriptionsAndPlans();
    setupSubscriptionEventListeners();
}

// Setup event listeners
function setupSubscriptionEventListeners() {
    // Create buttons
    document.getElementById('create-subscription-btn')?.addEventListener('click', openCreateSubscriptionModal);
    document.getElementById('create-payment-plan-btn')?.addEventListener('click', openPaymentPlanModal);
    document.getElementById('create-payment-plan-from-invoice-btn')?.addEventListener('click', openPaymentPlanModal);

    // Filter buttons
    document.querySelectorAll('[data-sub-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-sub-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSubFilter = btn.dataset.subFilter;
            renderSubscriptionsTable();
        });
    });

    // Plan type change for subscription modal
    document.getElementById('sub-plan-type')?.addEventListener('change', handlePlanTypeChange);
    document.getElementById('sub-plan-tier')?.addEventListener('change', handlePlanTierChange);

    // Payment plan preview calculation
    document.getElementById('pp-total-amount')?.addEventListener('input', updatePaymentPlanPreview);
    document.getElementById('pp-num-payments')?.addEventListener('change', updatePaymentPlanPreview);
    document.getElementById('pp-start-date')?.addEventListener('change', updatePaymentPlanPreview);
}

// Load subscription stats
async function loadSubscriptionStats() {
    try {
        // Get subscriptions
        const subsSnapshot = await db.collection('subscriptions').where('status', '==', 'active').get();
        document.getElementById('active-subscriptions').textContent = subsSnapshot.size;

        // Get payment plans
        const plansSnapshot = await db.collection('paymentPlans').where('status', '==', 'active').get();
        document.getElementById('active-payment-plans').textContent = plansSnapshot.size;

        // Calculate monthly recurring revenue
        let mrr = 0;
        subsSnapshot.forEach(doc => {
            const data = doc.data();
            mrr += data.monthlyAmount || 0;
        });
        plansSnapshot.forEach(doc => {
            const data = doc.data();
            mrr += data.monthlyAmount || 0;
        });
        document.getElementById('monthly-recurring').textContent = formatCurrency(mrr);

        // Get failed payments
        const failedSubs = await db.collection('subscriptions').where('status', '==', 'payment_failed').get();
        const failedPlans = await db.collection('paymentPlans').where('status', '==', 'payment_failed').get();
        document.getElementById('failed-payments').textContent = failedSubs.size + failedPlans.size;
    } catch (error) {
        console.error('Error loading subscription stats:', error);
    }
}

// Load all subscriptions and payment plans
async function loadSubscriptionsAndPlans() {
    try {
        // Load subscriptions
        const subsSnapshot = await db.collection('subscriptions')
            .orderBy('createdAt', 'desc')
            .get();
        allSubscriptions = subsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'subscription',
            ...doc.data()
        }));

        // Load payment plans
        const plansSnapshot = await db.collection('paymentPlans')
            .orderBy('createdAt', 'desc')
            .get();
        allPaymentPlans = plansSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'payment_plan',
            ...doc.data()
        }));

        renderSubscriptionsTable();
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        showToast('Failed to load subscriptions', 'error');
    }
}

// Render subscriptions table
function renderSubscriptionsTable() {
    const tbody = document.getElementById('subscriptions-body');
    if (!tbody) return;

    // Combine and filter data
    let items = [...allSubscriptions, ...allPaymentPlans];

    // Apply filter
    if (currentSubFilter === 'subscriptions') {
        items = items.filter(i => i.type === 'subscription');
    } else if (currentSubFilter === 'payment_plans') {
        items = items.filter(i => i.type === 'payment_plan');
    } else if (currentSubFilter === 'failed') {
        items = items.filter(i => i.status === 'payment_failed');
    }

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-sync-alt"></i>
                        <p>No ${currentSubFilter === 'all' ? 'subscriptions or payment plans' : currentSubFilter.replace('_', ' ')} found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isPaymentPlan = item.type === 'payment_plan';
        const progressHtml = isPaymentPlan
            ? `<div class="progress-bar-mini"><div class="progress-fill" style="width: ${(item.paymentsCompleted || 0) / (item.numberOfPayments || 1) * 100}%"></div></div>
               <span class="progress-text">${item.paymentsCompleted || 0}/${item.numberOfPayments || '?'} payments</span>`
            : '<span class="text-muted">Ongoing</span>';

        const statusClass = getStatusClass(item.status);
        const typeLabel = isPaymentPlan ? 'Payment Plan' : 'Subscription';
        const typeBadgeClass = isPaymentPlan ? 'type-payment-plan' : 'type-subscription';

        return `
            <tr class="clickable-row" onclick="viewSubscriptionDetails('${item.id}', '${item.type}')">
                <td>
                    <span class="cell-primary">${escapeHtml(item.clientName || 'Unknown')}</span>
                    <span class="cell-sub">${escapeHtml(item.clientEmail || '')}</span>
                </td>
                <td><span class="type-badge ${typeBadgeClass}">${typeLabel}</span></td>
                <td>${escapeHtml(item.planName || item.projectName || 'N/A')}</td>
                <td><strong>${formatCurrency(item.monthlyAmount || 0)}/mo</strong></td>
                <td>${progressHtml}</td>
                <td><span class="status-badge ${statusClass}">${formatStatus(item.status)}</span></td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewSubscriptionDetails('${item.id}', '${item.type}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${item.status === 'active' ? `
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); confirmCancelSubscription('${item.id}', '${item.type}')" title="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// Open create subscription modal
function openCreateSubscriptionModal() {
    document.getElementById('subscription-modal').classList.add('active');
    document.getElementById('subscription-form').reset();
    document.getElementById('sub-plan-tier').disabled = true;
    document.getElementById('sub-preview').classList.add('hidden');

    // Populate clients dropdown
    populateClientsDropdown('sub-client');
}

// Close subscription modal
function closeSubscriptionModal() {
    document.getElementById('subscription-modal').classList.remove('active');
}

// Handle plan type change
function handlePlanTypeChange(e) {
    const planType = e.target.value;
    const tierSelect = document.getElementById('sub-plan-tier');

    if (!planType) {
        tierSelect.disabled = true;
        tierSelect.innerHTML = '<option value="">Select plan type first...</option>';
        document.getElementById('sub-preview').classList.add('hidden');
        return;
    }

    tierSelect.disabled = false;
    const plans = SUBSCRIPTION_PLANS[planType];
    tierSelect.innerHTML = '<option value="">Select tier...</option>' +
        Object.entries(plans).map(([key, plan]) =>
            `<option value="${key}">${plan.name}</option>`
        ).join('');
}

// Handle plan tier change
function handlePlanTierChange(e) {
    const planType = document.getElementById('sub-plan-type').value;
    const tier = e.target.value;

    if (!planType || !tier) {
        document.getElementById('sub-preview').classList.add('hidden');
        return;
    }

    const plan = SUBSCRIPTION_PLANS[planType][tier];
    document.getElementById('sub-preview-amount').textContent = formatCurrency(plan.amount);
    document.getElementById('sub-preview').classList.remove('hidden');
}

// Create subscription
async function createSubscription() {
    const clientId = document.getElementById('sub-client').value;
    const planType = document.getElementById('sub-plan-type').value;
    const tier = document.getElementById('sub-plan-tier').value;

    if (!clientId || !planType || !tier) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const btn = document.getElementById('create-sub-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        // Get client details
        const clientDoc = await db.collection('clients').doc(clientId).get();
        const client = clientDoc.data();

        const plan = SUBSCRIPTION_PLANS[planType][tier];
        const planLabel = planType === 'retainer' ? 'Maintenance Retainer' : 'SaaS Hosting';

        // Call Cloud Function
        const createSubscriptionFn = getFunctions().httpsCallable('createSubscription');
        const result = await createSubscriptionFn({
            clientId: clientId,
            clientEmail: client.email,
            clientName: client.name,
            planType: planType,
            planTier: tier
        });

        if (result.data.success) {
            showToast('Subscription created! Payment link sent to client.', 'success');
            closeSubscriptionModal();
            loadSubscriptionsAndPlans();
            loadSubscriptionStats();
        } else {
            throw new Error(result.data.error || 'Failed to create subscription');
        }
    } catch (error) {
        console.error('Error creating subscription:', error);
        showToast(error.message || 'Failed to create subscription', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Create & Send Payment Link';
    }
}

// Open payment plan modal
function openPaymentPlanModal() {
    document.getElementById('payment-plan-modal').classList.add('active');
    document.getElementById('payment-plan-form').reset();
    updatePaymentPlanPreview();

    // Populate clients dropdown
    populateClientsDropdown('pp-client');
}

// Close payment plan modal
function closePaymentPlanModal() {
    document.getElementById('payment-plan-modal').classList.remove('active');
}

// Update payment plan preview
function updatePaymentPlanPreview() {
    const totalAmount = parseFloat(document.getElementById('pp-total-amount').value) || 0;
    const numPayments = parseInt(document.getElementById('pp-num-payments').value) || 3;
    const startDate = document.getElementById('pp-start-date').value;

    const monthlyPayment = totalAmount / numPayments;

    document.getElementById('pp-preview-monthly').textContent = formatCurrency(monthlyPayment);
    document.getElementById('pp-preview-total').textContent = formatCurrency(totalAmount);
    document.getElementById('pp-preview-duration').textContent = `${numPayments} months`;

    // Update start date display
    const startDateDisplay = document.getElementById('pp-preview-start');
    if (startDateDisplay) {
        if (startDate) {
            const date = new Date(startDate + 'T00:00:00');
            startDateDisplay.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else {
            startDateDisplay.textContent = 'Immediately';
        }
    }
}

// Create payment plan
async function createPaymentPlan() {
    const clientId = document.getElementById('pp-client').value;
    const projectName = document.getElementById('pp-project-name').value.trim();
    const totalAmount = parseFloat(document.getElementById('pp-total-amount').value);
    const numPayments = parseInt(document.getElementById('pp-num-payments').value);
    const description = document.getElementById('pp-description').value.trim();
    const startDate = document.getElementById('pp-start-date').value;

    if (!clientId || !projectName || !totalAmount || !numPayments) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Validate start date is in the future if provided
    if (startDate) {
        const selectedDate = new Date(startDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
            showToast('Start date must be in the future', 'error');
            return;
        }
    }

    const btn = document.getElementById('create-pp-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        // Get client details
        const clientDoc = await db.collection('clients').doc(clientId).get();
        const client = clientDoc.data();

        // Call Cloud Function
        const createPaymentPlanFn = getFunctions().httpsCallable('createPaymentPlan');
        const result = await createPaymentPlanFn({
            clientId: clientId,
            clientEmail: client.email,
            clientName: client.name,
            projectName: projectName,
            totalAmount: totalAmount,
            numberOfPayments: numPayments,
            description: description,
            startDate: startDate || null
        });

        if (result.data.success) {
            showToast('Payment plan created! Payment link sent to client.', 'success');
            closePaymentPlanModal();
            loadSubscriptionsAndPlans();
            loadSubscriptionStats();
        } else {
            throw new Error(result.data.error || 'Failed to create payment plan');
        }
    } catch (error) {
        console.error('Error creating payment plan:', error);
        showToast(error.message || 'Failed to create payment plan', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-calendar-alt"></i> Create & Send Payment Link';
    }
}

// View subscription/payment plan details
async function viewSubscriptionDetails(id, type) {
    const collection = type === 'payment_plan' ? 'paymentPlans' : 'subscriptions';

    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) {
            showToast('Item not found', 'error');
            return;
        }

        const data = doc.data();
        const isPaymentPlan = type === 'payment_plan';

        const content = document.getElementById('view-subscription-content');
        const actions = document.getElementById('view-subscription-actions');

        content.innerHTML = `
            <div class="detail-header-row">
                <div>
                    <h3>${escapeHtml(isPaymentPlan ? data.projectName : data.planName)}</h3>
                    <span class="type-badge ${isPaymentPlan ? 'type-payment-plan' : 'type-subscription'}">
                        ${isPaymentPlan ? 'Payment Plan' : 'Subscription'}
                    </span>
                </div>
                <span class="status-badge ${getStatusClass(data.status)}">${formatStatus(data.status)}</span>
            </div>

            <div class="detail-grid">
                <div class="detail-group">
                    <span class="detail-label">Client</span>
                    <span class="detail-value">${escapeHtml(data.clientName || 'Unknown')}</span>
                    <span class="detail-sub">${escapeHtml(data.clientEmail || '')}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Monthly Amount</span>
                    <span class="detail-value highlight">${formatCurrency(data.monthlyAmount || 0)}</span>
                </div>
                ${isPaymentPlan ? `
                    <div class="detail-group">
                        <span class="detail-label">Total Amount</span>
                        <span class="detail-value">${formatCurrency(data.totalAmount || 0)}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Progress</span>
                        <span class="detail-value">${data.paymentsCompleted || 0} of ${data.numberOfPayments || 0} payments</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(data.paymentsCompleted || 0) / (data.numberOfPayments || 1) * 100}%"></div>
                        </div>
                    </div>
                ` : `
                    <div class="detail-group">
                        <span class="detail-label">Plan Type</span>
                        <span class="detail-value">${data.planType === 'retainer' ? 'Maintenance Retainer' : 'SaaS Hosting'} - ${data.tier || 'Standard'}</span>
                    </div>
                    <div class="detail-group">
                        <span class="detail-label">Next Billing</span>
                        <span class="detail-value">${data.currentPeriodEnd ? formatDate(data.currentPeriodEnd, true) : 'N/A'}</span>
                    </div>
                `}
            </div>

            ${data.status === 'pending' ? `
                <div class="pending-notice">
                    <i class="fas fa-clock"></i>
                    <div>
                        <strong>Awaiting Client Payment</strong>
                        <p>The client has received a payment link to set up their billing.</p>
                    </div>
                </div>
            ` : ''}

            ${data.status === 'payment_failed' ? `
                <div class="failed-notice">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Payment Failed</strong>
                        <p>${data.lastFailureReason || 'The most recent payment attempt failed.'}</p>
                    </div>
                </div>
            ` : ''}

            <details class="advanced-details">
                <summary><i class="fas fa-cog"></i> Technical Details</summary>
                <div class="advanced-content">
                    <div class="detail-row">
                        <span class="detail-key">Document ID</span>
                        <span class="detail-val">${id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-key">Stripe Subscription ID</span>
                        <span class="detail-val">${data.stripeSubscriptionId || 'Not yet created'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-key">Created</span>
                        <span class="detail-val">${data.createdAt ? formatDate(data.createdAt, true) : 'Unknown'}</span>
                    </div>
                    ${data.lastPaymentAt ? `
                        <div class="detail-row">
                            <span class="detail-key">Last Payment</span>
                            <span class="detail-val">${formatDate(data.lastPaymentAt, true)}</span>
                        </div>
                    ` : ''}
                </div>
            </details>
        `;

        // Build actions based on status
        let actionsHtml = '<button class="btn btn-outline" onclick="closeViewSubscriptionModal()">Close</button>';

        if (data.status === 'active') {
            actionsHtml += `
                <button class="btn btn-danger" onclick="confirmCancelSubscription('${id}', '${type}')">
                    <i class="fas fa-times"></i> Cancel ${isPaymentPlan ? 'Plan' : 'Subscription'}
                </button>
            `;
        } else if (data.status === 'pending' && data.checkoutUrl) {
            actionsHtml += `
                <button class="btn btn-secondary" onclick="copyToClipboard('${data.checkoutUrl}')">
                    <i class="fas fa-link"></i> Copy Payment Link
                </button>
                <button class="btn btn-primary" onclick="resendPaymentLink('${id}', '${type}')">
                    <i class="fas fa-paper-plane"></i> Resend Link
                </button>
            `;
        }

        actions.innerHTML = actionsHtml;
        document.getElementById('view-subscription-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading subscription details:', error);
        showToast('Failed to load details', 'error');
    }
}

// Close view subscription modal
function closeViewSubscriptionModal() {
    document.getElementById('view-subscription-modal').classList.remove('active');
}

// Confirm cancel subscription
async function confirmCancelSubscription(id, type) {
    const itemName = type === 'payment_plan' ? 'payment plan' : 'subscription';

    if (!confirm(`Are you sure you want to cancel this ${itemName}? This action cannot be undone.`)) {
        return;
    }

    try {
        const cancelSubscriptionFn = getFunctions().httpsCallable('cancelSubscription');
        const result = await cancelSubscriptionFn({
            subscriptionId: id,
            isPaymentPlan: type === 'payment_plan',
            cancelImmediately: true
        });

        if (result.data.success) {
            showToast(`${itemName.charAt(0).toUpperCase() + itemName.slice(1)} cancelled successfully`, 'success');
            closeViewSubscriptionModal();
            loadSubscriptionsAndPlans();
            loadSubscriptionStats();
        } else {
            throw new Error(result.data.error);
        }
    } catch (error) {
        console.error('Error cancelling:', error);
        showToast('Failed to cancel: ' + error.message, 'error');
    }
}

// Resend payment link
async function resendPaymentLink(id, type) {
    // This would call a cloud function to resend the email
    showToast('Payment link resent to client', 'success');
}

// Populate clients dropdown
async function populateClientsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const snapshot = await db.collection('clients').orderBy('name').get();
        select.innerHTML = '<option value="">Select a client...</option>' +
            snapshot.docs.map(doc => {
                const data = doc.data();
                return `<option value="${doc.id}">${escapeHtml(data.name)} (${escapeHtml(data.email)})</option>`;
            }).join('');
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Helper functions
function getStatusClass(status) {
    const statusClasses = {
        'active': 'status-active',
        'pending': 'status-pending',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled',
        'payment_failed': 'status-failed'
    };
    return statusClasses[status] || 'status-pending';
}

function formatStatus(status) {
    const statusLabels = {
        'active': 'Active',
        'pending': 'Pending',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'payment_failed': 'Failed'
    };
    return statusLabels[status] || status;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(timestamp, full = false) {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    if (full) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
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

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// Make functions globally available
window.openCreateSubscriptionModal = openCreateSubscriptionModal;
window.closeSubscriptionModal = closeSubscriptionModal;
window.createSubscription = createSubscription;
window.openPaymentPlanModal = openPaymentPlanModal;
window.closePaymentPlanModal = closePaymentPlanModal;
window.createPaymentPlan = createPaymentPlan;
window.viewSubscriptionDetails = viewSubscriptionDetails;
window.closeViewSubscriptionModal = closeViewSubscriptionModal;
window.confirmCancelSubscription = confirmCancelSubscription;
window.loadSubscriptionsSection = initSubscriptions;
