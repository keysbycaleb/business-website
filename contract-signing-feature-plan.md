# Contract Signing Feature - Development Plan

## Overview

Build a contract signing flow for the Lanting Platform (admin.lantingdigital.com) that allows clients to view and sign contracts digitally. This replaces the awkward "reply with I accept" email flow with a professional, trackable signing experience.

**First use case:** iAttend contract (hardcoded for this project, not a template system)

---

## User Flows

### Client Flow
1. Client receives email with a unique signing link (e.g., `admin.lantingdigital.com/sign/[unique-id]`)
2. Client clicks link, sees the full contract rendered on the page
3. Client fills in:
   - Name (text field)
   - Title (text field)
   - Signature (draw with mouse/touch/Apple Pencil)
   - Portfolio permission (checkbox: yes or no, from Section 16 of contract)
   - "I agree to the terms of this Agreement" (checkbox, required)
4. Date auto-fills with current date
5. Client clicks "Sign & Submit"
6. Confirmation screen shows success message
7. Both parties receive email confirmation with timestamp and PDF attachment of signed contract

### Admin Flow (Caleb)
1. Log into admin.lantingdigital.com
2. Navigate to Contracts section
3. See list of contracts with status (Draft, Sent, Signed)
4. Can view signed contracts with all details
5. Can see when contract was signed, by whom, from what IP (optional but nice for records)

---

## Technical Scope

### New Pages/Routes

**Public (no auth required):**
- `/sign/[contractId]` - Client-facing signing page

**Admin (auth required):**
- `/contracts` - List of all contracts
- `/contracts/[contractId]` - Contract detail view with signature status

### Database Schema (Supabase)

```sql
-- Contracts table
contracts (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamp with time zone default now(),

  -- Contract identification
  contract_name text not null,  -- e.g., "iAttend Enrichment Dashboard"
  client_company text not null, -- e.g., "iAttend, LLC"
  client_email text not null,   -- e.g., "micah@iattendenrichment.com"

  -- Contract content (hardcoded HTML for now)
  contract_html text not null,

  -- Provider signature (pre-filled)
  provider_name text not null,        -- "Caleb Lanting"
  provider_title text not null,       -- "Owner / Member"
  provider_signature_font text,       -- Font name for styled signature
  provider_signed_at timestamp with time zone,

  -- Client signature (filled on signing)
  client_name text,
  client_title text,
  client_signature_data text,         -- Base64 encoded signature image from canvas
  client_signed_at timestamp with time zone,
  client_ip_address text,             -- Optional: for records

  -- Portfolio permission (Section 16)
  portfolio_permission boolean,

  -- Status tracking
  status text default 'draft',        -- draft, sent, signed
  sent_at timestamp with time zone,

  -- Effective date
  effective_date date
)
```

### Components Needed

**SigningPage (`/sign/[contractId]`):**
- Contract display (rendered HTML, scrollable)
- Signature pad component (canvas-based, works with mouse and touch)
- Form fields: Name, Title
- Effective Date picker (auto-fills with today's date, but client can change if needed)
- Signature Date (auto-filled with current date, not editable - this is when they actually signed)
- Portfolio permission radio buttons (Yes / No)
- Agreement checkbox
- Submit button
- Loading and success states

**Note on dates:**
- **Effective Date:** When the agreement starts. Auto-fills with today but client can adjust. This is what appears at the top of the contract.
- **Signature Date:** When the client actually signed. Auto-set, not editable. This appears in the signature block.

**SignaturePad Component:**
- HTML5 Canvas for drawing
- Touch and mouse support (Apple Pencil works via touch events)
- Clear button to reset
- Outputs base64 PNG on submit
- Responsive sizing

**ContractList (`/contracts`):**
- Table showing all contracts
- Columns: Client, Contract Name, Status, Sent Date, Signed Date
- Click to view details

**ContractDetail (`/contracts/[contractId]`):**
- Full contract view
- Signature image displayed
- All signing metadata
- Option to download as PDF (stretch goal)

---

## Provider (Caleb) Signature

Pre-fill Caleb's signature block with:
- Name: "Caleb Lanting"
- Title: "Owner / Member"
- Signature: Styled text using a script/handwriting font (e.g., "Great Vibes", "Dancing Script", or "Allura" from Google Fonts)
- Date: Set when contract is created/sent

This avoids Caleb needing to draw his signature every time. The styled font approach is legally equivalent to a drawn signature.

---

## Email Notifications

**On contract send:**
- Email to client with signing link
- Subject: "Contract Ready for Signature - [Contract Name]"
- Body: Brief message + prominent "Review & Sign" button/link

**On contract signed:**
- Email to Caleb (confirmation that client signed)
- Email to client (confirmation with copy of what they signed)
- Both emails should include: timestamp, contract name, and ideally a PDF attachment

---

## Libraries/Dependencies

- **Signature pad:** `signature_pad` npm package (lightweight, well-maintained) or `react-signature-canvas`
- **PDF generation (stretch):** `@react-pdf/renderer` or `html2pdf.js` for generating downloadable PDFs
- **Fonts:** Google Fonts for Caleb's script signature

---

## Phases

### Phase 1: MVP (Today's Goal)
- [ ] Database table for contracts
- [ ] Signing page with signature pad
- [ ] Form validation
- [ ] Save signed contract to database
- [ ] Basic admin view to see signed contracts
- [ ] Manually create iAttend contract record in database

### Phase 2: Polish (If Time Permits)
- [ ] Email notifications on sign
- [ ] Styled confirmation page
- [ ] Download as PDF

### Phase 3: Future Enhancements (Not Today)
- [ ] Create contracts from admin UI
- [ ] Template system (if patterns emerge)
- [ ] Automatic Stripe invoice trigger on signature
- [ ] Contract expiration (auto-void if not signed in X days)

---

## iAttend Contract Specifics

For the first contract, manually insert the iAttend contract HTML into the database. Key details:

- **Contract Name:** iAttend Enrichment Dashboard
- **Client Company:** iAttend, LLC
- **Client Email:** micah@iattendenrichment.com
- **Effective Date:** Leave blank or set to signing date
- **Provider Name:** Caleb Lanting
- **Provider Title:** Owner / Member
- **Contract HTML:** Contents of `iattend-contract.html`

The portfolio permission checkbox maps to Section 16:
- "I agree to allow portfolio use after launch, subject to prior written approval"
- "I do not wish to be featured in Provider's portfolio"

---

## Success Criteria

1. Micah can click a link, see the contract, draw his signature, and submit
2. Caleb can see in his admin that Micah signed, with timestamp and signature image
3. Both parties have a record of the signed agreement

---

## Questions Resolved

- **Where does this live?** admin.lantingdigital.com (Lanting Platform)
- **Template system?** No, hardcode for now. Templates are too complex for the variety of projects.
- **Signature method?** Draw signature (mouse/touch/Apple Pencil) for client. Styled font for Caleb (pre-filled).
- **Different signing dates?** Not a problem. Each party's signature date is independent. Effective Date governs when agreement starts.
