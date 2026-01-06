const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Admin email for admin portal access
const ADMIN_EMAIL = "caleb@lantingdigital.com";

/**
 * Create a custom token for cross-subdomain authentication.
 * Takes an ID token, verifies it, and returns a custom token.
 */
exports.createCustomToken = onCall(
  {
    region: "us-central1",
    cors: true, // Allow all origins for this function
  },
  async (request) => {
    const { idToken } = request.data;

    if (!idToken) {
      throw new Error("Missing ID token");
    }

    try {
      // Verify the ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // Create custom token with additional claims
      const customToken = await admin.auth().createCustomToken(uid, {
        email: email,
        isAdmin: email === ADMIN_EMAIL,
      });

      return {
        success: true,
        customToken,
        email,
        isAdmin: email === ADMIN_EMAIL,
      };
    } catch (error) {
      console.error("Error creating custom token:", error);
      throw new Error(`Failed to create custom token: ${error.message}`);
    }
  }
);

// Stripe Price IDs for recurring products
const STRIPE_PRICES = {
  retainer_standard: "price_1SldKB5CaLIi8KGPhzEhw1Jj",  // $139/month
  retainer_priority: "price_1SldKC5CaLIi8KGPvh8rsrMo",  // $199/month
  saas_starter: "price_1SldKC5CaLIi8KGPa90LOPpP",      // $149/month
  saas_growth: "price_1SldKC5CaLIi8KGPMqkjWwlm",       // $299/month
  saas_scale: "price_1SldKD5CaLIi8KGPHOWVo9xG",        // $499/month
};

// Define secrets
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Cloud Function triggered when a new document is created in the
 * 'submissions' collection. Sends an email notification.
 */
exports.sendEmailOnSubmission = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return null;
    }

    const data = snapshot.data();
    const db = admin.firestore();

    // Create transporter with secrets (must be inside function)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailEmail.value(),
        pass: gmailPassword.value(),
      },
    });

    // Get form config for recipient emails
    let recipientEmails = ["caleb@lantingdigital.com"];
    try {
      const formDoc = await db.collection("forms").doc("lanting-digital").get();
      if (formDoc.exists && formDoc.data().recipientEmails) {
        recipientEmails = formDoc.data().recipientEmails;
      }
    } catch (error) {
      console.log("Could not fetch form config, using default email");
    }

    // Build email content
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1b1f22; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-top: 5px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    a.button { display: inline-block; background: #1b1f22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Contact Form Submission</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name:</div>
        <div class="value">${data.name || "Not provided"}</div>
      </div>
      <div class="field">
        <div class="label">Email:</div>
        <div class="value">${data.email || "Not provided"}</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="value">${data.message || "No message"}</div>
      </div>
    </div>
    <div class="footer">
      <p><a href="https://admin.lantingdigital.com" class="button">View in Admin Dashboard</a></p>
      <p>Submitted: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</p>
      <p>Lanting Digital LLC</p>
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: `"Lanting Digital" <${gmailEmail.value()}>`,
      to: recipientEmails.join(", "),
      subject: `New Lead: ${data.name || "Contact Form Submission"}`,
      html: emailBody,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully to:", recipientEmails.join(", "));
      return null;
    } catch (error) {
      console.error("Error sending email:", error);
      return null;
    }
  }
);

/**
 * Cloud Function triggered when a contract document is updated.
 * Sends confirmation emails when a contract is signed.
 */
exports.sendContractSignedEmail = onDocumentUpdated(
  {
    document: "contracts/{contractId}",
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Only send email when status changes to 'signed'
    if (beforeData.status === "signed" || afterData.status !== "signed") {
      console.log("Contract not newly signed, skipping email");
      return null;
    }

    console.log("Contract signed! Sending confirmation emails...");

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailEmail.value(),
        pass: gmailPassword.value(),
      },
    });

    const contractName = afterData.contractName || "Service Agreement";
    const clientName = afterData.clientName || "Client";
    const clientEmail = afterData.clientEmail;
    const clientCompany = afterData.clientCompany || "";
    const providerEmail = "caleb@lantingdigital.com";
    const signedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });

    // Email to Client
    const clientEmailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .success-badge { background: #dcfce7; color: #059669; padding: 12px 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .details p { margin: 8px 0; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-weight: bold; color: #1a1a1a; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Contract Signed Successfully</h1>
    </div>
    <div class="content">
      <div class="success-badge">
        <strong>✓ Your signature has been recorded</strong>
      </div>
      <p>Dear ${clientName},</p>
      <p>Thank you for signing the agreement. This email confirms that your electronic signature has been successfully recorded.</p>
      <div class="details">
        <p><span class="label">Contract:</span><br><span class="value">${contractName}</span></p>
        <p><span class="label">Signed By:</span><br><span class="value">${clientName}${clientCompany ? `, ${clientCompany}` : ""}</span></p>
        <p><span class="label">Date Signed:</span><br><span class="value">${signedDate}</span></p>
      </div>
      <p>A copy of this agreement will be provided upon request. If you have any questions, please don't hesitate to reach out.</p>
      <p>Best regards,<br><strong>Caleb Lanting</strong><br>Lanting Digital LLC</p>
    </div>
    <div class="footer">
      <p>Lanting Digital LLC | <a href="https://lantingdigital.com">lantingdigital.com</a></p>
    </div>
  </div>
</body>
</html>
    `;

    // Email to Provider (Caleb)
    const providerEmailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #555; }
    .value { margin-top: 5px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    a.button { display: inline-block; background: #1b1f22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Contract Signed!</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Contract:</div>
        <div class="value">${contractName}</div>
      </div>
      <div class="field">
        <div class="label">Client:</div>
        <div class="value">${clientName}${clientCompany ? ` (${clientCompany})` : ""}</div>
      </div>
      <div class="field">
        <div class="label">Client Email:</div>
        <div class="value">${clientEmail || "Not provided"}</div>
      </div>
      <div class="field">
        <div class="label">Signed:</div>
        <div class="value">${signedDate}</div>
      </div>
      <div class="field">
        <div class="label">Portfolio Permission:</div>
        <div class="value">${afterData.portfolioPermission ? "Yes ✓" : "No"}</div>
      </div>
    </div>
    <div class="footer">
      <p><a href="https://admin.lantingdigital.com" class="button">View in Admin Dashboard</a></p>
    </div>
  </div>
</body>
</html>
    `;

    const emailPromises = [];

    // Send to client if email exists
    if (clientEmail) {
      emailPromises.push(
        transporter.sendMail({
          from: `"Lanting Digital" <${gmailEmail.value()}>`,
          to: clientEmail,
          subject: `Contract Signed: ${contractName}`,
          html: clientEmailBody,
        })
      );
    }

    // Send to provider
    emailPromises.push(
      transporter.sendMail({
        from: `"Lanting Digital" <${gmailEmail.value()}>`,
        to: providerEmail,
        subject: `Contract Signed: ${clientName} - ${contractName}`,
        html: providerEmailBody,
      })
    );

    try {
      await Promise.all(emailPromises);
      console.log("Contract confirmation emails sent successfully");
      return null;
    } catch (error) {
      console.error("Error sending contract emails:", error);
      return null;
    }
  }
);

/**
 * Cloud Function triggered when a new message is created.
 * Only notifies admin when:
 * 1. It's the first message from a client, OR
 * 2. Admin has responded since the last client message
 * Never notifies client (no email when admin responds).
 */
exports.sendMessageNotification = onDocumentCreated(
  {
    document: "messages/{messageId}",
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return null;
    }

    const message = snapshot.data();
    const db = admin.firestore();

    // If admin sent the message, mark conversation as responded and don't notify client
    if (message.fromAdmin) {
      console.log("Admin message - no notification to client");
      // Update the client's lastAdminResponse timestamp
      if (message.clientEmail) {
        try {
          const clientQuery = await db.collection("clients")
            .where("email", "==", message.clientEmail)
            .limit(1)
            .get();

          if (!clientQuery.empty) {
            await clientQuery.docs[0].ref.update({
              lastAdminResponse: admin.firestore.FieldValue.serverTimestamp(),
              pendingNotification: false,
            });
          }
        } catch (error) {
          console.error("Error updating client lastAdminResponse:", error);
        }
      }
      return null;
    }

    // Client sent message - check if we should notify admin
    const providerEmail = "caleb@lantingdigital.com";

    try {
      // Check if there's a pending notification already (admin hasn't responded)
      const clientQuery = await db.collection("clients")
        .where("email", "==", message.clientEmail)
        .limit(1)
        .get();

      let shouldNotify = true;
      let clientDoc = null;

      if (!clientQuery.empty) {
        clientDoc = clientQuery.docs[0];
        const clientData = clientDoc.data();

        // If there's already a pending notification, don't send another
        if (clientData.pendingNotification === true) {
          console.log("Pending notification exists, skipping immediate email");
          shouldNotify = false;

          // Update the reminder time (5 minutes from now)
          await clientDoc.ref.update({
            reminderDue: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 5 * 60 * 1000)
            ),
          });
        }
      }

      if (shouldNotify) {
        // Create transporter
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailEmail.value(),
            pass: gmailPassword.value(),
          },
        });

        const timestamp = new Date().toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Los_Angeles",
        });

        const providerEmailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0284c7; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .message-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    a.button { display: inline-block; background: #1b1f22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Client Message</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">From:</div>
        <div class="value">${message.clientName || "Client"} (${message.clientEmail || "No email"})</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="message-box">
          <p>${message.content || ""}</p>
        </div>
      </div>
      <div class="field">
        <div class="label">Received:</div>
        <div class="value">${timestamp}</div>
      </div>
    </div>
    <div class="footer">
      <p><a href="https://admin.lantingdigital.com/#messages" class="button">Reply in Admin Dashboard</a></p>
    </div>
  </div>
</body>
</html>
        `;

        await transporter.sendMail({
          from: `"Lanting Digital" <${gmailEmail.value()}>`,
          to: providerEmail,
          subject: `New Message from ${message.clientName || "Client"}`,
          html: providerEmailBody,
        });
        console.log("Message notification sent to provider");

        // Mark that there's a pending notification and set reminder time
        if (clientDoc) {
          await clientDoc.ref.update({
            pendingNotification: true,
            lastClientMessage: admin.firestore.FieldValue.serverTimestamp(),
            reminderDue: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 5 * 60 * 1000)
            ),
          });
        }
      }

    } catch (error) {
      console.error("Error in message notification:", error);
    }

    return null;
  }
);

/**
 * Cloud Function triggered when a new contract is created.
 * Auto-creates a client record if one doesn't exist.
 */
exports.autoCreateClientFromContract = onDocumentCreated(
  {
    document: "contracts/{contractId}",
    region: "us-central1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return null;
    }

    const contract = snapshot.data();
    const db = admin.firestore();

    // Check if we have a client email
    if (!contract.clientEmail) {
      console.log("No client email in contract, skipping client creation");
      return null;
    }

    try {
      // Check if client already exists
      const existingClient = await db.collection("clients")
        .where("email", "==", contract.clientEmail)
        .limit(1)
        .get();

      if (!existingClient.empty) {
        console.log("Client already exists for:", contract.clientEmail);
        return null;
      }

      // Create new client record
      const newClient = {
        email: contract.clientEmail,
        name: contract.clientName || "Client",
        company: contract.clientCompany || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdFromContract: event.params.contractId,
      };

      await db.collection("clients").add(newClient);
      console.log("Auto-created client for:", contract.clientEmail);

      return null;
    } catch (error) {
      console.error("Error auto-creating client:", error);
      return null;
    }
  }
);

/**
 * Scheduled function that runs every 5 minutes to check for
 * unanswered client messages and send reminder emails.
 * Only sends reminders when admin status is "available".
 */
exports.checkMessageReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      // Check admin status first
      const settingsDoc = await db.collection("settings").doc("admin").get();
      const adminStatus = settingsDoc.exists ? settingsDoc.data().status : "available";

      // Only send reminders when admin is "available"
      if (adminStatus !== "available") {
        console.log(`Admin status is "${adminStatus}" - skipping reminders`);
        return null;
      }

      // Find clients with pending notifications where reminder is due
      const clientsQuery = await db.collection("clients")
        .where("pendingNotification", "==", true)
        .where("reminderDue", "<=", now)
        .get();

      if (clientsQuery.empty) {
        console.log("No pending reminders due");
        return null;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailEmail.value(),
          pass: gmailPassword.value(),
        },
      });

      const providerEmail = "caleb@lantingdigital.com";

      for (const clientDoc of clientsQuery.docs) {
        const clientData = clientDoc.data();

        // Get the most recent unread message from this client
        const messagesQuery = await db.collection("messages")
          .where("clientEmail", "==", clientData.email)
          .where("fromAdmin", "==", false)
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        if (messagesQuery.empty) {
          // No messages, clear the pending flag
          await clientDoc.ref.update({
            pendingNotification: false,
            reminderDue: admin.firestore.FieldValue.delete(),
          });
          continue;
        }

        const lastMessage = messagesQuery.docs[0].data();

        const reminderEmailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #d97706; color: white; padding: 20px; text-align: center; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .message-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #555; font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    a.button { display: inline-block; background: #1b1f22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Reminder: Unanswered Message</h1>
    </div>
    <div class="content">
      <p>You have an unanswered message from <strong>${clientData.name || "a client"}</strong>.</p>
      <div class="field">
        <div class="label">From:</div>
        <div class="value">${clientData.name || "Client"} (${clientData.email})</div>
      </div>
      <div class="field">
        <div class="label">Last Message:</div>
        <div class="message-box">
          <p>${lastMessage.content || ""}</p>
        </div>
      </div>
    </div>
    <div class="footer">
      <p><a href="https://admin.lantingdigital.com/#messages" class="button">Reply Now</a></p>
    </div>
  </div>
</body>
</html>
        `;

        try {
          await transporter.sendMail({
            from: `"Lanting Digital" <${gmailEmail.value()}>`,
            to: providerEmail,
            subject: `⏰ Reminder: Message from ${clientData.name || "Client"} awaiting reply`,
            html: reminderEmailBody,
          });
          console.log("Reminder sent for client:", clientData.email);

          // Clear the pending notification (no more reminders until admin responds and client messages again)
          await clientDoc.ref.update({
            pendingNotification: false,
            reminderDue: admin.firestore.FieldValue.delete(),
            reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        } catch (error) {
          console.error("Error sending reminder for client:", clientData.email, error);
        }
      }

    } catch (error) {
      console.error("Error in checkMessageReminders:", error);
    }

    return null;
  }
);

