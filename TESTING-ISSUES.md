# Testing Issues Log

Issues discovered during end-to-end testing session. Fix after testing is complete.

---

## Issue #1: Contact Form Success Message Not Showing
**Location:** Main website contact form (lantingdigital.com)
**Severity:** Medium - UX issue, data still works
**Description:** After submitting the contact form, the form either refreshes or shows validation prompts instead of displaying a success message. The submission goes through successfully (email notification sent, appears in admin dashboard), but the user has no visual confirmation that it worked.
**Expected:** User should see a clear "Thank you! We'll be in touch soon." message
**File to check:** Main site form submission handler (likely `assets/js/main.js` or similar)

---

## Issue #2: No Email Notification When Contract Created
**Location:** Contract creation flow
**Severity:** HIGH - Client has no way to know a contract is waiting
**Description:** When admin creates a contract and sets status to "sent", no email is sent to the client. Client only receives email notification AFTER signing. Need to send auto-email with signing link when contract is created/sent.
**Expected:** Client receives email like "You have a contract waiting for your signature" with the signing link
**File to check:** `functions/index.js` - need to add Firestore trigger or update contract creation to send email

---

## Feature Request #1: Convert Submission to Client Button
**Location:** Admin dashboard - Submissions section
**Priority:** Low - nice to have
**Description:** Currently there's no way to directly convert a submission/inquiry into a client. Admin has to manually create the client and copy over the details. A "Convert to Client" button that pre-fills the client form with submission data would streamline the workflow.

---

## Feature Request #2: Add Client Name to Contract Form
**Location:** Admin dashboard - Contract creation modal
**Priority:** Low
**Description:** Contract creation form doesn't have a client name field. Would be helpful for contracts to display the client's name prominently.

---

## Feature Request #3: Return to Portal Button on Signing Success
**Location:** Contract signing success screen
**Priority:** Low
**Description:** After signing a contract, there's no easy way for the client to navigate back to the portal. Add a "Return to Portal" button on the success confirmation screen.

---

## Issue #3: Admin Cannot Compose New Messages
**Location:** Admin dashboard - Messages section
**Severity:** HIGH - Admin can only reply, cannot initiate conversations
**Description:** There is no "New Message" or "Compose" button in the admin Messages section. Admin can only reply to messages that clients initiate first. Need ability for admin to start a conversation with any client.
**Expected:** "New Message" button that opens a compose modal with client selector
**File to check:** `admin/index.html` (messages section), `admin/js/messages.js`

---

## Issue #4: Message Status Pill Text Truncated on Mobile
**Location:** Admin dashboard - Messages section (mobile view)
**Severity:** Low - UX issue
**Description:** Status pill text is truncated on mobile, showing partial phrases instead of full status.

---

## Issue #5: No Unread/Read Indicators on Messages
**Location:** Admin dashboard - Messages section
**Severity:** Low - UX issue
**Description:** No visible indicators to show which messages are unread vs read. Hard to tell at a glance which messages need attention.

---

## Issue #6: No Email Notification When Invoice Created
**Location:** Invoice creation flow
**Severity:** HIGH - Client has no way to know an invoice is waiting
**Description:** Same issue as contracts - when admin creates an invoice, no email is sent to the client. Client only finds out if they happen to check the portal.
**Expected:** Client receives email like "You have a new invoice from Lanting Digital" with amount and payment link
**File to check:** `functions/index.js` - need Firestore trigger or update invoice creation to send email
**Note:** Stripe handles payment receipts natively - enable in Stripe Dashboard → Settings → Emails → 'Successful payments'

---

## Issue #7: Payment Plans & Subscriptions Not Visible in Client Portal
**Location:** Client portal - Billing/Invoices section
**Severity:** HIGH - Client cannot see or pay payment plans from portal
**Description:** Portal only queries the `invoices` collection. Payment plans (stored in `paymentPlans` collection) and subscriptions (stored in `subscriptions` collection) don't appear. Client can only pay via manually-sent checkout link.
**Expected:** Portal billing section should show:
  - One-time invoices (from `invoices` collection)
  - Active payment plans with payment link (from `paymentPlans` collection)
  - Active subscriptions (from `subscriptions` collection)
**Files to check:** `portal/js/portal.js` or equivalent billing section code
**Workaround:** Admin manually copies and sends checkout link to client

---
