# Lanting Digital - Client Portal Project

## Project Overview

This project is a **Client Portal** for Lanting Digital LLC, a web development consultancy run by Caleb Lanting. The portal allows clients to:
- View and sign contracts
- See invoices and pay them (Stripe integrated!)
- Send messages to the admin
- Track project status

The system includes:
- **Main Website**: `lantingdigital.com` - Marketing site
- **Admin Dashboard**: `admin.lantingdigital.com` - Internal management
- **Client Portal**: `portal.lantingdigital.com` - Client-facing dashboard
- **Contract Signing**: `sign.lantingdigital.com` - Public contract signing pages

---

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Firebase (Firestore, Auth, Hosting, Cloud Functions)
- **Authentication**: Google Sign-In (Firebase Auth)
- **Email**: Nodemailer with Gmail (via Cloud Functions)
- **Payments**: Stripe (Payment Links API)
- **Hosting**: Firebase Hosting with multiple sites

---

## What Has Been Completed

### 1. Admin Status System (NEW - Jan 3, 2026)
- [x] Status toggle in admin dashboard header (Available/Busy/Away)
- [x] Real-time status sync to Firestore (`settings/admin`)
- [x] Status indicator in client portal messages view
- [x] Response time estimates shown to clients:
  - Available: "Typically responds in ~5 minutes"
  - Busy: "Typically responds in 30-60 minutes"
  - Away: "Away - responds in 1-2 business days"
- [x] Cloud Function respects status (skips reminders when not "available")

### 2. Stripe Invoicing System (NEW - Jan 3, 2026)
- [x] Invoice management UI in admin dashboard
- [x] Create invoices with line items
- [x] Year-based invoice numbering (2026-001, 2026-002...)
- [x] Client selection dropdown
- [x] Save as draft functionality
- [x] Send invoice (creates Stripe payment link)
- [x] View invoice modal with payment link
- [x] Cloud Function `createStripePaymentLink`:
  - Creates/finds Stripe customer
  - Creates product and price for invoice
  - Generates payment link
  - Supports cards, Apple/Google Pay, ACH
- [x] Cloud Function `stripeWebhook`:
  - Handles `checkout.session.completed` event
  - Updates invoice status to 'paid'
- [x] STRIPE_SECRET_KEY secret configured in Firebase

### 3. Client Portal (`portal.lantingdigital.com`)
- [x] Google Sign-In authentication
- [x] Dashboard with stats (contracts, invoices, messages, completed projects)
- [x] Contracts list view with status indicators
- [x] Contract detail view with full contract display
- [x] Invoices list view (placeholder, needs portal-side updates)
- [x] Real-time messaging system
- [x] Light theme matching sign page
- [x] Account selection prompt (can switch Google accounts)
- [x] Access denied screen for users without contracts
- [x] Responsive sidebar navigation
- [x] Quick actions grid
- [x] Admin status indicator in messages

### 4. Admin Dashboard (`admin.lantingdigital.com`)
- [x] Google Sign-In with admin email check
- [x] Contract management (create, view, edit)
- [x] Contract HTML editor with preview
- [x] Client management (auto-created from contracts)
- [x] Messaging interface with conversation list
- [x] Real-time message updates
- [x] Account selection prompt
- [x] Status toggle (Available/Busy/Away)
- [x] Invoice management section

### 5. Contract Signing (`sign.lantingdigital.com`)
- [x] Public contract signing pages
- [x] Signature pad integration
- [x] Email confirmation on signing
- [x] Contract status updates

### 6. Cloud Functions
- [x] `sendEmailOnSubmission` - Contact form notifications
- [x] `sendContractSignedEmail` - Contract signing confirmations
- [x] `sendMessageNotification` - Message notifications to admin
- [x] `checkMessageReminders` - 5-minute reminder scheduler (respects status)
- [x] `autoCreateClientFromContract` - Auto-create clients from contracts
- [x] `createStripePaymentLink` - Generate Stripe payment links
- [x] `stripeWebhook` - Handle Stripe payment confirmations

### 7. Firestore Security Rules
- [x] Admin-only write access for contracts, clients, invoices
- [x] Client read access based on email matching
- [x] Message permissions (clients can read/write their own)
- [x] Settings collection rules

### 8. Firestore Indexes Created
- [x] `contracts`: clientEmail + createdAt
- [x] `contracts`: clientEmail + updatedAt
- [x] `invoices`: clientEmail + createdAt
- [x] `messages`: clientEmail + createdAt
- [x] `messages`: clientId + createdAt (for admin view)
- [x] `messages`: clientEmail + fromAdmin + createdAt
- [x] `clients`: pendingNotification + reminderDue

---

## IMMEDIATE ACTION REQUIRED: Stripe Webhook Setup

The Stripe integration is 95% complete. You need to complete these final steps:

### Step 1: Fix Webhook IAM Permissions

