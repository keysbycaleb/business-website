# Legal Pages Content for Lanting Digital

Instructions for dev session: Create two new pages accessible from the main site footer and the sign/portal footers. Use the same styling as the rest of the platform.

---

## Page 1: Privacy Policy

**URL:** `lantingdigital.com/privacy` or `/privacy.html`

---

# Privacy Policy

**Last Updated:** January 2, 2026

Lanting Digital LLC ("we," "us," or "our") operates the lantingdigital.com website and related services. This Privacy Policy explains how we collect, use, and protect your information.

## Information We Collect

### Information You Provide
- **Contact Information:** Name, email address, phone number, company name
- **Contract Information:** Job title, company/entity name, electronic signatures
- **Communications:** Messages sent through our client portal
- **Payment Information:** Billing details processed through Stripe (we do not store card numbers)

### Information Collected Automatically
- **IP Address:** Captured when you sign contracts (for verification purposes)
- **Usage Data:** Pages visited, time spent, browser type
- **Device Information:** Operating system, screen size

## How We Use Your Information

We use your information to:
- Provide and improve our services
- Process contracts and payments
- Communicate about projects and updates
- Send invoices and receipts
- Respond to inquiries and support requests
- Maintain security and prevent fraud

## Information Sharing

We do not sell your personal information. We may share information with:
- **Service Providers:** Firebase (hosting/database), Stripe (payments), Google (authentication), Gmail (email notifications)
- **Legal Requirements:** When required by law or to protect our rights

## Data Retention

We retain your information for as long as necessary to provide services and comply with legal obligations. Contract records are kept for at least 7 years for tax and legal purposes.

## Your Rights (California Residents)

Under the California Consumer Privacy Act (CCPA), you have the right to:
- **Know** what personal information we collect
- **Delete** your personal information (subject to legal retention requirements)
- **Opt-out** of the sale of personal information (we do not sell your data)
- **Non-discrimination** for exercising your privacy rights

To exercise these rights, contact us at caleb@lantingdigital.com.

## Security

We implement industry-standard security measures including:
- Encrypted data transmission (HTTPS)
- Secure authentication (Firebase Auth)
- Access controls and role-based permissions
- Regular security updates

## Third-Party Services

Our platform uses the following third-party services with their own privacy policies:
- **Google Firebase:** Database and authentication
- **Stripe:** Payment processing
- **Google Sign-In:** Authentication

## Children's Privacy

Our services are not directed to children under 13. We do not knowingly collect information from children.

## Changes to This Policy

We may update this Privacy Policy periodically. We will notify you of significant changes via email or platform notification.

## Contact Us

For privacy questions or to exercise your rights:

**Lanting Digital LLC**
Riverside, California
caleb@lantingdigital.com
(951) 460-8140

---

## Page 2: Terms of Service

**URL:** `lantingdigital.com/terms` or `/terms.html`

---

# Terms of Service

**Last Updated:** January 2, 2026

These Terms of Service ("Terms") govern your use of the Lanting Digital LLC platform, including our website, client portal, and contract signing system (collectively, the "Platform").

By using our Platform, you agree to these Terms. If you do not agree, please do not use our services.

## 1. Services

Lanting Digital LLC provides custom software development, web development, mobile app development, and related technology services. Specific project terms are outlined in individual Service Agreements between you and Lanting Digital LLC.

## 2. Accounts

### Registration
To access certain features (client portal, contract signing), you must authenticate using Google Sign-In or email/password. You are responsible for maintaining the security of your account credentials.

### Accurate Information
You agree to provide accurate, current information. You are responsible for all activity under your account.

### One Account Per Person
Each account should represent one individual. Shared accounts are not permitted without prior written consent.

## 3. Electronic Signatures

By signing contracts through our Platform:
- You acknowledge that typing your name constitutes a legally binding electronic signature
- You agree to be bound by the terms of any agreement you sign electronically
- You consent to conducting business electronically

Electronic signatures are valid and enforceable under the Electronic Signatures in Global and National Commerce Act (E-SIGN) and the Uniform Electronic Transactions Act (UETA).

## 4. Payments

### Payment Processing
Payments are processed through Stripe. By making a payment, you agree to Stripe's terms of service.

### Refund Policy
Deposits and payments for completed work are non-refundable. Refunds for incomplete work are handled on a case-by-case basis as specified in your Service Agreement.

### Late Payments
Late payments may result in paused work, as specified in your Service Agreement.

## 5. Intellectual Property

### Our Property
The Platform, including its design, code, and content, is owned by Lanting Digital LLC. You may not copy, modify, or distribute any part of the Platform without permission.

### Your Property
You retain ownership of any content you provide through the Platform (documents, images, data). By uploading content, you grant us a limited license to use it for providing services.

### Project Work
Intellectual property for project work is governed by individual Service Agreements, not these Terms.

## 6. Acceptable Use

You agree not to:
- Use the Platform for illegal purposes
- Attempt to gain unauthorized access to our systems
- Interfere with the Platform's operation
- Upload malicious content or code
- Impersonate others or provide false information
- Use the Platform to harass, abuse, or harm others

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW:

- Lanting Digital LLC is not liable for indirect, incidental, special, or consequential damages
- Our total liability for any claim is limited to the amount you paid us in the 12 months preceding the claim
- We are not liable for service interruptions, data loss, or third-party actions

These limitations do not apply to our gross negligence or willful misconduct.

## 8. Disclaimer of Warranties

THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. We do not warrant that the Platform will be uninterrupted, error-free, or secure.

## 9. Indemnification

You agree to indemnify and hold harmless Lanting Digital LLC from any claims, damages, or expenses arising from your use of the Platform or violation of these Terms.

## 10. Termination

We may suspend or terminate your access to the Platform at any time for violation of these Terms or for any reason with notice. Upon termination, your right to use the Platform ends immediately.

## 11. Dispute Resolution

### Governing Law
These Terms are governed by the laws of the State of California.

### Jurisdiction
Any disputes will be resolved in the state courts of Riverside County, California.

### Informal Resolution
Before filing any legal claim, you agree to contact us and attempt to resolve the dispute informally for at least 30 days.

## 12. Changes to Terms

We may modify these Terms at any time. We will notify you of significant changes via email or Platform notification. Continued use after changes constitutes acceptance.

## 13. Severability

If any provision of these Terms is found unenforceable, the remaining provisions remain in effect.

## 14. Entire Agreement

These Terms, together with our Privacy Policy and any Service Agreements, constitute the entire agreement between you and Lanting Digital LLC regarding the Platform.

## 15. Contact

For questions about these Terms:

**Lanting Digital LLC**
Riverside, California
caleb@lantingdigital.com
(951) 460-8140

---

## Implementation Notes for Dev Session

1. **Create two HTML pages:** `/privacy.html` and `/terms.html`

2. **Add footer links to:**
   - Main website (lantingdigital.com)
   - Sign page (sign.lantingdigital.com)
   - Portal (portal.lantingdigital.com)
   - Admin (optional, but good practice)

3. **On the sign page**, add a line above the signature section:
   ```
   By signing, you agree to our [Terms of Service] and [Privacy Policy].
   ```

4. **Styling:** Match the existing platform aesthetic. Simple, clean, readable.

5. **Last Updated date:** Make this easy to update (could be a variable or just edit the HTML).
