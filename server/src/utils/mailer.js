const nodemailer = require("nodemailer");

let mailer;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const connectionTimeout = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000);
  const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000);
  const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 10000);

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout,
    greetingTimeout,
    socketTimeout
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

async function sendMail({ to, subject, text, html }) {
  const transporter = getMailer();
  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({ from, to, subject, text, html });
}

module.exports = {
  isSmtpConfigured,
  sendMail
};
