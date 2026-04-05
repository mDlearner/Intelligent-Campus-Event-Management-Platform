const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { authRequired } = require("../middleware/auth");
const { isResendConfigured, isSmtpConfigured, sendMail } = require("../utils/mailer");
const logger = require("../utils/logger");

const router = express.Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const verificationCodeTtlDays = 7;
const emailSendTimeoutMs = Number(process.env.EMAIL_SEND_TIMEOUT_MS || 12000);
const allowedDepartments = new Set([
  "Artificial Intelligence and Machine Learning",
  "Information Technology (IT)",
  "Electronics and Communication Engineering (ECE)",
  "Civil Engineering (CE)",
  "Mechanical Engineering (ME)",
  "Electrical and Electronics Engineering (EEE)",
  "Computer Science and Engineering (CSE)"
]);

function createVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createVerificationExpiry() {
  return new Date(Date.now() + verificationCodeTtlDays * 24 * 60 * 60 * 1000);
}

function buildVerificationEmail({ name, email, role, verificationCode }) {
  const subject = `🔐 Verify Your ${role.charAt(0).toUpperCase() + role.slice(1)} Account - Campus Event Management`;
  const safeName = name || "there";
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const clientBaseUrl = (process.env.CLIENT_BASE_URL || "https://intelligent-campus-event-management-8jou.onrender.com").replace(/\/$/, "");
  const browseEventsUrl = `${clientBaseUrl}/events`;
  const text = [
    `Welcome to Campus Event Management, ${safeName}!`,
    "",
    `We're excited to have you join us as a ${role}.`,
    `Thanks for registering with ${email}.`,
    "",
    `=== YOUR VERIFICATION CODE ===`,
    `${verificationCode}`,
    `============================`,
    "",
    `Browse events: ${browseEventsUrl}`,
    "",
    "Campus Event Management Team"
  ].join("\n");

  const html = `
    <div style="font-family:'Segoe UI','-apple-system','BlinkMacSystemFont','Roboto',sans-serif;background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);padding:40px 20px;margin:0;">
      <div style="max-width:600px;margin:0 auto;">
        <!-- Header Banner -->
        <div style="background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);padding:40px 30px;border-radius:16px 16px 0 0;text-align:center;color:#ffffff;">
          <div style="font-size:48px;margin-bottom:12px;">🎓📅</div>
          <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;">Welcome to Campus Event Management</h1>
          <p style="margin:0;font-size:15px;opacity:0.95;">Verify Your ${roleLabel} Account</p>
        </div>

        <!-- Main Content -->
        <div style="background:#ffffff;padding:40px 30px;border-radius:0 0 16px 16px;">
          <!-- Greeting -->
          <p style="margin:0 0 20px 0;font-size:16px;color:#1f2937;line-height:1.6;">
            Hi <strong>${safeName}</strong>,
          </p>

          <!-- Welcome Message -->
          <div style="background:#f0fdfa;border-left:4px solid #14b8a6;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#0f766e;line-height:1.6;">
              Welcome! We're thrilled to have you join our campus community as a <strong>${roleLabel}</strong>. 
              Your account is almost ready. Complete the verification process below to unlock all features.
            </p>
          </div>

          <!-- Account Details -->
          <div style="background:#f6f8fb;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Account Details</p>
            <table style="width:100%;font-size:14px;color:#1f2937;">
              <tr>
                <td style="padding:4px 0;"><strong>Email:</strong></td>
                <td style="padding:4px 0;text-align:right;color:#0f766e;">${email}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;"><strong>Role:</strong></td>
                <td style="padding:4px 0;text-align:right;color:#0f766e;">${roleLabel}</td>
              </tr>
            </table>
          </div>

          <!-- Verification Code Block -->
          <div style="margin:28px 0;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Your Verification Code</p>
            <div style="background:linear-gradient(135deg,#f0fdfa 0%,#e0f2fe 100%);border:2px dashed #14b8a6;border-radius:12px;padding:20px;margin:0;">
              <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:0.15em;color:#0f766e;font-family:'Courier New',monospace;">${verificationCode}</p>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">Click to copy the code above</p>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:28px 0;">
            <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Ready to continue?</p>
            <a href="${browseEventsUrl}" style="display:inline-block;background:linear-gradient(135deg,#0f766e 0%,#14b8a6 100%);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;transition:opacity 0.3s ease;">Browse Events</a>
          </div>

          <!-- Footer -->
          <div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:20px;">
            <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">
              © 2024 Campus Event Management. All rights reserved.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              <a href="#" style="color:#0f766e;text-decoration:none;margin-right:12px;">Privacy Policy</a>
              <a href="#" style="color:#0f766e;text-decoration:none;margin-right:12px;">Terms of Service</a>
              <a href="#" style="color:#0f766e;text-decoration:none;">Contact Us</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function buildSecondaryVerificationEmail({ name, email, role, verificationCode }) {
  const subject = `🔐 Secondary Verification Required - ${role.charAt(0).toUpperCase() + role.slice(1)} Account`;
  const safeName = name || "there";
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const text = [
    `Secondary Verification for ${safeName}'s ${role} Account`,
    "",
    `This is a secondary verification code for account registration.`,
    `User: ${safeName} (${email})`,
    `Role: ${roleLabel}`,
    "",
    `=== SECONDARY VERIFICATION CODE ===`,
    `${verificationCode}`,
    `===================================`,
    "",
    `This code expires in ${verificationCodeTtlDays} days.`,
    "",
    `INSTRUCTIONS:`,
    `1. Share this code with ${safeName} through a secure channel`,
    `2. They will use this code as their second verification step`,
    `3. This completes the registration process for the ${role} role`,
    "",
    `Campus Event Management Team`
  ].join("\n");

  const html = `
    <div style="font-family:'Segoe UI','-apple-system','BlinkMacSystemFont','Roboto',sans-serif;background:linear-gradient(135deg,#7c2d12 0%,#ea580c 100%);padding:40px 20px;margin:0;">
      <div style="max-width:600px;margin:0 auto;">
        <!-- Header Banner -->
        <div style="background:linear-gradient(135deg,#7c2d12 0%,#ea580c 100%);padding:40px 30px;border-radius:16px 16px 0 0;text-align:center;color:#ffffff;">
          <div style="font-size:48px;margin-bottom:12px;">🔐✅</div>
          <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;">Secondary Verification</h1>
          <p style="margin:0;font-size:15px;opacity:0.95;">Additional Security Step for ${roleLabel} Account</p>
        </div>

        <!-- Main Content -->
        <div style="background:#ffffff;padding:40px 30px;border-radius:0 0 16px 16px;">
          <!-- Important Notice -->
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">
              ⚠️ This is a restricted email verification — forward and share appropriately
            </p>
          </div>

          <!-- Greeting -->
          <p style="margin:0 0 20px 0;font-size:16px;color:#1f2937;line-height:1.6;">
            Secondary verification requested for <strong>${safeName}</strong>
          </p>

          <!-- Account Details -->
          <div style="background:#f6f8fb;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Registration Details</p>
            <table style="width:100%;font-size:14px;color:#1f2937;">
              <tr>
                <td style="padding:6px 0;"><strong>User Name:</strong></td>
                <td style="padding:6px 0;text-align:right;color:#7c2d12;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;"><strong>Email Address:</strong></td>
                <td style="padding:6px 0;text-align:right;color:#7c2d12;">${email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;"><strong>Account Role:</strong></td>
                <td style="padding:6px 0;text-align:right;color:#7c2d12;font-weight:600;">${roleLabel}</td>
              </tr>
            </table>
          </div>

          <!-- Secondary Verification Code -->
          <div style="margin:28px 0;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Secondary Verification Code</p>
            <div style="background:linear-gradient(135deg,#fff7ed 0%,#fed7aa 100%);border:2px dashed #ea580c;border-radius:12px;padding:20px;margin:0;">
              <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:0.15em;color:#7c2d12;font-family:'Courier New',monospace;">${verificationCode}</p>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">Click to copy the code above</p>
          </div>

          <!-- Instructions -->
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">What to do next</p>
            <ol style="margin:0;padding-left:20px;color:#1f2937;font-size:14px;line-height:1.8;">
              <li>Share this code with <strong>${safeName}</strong> securely</li>
              <li>They will enter this code on the verification page</li>
              <li>Their account will be fully activated</li>
              <li>They can start using Campus Event Management</li>
            </ol>
          </div>

          <!-- Security Information -->
          <div style="background:#f5f3ff;border-left:4px solid #8b5cf6;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#6d28d9;text-transform:uppercase;letter-spacing:0.05em;">🔒 Security Notes</p>
            <ul style="margin:0;padding-left:20px;color:#4c1d95;font-size:13px;line-height:1.8;">
              <li>This code is unique and valid for ${verificationCodeTtlDays} days only</li>
              <li>For ${role} accounts, only share with the authorized person</li>
              <li>Each code can be used once for verification</li>
              <li>If code expires, request a new one from the registration page</li>
            </ul>
          </div>

          <!-- Divider -->
          <div style="height:1px;background:#e5e7eb;margin:28px 0;"></div>

          <!-- Support Section -->
          <div style="background:#f9fafb;padding:16px;border-radius:8px;">
            <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#1f2937;">Questions or Concerns?</p>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              Contact our support team at 
              <a href="mailto:support@campusevent.com" style="color:#7c2d12;text-decoration:none;font-weight:600;">support@campusevent.com</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:20px;margin-top:20px;">
            <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">
              © 2024 Campus Event Management. All rights reserved.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              <a href="#" style="color:#7c2d12;text-decoration:none;margin-right:12px;">Privacy Policy</a>
              <a href="#" style="color:#7c2d12;text-decoration:none;margin-right:12px;">Terms of Service</a>
              <a href="#" style="color:#7c2d12;text-decoration:none;">Contact Us</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function buildEmailChangeEmail({ name, email, verificationCode }) {
  const subject = `🔐 Verify Your New Email Address - Campus Event Management`;
  const safeName = name || "there";
  const text = [
    `Hi ${safeName},`,
    "",
    `Email Change Request for Your Campus Event Management Account`,
    "",
    `You have requested to change your account email to: ${email}`,
    "",
    `=== EMAIL VERIFICATION CODE ===`,
    `${verificationCode}`,
    `===============================`,
    "",
    `HOW TO VERIFY:`,
    `1. Go to account settings in Campus Event Management`,
    `2. Find the "Change Email" section`,
    `3. Enter the verification code above`,
    `4. Click "Confirm Email Change"`,
    "",
    `Valid for ${verificationCodeTtlDays} days.`,
    "",
    `Why did you receive this? We send this email when someone requests to change the email associated with an account.`,
    "",
    `If you did not request this change, please ignore this email or contact support immediately.`,
    "",
    "Campus Event Management Team"
  ].join("\n");

  const html = `
    <div style="font-family:'Segoe UI','-apple-system','BlinkMacSystemFont','Roboto',sans-serif;background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:40px 20px;margin:0;">
      <div style="max-width:600px;margin:0 auto;">
        <!-- Header Banner -->
        <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:40px 30px;border-radius:16px 16px 0 0;text-align:center;color:#ffffff;">
          <div style="font-size:48px;margin-bottom:12px;">✉️🔄</div>
          <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;">Email Verification</h1>
          <p style="margin:0;font-size:15px;opacity:0.95;">Confirm your new email address</p>
        </div>

        <!-- Main Content -->
        <div style="background:#ffffff;padding:40px 30px;border-radius:0 0 16px 16px;">
          <!-- Alert Box -->
          <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">
              ℹ️ You have requested to change the email address on your account
            </p>
          </div>

          <!-- Greeting -->
          <p style="margin:0 0 20px 0;font-size:16px;color:#1f2937;line-height:1.6;">
            Hi <strong>${safeName}</strong>,
          </p>

          <!-- Change Summary -->
          <div style="background:#f6f8fb;padding:20px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Email Change Details</p>
            <div style="border-top:1px solid #e5e7eb;padding-top:12px;">
              <p style="margin:8px 0;font-size:14px;color:#1f2937;">
                <strong>New Email Address:</strong><br>
                <span style="color:#1d4ed8;font-weight:600;">${email}</span>
              </p>
              <p style="margin:8px 0;font-size:13px;color:#6b7280;">
                Once verified, we'll send all future communications to this address.
              </p>
            </div>
          </div>

          <!-- Verification Code -->
          <div style="margin:28px 0;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Verification Code</p>
            <div style="background:linear-gradient(135deg,#eff6ff 0%,#e0f2fe 100%);border:2px dashed #3b82f6;border-radius:12px;padding:20px;margin:0;">
              <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:0.15em;color:#1d4ed8;font-family:'Courier New',monospace;">${verificationCode}</p>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">Click to copy the code above</p>
          </div>

          <!-- Instructions -->
          <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Verification Steps</p>
            <ol style="margin:0;padding-left:20px;color:#1f2937;font-size:14px;line-height:1.8;">
              <li>Open your Campus Event Management account settings</li>
              <li>Go to "Account & Security" section</li>
              <li>Find "Change Email Address" option</li>
              <li>Paste the code above in the verification field</li>
              <li>Click "Confirm Email Change" to complete</li>
            </ol>
          </div>

          <!-- Safety Notice -->
          <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;margin-bottom:24px;">
            <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#991b1b;text-transform:uppercase;letter-spacing:0.05em;">🛡️ Important Security Notice</p>
            <ul style="margin:0;padding-left:20px;color:#7f1d1d;font-size:13px;line-height:1.8;">
              <li><strong>Code Validity:</strong> This code expires in ${verificationCodeTtlDays} days</li>
              <li><strong>One-time Use:</strong> The code can only be used once</li>
              <li><strong>Confidentiality:</strong> Never share this code with anyone</li>
              <li><strong>Didn't Request?:</strong> If you didn't initiate this change, secure your account immediately</li>
            </ul>
          </div>

          <!-- Why Received Section -->
          <div style="background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:20px;border:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
              <strong>Why did you receive this email?</strong><br>
              We send this email whenever someone requests to change the email address associated with a Campus Event Management account. If this wasn't you, please secure your account right away.
            </p>
          </div>

          <!-- Divider -->
          <div style="height:1px;background:#e5e7eb;margin:28px 0;"></div>

          <!-- Support -->
          <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px;">
            <p style="margin:0 0 10px 0;font-size:13px;font-weight:600;color:#1f2937;">Need Assistance?</p>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              If you have any questions or need help, contact our support team:<br>
              <a href="mailto:support@campusevent.com" style="color:#1d4ed8;text-decoration:none;font-weight:600;">support@campusevent.com</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align:center;border-top:1px solid #e5e7eb;padding-top:20px;">
            <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">
              © 2024 Campus Event Management. All rights reserved.
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              <a href="#" style="color:#1d4ed8;text-decoration:none;margin-right:12px;">Privacy Policy</a>
              <a href="#" style="color:#1d4ed8;text-decoration:none;margin-right:12px;">Terms of Service</a>
              <a href="#" style="color:#1d4ed8;text-decoration:none;">Contact Us</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

