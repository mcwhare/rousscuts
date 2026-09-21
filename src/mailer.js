const nodemailer = require('nodemailer');

// Use the server's native sendmail binary (exactly what PHP does)
const transporter = nodemailer.createTransport({
  sendmail: true,
  newline: 'unix',
  path: '/usr/sbin/sendmail' // This is the standard GoDaddy cPanel path
});

async function sendEmail(to, subject, html, from = 'noreply@rousscuts.au', fromName = 'Rousscuts') {
  transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    html,
  }).catch(err => {
    console.error(`Email failed to send to ${to}:`, err.message);
  });
  
  return true; 
}

module.exports = { sendEmail, transporter };