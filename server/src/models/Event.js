const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    registrationCloseDate: { type: String },
    registrationCloseTime: { type: String },
    venue: { type: String, required: true, trim: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    maxSeats: { type: Number, default: 0 },
    status: { type: String, enum: ["upcoming", "ongoing", "completed", "cancelled"], default: "upcoming" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
