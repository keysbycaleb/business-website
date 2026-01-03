# Lanting Digital Pricing Model & Stripe Integration Guide

This document explains how Lanting Digital prices services and how those pricing models should be implemented in Stripe and the invoicing system.

---

## Overview

Lanting Digital has **five distinct pricing models**, each requiring different Stripe integration:

| Model | Type | Stripe Product Type | Example |
|-------|------|---------------------|---------|
| **Project Build** | One-time | Single payment or Payment Plan | $9,500 dashboard build |
| **Hourly Work** | One-time | Invoice after completion | $75/hr for 8 hours = $600 |
| **Maintenance Retainer** | Recurring | Subscription | $139/month or $199/month |
| **SaaS Subscription** | Recurring | Subscription | $149/$299/$499 per month |
| **Payment Plan** | Split payments | Multiple invoices OR Stripe Installments | $9,500 over 6 months |

---

## 1. Project Build (One-Time)

### What It Is
A fixed-price project to build something from scratch. Client owns the IP when complete (or after specific payment milestones).

### Pricing Guidelines
| Project Type | Price Range |
|--------------|-------------|
| Simple website | $1,500 - $3,000 |
| Custom web application | Starting at $2,500 |
| Mobile app | Starting at $5,000 |
| PWA (Progressive Web App) | Starting at $2,000 |
| Complex dashboard/business tool | $6,000 - $15,000+ |

### Payment Structures

**Option A: 50/50 Split**
- 50% upfront (before work begins)
- 50% at launch
- IP transfers immediately

**Option B: 3-Part Milestone**
- 33% at contract signing
- 33% at milestone 2 (mid-project)
- 33% at launch

**Option C: Payment Plan**
- 20% down payment
- Remaining balance over 6 months (0% interest)
- IP transfers after final payment (unless negotiated otherwise)

### Stripe Implementation

**For 50/50 or Milestone Payments:**
- Create separate invoices for each payment
- Each invoice is a one-time payment link
- Line items should describe what milestone it covers

Example Invoice 1 (for iAttend):
```
Line Items:
- "iAttend Dashboard - Down Payment + First Monthly" | Qty: 1 | $3,167.00
```

Example Invoice 2:
```
Line Items:
- "iAttend Dashboard - Payment 2 of 6" | Qty: 1 | $1,267.00
```

**For Payment Plans:**
Option 1: Create 6 separate invoices, send one per month
Option 2: Use Stripe's built-in installment plans (if available in your Stripe account)

### Database Fields for Project Invoices
```javascript
{
  type: "project",
  projectName: "iAttend Dashboard",
  totalProjectValue: 9500.00,
  paymentNumber: 1,        // 1 of 6
  totalPayments: 6,
  milestoneDescription: "Down Payment + First Monthly",
  contractId: "abc123"     // Link to contract
}
```

---

## 2. Hourly Work (Ad-Hoc)

### What It Is
Work billed by the hour, typically for:
- Consulting calls
- Small tasks outside of a project scope
- Overflow work or change requests
- Post-warranty bug fixes

### Pricing
**$75/hour**

### When to Use
- Change requests under 8 hours (per contract terms)
- Ad-hoc consulting
- Maintenance work outside of a retainer
- Training sessions

### Stripe Implementation
Create invoice after work is completed. Line items should itemize the work:

```
Line Items:
- "Consulting Call - Dashboard Architecture Review" | 2 hrs @ $75 | $150.00
- "Bug Fix - Login redirect issue" | 1.5 hrs @ $75 | $112.50
- "Feature Addition - Export to CSV" | 4 hrs @ $75 | $300.00
---
Total: $562.50
```

### Database Fields for Hourly Invoices
```javascript
{
  type: "hourly",
  lineItems: [
    { description: "...", hours: 2, rate: 75.00, total: 150.00 },
    { description: "...", hours: 1.5, rate: 75.00, total: 112.50 }
  ],
  totalHours: 3.5,
  hourlyRate: 75.00
}
```

---

## 3. Maintenance Retainer (Recurring)

### What It Is
Monthly subscription for ongoing support and maintenance. Client owns their IP (this is NOT SaaS).

### Pricing Tiers

| Tier | Monthly | Includes |
|------|---------|----------|
| **Standard** | $139/month | Hosting oversight, backups, security updates, small content edits |
| **Priority** | $199/month | Everything above + faster response + up to 2 hrs/month of minor edits |

### What's NOT Included
- New features
- Redesigns
- Major changes
- These are billed as hourly work or new project quotes

