const express = require("express");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const { authRequired, requireRole } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");

const router = express.Router();

function getRegistrationCloseTime(event) {
  if (!event?.registrationCloseDate) {
    return null;
  }

  const parts = event.registrationCloseDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [year, month, day] = parts;
  const closeDate = new Date(year, month - 1, day);
  if (event.registrationCloseTime) {
    const [hours, minutes] = event.registrationCloseTime.split(":").map(Number);
    closeDate.setHours(hours || 0, minutes || 0, 0, 0);
  } else {
    closeDate.setHours(23, 59, 0, 0);
  }

  return Number.isNaN(closeDate.getTime()) ? null : closeDate;
}

function getEventStartTime(event) {
  if (!event?.date || !event?.startTime) {
    return null;
  }

  const parts = event.date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [year, month, day] = parts;
  const startDate = new Date(year, month - 1, day);
  const [hours, minutes] = event.startTime.split(":").map(Number);
  startDate.setHours(hours || 0, minutes || 0, 0, 0);

  return Number.isNaN(startDate.getTime()) ? null : startDate;
}

function isRegistrationClosed(event, registeredCount) {
  if (event.maxSeats > 0 && registeredCount >= event.maxSeats) {
    return true;
  }

  const startTime = getEventStartTime(event);
  if (startTime && new Date() >= startTime) {
    return true;
  }

  const closeDate = getRegistrationCloseTime(event);
  if (closeDate && new Date() > closeDate) {
    return true;
  }

  return false;
}

router.get("/", async (req, res, next) => {
  try {
    const events = await Event.find().sort({ date: 1, startTime: 1 }).lean();
    if (!events.length) {
      return res.json([]);
    }

    const eventIds = events.map((event) => event._id);
    const counts = await Registration.aggregate([
      { $match: { event: { $in: eventIds }, status: "registered" } },
      { $group: { _id: "$event", count: { $sum: 1 } } }
    ]);

    const countMap = counts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const enriched = events.map((event) => {
      const registeredCount = countMap[event._id.toString()] || 0;
      const seatsRemaining =
        event.maxSeats > 0 ? Math.max(event.maxSeats - registeredCount, 0) : null;
      const registrationClosed = isRegistrationClosed(event, registeredCount);

      return {
        ...event,
        registeredCount,
        seatsRemaining,
        registrationOpen: !registrationClosed
      };
    });

    return res.json(enriched);
  } catch (err) {
    return next(err);
  }
});

router.get("/registrations/me", authRequired, async (req, res, next) => {
  try {
    const registrations = await Registration.find({
      user: req.user.userId,
      status: "registered"
    })
      .populate("event")
      .sort({ createdAt: -1 });

    return res.json(registrations);
  } catch (err) {
    return next(err);
  }
});

router.post("/", authRequired, requireRole(["admin", "club"]), async (req, res, next) => {
  try {
    const payload = { ...req.body, organizer: req.user.userId };
    const event = await Event.create(payload);
    return res.status(201).json(event);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", authRequired, requireRole(["admin", "club"]), async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", authRequired, requireRole(["admin", "club"]), async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    return res.json({ message: "Event deleted" });
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/register", authRequired, requireRole(["student"]), async (req, res, next) => {
  try {
    if (!req.user?.email) {
      return res.status(400).json({ message: "User email is missing" });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const count = await Registration.countDocuments({ event: event._id, status: "registered" });
    if (isRegistrationClosed(event, count)) {
      return res.status(409).json({ message: "Registration closed" });
    }

    const registration = await Registration.create({
      event: event._id,
      user: req.user.userId
    });

    if (isSmtpConfigured()) {
      const subject = `Registration confirmed: ${event.title}`;
      const text = `You are registered for ${event.title} on ${event.date} at ${event.startTime} in ${event.venue}.`;

      sendMail({ to: req.user.email, subject, text }).catch((err) => {
        console.error("Failed to send confirmation email", err.message);
      });
    }

    return res.status(201).json(registration);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Already registered" });
    }
    return next(err);
  }
});

module.exports = router;
