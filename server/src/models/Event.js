const mongoose = require("mongoose");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: {
      type: String,
      required: true,
      validate: {
        validator: (value) => DATE_REGEX.test(value),
        message: "Event date must be in YYYY-MM-DD format"
      }
    },
    endDate: {
      type: String,
      validate: {
        validator: (value) => !value || DATE_REGEX.test(value),
        message: "Event end date must be in YYYY-MM-DD format"
      }
    },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: (value) => TIME_REGEX.test(value),
        message: "Event start time must be in HH:mm format"
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: (value) => TIME_REGEX.test(value),
        message: "Event end time must be in HH:mm format"
      }
    },
    registrationCloseDate: {
      type: String,
      validate: {
        validator: (value) => !value || DATE_REGEX.test(value),
        message: "Registration close date must be in YYYY-MM-DD format"
      }
    },
    registrationCloseTime: {
      type: String,
      validate: {
        validator: (value) => !value || TIME_REGEX.test(value),
        message: "Registration close time must be in HH:mm format"
      }
    },
    venue: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    maxSeats: { type: Number, required: true, min: 1 },
    paymentType: { type: String, enum: ["free", "paid"], default: "free" },
    status: { type: String, enum: ["upcoming", "ongoing", "completed", "cancelled"], default: "upcoming" },
    categories: [
      {
        type: String,
        enum: [
          "Tech Conference",
          "Hackathon",
          "Social Impact",
          "Cultural",
          "Academic",
          "Arts",
          "Music",
          "Startup",
          "Workshop",
          "Other",
          "Innovation & Research",
          "Academic Seminar",
          "Competition"
        ]
      }
    ],
    speakers: [
      {
        name: { type: String, trim: true },
        title: { type: String, trim: true },
        bio: { type: String, trim: true },
        imageUrl: { type: String, trim: true },
        socialLinks: {
          linkedin: { type: String, trim: true },
          twitter: { type: String, trim: true },
          github: { type: String, trim: true },
          website: { type: String, trim: true }
        }
      }
    ],
    sponsors: [
      {
        name: { type: String, trim: true },
        logo: { type: String, trim: true },
        website: { type: String, trim: true }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
