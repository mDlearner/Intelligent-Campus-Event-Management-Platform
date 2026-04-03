import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchEvents, createEvent, updateEvent, deleteEvent, registerForEvent } from '../lib/api.js';
import { getAuth, getToken } from '../lib/auth.js';
import Timeline from '../components/Timeline';

const initialEventForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  registrationCloseDate: "",
  registrationCloseTime: "",
  venue: "",
  maxSeats: "",
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

function truncateText(text, length = 100) {
  if (!text) return "";
  return text.length > length ? text.substring(0, length) + "..." : text;
}

function getCategoryTone(tag) {
  const key = String(tag || "").toLowerCase();
  if (key.includes("academic") || key.includes("seminar")) {
    return "border-[var(--gold)]/30 bg-[rgba(240,192,64,0.1)] text-[var(--gold)]";
  }
  if (key.includes("workshop")) {
    return "border-[var(--blue)]/30 bg-[rgba(77,159,255,0.1)] text-[var(--blue)]";
  }
  if (key.includes("hackathon")) {
    return "border-purple-500/30 bg-[rgba(168,85,247,0.1)] text-purple-400";
  }
  if (key.includes("cultural")) {
    return "border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] text-[var(--rose)]";
  }
  if (key.includes("competition")) {
    return "border-orange-500/30 bg-[rgba(249,115,22,0.1)] text-orange-400";
  }
  if (key.includes("social impact")) {
    return "border-[var(--teal)]/30 bg-[rgba(0,212,170,0.1)] text-[var(--teal)]";
  }
  if (key.includes("sport")) {
    return "border-emerald-500/30 bg-[rgba(16,185,129,0.1)] text-emerald-400";
  }
  if (key.includes("innovation") || key.includes("research")) {
    return "border-cyan-500/30 bg-[rgba(34,211,238,0.1)] text-cyan-400";
  }
  if (key.includes("free food")) {
    return "border-lime-500/30 bg-[rgba(132,204,22,0.1)] text-lime-400";
  }
  if (key.includes("career")) {
    return "border-indigo-500/30 bg-[rgba(99,102,241,0.1)] text-indigo-400";
  }
  return "border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)]";
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
  const endDateTime = parseDateTime(form.date, form.endTime);
  const eventDayStart = parseDateTime(form.date, "00:00");

  if (eventDayStart && eventDayStart < todayStart) {
    return "Event date cannot be before today";
  }

  if (!startDateTime || !endDateTime) {
    return "Event date/time values are invalid";
  }

  if (endDateTime <= startDateTime) {
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

export default function Events({ showEnded = false }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialEventForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [auth, setAuth] = useState(() => getAuth());
  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";
  const isAdmin = auth?.user?.role === "admin";
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
    const query = searchParams.get("search") || "";
    if (query !== searchQuery) {
      setSearchQuery(query);
    }
  }, [searchParams, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const data = await fetchEvents();
        if (isMounted) {
          setEvents(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load events");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadEvents();
    return () => {
      isMounted = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
        startTime: form.startTime,
        endTime: form.endTime,
        registrationCloseDate: form.registrationCloseDate || null,
        registrationCloseTime: form.registrationCloseTime || null,
        venue: form.venue,
        imageUrl: form.imageUrl || null,
        maxSeats: Number(form.maxSeats),
        categories: form.categories,
        speakers: form.speakers.filter((s) => s.name),
        sponsors: form.sponsors.filter((s) => s.name)
      };

      if (editingEventId) {
        const updated = await updateEvent(editingEventId, payload, token);
        setEvents((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
        setEditingEventId(null);
      } else {
        const created = await createEvent(payload, token);
        setEvents((prev) => [created, ...prev]);
      }
      setForm(initialEventForm);
    } catch (err) {
      setFormError(err.message || "Unable to create event");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(event) {
    setEditingEventId(event._id);
    setForm({
      title: event.title || "",
      description: event.description || "",
      date: event.date || "",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      registrationCloseDate: event.registrationCloseDate || "",
      registrationCloseTime: event.registrationCloseTime || "",
      venue: event.venue || "",
      imageUrl: event.imageUrl || "",
      maxSeats: event.maxSeats ? String(event.maxSeats) : "",
      categories: event.categories || [],
      speakers: event.speakers || [],
      sponsors: event.sponsors || []
    });
  }

  async function handleDelete(eventId) {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteEvent(eventId, token);
      setEvents((prev) => prev.filter((item) => item._id !== eventId));
      if (editingEventId === eventId) {
        setEditingEventId(null);
        setForm(initialEventForm);
      }
    } catch (err) {
      alert(err.message || "Unable to delete event");
    }
  }

  async function handleRegister(eventId) {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return false;
    }

    try {
      await registerForEvent(eventId, token);
      window.dispatchEvent(new Event("registrations-updated"));
      alert("Registered successfully");
      return true;
    } catch (err) {
      alert(err.message || "Unable to register");
      return false;
    }
  }

  function isHappeningNow(event) {
    if (!event?.date || !event?.startTime || !event?.endTime) {
      return false;
    }

    const today = new Date();
    const [year, month, day] = event.date.split("-").map(Number);
    if (!year || !month || !day) {
      return false;
    }

    const eventDate = new Date(year, month - 1, day);
    if (
      eventDate.getFullYear() !== today.getFullYear() ||
      eventDate.getMonth() !== today.getMonth() ||
      eventDate.getDate() !== today.getDate()
    ) {
      return false;
    }

    const [startHours, startMinutes] = event.startTime.split(":").map(Number);
    const [endHours, endMinutes] = event.endTime.split(":").map(Number);
    const start = new Date(eventDate);
    const end = new Date(eventDate);
    start.setHours(startHours || 0, startMinutes || 0, 0, 0);
    end.setHours(endHours || 0, endMinutes || 0, 0, 0);

    return today >= start && today <= end;
  }

  function isEventEnded(event) {
    if (!event?.date || !DATE_REGEX.test(event.date)) {
      return false;
    }

    const [year, month, day] = event.date.split("-").map(Number);
    const now = new Date();
    const eventDayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (eventDayStart < todayStart) {
      return true;
    }

    if (eventDayStart > todayStart) {
      return false;
    }

    if (!TIME_REGEX.test(event.endTime || "")) {
      return false;
    }

    const endDateTime = parseDateTime(event.date, event.endTime);
    if (!endDateTime) {
      return false;
    }

    return endDateTime < now;
  }

  function getTags(event) {
    const title = `${event?.title || ""} ${event?.description || ""}`.toLowerCase();
    const tags = [];
    if (title.includes("workshop") || title.includes("learn")) {
      tags.push("Workshop");
    }
    if (title.includes("food") || title.includes("pizza")) {
      tags.push("Free Food");
    }
    if (title.includes("career") || title.includes("intern")) {
      tags.push("Career");
    }
    if (tags.length === 0) {
      tags.push("Campus");
    }
    return tags.slice(0, 2);
  }

  function getCategoryTone(tag) {
    const key = String(tag || "").toLowerCase();
    if (key.includes("academic") || key.includes("seminar")) {
      return "border-[var(--gold)]/30 bg-[rgba(240,192,64,0.1)] text-[var(--gold)]";
    }
    if (key.includes("workshop")) {
      return "border-[var(--blue)]/30 bg-[rgba(77,159,255,0.1)] text-[var(--blue)]";
    }
    if (key.includes("hackathon")) {
      return "border-purple-500/30 bg-[rgba(168,85,247,0.1)] text-purple-400";
    }
    if (key.includes("cultural")) {
      return "border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] text-[var(--rose)]";
    }
    if (key.includes("competition")) {
      return "border-orange-500/30 bg-[rgba(249,115,22,0.1)] text-orange-400";
    }
    if (key.includes("social impact")) {
      return "border-[var(--teal)]/30 bg-[rgba(0,212,170,0.1)] text-[var(--teal)]";
    }
    if (key.includes("sport")) {
      return "border-emerald-500/30 bg-[rgba(16,185,129,0.1)] text-emerald-400";
    }
    if (key.includes("innovation") || key.includes("research")) {
      return "border-cyan-500/30 bg-[rgba(34,211,238,0.1)] text-cyan-400";
    }
    if (key.includes("free food")) {
      return "border-lime-500/30 bg-[rgba(132,204,22,0.1)] text-lime-400";
    }
    if (key.includes("career")) {
      return "border-indigo-500/30 bg-[rgba(99,102,241,0.1)] text-indigo-400";
    }
    return "border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)]";
  }

  function getRegistrationCloseLabel(event) {
    if (!event?.registrationCloseDate && !event?.registrationCloseTime) {
      return "";
    }
    const date = event.registrationCloseDate || "";
    const time = event.registrationCloseTime ? ` · ${event.registrationCloseTime}` : "";
    return `Registration closes ${date}${time}`.trim();
  }

  const scopedEvents = useMemo(
    () => events.filter((event) => (showEnded ? isEventEnded(event) : !isEventEnded(event))),
    [events, showEnded]
  );

  const filteredEvents = scopedEvents.filter((event) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [event?.title, event?.venue, event?.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    if (!matchesQuery) {
      return false;
    }

    if (showEnded) {
      return true;
    }

    if (activeFilter === "Happening Now") {
      return isHappeningNow(event);
    }
    if (activeFilter === "This Week") {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + 7);
      const eventDate = new Date(event?.date || "");
      return eventDate >= now && eventDate <= cutoff;
    }
    if (activeFilter === "Workshops") {
      return getTags(event).includes("Workshop");
    }
    if (activeFilter === "Free Food") {
      return getTags(event).includes("Free Food");
    }
    return true;
  });

  const displayedEvents = filteredEvents;

  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);

  function parseMinutes(timeValue) {
    if (!timeValue) {
      return null;
    }
    const [hours, minutes] = timeValue.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function formatDateKey(dateValue) {
    return dateValue.toLocaleDateString("en-CA");
  }

  const conflictIds = new Set();
  calendarDays.forEach((date) => {
    const dayEvents = displayedEvents.filter((event) => event?.date === formatDateKey(date));
    dayEvents.forEach((event, index) => {
      for (let otherIndex = index + 1; otherIndex < dayEvents.length; otherIndex += 1) {
        const other = dayEvents[otherIndex];
        if (!event.venue || !other.venue || event.venue !== other.venue) {
          continue;
        }
        const start = parseMinutes(event.startTime);
        const end = parseMinutes(event.endTime);
        const otherStart = parseMinutes(other.startTime);
        const otherEnd = parseMinutes(other.endTime);
        if ([start, end, otherStart, otherEnd].includes(null)) {
          continue;
        }
        if (start < otherEnd && otherStart < end) {
          conflictIds.add(event._id);
          conflictIds.add(other._id);
        }
      }
    });
  });

  async function handleConfirmRegistration() {
    if (!selectedEvent) {
      return;
    }
    setIsRegistering(true);
    const success = await handleRegister(selectedEvent._id);
    if (success) {
      setIsDrawerOpen(false);
    }
    setIsRegistering(false);
  }

  return (
    <section className="space-y-8">
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text3)]">
              {showEnded ? "Event Archive" : "Events & Registrations"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl text-[var(--text)]">
              {showEnded ? "Ended Events" : "What's happening next?"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--text2)]">
              {showEnded
                ? "Browse completed events in one place."
                : "Discover, filter, and register for campus events in real time."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && !showEnded && (
              <button
                className="rounded-full border border-[var(--border2)] bg-[var(--gold)] px-5 py-2 text-sm font-semibold text-[var(--bg)] transition hover:bg-[var(--gold2)]"
                type="button"
                onClick={() => navigate("/events/create")}
              >
                + Create Event
              </button>
            )}
            <button
              className="rounded-full border border-[var(--border2)] bg-[var(--surface2)]/50 px-5 py-2 text-sm font-semibold text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              type="button"
              onClick={() => navigate(showEnded ? "/events" : "/events/ended")}
            >
              {showEnded ? "View Active Events" : "View Ended Events"}
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="glass-panel flex flex-1 items-center gap-3 rounded-full px-4 py-3">
            <span className="text-[var(--text3)]">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z"
                />
              </svg>
            </span>
            <input
              className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text3)] transition-colors duration-300"
              placeholder="Search events by name, club, or venue…"
              type="search"
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchQuery(nextValue);
                const nextParams = new URLSearchParams(searchParams);
                if (nextValue.trim()) {
                  nextParams.set("search", nextValue.trim());
                } else {
                  nextParams.delete("search");
                }
                setSearchParams(nextParams, { replace: true });
              }}
            />
          </div>
          {!showEnded && (
            <div className="flex flex-wrap gap-2">
              {["All", "Happening Now", "This Week", "Workshops", "Free Food"].map((filter) => (
                <button
                  key={filter}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeFilter === filter
                      ? "bg-[var(--gold)] text-[var(--bg)]"
                      : "border border-[var(--border2)] bg-[var(--surface2)]/50 text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  }`}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`event-skeleton-${index}`} className="bento-tile animate-pulse rounded-3xl p-4">
                  <div className="h-32 rounded-2xl bg-[var(--surface2)]/70" />
                  <div className="mt-4 h-4 w-2/3 rounded-full bg-[var(--surface2)]/70" />
                  <div className="mt-3 h-3 w-1/2 rounded-full bg-[var(--surface2)]/70" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-4 py-3 text-sm text-[var(--rose)]">
              {error}
            </div>
          )}
          {!loading && !error && filteredEvents.length === 0 && (
            <div className="glass-panel rounded-2xl p-6 text-sm text-[var(--text2)]">
              {showEnded
                ? "No ended events match your search."
                : "No events match your search. Try clearing a filter."}
            </div>
          )}
          {!loading && !error && filteredEvents.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEvents.map((event, index) => (
                <article
                  key={event._id}
                  className="bento-tile flex flex-col justify-between rounded-3xl p-4 transition hover:-translate-y-1 hover:border-[var(--gold2)] hover:shadow-lg hover:shadow-[rgba(240,192,64,0.1)] cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/events/${event._id}`)}
                >
                  <div
                    className={`relative flex h-28 items-end justify-between overflow-hidden rounded-2xl p-4 text-white ${
                      event.imageUrl
                        ? "bg-[var(--surface2)]"
                        : index % 2 === 0
                        ? "bg-gradient-to-br from-[var(--blue)]/60 via-[var(--surface2)]/60 to-[var(--surface2)]"
                        : "bg-gradient-to-br from-[var(--gold)]/60 via-[var(--rose)]/40 to-[var(--surface2)]"
                    }`}
                  >
                    {event.imageUrl && (
                      <>
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="absolute inset-0 h-full w-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-[var(--bg)]/45" />
                      </>
                    )}
                    <div className="relative z-10 flex flex-col gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">{event.status}</p>
                      {showEnded && (
                        <span className="w-fit rounded-full border border-[rgba(249,115,22,0.35)] bg-[rgba(249,115,22,0.14)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
                          Ended
                        </span>
                      )}
                    </div>
                    <div className="relative z-10 flex flex-col items-end gap-2">
                      {event.categories && event.categories.length > 0 && (
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${getCategoryTone(event.categories[0])}`}>
                          {event.categories[0]}
                        </span>
                      )}
                      {!showEnded && (
                        <span className="rounded-full bg-[var(--gold)]/20 px-3 py-1 text-[10px] font-semibold text-[var(--gold)]">
                          {event.maxSeats
                            ? `Seats: ${event.seatsRemaining ?? event.maxSeats} / ${event.maxSeats}`
                            : "Seats: Open"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {getTags(event).map((tag) => (
                        <span
                          key={`${event._id}-${tag}`}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${getCategoryTone(tag)}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-[var(--text)]">{event.title}</h2>
                    <p className="mt-2 text-xs font-semibold text-[var(--text2)]">
                      {event.date}
                      {event.startTime && event.endTime
                        ? ` · ${event.startTime} - ${event.endTime}`
                        : event.startTime
                        ? ` · ${event.startTime}`
                        : ""}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                    {getRegistrationCloseLabel(event) && (
                      <p className="mt-2 text-xs font-bold text-[var(--text3)]">
                        {getRegistrationCloseLabel(event)}
                      </p>
                    )}
                    {event.description && (
                      <p className="mt-3 text-sm font-semibold text-[var(--text2)]">{truncateText(event.description, 100)}</p>
                    )}
                  </div>
                  {!showEnded && (
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[var(--text3)]">
                      <span>
                        {event.maxSeats
                          ? `Seats left: ${event.seatsRemaining ?? event.maxSeats} of ${event.maxSeats}`
                          : "Open capacity"}
                      </span>
                      <span className={event.registrationOpen === false ? "font-semibold text-[var(--rose)]" : "font-semibold text-[var(--teal)]"}>
                        {event.registrationOpen === false ? "Registration closed" : "Registration open"}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 h-2 rounded-full bg-[var(--surface2)]">
                    <div className="h-2 w-full rounded-full bg-gradient-to-r from-[var(--blue)] to-[var(--gold)]" />
                  </div>
                  {!showEnded && !isHappeningNow(event) && event.registrationOpen !== false && (
                    <button
                      className="mt-4 w-full rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition hover:bg-[var(--gold2)]"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                        setIsDrawerOpen(true);
                      }}
                    >
                      Register now
                    </button>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="flex-1 rounded-full border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-xs font-bold text-[var(--rose)] transition hover:bg-[rgba(255,107,138,0.2)]"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event._id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {!showEnded && (
          <div className="glass-panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">Intelligent Calendar</h2>
              <p className="text-xs text-[var(--text3)]">Conflicts highlighted automatically</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text3)]">
              {["Workshop", "Free Food", "Career", "Campus"].map((tag) => (
                <span
                  key={`legend-${tag}`}
                  className={`rounded-full border px-3 py-1 ${getCategoryTone(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {calendarDays.map((date) => {
                const dateLabel = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric"
                });
                const dateKey = formatDateKey(date);
                const dayEvents = displayedEvents.filter((event) => event?.date === dateKey);
                return (
                  <div key={dateKey} className="relative rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/30 p-3">
                    <p className="text-xs font-semibold text-[var(--text3)]">{dateLabel}</p>
                    {dayEvents.length === 0 && (
                      <p className="mt-3 text-xs text-[var(--text3)]">No events</p>
                    )}
                    {dayEvents.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {dayEvents.map((event) => {
                          const primaryTag = getTags(event)[0];
                          const tone = getCategoryTone(primaryTag);
                          const closeLabel = getRegistrationCloseLabel(event);
                          return (
                          <div
                            key={`calendar-${event._id}`}
                            className={`group relative rounded-xl border px-3 py-2 text-xs ${
                              conflictIds.has(event._id)
                                ? "border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] text-[var(--rose)]"
                                : tone
                            }`}
                          >
                            <p className="font-bold">{event.title}</p>
                            <p className="mt-1 font-semibold">
                              {event.startTime} - {event.endTime}
                              {event.venue ? ` · ${event.venue}` : ""}
                            </p>
                            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3 text-xs text-[var(--text2)] opacity-0 shadow transition group-hover:opacity-100">
                              <p className="text-sm font-semibold text-[var(--text)]">{event.title}</p>
                              <p className="mt-1">
                                {event.date}
                                {event.startTime ? ` · ${event.startTime}` : ""}
                                {event.endTime ? ` - ${event.endTime}` : ""}
                              </p>
                              {event.venue && <p className="mt-1">Venue: {event.venue}</p>}
                              {closeLabel && <p className="mt-1">{closeLabel}</p>}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6">
            <h3 className="text-sm font-semibold">Smart Notification Center</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                <p className="font-semibold">Urgent</p>
                <p>Two venue conflicts detected next week.</p>
              </div>
              <div className="rounded-xl border border-[var(--border2)] bg-[var(--surface2)]/35 px-3 py-2 text-[var(--text2)]">
                <p className="font-semibold">Updates</p>
                <p>AI recommendations refreshed 5 minutes ago.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDrawerOpen && selectedEvent && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(8,11,18,0.75)] px-4 py-6 sm:items-center">
          <div className="bento-tile w-full max-w-lg rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text3)]">
                  Registration
                </p>
                <h3 className="mt-2 text-xl font-semibold">{selectedEvent.title}</h3>
                <p className="mt-2 text-sm text-[var(--text2)]">
                  {selectedEvent.date}
                  {selectedEvent.startTime ? ` · ${selectedEvent.startTime}` : ""}
                  {selectedEvent.venue ? ` · ${selectedEvent.venue}` : ""}
                </p>
                {getRegistrationCloseLabel(selectedEvent) && (
                  <p className="mt-2 text-xs font-semibold text-[var(--text3)]">
                    {getRegistrationCloseLabel(selectedEvent)}
                  </p>
                )}
              </div>
              <button
                className="neo-btn-ghost px-3 py-1 text-xs"
                type="button"
                onClick={() => setIsDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-[var(--text2)]">
              Confirm your spot and receive a QR pass for fast check-in.
            </p>
            {selectedEvent.registrationOpen === false && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Registration is closed for this event.
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="neo-btn flex-1 px-4 py-2 text-sm"
                type="button"
                onClick={handleConfirmRegistration}
                disabled={isRegistering || selectedEvent.registrationOpen === false}
              >
                {isRegistering ? "Registering..." : "Confirm registration"}
              </button>
              <button
                className="neo-btn-ghost flex-1 px-4 py-2 text-sm"
                type="button"
                onClick={() => setIsDrawerOpen(false)}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
