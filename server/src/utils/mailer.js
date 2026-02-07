const nodemailer = require("nodemailer");

let mailer;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass }
  };
}

function getMailer() {
  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  if (!mailer) {
    mailer = nodemailer.createTransport(config);
  }

  return mailer;
}

function isSmtpConfigured() {
  return Boolean(getSmtpConfig());
}

async function sendMail({ to, subject, text }) {
  const transporter = getMailer();
  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({ from, to, subject, text });
}

module.exports = {
  isSmtpConfigured,
  sendMail
};
