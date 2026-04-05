const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["registered", "cancelled"], default: "registered" },
    attendance: { type: String, enum: ["pending", "present", "absent"], default: "pending" },
    feedback: { type: String, trim: true }
  },
  { timestamps: true }
);

registrationSchema.index({ event: 1, user: 1 }, { unique: true });
registrationSchema.index({ event: 1, status: 1 });
registrationSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Registration", registrationSchema);