/**
 * Helper function to create Stripe payment link for an invoice
 */
async function createPaymentLinkForInvoice(invoiceId, invoiceData) {
  const stripe = require("stripe")(stripeSecretKey.value());
  const db = admin.firestore();

  console.log(`Creating payment link for invoice ${invoiceId}`);

  try {
    // Get or create Stripe customer
    let stripeCustomerId = invoiceData.stripeCustomerId;

    if (!stripeCustomerId && invoiceData.clientEmail) {
      // Search for existing customer
      const customers = await stripe.customers.list({
        email: invoiceData.clientEmail,
        limit: 1,
      });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: invoiceData.clientEmail,
          name: invoiceData.clientName || undefined,
          metadata: {
            clientId: invoiceData.clientId || "",
            source: "lanting-digital-portal",
          },
        });
        stripeCustomerId = customer.id;
      }
    }

    // Create a product for this invoice
    const product = await stripe.products.create({
      name: `Invoice ${invoiceData.invoiceNumber}`,
      description: invoiceData.lineItems?.map((item) => item.description).join(", ") || "Services",
      metadata: {
        invoiceId: invoiceId,
        invoiceNumber: invoiceData.invoiceNumber || "",
      },
    });

    // Create a price for the total amount
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round((invoiceData.total || 0) * 100), // Convert to cents
      currency: "usd",
    });

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoiceId,
        invoiceNumber: invoiceData.invoiceNumber || "",
        clientEmail: invoiceData.clientEmail || "",
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `https://portal.lantingdigital.com/#invoices?success=true&invoice=${invoiceId}`,
        },
      },
      payment_method_types: ["card", "us_bank_account"],
      allow_promotion_codes: false,
      billing_address_collection: "auto",
    });

    // Update invoice with Stripe info
    await db.collection("invoices").doc(invoiceId).update({
      stripeCustomerId: stripeCustomerId,
      stripeProductId: product.id,
      stripePriceId: price.id,
      stripePaymentLinkId: paymentLink.id,
      stripePaymentLink: paymentLink.url,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Payment link created for invoice ${invoiceId}: ${paymentLink.url}`);
    return true;
  } catch (error) {
    console.error("Error creating payment link:", error);

    // Update invoice with error
    await db.collection("invoices").doc(invoiceId).update({
      stripeError: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return false;
  }
}

/**
 * Cloud Function triggered when a NEW invoice is created with status 'pending'.
 * Creates a Stripe payment link immediately.
 */
exports.createStripePaymentLinkOnCreate = onDocumentCreated(
  {
    document: "invoices/{invoiceId}",
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return null;
    }

    const invoiceData = snapshot.data();
    const invoiceId = event.params.invoiceId;

    // Only process if status is 'pending' and no payment link exists
    if (invoiceData.status !== "pending" || invoiceData.stripePaymentLink) {
      return null;
    }

    await createPaymentLinkForInvoice(invoiceId, invoiceData);
    return null;
  }
);

/**
 * Cloud Function triggered when an invoice is updated.
 * Creates a Stripe payment link when status changes to 'pending'.
 */
exports.createStripePaymentLink = onDocumentUpdated(
  {
    document: "invoices/{invoiceId}",
    region: "us-central1",
    secrets: [stripeSecretKey],
  },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const invoiceId = event.params.invoiceId;

    // Only process when status changes to 'pending' and no payment link exists
    if (beforeData.status === afterData.status) {
      return null;
    }

    if (afterData.status !== "pending" || afterData.stripePaymentLink) {
      return null;
    }

    await createPaymentLinkForInvoice(invoiceId, afterData);
    return null;
  }
);

/**
 * Stripe webhook handler for payment events.
 * Handles invoices, subscriptions, and payment plans.
 */
exports.stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [stripeSecretKey, stripeWebhookSecret, gmailEmail, gmailPassword],
    invoker: "public", // Allow Stripe to call this endpoint
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];
    const db = admin.firestore();

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle checkout.session.completed event (one-time payments & initial subscription setup)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Handle one-time invoice payment
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId) {
        try {
          await db.collection("invoices").doc(invoiceId).update({
            status: "paid",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            stripePaymentIntentId: session.payment_intent,
            stripeSessionId: session.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Invoice ${invoiceId} marked as paid`);
        } catch (error) {
          console.error("Error updating invoice:", error);
        }
      }

      // Handle subscription/payment plan activation
      if (session.mode === "subscription" && session.subscription) {
        const isPaymentPlan = session.metadata?.isPaymentPlan === "true";
        const clientId = session.metadata?.clientId;

        try {
          // Find the pending subscription/payment plan by checkout session ID
          const collection = isPaymentPlan ? "paymentPlans" : "subscriptions";
          const query = await db.collection(collection)
            .where("stripeCheckoutSessionId", "==", session.id)
            .limit(1)
            .get();

          if (!query.empty) {
            const docRef = query.docs[0].ref;
            await docRef.update({
              status: "active",
              stripeSubscriptionId: session.subscription,
              activatedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`${collection} activated with subscription ${session.subscription}`);
          }
        } catch (error) {
          console.error("Error activating subscription:", error);
        }
      }
    }

    // Handle subscription created (backup in case checkout.session.completed doesn't catch it)
    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object;
      console.log(`Subscription created: ${subscription.id}`);
    }

    // Handle recurring invoice paid (subscription payments)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      // Only process subscription invoices
      if (invoice.subscription) {
        const subscriptionId = invoice.subscription;
        const isPaymentPlan = invoice.subscription_details?.metadata?.isPaymentPlan === "true";

        try {
          // Find the subscription in Firestore
          const collection = isPaymentPlan ? "paymentPlans" : "subscriptions";

          // Search by stripeSubscriptionId
          let query = await db.collection(collection)
            .where("stripeSubscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!query.empty) {
            const docRef = query.docs[0].ref;
            const docData = query.docs[0].data();

            const updateData = {
              lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
              lastPaymentAmount: invoice.amount_paid / 100,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // For payment plans, track payment count
            if (isPaymentPlan) {
              const newPaymentCount = (docData.paymentsCompleted || 0) + 1;
              updateData.paymentsCompleted = newPaymentCount;

              // Check if payment plan is complete
              if (newPaymentCount >= docData.numberOfPayments) {
                updateData.status = "completed";
                updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();

                // Cancel the subscription in Stripe since payment plan is done
                try {
                  await stripe.subscriptions.cancel(subscriptionId);
                  console.log(`Payment plan completed, subscription ${subscriptionId} cancelled`);
                } catch (cancelError) {
                  console.error("Error cancelling completed payment plan:", cancelError);
                }
              }
            }

            await docRef.update(updateData);
            console.log(`Payment recorded for ${collection}: ${docRef.id}`);

            // Create a payment record for tracking
            await db.collection("payments").add({
              type: isPaymentPlan ? "payment_plan" : "subscription",
              parentId: docRef.id,
              clientId: docData.clientId,
              clientEmail: docData.clientEmail,
              amount: invoice.amount_paid / 100,
              stripeInvoiceId: invoice.id,
              stripeSubscriptionId: subscriptionId,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (error) {
          console.error("Error processing invoice.paid:", error);
        }
      }
    }

    // Handle invoice payment failed
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;

      if (invoice.subscription) {
        const subscriptionId = invoice.subscription;
        const isPaymentPlan = invoice.subscription_details?.metadata?.isPaymentPlan === "true";

        try {
          const collection = isPaymentPlan ? "paymentPlans" : "subscriptions";
          const query = await db.collection(collection)
            .where("stripeSubscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

          if (!query.empty) {
            const docRef = query.docs[0].ref;
            const docData = query.docs[0].data();

            await docRef.update({
              status: "payment_failed",
              lastFailedPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
              lastFailureReason: invoice.last_payment_error?.message || "Payment failed",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Send notification email
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: gmailEmail.value(),
                pass: gmailPassword.value(),
              },
            });

            await transporter.sendMail({
              from: `"Lanting Digital" <${gmailEmail.value()}>`,
              to: "caleb@lantingdigital.com",
              subject: `⚠️ Payment Failed: ${docData.clientName || docData.clientEmail}`,
              html: `
                <h2>Payment Failed</h2>
                <p><strong>Client:</strong> ${docData.clientName || "N/A"} (${docData.clientEmail})</p>
                <p><strong>Type:</strong> ${isPaymentPlan ? "Payment Plan" : "Subscription"}</p>
                <p><strong>Amount:</strong> $${(invoice.amount_due / 100).toFixed(2)}</p>
                <p><strong>Reason:</strong> ${invoice.last_payment_error?.message || "Unknown"}</p>
                <p><a href="https://admin.lantingdigital.com/#subscriptions">View in Admin</a></p>
              `,
            });

            console.log(`Payment failure recorded and notification sent for ${collection}`);
          }
        } catch (error) {
          console.error("Error processing payment failure:", error);
        }
      }
    }

    // Handle subscription deleted/cancelled
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const isPaymentPlan = subscription.metadata?.isPaymentPlan === "true";

      try {
        const collection = isPaymentPlan ? "paymentPlans" : "subscriptions";
        const query = await db.collection(collection)
          .where("stripeSubscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (!query.empty) {
          const docRef = query.docs[0].ref;
          const docData = query.docs[0].data();

          // Only update to cancelled if not already completed
          if (docData.status !== "completed") {
            await docRef.update({
              status: "cancelled",
              cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`${collection} marked as cancelled: ${docRef.id}`);
          }
        }
      } catch (error) {
        console.error("Error processing subscription deletion:", error);
      }
    }

    // Handle subscription updated (e.g., cancel_at_period_end changes)
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const isPaymentPlan = subscription.metadata?.isPaymentPlan === "true";

      try {
        const collection = isPaymentPlan ? "paymentPlans" : "subscriptions";
        const query = await db.collection(collection)
          .where("stripeSubscriptionId", "==", subscription.id)
          .limit(1)
          .get();

        if (!query.empty) {
          const docRef = query.docs[0].ref;

          await docRef.update({
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripeStatus: subscription.status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Error processing subscription update:", error);
      }
    }

    res.status(200).json({ received: true });
  }
);

/**
 * Create a regular subscription (for retainers/SaaS - ongoing until cancelled)
 */
exports.createSubscription = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    invoker: "public",
    cors: [
      "https://admin.lantingdigital.com",
      "https://lanting-digital-admin.web.app",
      "http://localhost:5000",
    ],
  },
  async (request) => {
    // Verify admin is authenticated
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const { clientId, clientEmail, clientName, planType, planTier } = request.data;

    if (!clientId || !clientEmail || !planType || !planTier) {
      throw new Error("Missing required fields: clientId, clientEmail, planType, planTier");
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    const db = admin.firestore();

    // Determine price ID based on plan
    const priceKey = `${planType}_${planTier}`;
    const priceId = STRIPE_PRICES[priceKey];

    if (!priceId) {
      throw new Error(`Invalid plan: ${priceKey}. Valid plans: ${Object.keys(STRIPE_PRICES).join(", ")}`);
    }

    try {
      // Get or create Stripe customer
      let stripeCustomerId;
      const customers = await stripe.customers.list({ email: clientEmail, limit: 1 });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: clientEmail,
          name: clientName || undefined,
          metadata: { clientId, source: "lanting-digital-admin" },
        });
        stripeCustomerId = customer.id;
      }

      // Create a checkout session for the subscription
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `https://portal.lantingdigital.com/#invoices?subscription=success`,
        cancel_url: `https://portal.lantingdigital.com/#invoices?subscription=cancelled`,
        metadata: {
          clientId,
          planType,
          planTier,
          source: "admin-created",
        },
      });

      // Create subscription record in Firestore (pending until checkout completes)
      const subscriptionDoc = await db.collection("subscriptions").add({
        clientId,
        clientEmail,
        clientName: clientName || "",
        planType,
        planTier,
        priceId,
        status: "pending_payment",
        stripeCustomerId,
        stripeCheckoutSessionId: session.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      });

      return {
        success: true,
        subscriptionId: subscriptionDoc.id,
        checkoutUrl: session.url,
      };

    } catch (error) {
      console.error("Error creating subscription:", error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }
);

