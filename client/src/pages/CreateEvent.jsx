import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createEvent, updateEvent } from "../lib/api.js";
import { getAuth, getToken } from "../lib/auth.js";
import { getNextDateValue, getEventDateTimeSpan, resolveEventEndDate } from "../lib/time.js";

const initialEventForm = {
  title: "",
  description: "",
  date: "",
  endDate: "",
  startTime: "",
  endTime: "",
  registrationCloseDate: "",
  registrationCloseTime: "",
  venue: "",
  maxSeats: "",
  paymentType: "free",
  imageUrl: "",
  categories: [],
  speakers: [],
  sponsors: []
};

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

function formatDateInputValue(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateEventForm(form) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!form.title.trim()) {
    return "Title is required";
  }

  if (!form.venue.trim()) {
    return "Venue is required";
  }

  if (!Array.isArray(form.categories) || form.categories.length === 0) {
    return "At least one category is required";
  }

  if (!DATE_REGEX.test(form.date || "")) {
    return "Event date is required";
  }

  if (form.endDate && !DATE_REGEX.test(form.endDate)) {
    return "Event end date is invalid";
  }

  if (form.endDate && form.endDate < form.date) {
    return "Event end date cannot be before event date";
  }

  if (!TIME_REGEX.test(form.startTime || "")) {
    return "Event start time is required";
  }

  if (!TIME_REGEX.test(form.endTime || "")) {
    return "Event end time is required";
  }

  const maxSeats = Number(form.maxSeats);
  if (!Number.isInteger(maxSeats) || maxSeats <= 0) {
    return "Max seats must be an integer greater than 0";
  }

  const startDateTime = parseDateTime(form.date, form.startTime);
  const eventDayStart = parseDateTime(form.date, "00:00");
  const resolvedEndDate = resolveEventEndDate(form.date, form.startTime, form.endDate || "", form.endTime);
  const eventSpan = getEventDateTimeSpan(form.date, form.startTime, resolvedEndDate, form.endTime);

  if (eventDayStart && eventDayStart < todayStart) {
    return "Event date cannot be before today";
  }

  if (!startDateTime || !eventSpan) {
    return "Event date/time values are invalid";
  }

  if (form.endDate && eventSpan.end <= eventSpan.start) {
    return "Event end time must be after start time";
  }

  if (form.registrationCloseTime && !form.registrationCloseDate) {
    return "Registration close date is required when close time is provided";
  }

  if (form.registrationCloseDate) {
    if (!DATE_REGEX.test(form.registrationCloseDate)) {
      return "Registration close date is invalid";
    }

    if (form.registrationCloseTime && !TIME_REGEX.test(form.registrationCloseTime)) {
      return "Registration close time is invalid";
    }

    const closeDateTime = parseDateTime(
      form.registrationCloseDate,
      form.registrationCloseTime || "23:59"
    );
    if (!closeDateTime) {
      return "Registration close date/time is invalid";
    }

    if (
      closeDateTime.getFullYear() === now.getFullYear() &&
      closeDateTime.getMonth() === now.getMonth() &&
      closeDateTime.getDate() === now.getDate() &&
      closeDateTime <= now
    ) {
      return "Registration close time must be greater than current time for today";
    }

    if (closeDateTime >= startDateTime) {
      return "Registration must close before event start";
    }
  }

  return "";
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState(() => getAuth());
  const [form, setForm] = useState(initialEventForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";
  const todayDateValue = formatDateInputValue(new Date());

  useEffect(() => {
    function handleAuthChange() {
      setAuth(getAuth());
    }

    window.addEventListener("auth-changed", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!canCreate) {
      navigate("/events");
    }
  }, [canCreate, navigate]);

  useEffect(() => {
    const event = location.state?.event;
    if (!event) {
      return;
    }

    setEditingEventId(event._id || null);
    setForm({
      title: event.title || "",
      description: event.description || "",
      date: event.date || "",
      endDate: event.endDate || "",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      registrationCloseDate: event.registrationCloseDate || "",
      registrationCloseTime: event.registrationCloseTime || "",
      venue: event.venue || "",
      maxSeats: event.maxSeats ? String(event.maxSeats) : "",
      paymentType: event.paymentType || "free",
      imageUrl: event.imageUrl || "",
      categories: event.categories || [],
      speakers: event.speakers || [],
      sponsors: event.sponsors || []
    });
  }, [location.state]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function openPicker(fieldName) {
    const input = document.querySelector(`input[name="${fieldName}"]`);
    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const validationError = validateEventForm(form);
      if (validationError) {
        setFormError(validationError);
        return;
      }

      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const payload = {
        title: form.title,
        description: form.description,
        date: form.date,
        endDate: form.endDate || (form.endTime <= form.startTime ? getNextDateValue(form.date) : null),
        startTime: form.startTime,
        endTime: form.endTime,
        registrationCloseDate: form.registrationCloseDate || null,
        registrationCloseTime: form.registrationCloseTime || null,
        venue: form.venue,
        imageUrl: form.imageUrl || null,
        maxSeats: Number(form.maxSeats),
        paymentType: form.paymentType,
        categories: form.categories,
        speakers: form.speakers.filter((s) => s.name),
        sponsors: form.sponsors.filter((s) => s.name)
      };

      if (editingEventId) {
        await updateEvent(editingEventId, payload, token);
      } else {
        await createEvent(payload, token);
      }
      navigate("/events");
    } catch (err) {
      setFormError(err.message || (editingEventId ? "Unable to update event" : "Unable to create event"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="bento-tile rounded-3xl p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text3)]">Organizer</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] md:text-3xl">
              {editingEventId ? "Edit Event" : "Create Event"}
            </h1>
          </div>
          <button
            className="neo-btn-ghost px-4 py-2 text-sm"
            type="button"
            onClick={() => navigate("/events")}
          >
            Back to Events
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleCreate}>
          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Title</label>
            <input
              className="neo-input mt-1 text-sm"
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Venue</label>
            <input
              className="neo-input mt-1 text-sm"
              type="text"
              name="venue"
              value={form.venue}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Date</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  min={todayDateValue}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open date picker"
                  onClick={() => openPicker("date")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
                    <path d="M8 3.8v3.6M16 3.8v3.6M3.5 9.3h17" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">To date (optional)</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  min={form.date || todayDateValue}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open end date picker"
                  onClick={() => openPicker("endDate")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
                    <path d="M8 3.8v3.6M16 3.8v3.6M3.5 9.3h17" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Max seats</label>
              <input
                className="neo-input mt-1 text-sm"
                type="number"
                name="maxSeats"
                value={form.maxSeats}
                onChange={handleChange}
                min="1"
                step="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Event type</label>
            <select
              className="neo-input mt-1 text-sm"
              name="paymentType"
              value={form.paymentType}
              onChange={handleChange}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Event start</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open start time picker"
                  onClick={() => openPicker("startTime")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.8v4.8l3.2 1.9" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Event end</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open end time picker"
                  onClick={() => openPicker("endTime")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.8v4.8l3.2 1.9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Registration closes</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="date"
                  name="registrationCloseDate"
                  value={form.registrationCloseDate}
                  onChange={handleChange}
                  min={todayDateValue}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open registration close date picker"
                  onClick={() => openPicker("registrationCloseDate")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
                    <path d="M8 3.8v3.6M16 3.8v3.6M3.5 9.3h17" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-[var(--text2)]">Close time</label>
              <div className="relative mt-1">
                <input
                  className="neo-input pr-12 text-sm"
                  type="time"
                  name="registrationCloseTime"
                  value={form.registrationCloseTime}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--gold2)] transition hover:bg-[rgba(240,192,64,0.14)]"
                  aria-label="Open registration close time picker"
                  onClick={() => openPicker("registrationCloseTime")}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.8v4.8l3.2 1.9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Description</label>
            <textarea
              className="neo-textarea mt-1 text-sm"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Event Image URL</label>
            <input
              className="neo-input mt-1 text-sm"
              type="text"
              name="imageUrl"
              value={form.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
            {form.imageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg">
                <img src={form.imageUrl} alt="Event preview" className="h-32 w-full rounded-lg object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-bold text-[var(--text2)]">Categories</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {["Workshop", "Hackathon", "Cultural", "Social Impact", "Innovation & Research", "Academic Seminar", "Competition"].map((cat) => (
                <label key={cat} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.categories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm((prev) => ({
                          ...prev,
                          categories: [...prev.categories, cat]
                        }));
                      } else {
                        setForm((prev) => ({
                          ...prev,
                          categories: prev.categories.filter((c) => c !== cat)
                        }));
                      }
                    }}
                    className="h-4 w-4 rounded border-[var(--border2)]"
                  />
                  <span className="text-sm text-[var(--text2)]">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--text2)]">Speakers</label>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    speakers: [
                      ...prev.speakers,
                      { name: "", title: "", bio: "", imageUrl: "", socialLinks: { linkedin: "", twitter: "", github: "", website: "" } }
                    ]
                  }))
                }
                className="text-sm font-semibold text-[var(--blue)] hover:underline"
              >
                + Add Speaker
              </button>
            </div>
            <div className="space-y-3">
              {form.speakers.map((speaker, idx) => (
                <div key={idx} className="space-y-3 rounded-xl border border-[var(--border2)] bg-[var(--surface2)]/35 p-4">
                  <input
                    type="text"
                    placeholder="Speaker name"
                    value={speaker.name || ""}
                    onChange={(e) => {
                      const updated = [...form.speakers];
                      updated[idx].name = e.target.value;
                      setForm((prev) => ({ ...prev, speakers: updated }));
                    }}
                    className="neo-input"
                  />
                  <input
                    type="text"
                    placeholder="Title/Position"
                    value={speaker.title || ""}
                    onChange={(e) => {
                      const updated = [...form.speakers];
                      updated[idx].title = e.target.value;
                      setForm((prev) => ({ ...prev, speakers: updated }));
                    }}
                    className="neo-input"
                  />
                  <input
                    type="text"
                    placeholder="Photo URL"
                    value={speaker.imageUrl || ""}
                    onChange={(e) => {
                      const updated = [...form.speakers];
                      updated[idx].imageUrl = e.target.value;
                      setForm((prev) => ({ ...prev, speakers: updated }));
                    }}
                    className="neo-input"
                  />
                  <textarea
                    placeholder="Bio"
                    value={speaker.bio || ""}
                    onChange={(e) => {
                      const updated = [...form.speakers];
                      updated[idx].bio = e.target.value;
                      setForm((prev) => ({ ...prev, speakers: updated }));
                    }}
                    rows="3"
                    className="neo-textarea"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="LinkedIn URL"
                      value={speaker.socialLinks?.linkedin || ""}
                      onChange={(e) => {
                        const updated = [...form.speakers];
                        if (!updated[idx].socialLinks) updated[idx].socialLinks = {};
                        updated[idx].socialLinks.linkedin = e.target.value;
                        setForm((prev) => ({ ...prev, speakers: updated }));
                      }}
                      className="neo-input"
                    />
                    <input
                      type="text"
                      placeholder="Twitter URL"
                      value={speaker.socialLinks?.twitter || ""}
                      onChange={(e) => {
                        const updated = [...form.speakers];
                        if (!updated[idx].socialLinks) updated[idx].socialLinks = {};
                        updated[idx].socialLinks.twitter = e.target.value;
                        setForm((prev) => ({ ...prev, speakers: updated }));
                      }}
                      className="neo-input"
                    />
                    <input
                      type="text"
                      placeholder="GitHub URL"
                      value={speaker.socialLinks?.github || ""}
                      onChange={(e) => {
                        const updated = [...form.speakers];
                        if (!updated[idx].socialLinks) updated[idx].socialLinks = {};
                        updated[idx].socialLinks.github = e.target.value;
                        setForm((prev) => ({ ...prev, speakers: updated }));
                      }}
                      className="neo-input"
                    />
                    <input
                      type="text"
                      placeholder="Website URL"
                      value={speaker.socialLinks?.website || ""}
                      onChange={(e) => {
                        const updated = [...form.speakers];
                        if (!updated[idx].socialLinks) updated[idx].socialLinks = {};
                        updated[idx].socialLinks.website = e.target.value;
                        setForm((prev) => ({ ...prev, speakers: updated }));
                      }}
                      className="neo-input"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        speakers: prev.speakers.filter((_, i) => i !== idx)
                      }));
                    }}
                    className="text-sm font-medium text-[var(--rose)] hover:underline"
                  >
                    Remove Speaker
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--text2)]">Sponsors</label>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    sponsors: [...prev.sponsors, { name: "", logo: "", website: "" }]
                  }))
                }
                className="text-sm font-semibold text-[var(--blue)] hover:underline"
              >
                + Add Sponsor
              </button>
            </div>
            <div className="space-y-3">
              {form.sponsors.map((sponsor, idx) => (
                <div key={idx} className="space-y-3 rounded-xl border border-[var(--border2)] bg-[var(--surface2)]/35 p-4">
                  <input
                    type="text"
                    placeholder="Sponsor name"
                    value={sponsor.name || ""}
                    onChange={(e) => {
                      const updated = [...form.sponsors];
                      updated[idx].name = e.target.value;
                      setForm((prev) => ({ ...prev, sponsors: updated }));
                    }}
                    className="neo-input"
                  />
                  <input
                    type="text"
                    placeholder="Logo URL"
                    value={sponsor.logo || ""}
                    onChange={(e) => {
                      const updated = [...form.sponsors];
                      updated[idx].logo = e.target.value;
                      setForm((prev) => ({ ...prev, sponsors: updated }));
                    }}
                    className="neo-input"
                  />
                  <input
                    type="text"
                    placeholder="Website URL"
                    value={sponsor.website || ""}
                    onChange={(e) => {
                      const updated = [...form.sponsors];
                      updated[idx].website = e.target.value;
                      setForm((prev) => ({ ...prev, sponsors: updated }));
                    }}
                    className="neo-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        sponsors: prev.sponsors.filter((_, i) => i !== idx)
                      }));
                    }}
                    className="text-sm font-medium text-[var(--rose)] hover:underline"
                  >
                    Remove Sponsor
                  </button>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-xs text-[var(--rose)]">
              {formError}
            </div>
          )}

          <button className="neo-btn w-full px-4 py-2 text-sm disabled:opacity-70" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (editingEventId ? "Saving..." : "Creating...") : editingEventId ? "Save Changes" : "Create Event"}
          </button>
        </form>
      </div>
    </section>
  );
}
