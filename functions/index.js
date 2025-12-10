const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
