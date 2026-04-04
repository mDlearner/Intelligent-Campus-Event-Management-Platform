const express = require("express");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const { authRequired, requireRole } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");

const router = express.Router();
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseDateTime(dateValue, timeValue) {
  if (!DATE_REGEX.test(dateValue) || !TIME_REGEX.test(timeValue)) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatTime12h(timeValue) {
  if (!TIME_REGEX.test(timeValue || "")) {
    return timeValue || "";
  }

  const [hours24, minutes] = timeValue.split(":").map(Number);
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatTimeRange12h(startTime, endTime) {
  const start = formatTime12h(startTime);
  const end = formatTime12h(endTime);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || "";
}

function validateEventPayload(payload) {
  const errors = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const venue = typeof payload.venue === "string" ? payload.venue.trim() : "";

  if (!title) {
    errors.push("Title is required");
  }

  if (!venue) {
    errors.push("Venue is required");
  }

  if (!DATE_REGEX.test(payload.date || "")) {
    errors.push("Event date must be in YYYY-MM-DD format");
  }

  if (payload.endDate && !DATE_REGEX.test(payload.endDate)) {
    errors.push("Event end date must be in YYYY-MM-DD format");
  }

  if (!TIME_REGEX.test(payload.startTime || "")) {
    errors.push("Event start time must be in HH:mm format");
  }

  if (!TIME_REGEX.test(payload.endTime || "")) {
    errors.push("Event end time must be in HH:mm format");
  }

  const seats = Number(payload.maxSeats);
  if (!Number.isInteger(seats) || seats <= 0) {
    errors.push("Max seats must be an integer greater than 0");
  }

  if (payload.categories && Array.isArray(payload.categories) && payload.categories.length === 0) {
    errors.push("At least one category is required");
  }

  const startDateTime = parseDateTime(payload.date || "", payload.startTime || "");
  const endDateTime = parseDateTime(payload.date || "", payload.endTime || "");
  const eventDayStart = parseDateTime(payload.date || "", "00:00");

  if (eventDayStart && eventDayStart < todayStart) {
    errors.push("Event date cannot be before today");
  }

  if (payload.endDate && DATE_REGEX.test(payload.endDate) && DATE_REGEX.test(payload.date || "")) {
    const startDateOnly = parseDateTime(payload.date, "00:00");
    const endDateOnly = parseDateTime(payload.endDate, "00:00");
    if (startDateOnly && endDateOnly && endDateOnly < startDateOnly) {
      errors.push("Event end date cannot be before event date");
    }
  }

  if (startDateTime && endDateTime && endDateTime <= startDateTime) {
    errors.push("Event end time must be after start time");
  }

  const closeDate = payload.registrationCloseDate;
  const closeTime = payload.registrationCloseTime;
  if (closeTime && !closeDate) {
    errors.push("Registration close date is required when close time is provided");
  }

  if (closeDate && !DATE_REGEX.test(closeDate)) {
    errors.push("Registration close date must be in YYYY-MM-DD format");
  }

  if (closeTime && !TIME_REGEX.test(closeTime)) {
    errors.push("Registration close time must be in HH:mm format");
  }

  if (closeDate && startDateTime) {
    const closeDateTime = parseDateTime(closeDate, closeTime || "23:59");
    if (!closeDateTime) {
      errors.push("Registration close date/time is invalid");
    } else if (
      closeDateTime.getFullYear() === now.getFullYear() &&
      closeDateTime.getMonth() === now.getMonth() &&
      closeDateTime.getDate() === now.getDate() &&
      closeDateTime <= now
    ) {
      errors.push("Registration close time must be greater than current time for today");
    } else if (closeDateTime >= startDateTime) {
      errors.push("Registration must close before event start");
    }
  }

  return errors;
}

async function checkVenueConflict(venue, date, startTime, endTime, excludeEventId = null) {
  const isOnlineVenue = venue.toLowerCase().includes("online") || venue.toLowerCase().includes("virtual");
  if (isOnlineVenue) {
    return null;
  }

  const query = {
    venue: { $regex: `^${venue}$`, $options: "i" },
    date: date,
    status: { $ne: "cancelled" }
  };

  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  const conflictingEvents = await Event.find(query).lean();

  for (const event of conflictingEvents) {
    const existingStart = parseDateTime(event.date, event.startTime);
    const existingEnd = parseDateTime(event.date, event.endTime);
    const newStart = parseDateTime(date, startTime);
    const newEnd = parseDateTime(date, endTime);

    if (newStart < existingEnd && newEnd > existingStart) {
      return {
        conflictingEventId: event._id,
        conflictingEventTitle: event.title,
        conflictingTime: formatTimeRange12h(event.startTime, event.endTime)
      };
    }
  }

  return null;
}

function getRegistrationCloseTime(event) {
  if (!event?.registrationCloseDate) {
    return null;
  }

  return parseDateTime(event.registrationCloseDate, event.registrationCloseTime || "23:59");
}

function getEventStartTime(event) {
  if (!event?.date || !event?.startTime) {
    return null;
  }

  return parseDateTime(event.date, event.startTime);
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

function enrichEventWithRegistration(event, registeredCount) {
  const seatsRemaining =
    event.maxSeats > 0 ? Math.max(event.maxSeats - registeredCount, 0) : null;
  const registrationClosed = isRegistrationClosed(event, registeredCount);

  return {
    ...event,
    registeredCount,
    seatsRemaining,
    registrationOpen: !registrationClosed
  };
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
      return enrichEventWithRegistration(event, registeredCount);
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
    const payload = {
      ...req.body,
      title: typeof req.body.title === "string" ? req.body.title.trim() : req.body.title,
      venue: typeof req.body.venue === "string" ? req.body.venue.trim() : req.body.venue,
      maxSeats: Number(req.body.maxSeats),
      organizer: req.user.userId
    };

    const errors = validateEventPayload(payload);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const venueConflict = await checkVenueConflict(payload.venue, payload.date, payload.startTime, payload.endTime);
    if (venueConflict) {
      return res.status(409).json({
        message: `Venue conflict: ${venueConflict.conflictingEventTitle} is scheduled at this venue from ${venueConflict.conflictingTime}`,
        conflict: venueConflict
      });
    }

    const event = await Event.create(payload);
    return res.status(201).json(event);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registeredCount = await Registration.countDocuments({
      event: event._id,
      status: "registered"
    });

    return res.json(enrichEventWithRegistration(event, registeredCount));
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", authRequired, requireRole(["admin", "club"]), async (req, res, next) => {
  try {
    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    const mergedPayload = {
      ...existingEvent.toObject(),
      ...req.body,
      title:
        typeof (req.body.title ?? existingEvent.title) === "string"
          ? (req.body.title ?? existingEvent.title).trim()
          : req.body.title ?? existingEvent.title,
      venue:
        typeof (req.body.venue ?? existingEvent.venue) === "string"
          ? (req.body.venue ?? existingEvent.venue).trim()
          : req.body.venue ?? existingEvent.venue,
      maxSeats: Number(req.body.maxSeats ?? existingEvent.maxSeats)
    };

    const errors = validateEventPayload(mergedPayload);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const venueConflict = await checkVenueConflict(
      mergedPayload.venue,
      mergedPayload.date,
      mergedPayload.startTime,
      mergedPayload.endTime,
      existingEvent._id
    );
    if (venueConflict) {
      return res.status(409).json({
        message: `Venue conflict: ${venueConflict.conflictingEventTitle} is scheduled at this venue from ${venueConflict.conflictingTime}`,
        conflict: venueConflict
      });
    }

    const updatePayload = {
      ...req.body,
      title:
        typeof req.body.title === "string"
          ? req.body.title.trim()
          : req.body.title,
      venue:
        typeof req.body.venue === "string"
          ? req.body.venue.trim()
          : req.body.venue,
      maxSeats:
        req.body.maxSeats === undefined
          ? undefined
          : Number(req.body.maxSeats)
    };

    if (updatePayload.maxSeats === undefined) {
      delete updatePayload.maxSeats;
    }
    if (updatePayload.title === undefined) {
      delete updatePayload.title;
    }
    if (updatePayload.venue === undefined) {
      delete updatePayload.venue;
    }

    const event = await Event.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true
    });

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
