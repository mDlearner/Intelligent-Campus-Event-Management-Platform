const express = require("express");
const Notification = require("../models/Notification");
const Registration = require("../models/Registration");
const { authRequired } = require("../middleware/auth");
const { isSmtpConfigured, sendMail } = require("../utils/mailer");

const router = express.Router();
const MAX_DELAY_MS = 2147483647;

function getEventDateTime(event) {
  if (!event?.date || !event?.startTime) {
    return null;
  }

  const value = `${event.date}T${event.startTime}:00`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function sendReminderEmail({ to, event }) {
  const subject = `Reminder: ${event.title}`;
  const text = `Reminder: ${event.title} starts at ${event.startTime} on ${event.date}.`;

  await sendMail({ to, subject, text });
}

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.userId })
      .sort({ createdAt: -1 });

    return res.json(notifications);
  } catch (err) {
    return next(err);
  }
});

router.post("/reminders", authRequired, async (req, res, next) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(400).json({ message: "SMTP is not configured" });
    }

    if (!req.user?.email) {
      return res.status(400).json({ message: "User email is missing" });
    }

    const registrations = await Registration.find({
      user: req.user.userId,
      status: "registered"
    }).populate("event");

    const now = Date.now();
    const scheduled = [];
    const toEmail = req.user.email;

    for (const registration of registrations) {
      const event = registration.event;
      const eventDateTime = getEventDateTime(event);
      if (!event || !eventDateTime) {
        continue;
      }

      const reminderTime = new Date(eventDateTime);
      reminderTime.setHours(reminderTime.getHours() - 1);

      const delay = reminderTime.getTime() - now;
      const message = `Reminder: ${event.title} starts at ${event.startTime} on ${event.date}.`;

      if (delay <= 0) {
        await Notification.create({
          user: req.user.userId,
          message,
          type: "reminder"
        });

        await sendReminderEmail({ to: toEmail, event });

        scheduled.push({ eventId: event._id, scheduledFor: new Date().toISOString() });
        continue;
      }

      if (delay > MAX_DELAY_MS) {
        scheduled.push({ eventId: event._id, scheduledFor: reminderTime.toISOString(), skipped: true });
        continue;
      }

      setTimeout(() => {
        Notification.create({
          user: req.user.userId,
          message,
          type: "reminder"
        })
          .then(() => sendReminderEmail({ to: toEmail, event }))
          .catch(() => {});
      }, delay);

      scheduled.push({ eventId: event._id, scheduledFor: reminderTime.toISOString() });
    }

    return res.json({
      scheduledCount: scheduled.filter((item) => !item.skipped).length,
      scheduled
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
