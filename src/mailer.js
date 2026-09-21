const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'localhost', // Targets GoDaddy's internal relay directly
  port: 25,          
  secure: false,     
  ignoreTLS: true    // Prevents Nodemailer from forcing an SSL handshake that crashes the relay
  // The auth block has been completely removed to mimic PHPMailer
});

/**
 * Send an HTML email. Mirrors the old PHPMailer sendEmail() helper —
 * logs failures instead of letting one bad send take down a booking.
 */
async function sendEmail(to, subject, html, from = 'noreply@rousscuts.com.au', fromName = 'rousscuts') {
  // We removed the 'await' here. The email will send silently in the background
  // while the server instantly returns 'true' to finish the booking quickly.
  transporter.sendMail({
    from: fromName ? `"${fromName}" <${from}>` : from,
    to,
    subject,
    html,
  }).catch(err => {
    console.error(`Failed to send email to ${to}:`, err.message);
  });
  
  return true; 
}

module.exports = { sendEmail, transporter };