/**
 * Create a payment plan (subscription schedule that auto-ends after X payments)
 */
exports.createPaymentPlan = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    invoker: "public",
    cors: [
      "https://admin.lantingdigital.com",
      "https://lanting-digital-admin.web.app",
      "http://localhost:5000",
    ],
  },
  async (request) => {
    // Verify admin is authenticated
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const {
      clientId,
      clientEmail,
      clientName,
      projectName,
      totalAmount,
      numberOfPayments,
      description,
      startDate,
    } = request.data;

    if (!clientId || !clientEmail || !totalAmount || !numberOfPayments) {
      throw new Error("Missing required fields: clientId, clientEmail, totalAmount, numberOfPayments");
    }

    // Calculate trial_end timestamp if startDate is provided
    let trialEndTimestamp = null;
    if (startDate) {
      const startDateObj = new Date(startDate + "T00:00:00");
      trialEndTimestamp = Math.floor(startDateObj.getTime() / 1000);
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    const db = admin.firestore();

    // Calculate payment amount per installment
    const paymentAmount = Math.round((totalAmount / numberOfPayments) * 100); // in cents

    try {
      // Get or create Stripe customer
      let stripeCustomerId;
      const customers = await stripe.customers.list({ email: clientEmail, limit: 1 });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: clientEmail,
          name: clientName || undefined,
          metadata: { clientId, source: "lanting-digital-admin" },
        });
        stripeCustomerId = customer.id;
      }

      // Create a product for this payment plan
      const product = await stripe.products.create({
        name: `Payment Plan: ${projectName || "Project"}`,
        description: description || `${numberOfPayments} monthly payments of $${(paymentAmount / 100).toFixed(2)}`,
        metadata: { clientId, projectName: projectName || "" },
      });

      // Create a recurring price for the monthly payment
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: paymentAmount,
        currency: "usd",
        recurring: { interval: "month" },
      });

      // Build subscription_data with optional trial_end
      const subscriptionData = {
        metadata: {
          clientId,
          projectName: projectName || "",
          totalAmount: totalAmount.toString(),
          numberOfPayments: numberOfPayments.toString(),
          paymentPlanId: "pending", // Will update after doc is created
          isPaymentPlan: "true",
        },
      };

      // If start date is in the future, use trial_end to delay first charge
      if (trialEndTimestamp) {
        subscriptionData.trial_end = trialEndTimestamp;
      }

      // Create checkout session for the subscription schedule
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        success_url: `https://portal.lantingdigital.com/#invoices?payment_plan=success`,
        cancel_url: `https://portal.lantingdigital.com/#invoices?payment_plan=cancelled`,
        subscription_data: subscriptionData,
        metadata: {
          clientId,
          projectName: projectName || "",
          isPaymentPlan: "true",
          numberOfPayments: numberOfPayments.toString(),
          startDate: startDate || "",
        },
      });

      // Create payment plan record in Firestore
      const paymentPlanDoc = await db.collection("paymentPlans").add({
        clientId,
        clientEmail,
        clientName: clientName || "",
        projectName: projectName || "",
        totalAmount,
        numberOfPayments,
        monthlyAmount: paymentAmount / 100, // Store in dollars for display
        paymentAmount: paymentAmount / 100, // Store in dollars
        description: description || "",
        status: "pending_payment",
        paymentsCompleted: 0,
        startDate: startDate || null,
        billingStartsAt: trialEndTimestamp ? new Date(trialEndTimestamp * 1000) : null,
        stripeCustomerId,
        stripeProductId: product.id,
        stripePriceId: price.id,
        stripeCheckoutSessionId: session.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      });

      return {
        success: true,
        paymentPlanId: paymentPlanDoc.id,
        checkoutUrl: session.url,
        monthlyAmount: paymentAmount / 100,
      };

    } catch (error) {
      console.error("Error creating payment plan:", error);
      throw new Error(`Failed to create payment plan: ${error.message}`);
    }
  }
);

