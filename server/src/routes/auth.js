const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { authRequired } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");
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
  const subject = `Verify your ${role} account`;
  const safeName = name || "there";
  const text = [
    `Hi ${safeName},`,
    "",
    `Thanks for registering as ${role}.`,
    `Use this verification code: ${verificationCode}`,
    `This code expires in ${verificationCodeTtlDays} days.`,
    "",
    "If you did not create this account, you can ignore this email.",
    "",
    "Campus Event Management"
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f8fb;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;">
          <h2 style="margin:0;font-size:20px;">Campus Event Management</h2>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.95;">Account verification</p>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px 0;font-size:15px;">Hi ${safeName},</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;">
            Thanks for registering as <strong>${role}</strong> with <strong>${email}</strong>.
            Please use the verification code below to activate your account.
          </p>
          <div style="margin:18px 0;padding:16px;border:1px dashed #14b8a6;border-radius:10px;background:#f0fdfa;text-align:center;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#0f766e;letter-spacing:0.08em;text-transform:uppercase;">Verification Code</p>
            <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#0f766e;">${verificationCode}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#4b5563;">This code expires in ${verificationCodeTtlDays} days.</p>
          <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">If you did not create this account, you can ignore this email.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function buildSecondaryVerificationEmail({ name, email, role, verificationCode }) {
  const subject = `Secondary verification for ${role} registration`;
  const safeName = name || "there";
  const text = [
    `Secondary verification requested for ${safeName} (${email})`,
    `Role: ${role}`,
    `Use this secondary verification code: ${verificationCode}`,
    `This code expires in ${verificationCodeTtlDays} days.`
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f8fb;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#7c2d12,#ea580c);color:#ffffff;">
          <h2 style="margin:0;font-size:20px;">Campus Event Management</h2>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.95;">Secondary role verification</p>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px 0;font-size:15px;">Secondary verification request for <strong>${safeName}</strong> (${email})</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;">Role: <strong>${role}</strong></p>
          <div style="margin:18px 0;padding:16px;border:1px dashed #ea580c;border-radius:10px;background:#fff7ed;text-align:center;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#c2410c;letter-spacing:0.08em;text-transform:uppercase;">Secondary Verification Code</p>
            <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#c2410c;">${verificationCode}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#4b5563;">This code expires in ${verificationCodeTtlDays} days.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

function buildEmailChangeEmail({ name, email, verificationCode }) {
  const subject = "Verify your new email address";
  const safeName = name || "there";
  const text = [
    `Hi ${safeName},`,
    "",
    `You requested to change your account email to ${email}.`,
    `Use this verification code: ${verificationCode}`,
    `This code expires in ${verificationCodeTtlDays} days.`,
    "",
    "If you did not request this, ignore this email.",
    "",
    "Campus Event Management"
  ].join("\n");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f8fb;padding:24px;color:#1f2937;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 22px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#ffffff;">
          <h2 style="margin:0;font-size:20px;">Campus Event Management</h2>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.95;">Email change verification</p>
        </div>
        <div style="padding:22px;">
          <p style="margin:0 0 12px 0;font-size:15px;">Hi ${safeName},</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.55;">
            We received a request to change your account email to <strong>${email}</strong>.
            Please verify this new email address using the code below.
          </p>
          <div style="margin:18px 0;padding:16px;border:1px dashed #3b82f6;border-radius:10px;background:#eff6ff;text-align:center;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#1d4ed8;letter-spacing:0.08em;text-transform:uppercase;">Verification Code</p>
            <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#1d4ed8;">${verificationCode}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#4b5563;">This code expires in ${verificationCodeTtlDays} days.</p>
          <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280;">If you did not request this, ignore this email.</p>
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

function dispatchRegistrationOtpEmails(user, isDualRole) {
  const verificationSentTo = String(user.email).trim().toLowerCase();
  const secondaryVerificationSentTo = isDualRole
    ? process.env.VERIFICATION_RECIPIENT?.trim().toLowerCase()
    : undefined;

  if (isDualRole && !secondaryVerificationSentTo) {
    const error = new Error("Secondary verification recipient is not configured");
    error.status = 500;
    throw error;
  }

  // Dispatch OTP emails asynchronously in background
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
        if (!isSmtpConfigured()) {
          return res.status(500).json({ message: "SMTP is not configured" });
        }

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
        const { verificationSentTo, secondaryVerificationSentTo } = dispatchRegistrationOtpEmails(
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

    if (!isSmtpConfigured()) {
      return res.status(500).json({ message: "SMTP is not configured" });
    }

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
    const { verificationSentTo, secondaryVerificationSentTo } = dispatchRegistrationOtpEmails(
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