The `stripeWebhook` Cloud Function was deployed but the IAM policy couldn't be set automatically. You need to make it publicly accessible so Stripe can call it.

**Option A: Via Google Cloud Console**
1. Go to: https://console.cloud.google.com/run?project=lanting-digital-website
2. Click on the `stripewebhook` service
3. Go to the "Security" tab
4. Under "Authentication", select "Allow unauthenticated invocations"
5. Save

**Option B: Install gcloud CLI and run:**
```bash
gcloud run services add-iam-policy-binding stripewebhook \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=lanting-digital-website
```

### Step 2: Set Up Stripe Webhook in Dashboard

1. Go to: https://dashboard.stripe.com/test/webhooks (or live dashboard)
2. Click "Add endpoint"
3. Enter the webhook URL:
   ```
   https://us-central1-lanting-digital-website.cloudfunctions.net/stripeWebhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)

### Step 3: Update Firebase Webhook Secret

Run this command in the project directory:
```bash
echo "YOUR_WEBHOOK_SIGNING_SECRET" | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Replace `YOUR_WEBHOOK_SIGNING_SECRET` with the signing secret from Step 2.

### Step 4: Test the Integration

1. Go to admin dashboard and create an invoice for a client
2. Click "Send Invoice" to change status to pending
3. The Cloud Function will automatically create a Stripe payment link
4. View the invoice to see the payment link
5. Test payment using Stripe test card: `4242 4242 4242 4242`
6. Verify the invoice status changes to "paid" after successful payment

---

## Current State

### Working Features
- Portal login and dashboard fully functional
- Contracts display correctly
- Messaging works both directions (client <-> admin)
- Admin status system with response time estimates
- Invoice creation and management
- Stripe payment link generation (pending webhook setup)

### Notification Behavior (Implemented)
Based on admin status:
- **Available**: 5-min recurring reminders, client sees "~5 min response"
- **Busy**: NO reminders, client sees "30-60 min response"
- **Away**: NO reminders, client sees "1-2 business days"

---

## Future Enhancements

### Stripe Subscriptions (Future Feature)
The current implementation supports one-time payments. To add recurring subscriptions later:

1. **Create subscription products in Stripe**
   - Monthly retainer tiers ($149, $299, $499)
   - Define price IDs for each tier

2. **Update invoice creation to support recurring**
   - Add "Invoice Type" dropdown (One-time / Subscription)
   - Select subscription tier
   - Create Stripe subscription instead of payment link

3. **Handle subscription webhooks**
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

4. **Add subscription management to portal**
   - View active subscription
   - Cancel/pause subscription
   - Update payment method

### Portal Enhancements
- [ ] Invoice payment page (embedded Stripe checkout)
- [ ] File attachments in messages
- [ ] Project timeline/milestones view
- [ ] Document storage (contracts, receipts, assets)
- [ ] Push notifications (browser)
- [ ] Email preferences (opt-out of certain notifications)
- [ ] Dark mode toggle for portal

### Admin Enhancements
- [ ] Analytics dashboard (revenue, project stats)
- [ ] Calendar integration
- [ ] Task/todo management per client
- [ ] Invoice templates
- [ ] Bulk actions (archive clients, etc.)
- [ ] Export data (CSV, PDF)
- [ ] Recurring invoice automation

### Messaging Improvements
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Message reactions
- [ ] Conversation archiving
- [ ] Search messages
- [ ] Rich text formatting

### Security & Performance
- [ ] Rate limiting on Cloud Functions
- [ ] Input sanitization review
- [ ] Performance audit (lazy loading, caching)
- [ ] Error tracking (Sentry or similar)
- [ ] Automated backups

---

## File Structure Reference

```
coming-soon/
├── index.html                    # Main marketing site
├── CLAUDE.md                     # Project instructions for AI
├── NEXT-STEPS.md                 # This file
├── firebase.json                 # Firebase hosting config
├── firestore.rules               # Security rules
├── firestore.indexes.json        # Index definitions
│
├── admin/                        # Admin dashboard
│   ├── index.html
│   ├── css/
│   │   └── admin.css
│   └── js/
│       ├── config.js             # Firebase config
│       ├── auth.js               # Authentication
│       ├── dashboard.js          # Main dashboard logic
│       ├── contracts.js          # Contract management
│       ├── clients.js            # Client management
│       ├── messages.js           # Messaging
│       └── invoices.js           # Invoice management (NEW)
│
├── portal/                       # Client portal
│   ├── index.html
│   ├── css/
│   │   └── portal.css
│   └── js/
│       ├── config.js             # Firebase config
│       └── portal.js             # All portal logic
│
├── sign/                         # Contract signing
│   ├── index.html
│   ├── css/
│   │   └── sign.css
│   └── js/
│       └── sign.js
│
└── functions/                    # Cloud Functions
    ├── index.js                  # All functions
    ├── package.json
    └── .secret.local             # Local secrets (not committed)
```

---

## Key Firebase Collections