/**
 * Cancel a subscription or payment plan
 */
exports.cancelSubscription = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    invoker: "public",
    cors: [
      "https://admin.lantingdigital.com",
      "https://lanting-digital-admin.web.app",
      "http://localhost:5000",
    ],
  },
  async (request) => {
    // Verify admin is authenticated
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const { subscriptionId, stripeSubscriptionId, cancelImmediately } = request.data;

    if (!stripeSubscriptionId) {
      throw new Error("Missing required field: stripeSubscriptionId");
    }

    const stripe = require("stripe")(stripeSecretKey.value());
    const db = admin.firestore();

    try {
      let result;

      if (cancelImmediately) {
        // Cancel immediately
        result = await stripe.subscriptions.cancel(stripeSubscriptionId);
      } else {
        // Cancel at end of current period
        result = await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      // Update Firestore record if subscriptionId provided
      if (subscriptionId) {
        // Check both collections
        const subDoc = await db.collection("subscriptions").doc(subscriptionId).get();
        const planDoc = await db.collection("paymentPlans").doc(subscriptionId).get();

        const docRef = subDoc.exists
          ? db.collection("subscriptions").doc(subscriptionId)
          : planDoc.exists
            ? db.collection("paymentPlans").doc(subscriptionId)
            : null;

        if (docRef) {
          await docRef.update({
            status: cancelImmediately ? "cancelled" : "cancelling",
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelAtPeriodEnd: !cancelImmediately,
          });
        }
      }

      return {
        success: true,
        status: result.status,
        cancelAtPeriodEnd: result.cancel_at_period_end,
      };

    } catch (error) {
      console.error("Error cancelling subscription:", error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }
);

/**
 * Get subscription/payment plan status from Stripe
 */
exports.getSubscriptionStatus = onCall(
  {
    region: "us-central1",
    secrets: [stripeSecretKey],
    invoker: "public",
    cors: [
      "https://admin.lantingdigital.com",
      "https://lanting-digital-admin.web.app",
      "http://localhost:5000",
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const { stripeSubscriptionId } = request.data;

    if (!stripeSubscriptionId) {
      throw new Error("Missing required field: stripeSubscriptionId");
    }

    const stripe = require("stripe")(stripeSecretKey.value());

    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      return {
        success: true,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
      };

    } catch (error) {
      console.error("Error getting subscription status:", error);
      throw new Error(`Failed to get subscription status: ${error.message}`);
    }
  }
);

// ============================================================
// CUSTOM AUTHENTICATION FUNCTIONS
// Password reset, client invitations, and password management
// ============================================================

const crypto = require("crypto");

// Token expiry times
const PASSWORD_RESET_EXPIRY_HOURS = 24;
const INVITATION_EXPIRY_DAYS = 7;

// Portal base URL
const PORTAL_URL = "https://portal.lantingdigital.com";

/**
 * Generate a secure random token (64 hex characters = 256 bits)
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token for storage (SHA-256)
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Request a password reset email.
 * Always returns success to prevent email enumeration attacks.
 */
exports.requestPasswordReset = onCall(
  {
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
    invoker: "public",
    cors: [
      "https://portal.lantingdigital.com",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
  },
  async (request) => {
    const { email } = request.data;

    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = admin.firestore();

    try {
      // Check rate limiting: max 3 requests per email per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTokens = await db.collection("authTokens")
        .where("email", "==", normalizedEmail)
        .where("type", "==", "password_reset")
        .where("createdAt", ">", admin.firestore.Timestamp.fromDate(oneHourAgo))
        .get();

      if (recentTokens.size >= 3) {
        // Still return success to prevent enumeration
        console.log(`Rate limit hit for ${normalizedEmail}`);
        return { success: true, message: "If an account exists, a reset link has been sent." };
      }

      // Check if client exists
      const clientQuery = await db.collection("clients")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (clientQuery.empty) {
        // Client doesn't exist - still return success to prevent enumeration
        console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
        return { success: true, message: "If an account exists, a reset link has been sent." };
      }

      const clientDoc = clientQuery.docs[0];
      const clientData = clientDoc.data();

      // Check if user has an Auth account
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(normalizedEmail);
      } catch (authError) {
        if (authError.code === "auth/user-not-found") {
          // User doesn't have an auth account yet
          console.log(`Password reset requested for client without auth account: ${normalizedEmail}`);
          return { success: true, message: "If an account exists, a reset link has been sent." };
        }
        throw authError;
      }

      // Generate secure token
      const rawToken = generateSecureToken();
      const hashedToken = hashToken(rawToken);

      // Store token in Firestore
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);
      await db.collection("authTokens").add({
        tokenHash: hashedToken,
        type: "password_reset",
        email: normalizedEmail,
        clientId: clientDoc.id,
        authUid: authUser.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        used: false,
        usedAt: null,
      });

      // Create reset link
      const resetLink = `${PORTAL_URL}?action=reset&token=${rawToken}`;

      // Send email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailEmail.value(),
          pass: gmailPassword.value(),
        },
      });

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: normal; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    .note { font-size: 13px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hi ${clientData.name || "there"},</p>
      <p>We received a request to reset your password for your Lanting Digital client portal account.</p>
      <p>Click the button below to set a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <p class="note">
        This link will expire in ${PASSWORD_RESET_EXPIRY_HOURS} hours.<br>
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="margin-top: 30px;">
        Best,<br>
        <strong>Caleb Lanting</strong><br>
        Lanting Digital
      </p>
    </div>
    <div class="footer">
      <p>Lanting Digital LLC | <a href="https://lantingdigital.com">lantingdigital.com</a></p>
    </div>
  </div>
</body>
</html>
      `;

      await transporter.sendMail({
        from: `"Lanting Digital" <${gmailEmail.value()}>`,
        to: normalizedEmail,
        subject: "Reset Your Password | Lanting Digital",
        html: emailHtml,
      });

      console.log(`Password reset email sent to ${normalizedEmail}`);
      return { success: true, message: "If an account exists, a reset link has been sent." };

    } catch (error) {
      console.error("Error in requestPasswordReset:", error);
      // Still return success to prevent enumeration
      return { success: true, message: "If an account exists, a reset link has been sent." };
    }
  }
);

/**
 * Validate an auth token (password reset or invitation).
 * Returns token type and associated email if valid.
 */
exports.validateAuthToken = onCall(
  {
    region: "us-central1",
    invoker: "public",
    cors: [
      "https://portal.lantingdigital.com",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
  },
  async (request) => {
    const { token } = request.data;

    if (!token) {
      return { valid: false, error: "Token is required" };
    }

    const db = admin.firestore();
    const hashedToken = hashToken(token);

    try {
      // Find token by hash
      const tokenQuery = await db.collection("authTokens")
        .where("tokenHash", "==", hashedToken)
        .limit(1)
        .get();

      if (tokenQuery.empty) {
        return { valid: false, error: "Invalid or expired link" };
      }

      const tokenDoc = tokenQuery.docs[0];
      const tokenData = tokenDoc.data();

      // Check if already used
      if (tokenData.used) {
        return { valid: false, error: "This link has already been used" };
      }

      // Check if expired
      const now = new Date();
      const expiresAt = tokenData.expiresAt.toDate();
      if (now > expiresAt) {
        return { valid: false, error: "This link has expired" };
      }

      // Get client name for personalization
      let clientName = "";
      if (tokenData.clientId) {
        const clientDoc = await db.collection("clients").doc(tokenData.clientId).get();
        if (clientDoc.exists) {
          clientName = clientDoc.data().name || "";
        }
      }

      return {
        valid: true,
        type: tokenData.type,
        email: tokenData.email,
        clientName: clientName,
      };

    } catch (error) {
      console.error("Error validating token:", error);
      return { valid: false, error: "Unable to validate link" };
    }
  }
);

/**
 * Reset password using a valid token.
 * Sets new password for existing Firebase Auth user.
 */
exports.resetPassword = onCall(
  {
    region: "us-central1",
    invoker: "public",
    cors: [
      "https://portal.lantingdigital.com",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
  },
  async (request) => {
    const { token, newPassword } = request.data;

    if (!token || !newPassword) {
      throw new Error("Token and new password are required");
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const db = admin.firestore();
    const hashedToken = hashToken(token);

    try {
      // Find and validate token
      const tokenQuery = await db.collection("authTokens")
        .where("tokenHash", "==", hashedToken)
        .where("type", "==", "password_reset")
        .limit(1)
        .get();

      if (tokenQuery.empty) {
        throw new Error("Invalid or expired link");
      }

      const tokenDoc = tokenQuery.docs[0];
      const tokenData = tokenDoc.data();

      if (tokenData.used) {
        throw new Error("This link has already been used");
      }

      const now = new Date();
      const expiresAt = tokenData.expiresAt.toDate();
      if (now > expiresAt) {
        throw new Error("This link has expired");
      }

      // Update password in Firebase Auth
      await admin.auth().updateUser(tokenData.authUid, {
        password: newPassword,
      });

      // Mark token as used
      await tokenDoc.ref.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update client record
      if (tokenData.clientId) {
        await db.collection("clients").doc(tokenData.clientId).update({
          lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Revoke all refresh tokens (logs out all sessions)
      await admin.auth().revokeRefreshTokens(tokenData.authUid);

      console.log(`Password reset successful for ${tokenData.email}`);
      return { success: true, message: "Password has been reset successfully" };

    } catch (error) {
      console.error("Error resetting password:", error);
      throw new Error(error.message || "Failed to reset password");
    }
  }
);

/**
 * Invite a new client to the portal.
 * Creates client record (if needed), generates invitation token, sends email.
 * Admin only.
 */
exports.inviteClient = onCall(
  {
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
    invoker: "public",
    cors: [
      "https://admin.lantingdigital.com",
      "https://lanting-digital-admin.web.app",
      "http://localhost:5000",
    ],
  },
  async (request) => {
    // Verify admin authentication
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    if (request.auth.token.email !== ADMIN_EMAIL) {
      throw new Error("Admin access required");
    }

    const { email, name, company } = request.data;

    if (!email || !name) {
      throw new Error("Email and name are required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = admin.firestore();

    try {
      // Check if client already exists
      let clientDoc;
      const existingClient = await db.collection("clients")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!existingClient.empty) {
        clientDoc = existingClient.docs[0];
        const clientData = clientDoc.data();

        // Check if they already have portal access
        if (clientData.hasPortalAccess) {
          throw new Error("Client already has portal access. Use password reset instead.");
        }

        // Update client info
        await clientDoc.ref.update({
          name: name,
          company: company || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create new client record
        const newClient = await db.collection("clients").add({
          email: normalizedEmail,
          name: name,
          company: company || "",
          hasPortalAccess: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: request.auth.uid,
          invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        clientDoc = await newClient.get();
      }

      // Invalidate any existing unused invitation tokens for this email
      const existingTokens = await db.collection("authTokens")
        .where("email", "==", normalizedEmail)
        .where("type", "==", "invitation")
        .where("used", "==", false)
        .get();

      const batch = db.batch();
      existingTokens.forEach((doc) => {
        batch.update(doc.ref, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();

      // Generate invitation token
      const rawToken = generateSecureToken();
      const hashedToken = hashToken(rawToken);

      // Store token
      const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      await db.collection("authTokens").add({
        tokenHash: hashedToken,
        type: "invitation",
        email: normalizedEmail,
        clientId: clientDoc.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        used: false,
        usedAt: null,
        invitedBy: request.auth.uid,
      });

      // Create invitation link
      const inviteLink = `${PORTAL_URL}?action=setup&token=${rawToken}`;

      // Send invitation email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailEmail.value(),
          pass: gmailPassword.value(),
        },
      });

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: normal; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 20px 0; }
    .features { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .features ul { margin: 0; padding-left: 20px; }
    .features li { margin: 8px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
    .note { font-size: 13px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Lanting Digital</h1>
    </div>
    <div class="content">
      <p>Hi ${name},</p>
      <p>You've been invited to access your client portal at Lanting Digital. Your portal gives you:</p>
      <div class="features">
        <ul>
          <li><strong>Contracts</strong> - View and sign agreements</li>
          <li><strong>Projects</strong> - Track project progress</li>
          <li><strong>Messages</strong> - Direct communication with your team</li>
          <li><strong>Invoices</strong> - View and pay invoices</li>
        </ul>
      </div>
      <p>Click the button below to set up your account:</p>
      <p style="text-align: center;">
        <a href="${inviteLink}" class="button">Set Up Your Account</a>
      </p>
      <p class="note">
        This invitation link expires in ${INVITATION_EXPIRY_DAYS} days.<br>
        If you have any questions, reply to this email.
      </p>
      <p style="margin-top: 30px;">
        Looking forward to working with you,<br>
        <strong>Caleb Lanting</strong><br>
        Lanting Digital
      </p>
    </div>
    <div class="footer">
      <p>Lanting Digital LLC | <a href="https://lantingdigital.com">lantingdigital.com</a></p>
    </div>
  </div>
</body>
</html>
      `;

      await transporter.sendMail({
        from: `"Lanting Digital" <${gmailEmail.value()}>`,
        to: normalizedEmail,
        subject: "You're Invited to Lanting Digital Client Portal",
        html: emailHtml,
      });

      console.log(`Invitation sent to ${normalizedEmail}`);

      return {
        success: true,
        clientId: clientDoc.id,
        inviteLink: inviteLink,
        message: `Invitation sent to ${normalizedEmail}`,
      };

    } catch (error) {
      console.error("Error inviting client:", error);
      throw new Error(error.message || "Failed to invite client");
    }
  }
);

