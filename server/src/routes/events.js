const express = require("express");
const rateLimit = require("express-rate-limit");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const { authRequired, requireRole } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");
const { validateEventPayload: validateEventSchema } = require("../shared/schemas");

const router = express.Router();
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" }
});
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

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDateValue(dateValue) {
  if (!DATE_REGEX.test(dateValue || "")) {
    return "";
  }

  const [year, month, day] = String(dateValue).split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "";
  }

  parsed.setDate(parsed.getDate() + 1);
  return formatDateKey(parsed);
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

function getResolvedEndDate(dateValue, startTime, endDateValue, endTime) {
  if (endDateValue && DATE_REGEX.test(endDateValue)) {
    return endDateValue;
  }

  if (!DATE_REGEX.test(dateValue || "") || !TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
    return endDateValue || "";
  }

  return endTime <= startTime ? getNextDateValue(dateValue) : dateValue;
}

function getEventSpan(payload) {
  const endDateValue = getResolvedEndDate(payload.date, payload.startTime, payload.endDate, payload.endTime);
  const start = parseDateTime(payload.date, payload.startTime);
  const end = parseDateTime(endDateValue || payload.date, payload.endTime);

  if (!start || !end) {
    return null;
  }

  return {
    start,
    end,
    endDate: endDateValue || payload.date
  };
}

async function checkVenueConflict(venue, date, startTime, endTime, excludeEventId = null) {
  const isOnlineVenue = venue.toLowerCase().includes("online") || venue.toLowerCase().includes("virtual");
  if (isOnlineVenue) {
    return null;
  }

  const query = {
    venue: { $regex: `^${venue}$`, $options: "i" },
    status: { $ne: "cancelled" }
  };

  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  const conflictingEvents = await Event.find(query).lean();
  const newSpan = getEventSpan({ date, startTime, endTime });

  if (!newSpan) {
    return null;
  }

  for (const event of conflictingEvents) {
    const existingSpan = getEventSpan(event);
    if (!existingSpan) {
      continue;
    }

    if (newSpan.start < existingSpan.end && newSpan.end > existingSpan.start) {
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
    const rawPage = Number.parseInt(req.query.page, 10);
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const hasPaginationQuery = Number.isInteger(rawPage) || Number.isInteger(rawLimit);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 8;
    const skip = (page - 1) * limit;

    const [events, totalEvents] = await Promise.all([
      hasPaginationQuery
        ? Event.find().sort({ date: 1, startTime: 1 }).skip(skip).limit(limit).lean()
        : Event.find().sort({ date: 1, startTime: 1 }).lean(),
      hasPaginationQuery ? Event.countDocuments() : Promise.resolve(0)
    ]);

    if (!events.length) {
      if (hasPaginationQuery) {
        return res.json({
          items: [],
          page,
          limit,
          total: totalEvents,
          totalPages: Math.ceil(totalEvents / limit),
          hasNextPage: false
        });
      }
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

    if (hasPaginationQuery) {
      const totalPages = Math.ceil(totalEvents / limit);
      return res.json({
        items: enriched,
        page,
        limit,
        total: totalEvents,
        totalPages,
        hasNextPage: page < totalPages
      });
    }

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

router.post("/", authRequired, requireRole(["admin", "club"]), mutationLimiter, async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      maxSeats: Number(req.body.maxSeats),
      organizer: req.user.userId
    };

    const validation = validateEventSchema(payload);
    if (!validation.success) {
      const errorMessages = Object.entries(validation.errors)
        .map(([field, msgs]) => msgs.join(', '))
        .join('; ');
      return res.status(400).json({ message: errorMessages, errors: validation.errors });
    }

    const validatedPayload = validation.data;
    validatedPayload.endDate = getResolvedEndDate(validatedPayload.date, validatedPayload.startTime, validatedPayload.endDate, validatedPayload.endTime) || null;
    validatedPayload.organizer = req.user.userId;

    const venueConflict = await checkVenueConflict(validatedPayload.venue, validatedPayload.date, validatedPayload.startTime, validatedPayload.endTime);
    if (venueConflict) {
      return res.status(409).json({
        message: `Venue conflict: ${venueConflict.conflictingEventTitle} is scheduled at this venue from ${venueConflict.conflictingTime}`,
        conflict: venueConflict
      });
    }

    const event = await Event.create(validatedPayload);
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

router.put("/:id", authRequired, requireRole(["admin", "club"]), mutationLimiter, async (req, res, next) => {
  try {
    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      existingEvent.organizer &&
      existingEvent.organizer.toString() !== String(req.user.userId)
    ) {
      return res.status(403).json({ message: "You can only update events you created" });
    }

    const mergedPayload = {
      ...existingEvent.toObject(),
      ...req.body,
      maxSeats: Number(req.body.maxSeats ?? existingEvent.maxSeats)
    };

    const validation = validateEventSchema(mergedPayload);
    if (!validation.success) {
      const errorMessages = Object.entries(validation.errors)
        .map(([field, msgs]) => msgs.join(', '))
        .join('; ');
      return res.status(400).json({ message: errorMessages, errors: validation.errors });
    }

    const validatedPayload = validation.data;
    validatedPayload.endDate = getResolvedEndDate(
      validatedPayload.date,
      validatedPayload.startTime,
      validatedPayload.endDate,
      validatedPayload.endTime
    ) || null;

    const venueConflict = await checkVenueConflict(
      validatedPayload.venue,
      validatedPayload.date,
      validatedPayload.startTime,
      validatedPayload.endTime,
      existingEvent._id
    );
    if (venueConflict) {
      return res.status(409).json({
        message: `Venue conflict: ${venueConflict.conflictingEventTitle} is scheduled at this venue from ${venueConflict.conflictingTime}`,
        conflict: venueConflict
      });
    }

    const event = await Event.findByIdAndUpdate(req.params.id, validatedPayload, {
      new: true,
      runValidators: true
    });

    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", authRequired, requireRole(["admin", "club"]), mutationLimiter, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (
      req.user.role !== "admin" &&
      event.organizer &&
      event.organizer.toString() !== String(req.user.userId)
    ) {
      return res.status(403).json({ message: "You can only delete events you created" });
    }

    await Event.findByIdAndDelete(req.params.id);
    return res.json({ message: "Event deleted" });
  } catch (err) {
    return next(err);
  }
});

router.post("/:id/register", authRequired, requireRole(["student"]), mutationLimiter, async (req, res, next) => {
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
