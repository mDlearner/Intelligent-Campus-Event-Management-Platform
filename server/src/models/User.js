const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "club", "admin"], default: "student" },
    department: { type: String, trim: true },
    studentId: { type: String, trim: true },
    year: { type: String, trim: true },
    isVerified: { type: Boolean, default: true },
    verificationCode: { type: String, trim: true },
    verificationExpiresAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
