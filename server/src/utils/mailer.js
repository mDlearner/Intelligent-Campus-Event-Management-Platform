const nodemailer = require("nodemailer");
const dns = require("dns").promises;
const { Resend } = require("resend");
const logger = require("./logger");

let mailer;
let resendClient;

function buildFromAddress() {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim();

  if (!smtpUser) {
    return smtpFrom;
  }

  if (!smtpFrom) {
    return smtpUser;
  }

  const namedAddressMatch = smtpFrom.match(/^(.*)<([^>]+)>$/);
  if (namedAddressMatch) {
    const displayName = namedAddressMatch[1].trim().replace(/^"|"$/g, "");
    return displayName ? `${displayName} <${smtpUser}>` : smtpUser;
  }

  return smtpUser;
}

async function resolveSmtpHost(host, family) {
  if (family !== 4) {
    return { host, tlsServername: host };
  }

  try {
    const ipv4Addresses = await dns.resolve4(host);
    if (Array.isArray(ipv4Addresses) && ipv4Addresses.length > 0) {
      return { host: ipv4Addresses[0], tlsServername: host };
    }
  } catch (error) {
    logger.warn({ err: error, host }, "Failed to resolve SMTP host to IPv4, using original host");
  }

  return { host, tlsServername: host };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const rawPass = process.env.SMTP_PASS?.trim();
  const pass = rawPass ? rawPass.replace(/\s+/g, "") : "";
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

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

function getMailer() {
  return mailer;
}

function isSmtpConfigured() {
  return Boolean(getSmtpConfig());
}

function isResendConfigured() {
  return Boolean(getResendConfig());
}

async function sendMail({ to, subject, text, html }) {
  const resendConfig = getResendConfig();
  if (resendConfig) {
    if (!resendClient) {
      resendClient = new Resend(resendConfig.apiKey);
    }

    const info = await resendClient.emails.send({
      from: resendConfig.from,
      to,
      subject,
      text,
      html
    });

    logger.info(
      {
        to,
        subject,
        provider: "resend",
        response: info
      },
      "Resend sendMail result"
    );

    if (info?.error) {
      throw new Error(info.error.message || "Email was rejected by Resend");
    }

    return info;
  }

  const config = getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured");
  }

  if (!mailer) {
    const resolved = await resolveSmtpHost(config.host, config.family);
    const transportConfig = {
      ...config,
      host: resolved.host,
      tls: {
        servername: resolved.tlsServername
      }
    };
    mailer = nodemailer.createTransport(transportConfig);
  }

  const transporter = getMailer();

  const from = buildFromAddress();
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
  isResendConfigured,
  isSmtpConfigured,
  sendMail
};
