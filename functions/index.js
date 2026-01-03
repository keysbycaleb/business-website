const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

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
 * Updates invoice status when payment is completed.
 */
exports.stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [stripeSecretKey, stripeWebhookSecret],
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

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Get invoice ID from metadata
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
    }

    res.status(200).json({ received: true });
  }
);
