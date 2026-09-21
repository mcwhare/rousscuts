const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 25,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  }
});

/**
 * Send an HTML email. Mirrors the old PHPMailer sendEmail() helper —
 * logs failures instead of letting one bad send take down a booking.
 */
async function sendEmail(to, subject, html, from = process.env.SMTP_USER, fromName = '') {
  try {
    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    return false;
  }
}

module.exports = { sendEmail, transporter };
