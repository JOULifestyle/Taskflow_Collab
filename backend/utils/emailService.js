const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendInviteEmail(email, listName, inviteToken, inviterName) {
  const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${inviteToken}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: `You're invited to join "${listName}"`,
    html: `
      <h2>You've been invited to collaborate!</h2>
      <p>${inviterName} has invited you to join the list "${listName}".</p>
      <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
      <p>This invitation will expire in 7 days.</p>
    `
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendInviteEmail };