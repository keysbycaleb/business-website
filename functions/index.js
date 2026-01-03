const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Define secrets
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

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
 * Sends email notification to the appropriate party.
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

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailEmail.value(),
        pass: gmailPassword.value(),
      },
    });

    const providerEmail = "caleb@lantingdigital.com";
    const messagePreview = message.content?.length > 100
      ? message.content.substring(0, 100) + "..."
      : message.content;

    const timestamp = new Date().toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Los_Angeles",
    });

    if (message.fromAdmin) {
      // Admin sent message to client - notify client
      if (!message.clientEmail) {
        console.log("No client email, skipping notification");
        return null;
      }

      const clientEmailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; }
    .message-box { background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #b45309; }
    .message-box p { margin: 0; }
    .cta { text-align: center; margin-top: 24px; }
    .button { display: inline-block; background: #b45309; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Message from Lanting Digital</h1>
    </div>
    <div class="content">
      <p>Hi ${message.clientName || "there"},</p>
      <p>You have a new message from Caleb at Lanting Digital:</p>
      <div class="message-box">
        <p>${message.content || ""}</p>
      </div>
      <p style="font-size: 12px; color: #666;">Sent: ${timestamp}</p>
      <div class="cta">
        <a href="https://lantingdigital.com/sign/portal.html#messages" class="button">View in Portal</a>
      </div>
    </div>
    <div class="footer">
      <p>Lanting Digital LLC | <a href="https://lantingdigital.com">lantingdigital.com</a></p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        await transporter.sendMail({
          from: `"Lanting Digital" <${gmailEmail.value()}>`,
          to: message.clientEmail,
          subject: "New Message from Lanting Digital",
          html: clientEmailBody,
        });
        console.log("Message notification sent to client:", message.clientEmail);
      } catch (error) {
        console.error("Error sending message notification to client:", error);
      }

    } else {
      // Client sent message to admin - notify Caleb
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

      try {
        await transporter.sendMail({
          from: `"Lanting Digital" <${gmailEmail.value()}>`,
          to: providerEmail,
          subject: `New Message from ${message.clientName || "Client"}`,
          html: providerEmailBody,
        });
        console.log("Message notification sent to provider");
      } catch (error) {
        console.error("Error sending message notification to provider:", error);
      }
    }

    return null;
  }
);
