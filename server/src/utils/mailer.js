const nodemailer = require("nodemailer");
const logger = require("./logger");

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
  const family = Number(process.env.SMTP_FAMILY || 4);

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    family,
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
  const info = await transporter.sendMail({ from, to, subject, text, html });

  logger.info(
    {
      to,
      subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    },
    "SMTP sendMail result"
  );

  if (Array.isArray(info.rejected) && info.rejected.length > 0) {
    throw new Error(`Email rejected by SMTP provider: ${info.rejected.join(", ")}`);
  }

  if (Array.isArray(info.accepted) && info.accepted.length === 0) {
    throw new Error("Email was not accepted by SMTP provider");
  }

  return info;
}

module.exports = {
  isSmtpConfigured,
  sendMail
};