### `settings/admin`
```javascript
{
  status: "available" | "busy" | "away",
  updatedAt: Timestamp
}
```

### `clients`
```javascript
{
  email: "client@example.com",
  name: "Client Name",
  company: "Company LLC",
  createdAt: Timestamp,
  createdFromContract: "contractId",
  pendingNotification: boolean,
  reminderDue: Timestamp,
  lastClientMessage: Timestamp,
  lastAdminResponse: Timestamp
}
```

### `contracts`
```javascript
{
  contractName: "Service Agreement",
  clientName: "Client Name",
  clientEmail: "client@example.com",
  clientCompany: "Company LLC",
  status: "draft" | "sent" | "signed",
  htmlContent: "<div>Contract HTML...</div>",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  signedAt: Timestamp,
  signatureData: "base64...",
  signedByIP: "xxx.xxx.xxx.xxx"
}
```

### `messages`
```javascript
{
  clientId: "firestoreDocId",
  clientEmail: "client@example.com",
  clientName: "Client Name",
  content: "Message text",
  fromAdmin: boolean,
  read: boolean,
  createdAt: Timestamp
}
```

### `invoices`
```javascript
{
  invoiceNumber: "2026-001",
  clientId: "firestoreDocId",
  clientEmail: "client@example.com",
  clientName: "Client Name",
  lineItems: [
    { description: "Web Development", quantity: 10, rate: 75, amount: 750 }
  ],
  subtotal: 750,
  tax: 0,
  total: 750,
  status: "draft" | "pending" | "paid" | "overdue",
  stripeCustomerId: "cus_xxx",
  stripeProductId: "prod_xxx",
  stripePriceId: "price_xxx",
  stripePaymentLinkId: "plink_xxx",
  stripePaymentLink: "https://buy.stripe.com/xxx",
  stripePaymentIntentId: "pi_xxx",
  stripeSessionId: "cs_xxx",
  paidAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Environment & Deployment

### Firebase Projects
- Project ID: `lanting-digital-website`
- Region: `us-central1`

### Hosting Sites
| Site | Domain | Purpose |
|------|--------|---------|
| lanting-digital-website | lantingdigital.com | Main site |
| lanting-digital-admin | admin.lantingdigital.com | Admin dashboard |
| lanting-digital-sign | sign.lantingdigital.com | Contract signing |
| lanting-digital-portal | portal.lantingdigital.com | Client portal |

### Deployment Commands
```bash
# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy specific site
firebase deploy --only hosting:lanting-digital-portal

# Deploy only functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:createStripePaymentLink
```

### Secrets (Cloud Functions)
- `GMAIL_EMAIL` - Gmail address for sending emails
- `GMAIL_PASSWORD` - Gmail app password
- `STRIPE_SECRET_KEY` - Stripe API secret key (TEST mode)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (NEEDS SETUP)

Set with: `firebase functions:secrets:set SECRET_NAME`

---

## Testing Checklist

### Invoice Testing (NEW)
- [ ] Create new invoice from admin
- [ ] Add multiple line items
- [ ] Save as draft
- [ ] Send invoice (status changes to pending)
- [ ] Verify Stripe payment link is generated
- [ ] View invoice and copy payment link
- [ ] Test payment with Stripe test card
- [ ] Verify webhook updates invoice to paid

### Portal Testing
- [ ] Sign in with Google (new user)
- [ ] Sign in with Google (existing client)
- [ ] Access denied for user without contracts
- [ ] Dashboard stats load correctly
- [ ] Contracts list shows all client contracts
- [ ] Contract detail displays full content
- [ ] Messages load and display
- [ ] Can send message
- [ ] Real-time message updates work
- [ ] Admin status indicator shows correctly
- [ ] Sign out works
- [ ] Account switching works

### Admin Testing
- [ ] Sign in with admin email
- [ ] Non-admin email rejected
- [ ] Dashboard loads
- [ ] Create new contract
- [ ] Edit contract HTML
- [ ] View client list
- [ ] Send message to client
- [ ] Receive real-time messages
- [ ] Status toggle works
- [ ] Invoice section loads
- [ ] Create and send invoice

### Notification Testing
- [ ] Status set to Available: reminders work
- [ ] Status set to Busy: no reminders
- [ ] Status set to Away: no reminders
- [ ] Client sees correct response time estimate

---

## Session Resume Instructions

When resuming work on this project:

1. **Complete the webhook setup** (see "IMMEDIATE ACTION REQUIRED" section)
2. **Read this file** to understand current state
3. **Check `firebase.json`** for hosting configuration
4. **Check `functions/index.js`** for Cloud Function logic
5. **Run `firebase deploy`** after changes to deploy

### Priority Order for Next Session
1. Complete Stripe webhook setup
2. Test full invoice flow
3. Add invoice display to client portal
4. Style improvements / polish

---

*Last Updated: January 3, 2026*
*Last Session: Admin status system, Stripe invoicing integration*