### Stripe Implementation
Use **Stripe Subscriptions**:

1. Create Product in Stripe: "Maintenance Retainer - Standard"
2. Create Price: $139/month, recurring
3. Create Product: "Maintenance Retainer - Priority"
4. Create Price: $199/month, recurring

When client signs up for retainer:
1. Create Stripe Customer (if not exists)
2. Create Subscription with appropriate Price ID
3. Stripe handles recurring billing automatically

### Database Fields
```javascript
{
  type: "retainer",
  tier: "standard" | "priority",
  monthlyAmount: 139.00 | 199.00,
  stripeSubscriptionId: "sub_xxxxx",
  stripeCustomerId: "cus_xxxxx",
  startDate: "2026-02-01",
  status: "active" | "cancelled" | "past_due"
}
```

### UI Considerations
- Retainers should show differently than one-time invoices
- Show "Recurring" badge
- Show subscription status (active, past due, cancelled)
- Allow cancellation (with confirmation)

---

## 4. SaaS Subscription (Recurring)

### What It Is
Monthly subscription where **Caleb owns the IP** and the client is essentially renting the software. This includes hosting, maintenance, and allotted hours for edits/features.

### Pricing Tiers

| Tier | Monthly | Includes |
|------|---------|----------|
| **Starter** | $149/month | Hosting, maintenance, up to 2 hrs edits/month |
| **Growth** | $299/month | Above + 3 hrs edits + 5 hrs feature work/month |
| **Scale** | $499/month | Above + 10 hrs flexible/month, priority support |

### Additional Notes
- Upfront build fee is separate (quoted per project)
- After 12-month contract, client can buy out for 6 months of installments
- Early termination: Remaining months / 2

### Stripe Implementation
Same as Maintenance Retainer - use **Stripe Subscriptions**.

Products to create:
- "SaaS - Starter Plan" → $149/month
- "SaaS - Growth Plan" → $299/month
- "SaaS - Scale Plan" → $499/month

### Database Fields
```javascript
{
  type: "saas",
  tier: "starter" | "growth" | "scale",
  monthlyAmount: 149.00 | 299.00 | 499.00,
  stripeSubscriptionId: "sub_xxxxx",
  contractStartDate: "2026-01-15",
  contractEndDate: "2027-01-15",  // 12 months
  hoursIncluded: { edits: 2, features: 0 },  // varies by tier
  hoursUsedThisMonth: { edits: 1.5, features: 0 },
  buyoutEligible: false  // true after 12 months
}
```

---

## 5. Payment Plan (Split Payments)

### What It Is
A way to split a large project fee into manageable monthly payments. Not a subscription - it's a fixed total split over time.

### Structure
- 20% down payment (due before kickoff)
- Remaining 80% split over 6 months
- 0% interest
- IP transfers after final payment (unless negotiated otherwise)

### Example: $9,500 Project
```
Down Payment (20%):        $1,900.00
Monthly Payment x 6:       $1,266.67 each
---
Breakdown:
- Payment 1: $3,167 (down + first monthly, combined)
- Payment 2: $1,267
- Payment 3: $1,267
- Payment 4: $1,267
- Payment 5: $1,267
- Payment 6: $1,265 (adjusted for rounding)
```

### Stripe Implementation

**Option A: Multiple Invoices (Current Approach)**
Create 6 separate invoices, one per payment. Send each when due.

Pros: Simple, works now
Cons: Manual, have to remember to send each month

**Option B: Stripe Payment Links with Installments**
Some Stripe accounts support installment plans. Check if available.

**Option C: Automated Invoice Scheduling**
Build a Cloud Function that:
1. Creates all invoices upfront (status: "scheduled")
2. Runs daily, checks for invoices due today
3. Sends payment link automatically
4. Updates status to "pending"

### Database Fields for Payment Plans
```javascript
{
  type: "payment_plan",
  projectName: "iAttend Dashboard",
  totalProjectValue: 9500.00,
  downPaymentPercent: 20,
  installmentMonths: 6,
  payments: [
    { number: 1, amount: 3167.00, dueDate: "2026-01-15", status: "paid" },
    { number: 2, amount: 1267.00, dueDate: "2026-02-15", status: "pending" },
    { number: 3, amount: 1267.00, dueDate: "2026-03-15", status: "scheduled" },
    // ...
  ],
  contractId: "abc123"
}
```

---

## Invoice Line Item Templates