async function sendVerificationEmail(user) {
  const emailPayload = buildVerificationEmail({
    name: user.name,
    email: user.email,
    role: user.role,
    verificationCode: user.verificationCode
  });

  await sendMail({
    to: String(user.email).trim().toLowerCase(),
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html
  });

  return String(user.email).trim().toLowerCase();
}

async function sendSecondaryVerificationEmail(user) {
  const verificationRecipient = process.env.VERIFICATION_RECIPIENT?.trim().toLowerCase();
  if (!verificationRecipient) {
    const error = new Error("Secondary verification recipient is not configured");
    error.status = 500;
    throw error;
  }

  const emailPayload = buildSecondaryVerificationEmail({
    name: user.name,
    email: user.email,
    role: user.role,
    verificationCode: user.secondaryVerificationCode
  });

  await sendMail({
    to: verificationRecipient,
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html
  });

  return verificationRecipient;
}

async function sendWithTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const error = new Error(timeoutMessage);
      error.status = 504;
      setTimeout(() => reject(error), timeoutMs);
    })
  ]);
}

async function sendPendingEmailVerification({ name, pendingEmail, code }) {
  const emailPayload = buildEmailChangeEmail({
    name,
    email: pendingEmail,
    verificationCode: code
  });

  await sendMail({
    to: pendingEmail,
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html
  });

  return pendingEmail;
}

