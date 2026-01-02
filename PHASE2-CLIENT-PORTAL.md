# Lanting Digital Client Portal - Phase 2 Planning Document

## Overview
This document outlines the complete vision for the Lanting Digital Client Portal system. Phase 1 establishes the foundation (authentication + secure contract signing). Phase 2 builds the full client experience.

---

## Architecture Overview

### Sites/Domains
- **lantingdigital.com** - Main marketing site
- **admin.lantingdigital.com** - Admin portal (Caleb's dashboard)
- **sign.lantingdigital.com** - Client portal (auth + contracts + messaging)

### Firebase Services Used
- **Firebase Authentication** - Email/Password + Google Sign-In
- **Cloud Firestore** - Data storage
- **Cloud Functions** - Email notifications
- **Firebase Hosting** - Static hosting

---

## Phase 1: Foundation (Current Sprint)

### 1.1 Typed Signature System
**Replace drawn signature with typed signature**

- Remove SignaturePad library dependency
- Add signature input field with Dancing Script font
- Modal appears on field focus with legal acknowledgment:
  > "I acknowledge that typing my name below constitutes my legal electronic signature and that I agree to the terms of this agreement."
- Checkbox required before signature can be saved
- Signature displays in contract preview in real-time

**Form Structure (Simplified):**
- Step 1: Full Name, Job Title, Company Entity, Signature (typed)
- Step 2: Portfolio Permission (Yes/No radio)
- Step 3: Submit

### 1.2 Contract Display Fix
- White background should extend full height of contract content
- Gray margins only visible on sides (not cutting off content)
- Proper scrolling behavior within document viewer

### 1.3 Client Authentication
**Firebase Auth Setup:**
```javascript
// Auth providers
- Email/Password
- Google Sign-In
```

**Auth Flow:**
1. Client clicks contract link: `sign.lantingdigital.com/?id=CONTRACT_ID`
2. System checks if user is authenticated
3. If not → redirect to login/register page
4. After auth → verify email matches contract's `clientEmail` field
5. If match → show contract for signing
6. If no match → show "Access Denied" message

### 1.4 Admin Updates
- Add `clientEmail` field to contract creation (required)
- Display client email in contract details modal
- Contracts table shows client email

---

## Phase 2: Full Client Portal

### 2.1 Contract Creation Form (Admin)

**New "Create Contract" button in admin contracts section**

**Form Fields:**
- Client Email (required) - who can access this contract
- Client Company Name
- Contract Name/Title
- Contract Subtitle (optional)
- Contract HTML Content (rich text editor or paste HTML)
- Provider Name (default: Caleb Lanting)
- Provider Title (default: Owner / Member)

**Workflow:**
1. Admin fills out form → creates contract in Firestore
2. Contract status set to "sent"
3. Admin copies signing link to send to client
4. (Future: Auto-send email with link)

### 2.2 Client Portal Dashboard

**After client logs in, they see:**

```
┌─────────────────────────────────────────────────────────┐
│  Lanting Digital                        [User] [Logout] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Welcome, [Client Name]                                 │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ My Contracts    │  │ Messages        │              │
│  │ 2 documents     │  │ 1 unread        │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  Recent Activity                                        │
│  ─────────────────                                      │
│  • Contract signed - Dec 15, 2024                       │
│  • New message from Caleb - Dec 14, 2024               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Contracts List View

**Shows all contracts associated with client's email:**

| Contract Name | Status | Date | Actions |
|--------------|--------|------|---------|
| Website Development | Signed | Dec 15 | View |
| Maintenance Agreement | Pending | Dec 20 | Sign |

**Status Types:**
- `pending` - Awaiting signature (can sign)
- `signed` - Completed (view only)

### 2.4 Messaging System

**Firestore Structure:**
```
conversations/
  {conversationId}/
    participants: [clientEmail, "admin"]
    clientName: "John Smith"
    clientCompany: "Acme Corp"
    createdAt: timestamp
    lastMessageAt: timestamp
    unreadByAdmin: number
    unreadByClient: number

    messages/ (subcollection)
      {messageId}/
        sender: "client" | "admin"
        content: string
        timestamp: timestamp
        read: boolean
```

**Client Messaging UI:**
- Thread-based (one conversation per client)
- Real-time updates using Firestore listeners
- Input field at bottom, messages scroll up
- Timestamps on messages
- "Caleb is typing..." indicator (optional)

**Admin Messaging UI:**
- List of all client conversations
- Unread indicator/count
- Click to open conversation
- Same message interface as client

**Email Notifications:**
- Cloud Function triggers on new message
- If client sends message → email Caleb
- If admin sends message → email client
- Use same Gmail setup as contact form notifications

### 2.5 Admin Enhancements

**New Sidebar Section: "Messages"**
- Shows list of client conversations
- Unread count badge
- Quick access to respond

**Contract Management:**
- Create new contracts from admin ✅ (Completed)
- View all contracts with client info
- Filter by status (pending/signed)
- Resend signing link
- Delete/archive contracts

### 2.6 Clients Tab (Admin Portal)

**Purpose:** Centralized client relationship management

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                    [+ Add Client]      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Search clients...                            [Filter ▾]     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Pete's Holiday Lighting                                     ││
│  │ pete@petesholidaylighting.com                              ││
│  │ 2 contracts • 5 messages • Last active: 2 days ago         ││
│  │ [View Profile] [New Contract] [Send Message]               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Acme Corporation                                            ││
│  │ john@acme.com                                               ││
│  │ 1 contract • 0 messages • Last active: 1 week ago          ││
│  │ [View Profile] [New Contract] [Send Message]               ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Client Profile View (Modal or Dedicated Page):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Pete's Holiday Lighting                              [Edit]    │
├─────────────────────────────────────────────────────────────────┤
│  Contact: Pete Johnson                                          │
│  Email: pete@petesholidaylighting.com                          │
│  Phone: (555) 123-4567                                          │
│  Company: Pete's Holiday Lighting LLC                           │
│  Notes: Great client, quick to respond, pays on time           │
├─────────────────────────────────────────────────────────────────┤
│  CONTRACTS                                    [+ New Contract]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Website Development Agreement    Signed    Dec 15, 2024    ││
│  │ Maintenance Retainer             Pending   Jan 2, 2025     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  MESSAGES                                     [View All]        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Last message: "Thanks for the update!" - Pete, 2 days ago  ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  QUICK ACTIONS                                                  │
│  [📧 Send Email]  [📝 New Contract]  [💬 Send Message]         │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
1. **Client List View**
   - Display all clients (aggregated from users + contracts)
   - Search by name, email, or company
   - Filter by status (active, inactive, pending contracts)
   - Sort by name, last activity, contract count

2. **Client Profile**
   - Contact information (name, email, phone, company)
   - Admin notes (private notes about the client)
   - All contracts associated with client
   - Conversation history preview
   - Activity timeline

3. **Quick Actions**
   - Send Email: Opens email composer with client email pre-filled
   - New Contract: Opens contract creation with client info pre-filled
   - Send Message: Opens messaging interface for this client
   - Edit Profile: Update client notes/info

4. **Email Integration**
   - Compose and send emails directly from admin
   - Pre-filled templates for common messages
   - Email history tracking (optional)
   - Uses Gmail API (same as contact notifications)

**Data Model - clients/ collection:**
```javascript
{
  email: "client@example.com",
  displayName: "John Smith",
  company: "Acme Corp",
  phone: "+1 555 123 4567",
  adminNotes: "Great client, always pays on time",
  status: "active" | "inactive" | "prospect",
  createdAt: timestamp,
  lastActivityAt: timestamp,
  contractCount: number,
  totalRevenue: number  // Optional: track revenue
}
```

**Implementation Notes:**
- Initially, clients are auto-created from contracts (clientEmail field)
- Admin can manually add clients without contracts
- Client profile links to all contracts with matching email
- Messages filtered by participant email

---

## Database Schema

### Collections

**users/** (clients who have registered)
```javascript
{
  email: "client@example.com",
  displayName: "John Smith",
  company: "Acme Corp",
  createdAt: timestamp,
  lastLoginAt: timestamp,
  authProvider: "google" | "password"
}
```

**contracts/** (existing, enhanced)
```javascript
{
  // Existing fields
  contractName: string,
  contractHtml: string,
  clientCompany: string,
  status: "draft" | "sent" | "signed",
  createdAt: timestamp,

  // New/Required fields
  clientEmail: string,  // WHO can access (required)
  clientName: string,   // Filled on sign
  clientTitle: string,  // Filled on sign
  clientSignature: string, // Typed signature
  clientSignedAt: timestamp,
  portfolioPermission: boolean,

  // Provider info
  providerName: string,
  providerTitle: string,
  providerSignedAt: timestamp
}
```

**conversations/**
```javascript
{
  participants: ["client@example.com", "admin"],
  clientName: string,
  clientCompany: string,
  createdAt: timestamp,
  lastMessageAt: timestamp,
  unreadByAdmin: number,
  unreadByClient: number
}
```

**conversations/{id}/messages/**
```javascript
{
  sender: "client" | "admin",
  senderName: string,
  content: string,
  timestamp: timestamp,
  read: boolean
}
```

---

## Security Rules

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own user doc
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Contracts: clients can only read contracts where clientEmail matches their email
    match /contracts/{contractId} {
      allow read: if request.auth != null &&
        (resource.data.clientEmail == request.auth.token.email ||
         request.auth.token.admin == true);
      allow write: if request.auth != null &&
        resource.data.clientEmail == request.auth.token.email;
      // Admin can do anything (set custom claim)
    }

    // Conversations: participants only
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null &&
        request.auth.token.email in resource.data.participants;

      match /messages/{messageId} {
        allow read, write: if request.auth != null &&
          request.auth.token.email in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
  }
}
```

---

## Cloud Functions

### Existing
- `sendEmailOnSubmission` - Contact form notifications

### New Functions Needed

**sendMessageNotification**
```javascript
// Trigger: onCreate in conversations/{convId}/messages/{msgId}
// Action: Send email to recipient (client or admin)
// Uses: Gmail API (same as contact form)
```

**sendContractReadyNotification** (optional)
```javascript
// Trigger: onCreate in contracts/
// Action: Email client that a contract is ready for signature
// Includes: Direct link to sign
```

---

## UI/UX Guidelines

### Client Portal Design
- Match existing "Porcelain & Gold" theme from admin
- Simpler navigation (only contracts + messages)
- Mobile-first responsive design
- Clear CTAs for signing contracts

### Typography
- Headings: Playfair Display
- Body: Inter
- Signatures: Dancing Script

### Colors
- Primary: Gold (#c5a059)
- Background: Light gray (#f8f9fa)
- Text: Dark gray (#1f2937)
- Success: Green (#10b981)
- Warning: Amber (#f59e0b)

---

## Implementation Order

### Phase 1 (Current)
1. Typed signature with modal
2. Contract display fix
3. Firebase Auth setup
4. Login/register page
5. Contract access control
6. Admin: client email field

### Phase 2A: Portal Foundation
1. Client dashboard page
2. Contracts list view
3. View signed contracts
4. Basic user profile

### Phase 2B: Messaging
1. Conversation data model
2. Client messaging UI
3. Admin messaging section
4. Email notifications
5. Real-time updates

### Phase 2C: Admin Enhancements
1. Contract creation form ✅ (Completed in Phase 1.5)
2. Rich text/HTML editor for contracts
3. Send contract notification emails
4. Enhanced contract management

### Phase 2D: Clients Tab (Admin)
1. Client management dashboard
2. Client list view with search/filter
3. View all contracts per client
4. View conversation history per client
5. Quick actions (send email, create contract, view profile)

---

## File Structure (Target)

```
coming-soon/
├── sign/
│   ├── index.html          # Main entry (routes to auth or portal)
│   ├── login.html          # Login/register page
│   ├── portal.html         # Client dashboard
│   ├── contracts.html      # View contracts list
│   ├── sign.html           # Sign specific contract
│   ├── messages.html       # Messaging interface
│   ├── css/
│   │   ├── auth.css
│   │   ├── portal.css
│   │   └── sign.css
│   └── js/
│       ├── auth.js         # Authentication logic
│       ├── portal.js       # Dashboard logic
│       ├── contracts.js    # Contract viewing
│       ├── sign.js         # Signing logic
│       └── messages.js     # Messaging logic
├── admin/
│   ├── index.html
│   ├── css/admin.css
│   └── js/
│       ├── auth.js
│       ├── dashboard.js
│       ├── contracts.js
│       └── messages.js     # NEW: Admin messaging
└── functions/
    └── index.js            # Cloud Functions
```

---

## Testing Checklist

### Phase 1
- [ ] Typed signature appears in Dancing Script
- [ ] Modal shows on signature field focus
- [ ] Cannot proceed without acknowledgment checkbox
- [ ] Contract background extends full height
- [ ] Email/Password registration works
- [ ] Google Sign-In works
- [ ] User with matching email can access contract
- [ ] User with different email gets access denied
- [ ] Admin can set client email when creating contract

### Phase 2
- [ ] Client sees dashboard after login
- [ ] Contracts list shows only client's contracts
- [ ] Can view signed contracts
- [ ] Messaging sends/receives in real-time
- [ ] Email notifications sent on new messages
- [ ] Admin can create contracts from form
- [ ] Admin can view/respond to messages

---

## Notes for Future Developers

1. **Firebase Config**: Located in `js/config.js` for each site
2. **Collections**:
   - `contact-submissions` - Website contact form
   - `archived-submissions` - Archived contacts
   - `contracts` - All contracts
3. **Auth Admin**: Caleb's account should have `admin: true` custom claim
4. **Email Sending**: Uses Gmail API via Cloud Functions with stored secrets

---

*Document created: January 2, 2026*
*Last updated: January 2, 2026*

---

## Recent Updates

### January 2, 2026 (Phase 1.5)
- ✅ Fixed admin auth.js variable reference bug (userEmailSpan → sidebarUserName)
- ✅ Added contract creation form to admin portal
- ✅ Created auth.lantingdigital.com subdomain for client authentication
- ✅ Added loading timeout to admin dashboard (shows empty state after 5s)
- ✅ Added Clients tab planning section to this document