### For Projects (One-Time)
```
Description: "[Project Name] - [Milestone Description]"
Examples:
- "iAttend Dashboard - Down Payment"
- "Pete's Holiday Lighting Website - Final Payment"
- "Coaster Companion App - Milestone 2: Core Features"
```

### For Hourly Work
```
Description: "[Task Description]" | Hours: X | Rate: $75/hr
Examples:
- "Bug Fix - Authentication redirect loop" | 1.5 hrs | $112.50
- "Feature Addition - PDF export for reports" | 4 hrs | $300.00
- "Consulting - Architecture review call" | 1 hr | $75.00
```

### For Change Requests
```
Description: "Change Request - [Description]"
Note: If under 8 hours, bill as hourly. If over 8 hours, quote as mini-project.
```

### For Maintenance Retainers
```
Description: "Maintenance Retainer - [Tier] - [Month Year]"
Examples:
- "Maintenance Retainer - Standard - February 2026"
- "Maintenance Retainer - Priority - February 2026"
```

### For SaaS Subscriptions
```
Description: "SaaS Subscription - [Tier] Plan - [Month Year]"
Examples:
- "SaaS Subscription - Starter Plan - February 2026"
- "SaaS Subscription - Growth Plan - February 2026"
```

---

## Stripe Product Structure Recommendation

### Products to Create in Stripe

**One-Time Products (create per project):**
- "iAttend Dashboard Build"
- "Pete's Holiday Lighting Website"
- etc.

**Recurring Products (create once, reuse):**
- "Maintenance Retainer - Standard" → $139/month
- "Maintenance Retainer - Priority" → $199/month
- "SaaS - Starter Plan" → $149/month
- "SaaS - Growth Plan" → $299/month
- "SaaS - Scale Plan" → $499/month

**Hourly Product (create once, reuse):**
- "Hourly Consulting & Development" → Price varies (use invoice line items)

---

## Admin UI Enhancements Needed

### Invoice Creation Flow

When creating an invoice, prompt for:

1. **Invoice Type** (dropdown):
   - Project Payment
   - Hourly Work
   - Change Request
   - Retainer Setup
   - SaaS Setup

2. **Based on type, show relevant fields:**

   **Project Payment:**
   - Select existing contract (dropdown)
   - Payment number (e.g., "2 of 6")
   - Amount (auto-calculate or manual)
   - Milestone description

   **Hourly Work:**
   - Line items with: Description, Hours, Rate ($75 default)
   - Auto-calculate totals

   **Retainer/SaaS Setup:**
   - Client selection
   - Tier selection
   - Start date
   - Creates Stripe Subscription (not one-time invoice)

### Invoice List View

Add columns/filters for:
- Type (project, hourly, retainer, saas)
- Recurring vs One-Time badge
- For payment plans: "Payment X of Y"

### Subscription Management (New Section?)

Consider a separate "Subscriptions" tab for managing:
- Active retainers
- Active SaaS subscriptions
- Subscription status (active, past due, cancelled)
- Cancel/pause functionality

---

## Future Considerations

### Automated Payment Plan Invoicing
Build a scheduled Cloud Function that:
1. Runs daily at 9 AM
2. Checks for payment plan invoices due today
3. Sends payment link via email
4. Updates invoice status

### Stripe Customer Portal
Stripe has a built-in Customer Portal where clients can:
- Update payment method
- View billing history
- Download invoices
- Cancel subscriptions (if allowed)

Integration: Just add a "Manage Billing" button that redirects to Stripe's hosted portal.

### Overdue Invoice Handling
Build logic to:
1. Mark invoices as "overdue" if past due date
2. Send reminder emails (3 days, 7 days, 14 days)
3. Flag in admin dashboard

---

## Summary Table

| Model | Stripe Type | Billing | IP Ownership |
|-------|-------------|---------|--------------|
| Project Build | One-time invoice(s) | At milestones | Client owns |
| Hourly Work | One-time invoice | After completion | Client owns |
| Maintenance Retainer | Subscription | Monthly auto-charge | Client owns |
| SaaS Subscription | Subscription | Monthly auto-charge | Caleb owns |
| Payment Plan | Multiple invoices | Monthly (manual or automated) | Transfers after final |

---

## Implementation Priority

1. **Now (for iAttend):** One-time invoices with payment plan structure. Create each invoice manually, send monthly.

2. **Soon:** Stripe Subscription setup for future retainer/SaaS clients.

3. **Later:** Automated payment plan invoicing, Stripe Customer Portal integration, overdue reminders.