async function sendRegistrationOtpEmails(user, isDualRole) {
  const secondaryVerificationSentTo = isDualRole
    ? process.env.VERIFICATION_RECIPIENT?.trim().toLowerCase()
    : undefined;

  if (isDualRole && !secondaryVerificationSentTo) {
    const error = new Error("Secondary verification recipient is not configured");
    error.status = 500;
    throw error;
  }

  const verificationSentTo = String(user.email).trim().toLowerCase();

  const primaryPromise = sendWithTimeout(
    sendVerificationEmail(user),
    emailSendTimeoutMs,
    "Verification email timed out. Please try again."
  );

  if (!isDualRole) {
    await primaryPromise;
    return { verificationSentTo };
  }

  const secondaryPromise = sendWithTimeout(
    sendSecondaryVerificationEmail(user),
    emailSendTimeoutMs,
    "Secondary verification email timed out. Please try again."
  );

  await Promise.all([
    primaryPromise,
    secondaryPromise
  ]);

  return { verificationSentTo, secondaryVerificationSentTo };
}

function shouldDispatchOtpInBackground() {
  if (typeof process.env.OTP_BACKGROUND_DISPATCH === "string") {
    return process.env.OTP_BACKGROUND_DISPATCH !== "false";
  }

  return true;
}

async function dispatchRegistrationOtpEmails(user, isDualRole) {
  const verificationSentTo = String(user.email).trim().toLowerCase();
  const secondaryVerificationSentTo = isDualRole
    ? process.env.VERIFICATION_RECIPIENT?.trim().toLowerCase()
    : undefined;

  if (isDualRole && !secondaryVerificationSentTo) {
    const error = new Error("Secondary verification recipient is not configured");
    error.status = 500;
    throw error;
  }

  if (!shouldDispatchOtpInBackground()) {
    logger.info({ email: user.email, role: user.role, isDualRole }, "Sending registration OTP synchronously");
    return sendRegistrationOtpEmails(user, isDualRole);
  }

  process.nextTick(async () => {
    try {
      logger.info({ email: user.email, role: user.role, isDualRole }, "Starting background OTP dispatch");
      const result = await sendRegistrationOtpEmails(user, isDualRole);
      logger.info({ email: user.email, role: user.role, result }, "Background OTP dispatch completed successfully");
    } catch (error) {
      logger.error(
        { err: error.message, stack: error.stack, email: user.email, role: user.role, isDualRole },
        "Background registration OTP dispatch failed"
      );
    }
  });

  return { verificationSentTo, secondaryVerificationSentTo };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later" }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" }
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, role, department, studentId, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRole = role || "student";
    const normalizedStudentId = studentId ? String(studentId).trim().toUpperCase() : undefined;
    const normalizedYear = year ? String(year).trim() : undefined;

    if (!department || !allowedDepartments.has(department)) {
      return res.status(400).json({ message: "Please select a valid department" });
    }

    if (!isResendConfigured() && !isSmtpConfigured()) {
      return res.status(500).json({ message: "Email service is not configured" });
    }

    if (normalizedRole === "student" && (!normalizedStudentId || !normalizedYear)) {
      return res.status(400).json({
        message: "Student registration requires department, student ID, and year"
      });
    }

    if (normalizedStudentId) {
      const studentIdOwner = await User.findOne({
        studentId: normalizedStudentId,
        email: { $ne: normalizedEmail }
      });

      if (studentIdOwner) {
        return res.status(409).json({ message: "Student ID already registered" });
      }
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (!existing.isVerified) {
        existing.name = name;
        existing.passwordHash = await bcrypt.hash(password, 10);
        existing.role = normalizedRole;
        existing.department = department;
        existing.studentId = normalizedStudentId;
        existing.year = normalizedYear;
        existing.verificationCode = createVerificationCode();
        existing.verificationExpiresAt = createVerificationExpiry();
        existing.primaryOtpVerified = false;
        if (normalizedRole === "club" || normalizedRole === "admin") {
          existing.secondaryVerificationCode = createVerificationCode();
          existing.secondaryVerificationExpiresAt = createVerificationExpiry();
        } else {
          existing.secondaryVerificationCode = undefined;
          existing.secondaryVerificationExpiresAt = undefined;
        }
        await existing.save();
        const isDualRole = normalizedRole === "club" || normalizedRole === "admin";
        const { verificationSentTo, secondaryVerificationSentTo } = await dispatchRegistrationOtpEmails(
          existing,
          isDualRole
        );

        return res.status(202).json({
          verificationRequired: true,
          email: existing.email,
          verificationStage: "primary",
          verificationSentTo,
          secondaryVerificationSentTo
        });
      }

      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole,
      department,
      studentId: normalizedStudentId,
      year: normalizedYear,
      isVerified: false,
      verificationCode: createVerificationCode(),
      verificationExpiresAt: createVerificationExpiry(),
      primaryOtpVerified: false,
      secondaryVerificationCode:
        normalizedRole === "club" || normalizedRole === "admin" ? createVerificationCode() : undefined,
      secondaryVerificationExpiresAt:
        normalizedRole === "club" || normalizedRole === "admin" ? createVerificationExpiry() : undefined
    });

    const isDualRole = normalizedRole === "club" || normalizedRole === "admin";
    const { verificationSentTo, secondaryVerificationSentTo } = await dispatchRegistrationOtpEmails(
      user,
      isDualRole
    );

    return res.status(202).json({
      verificationRequired: true,
      email: user.email,
      verificationStage: "primary",
      verificationSentTo,
      secondaryVerificationSentTo
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Account pending verification" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "",
        studentId: user.studentId || "",
        year: user.year || ""
      },
      tokenExpiresIn: jwtExpiresIn
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/verify", authLimiter, async (req, res, next) => {
  try {
    const { email, code, stage } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Missing email or verification code" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);

    if (normalizedCode.length !== 6) {
      return res.status(400).json({ message: "Verification code must be 6 digits" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(409).json({ message: "Account already verified" });
    }

    const requiresSecondary = user.role === "club" || user.role === "admin";
    const requestedStage = stage === "secondary" ? "secondary" : "primary";

    if (!requiresSecondary || requestedStage === "primary") {
      if (!user.verificationCode || !user.verificationExpiresAt) {
        return res.status(400).json({ message: "Verification code not found" });
      }

      if (new Date() > user.verificationExpiresAt) {
        return res.status(410).json({ message: "Verification code expired" });
      }

      const storedCode = String(user.verificationCode || "").replace(/\D/g, "");
      if (storedCode !== normalizedCode) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      if (requiresSecondary) {
        user.primaryOtpVerified = true;
        user.verificationCode = undefined;
        user.verificationExpiresAt = undefined;
        await user.save();

        return res.status(202).json({
          secondaryVerificationRequired: true,
          verificationStage: "secondary",
          message: "Primary OTP verified. Enter secondary OTP sent to verification inbox."
        });
      }
    }

    if (requiresSecondary) {
      if (!user.primaryOtpVerified) {
        return res.status(400).json({ message: "Primary verification must be completed first" });
      }

      if (!user.secondaryVerificationCode || !user.secondaryVerificationExpiresAt) {
        return res.status(400).json({ message: "Secondary verification code not found" });
      }

      if (new Date() > user.secondaryVerificationExpiresAt) {
        return res.status(410).json({ message: "Secondary verification code expired" });
      }

      const secondaryStoredCode = String(user.secondaryVerificationCode || "").replace(/\D/g, "");
      if (secondaryStoredCode !== normalizedCode) {
        return res.status(401).json({ message: "Invalid secondary verification code" });
      }
    }

    user.isVerified = true;
    user.primaryOtpVerified = false;
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    user.secondaryVerificationCode = undefined;
    user.secondaryVerificationExpiresAt = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "",
        studentId: user.studentId || "",
        year: user.year || ""
      },
      tokenExpiresIn: jwtExpiresIn
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/resend", authLimiter, async (req, res, next) => {
  try {
    const { email, stage } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Missing email" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(409).json({ message: "Account already verified" });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({ message: "SMTP is not configured" });
    }

    const isDualRole = user.role === "club" || user.role === "admin";
    const requestedStage = stage === "secondary" ? "secondary" : "primary";

    if (isDualRole && requestedStage === "secondary" && user.primaryOtpVerified) {
      user.secondaryVerificationCode = createVerificationCode();
      user.secondaryVerificationExpiresAt = createVerificationExpiry();
      await user.save();

      const secondaryVerificationSentTo = await sendWithTimeout(
        sendSecondaryVerificationEmail(user),
        emailSendTimeoutMs,
        "Secondary verification email timed out. Please try again."
      );

      return res.json({
        message: "Secondary verification code resent",
        verificationStage: "secondary",
        secondaryVerificationSentTo
      });
    }

    user.verificationCode = createVerificationCode();
    user.verificationExpiresAt = createVerificationExpiry();
    user.primaryOtpVerified = false;
    if (isDualRole) {
      user.secondaryVerificationCode = createVerificationCode();
      user.secondaryVerificationExpiresAt = createVerificationExpiry();
    }
    await user.save();

    const { verificationSentTo, secondaryVerificationSentTo } = await sendRegistrationOtpEmails(
      user,
      isDualRole
    );

    return res.json({
      message: "Verification code resent",
      verificationStage: "primary",
      verificationSentTo,
      secondaryVerificationSentTo
    });
  } catch (err) {
    if (err?.code === 11000) {
      if (err?.keyPattern?.email) {
        return res.status(409).json({ message: "Email already registered" });
      }
      if (err?.keyPattern?.studentId) {
        return res.status(409).json({ message: "Student ID already registered" });
      }
    }

    return next(err);
  }
});