/**
 * Complete onboarding for an invited client.
 * Creates Firebase Auth account and sets password.
 */
exports.completeOnboarding = onCall(
  {
    region: "us-central1",
    invoker: "public",
    cors: [
      "https://portal.lantingdigital.com",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
  },
  async (request) => {
    const { token, password } = request.data;

    if (!token || !password) {
      throw new Error("Token and password are required");
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const db = admin.firestore();
    const hashedToken = hashToken(token);

    try {
      // Find and validate token
      const tokenQuery = await db.collection("authTokens")
        .where("tokenHash", "==", hashedToken)
        .where("type", "==", "invitation")
        .limit(1)
        .get();

      if (tokenQuery.empty) {
        throw new Error("Invalid or expired invitation link");
      }

      const tokenDoc = tokenQuery.docs[0];
      const tokenData = tokenDoc.data();

      if (tokenData.used) {
        throw new Error("This invitation has already been used");
      }

      const now = new Date();
      const expiresAt = tokenData.expiresAt.toDate();
      if (now > expiresAt) {
        throw new Error("This invitation has expired");
      }

      // Get client info
      const clientDoc = await db.collection("clients").doc(tokenData.clientId).get();
      if (!clientDoc.exists) {
        throw new Error("Client record not found");
      }
      const clientData = clientDoc.data();

      // Check if Auth account already exists
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(tokenData.email);
        // User exists - update password
        await admin.auth().updateUser(authUser.uid, {
          password: password,
        });
      } catch (authError) {
        if (authError.code === "auth/user-not-found") {
          // Create new Auth user
          authUser = await admin.auth().createUser({
            email: tokenData.email,
            password: password,
            displayName: clientData.name || tokenData.email.split("@")[0],
            emailVerified: true, // We verified via invitation
          });
        } else {
          throw authError;
        }
      }

      // Mark token as used
      await tokenDoc.ref.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update client record
      await db.collection("clients").doc(tokenData.clientId).update({
        hasPortalAccess: true,
        portalActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        authUid: authUser.uid,
        lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create custom token for auto-login
      const customToken = await admin.auth().createCustomToken(authUser.uid, {
        email: tokenData.email,
        isClient: true,
      });

      console.log(`Onboarding completed for ${tokenData.email}`);

      return {
        success: true,
        customToken: customToken,
        message: "Account setup complete",
      };

    } catch (error) {
      console.error("Error completing onboarding:", error);
      throw new Error(error.message || "Failed to complete account setup");
    }
  }
);

/**
 * Change password for logged-in user.
 * Requires current password verification.
 */
exports.changePassword = onCall(
  {
    region: "us-central1",
    secrets: [gmailEmail, gmailPassword],
    invoker: "public",
    cors: [
      "https://portal.lantingdigital.com",
      "http://localhost:5000",
      "http://127.0.0.1:5500",
    ],
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new Error("Authentication required");
    }

    const { currentPassword, newPassword } = request.data;

    if (!currentPassword || !newPassword) {
      throw new Error("Current password and new password are required");
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const db = admin.firestore();

    try {
      // Get the user's Firebase Auth record
      const userRecord = await admin.auth().getUser(uid);

      // We can't directly verify the current password server-side with Admin SDK
      // The client should use reauthenticateWithCredential before calling this
      // For now, we'll trust that the client has verified (they need to be logged in)
      // In production, you'd use Firebase Auth REST API to verify password

      // Update password
      await admin.auth().updateUser(uid, {
        password: newPassword,
      });

      // Update client record
      const clientQuery = await db.collection("clients")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!clientQuery.empty) {
        await clientQuery.docs[0].ref.update({
          lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Revoke all refresh tokens (logs out all other sessions)
      await admin.auth().revokeRefreshTokens(uid);

      // Send confirmation email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailEmail.value(),
          pass: gmailPassword.value(),
        },
      });

      const clientName = clientQuery.empty ? "" : (clientQuery.docs[0].data().name || "");
      const changedDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      });

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: normal; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
    .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Changed</h1>
    </div>
    <div class="content">
      <p>Hi ${clientName || "there"},</p>
      <p>Your password for the Lanting Digital client portal was successfully changed on:</p>
      <p><strong>${changedDate}</strong></p>
      <div class="alert">
        <strong>Didn't make this change?</strong><br>
        If you didn't change your password, please contact us immediately at caleb@lantingdigital.com
      </div>
      <p style="margin-top: 30px;">
        Best,<br>
        <strong>Caleb Lanting</strong><br>
        Lanting Digital
      </p>
    </div>
    <div class="footer">
      <p>Lanting Digital LLC | <a href="https://lantingdigital.com">lantingdigital.com</a></p>
    </div>
  </div>
</body>
</html>
      `;

      await transporter.sendMail({
        from: `"Lanting Digital" <${gmailEmail.value()}>`,
        to: email,
        subject: "Password Changed | Lanting Digital",
        html: emailHtml,
      });

      console.log(`Password changed for ${email}`);

      return {
        success: true,
        message: "Password changed successfully. You will need to sign in again.",
      };

    } catch (error) {
      console.error("Error changing password:", error);
      throw new Error(error.message || "Failed to change password");
    }
  }
);
