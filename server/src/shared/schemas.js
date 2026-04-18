const { z } = require("zod");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const optionalUrlField = (message) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url(message).optional().nullable()
  );

// Event creation/update schema
const eventSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().trim().max(5000).optional().default(""),
  date: z.string().regex(DATE_REGEX, "Event date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(TIME_REGEX, "Start time must be in HH:MM format (24-hour)"),
  endTime: z.string().regex(TIME_REGEX, "End time must be in HH:MM format (24-hour)"),
  registrationCloseDate: z.string().regex(DATE_REGEX, "Invalid registration close date").optional().nullable(),
  registrationCloseTime: z.string().regex(TIME_REGEX, "Invalid registration close time").optional().nullable(),
  venue: z.string().trim().min(1, "Venue is required").max(300),
  imageUrl: z.string().url("Invalid image URL").optional().nullable(),
  maxSeats: z.number().int("Max seats must be an integer").positive("Max seats must be greater than 0"),
  categories: z.array(z.string().trim()).min(1, "At least one category is required").max(10),
  speakers: z.array(
    z.object({
      name: z.string().trim().optional(),
      title: z.string().trim().optional(),
      bio: z.string().trim().optional(),
      imageUrl: optionalUrlField("Invalid speaker image URL"),
      socialLinks: z.object({
        linkedin: optionalUrlField("Invalid LinkedIn URL"),
        twitter: optionalUrlField("Invalid Twitter URL"),
        github: optionalUrlField("Invalid GitHub URL"),
        website: optionalUrlField("Invalid website URL")
      }).optional().nullable()
    })
  ).optional().default([]),
  sponsors: z.array(
    z.object({
      name: z.string().trim().optional(),
      logo: optionalUrlField("Invalid sponsor logo URL"),
      website: optionalUrlField("Invalid sponsor website URL")
    })
  ).optional().default([])
})
  .refine((data) => {
    const start = new Date(`${data.date}T${data.startTime}`);
    const end = new Date(`${data.date}T${data.endTime}`);
    return end > start;
  }, {
    message: "Event end time must be after start time",
    path: ["endTime"]
  })
  .refine((data) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(data.date);
    return eventDate >= today;
  }, {
    message: "Event date cannot be before today",
    path: ["date"]
  })
  .refine((data) => {
    if (!data.registrationCloseDate || !data.registrationCloseTime) {
      return true;
    }
    const closeDateTime = new Date(`${data.registrationCloseDate}T${data.registrationCloseTime}`);
    const startDateTime = new Date(`${data.date}T${data.startTime}`);
    return closeDateTime < startDateTime;
  }, {
    message: "Registration must close before event start",
    path: ["registrationCloseTime"]
  });

function validateEventPayload(payload) {
  try {
    return { success: true, data: eventSchema.parse(payload) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.flatten().fieldErrors };
    }
    return { success: false, errors: { _global: [error.message] } };
  }
}

module.exports = {
  eventSchema,
  validateEventPayload
};