router.get("/profile", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      studentId: user.studentId || "",
      year: user.year || ""
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/profile", authRequired, async (req, res, next) => {
  try {
    const { name, department, studentId, year } = req.body;
    const updates = {
      name,
      department,
      studentId,
      year
    };

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      studentId: user.studentId || "",
      year: user.year || ""
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/profile/email/request", authRequired, authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Missing email" });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({ message: "SMTP is not configured" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "student") {
      return res.status(403).json({ message: "Only students can change email with OTP" });
    }

    if (user.email === normalizedEmail) {
      return res.status(409).json({ message: "New email must be different" });
    }

    const existingEmailOwner = await User.findOne({ email: normalizedEmail });
    if (existingEmailOwner && String(existingEmailOwner._id) !== String(user._id)) {
      return res.status(409).json({ message: "Email already registered" });
    }

    user.pendingEmail = normalizedEmail;
    user.pendingEmailCode = createVerificationCode();
    user.pendingEmailExpiresAt = createVerificationExpiry();
    await user.save();

    await sendWithTimeout(
      sendPendingEmailVerification({
        name: user.name,
        pendingEmail: user.pendingEmail,
        code: user.pendingEmailCode
      }),
      emailSendTimeoutMs,
      "Verification email timed out. Please try again."
    );

    return res.json({
      message: "Verification code sent to new email",
      pendingEmail: user.pendingEmail
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/profile/email/verify", authRequired, authLimiter, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Missing verification code" });
    }

    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) {
      return res.status(400).json({ message: "Verification code must be 6 digits" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "student") {
      return res.status(403).json({ message: "Only students can change email with OTP" });
    }

    if (!user.pendingEmail || !user.pendingEmailCode || !user.pendingEmailExpiresAt) {
      return res.status(400).json({ message: "No pending email verification request" });
    }

    if (new Date() > user.pendingEmailExpiresAt) {
      return res.status(410).json({ message: "Verification code expired" });
    }

    const storedCode = String(user.pendingEmailCode).replace(/\D/g, "");
    if (storedCode !== normalizedCode) {
      return res.status(401).json({ message: "Invalid verification code" });
    }

    const existingEmailOwner = await User.findOne({ email: user.pendingEmail });
    if (existingEmailOwner && String(existingEmailOwner._id) !== String(user._id)) {
      return res.status(409).json({ message: "Email already registered" });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.pendingEmailCode = undefined;
    user.pendingEmailExpiresAt = undefined;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.json({
      message: "Email updated successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "",
        studentId: user.studentId || "",
        year: user.year || ""
      },
      tokenExpiresIn: jwtExpiresIn
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
