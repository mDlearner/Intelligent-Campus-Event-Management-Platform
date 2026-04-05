const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { authRequired } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");

const router = express.Router();
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

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

    const existing = await User.findOne({ email });
    if (existing) {
      if ((existing.role === "club" || existing.role === "admin") && !existing.isVerified) {
        if (!isSmtpConfigured()) {
          return res.status(500).json({ message: "SMTP is not configured" });
        }

        const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
        const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        existing.verificationCode = verificationCode;
        existing.verificationExpiresAt = verificationExpiresAt;
        await existing.save();

        const subject = "Verify club/admin registration";
        const text = `Verification code for ${existing.email} (${existing.role}): ${verificationCode}`;
        await sendMail({ to: "mdgames.21128@gmail.com", subject, text });

        return res.status(202).json({
          verificationRequired: true,
          email: existing.email
        });
      }

      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (role === "club" || role === "admin") {
      if (!isSmtpConfigured()) {
        return res.status(500).json({ message: "SMTP is not configured" });
      }

      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        department,
        studentId,
        year,
        isVerified: false,
        verificationCode,
        verificationExpiresAt
      });

      const subject = "Verify club/admin registration";
      const text = `Verification code for ${user.email} (${user.role}): ${verificationCode}`;
      await sendMail({ to: "mdgames.21128@gmail.com", subject, text });

      return res.status(202).json({
        verificationRequired: true,
        email: user.email
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      department,
      studentId,
      year,
      isVerified: true
    });

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    return res.status(201).json({
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

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if ((user.role === "club" || user.role === "admin") && !user.isVerified) {
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
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Missing email or verification code" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(409).json({ message: "Account already verified" });
    }

    if (!user.verificationCode || !user.verificationExpiresAt) {
      return res.status(400).json({ message: "Verification code not found" });
    }

    if (new Date() > user.verificationExpiresAt) {
      return res.status(410).json({ message: "Verification code expired" });
    }

    if (user.verificationCode !== code) {
      return res.status(401).json({ message: "Invalid verification code" });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
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
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Missing email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(409).json({ message: "Account already verified" });
    }

    if (!isSmtpConfigured()) {
      return res.status(500).json({ message: "SMTP is not configured" });
    }

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.verificationCode = verificationCode;
    user.verificationExpiresAt = verificationExpiresAt;
    await user.save();

    const subject = "Verify club/admin registration";
    const text = `Verification code for ${user.email} (${user.role}): ${verificationCode}`;
    await sendMail({ to: "mdgames.21128@gmail.com", subject, text });

    return res.json({ message: "Verification code resent" });
  } catch (err) {
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

module.exports = router;
