import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createEvent, deleteEvent, fetchEvents, registerForEvent, updateEvent } from "../lib/api.js";
import { getAuth, getToken } from "../lib/auth.js";

const initialEventForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  registrationCloseDate: "",
  registrationCloseTime: "",
  venue: "",
  maxSeats: ""
};

export default function Events() {
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
        maxSeats: form.maxSeats ? Number(form.maxSeats) : 0
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
      maxSeats: event.maxSeats ? String(event.maxSeats) : ""
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
    if (tag === "Workshop") {
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    }
    if (tag === "Free Food") {
      return "border-orange-200 bg-orange-50 text-orange-700";
    }
    if (tag === "Career") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  function getRegistrationCloseLabel(event) {
    if (!event?.registrationCloseDate && !event?.registrationCloseTime) {
      return "";
    }
    const date = event.registrationCloseDate || "";
    const time = event.registrationCloseTime ? ` · ${event.registrationCloseTime}` : "";
    return `Registration closes ${date}${time}`.trim();
  }

  const filteredEvents = events.filter((event) => {
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Student Discovery
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Upcoming Events</h1>
            <p className="mt-2 text-sm text-slate-600">
              Search, filter, and register without leaving the feed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["All", "Happening Now", "This Week", "Workshops", "Free Food"].map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeFilter === filter
                    ? "bg-[color:var(--primary)] text-white"
                    : "border border-white/60 bg-white/60 text-slate-600"
                }`}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 glass-panel flex items-center gap-3 rounded-full px-4 py-3">
          <span className="text-slate-500">
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
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
            placeholder="Search by event name, club, or venue"
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
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-white/60 bg-white/60 px-3 py-1">
            Showing {displayedEvents.length} events
          </span>
          <span>Search applies to the calendar and feed.</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`event-skeleton-${index}`} className="bento-tile animate-pulse rounded-3xl p-4">
                  <div className="h-32 rounded-2xl bg-slate-200/70" />
                  <div className="mt-4 h-4 w-2/3 rounded-full bg-slate-200/70" />
                  <div className="mt-3 h-3 w-1/2 rounded-full bg-slate-200/70" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && filteredEvents.length === 0 && (
            <div className="glass-panel rounded-2xl p-6 text-sm text-slate-600">
              No events match your search. Try clearing a filter.
            </div>
          )}
          {!loading && !error && filteredEvents.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEvents.map((event, index) => (
                <article
                  key={event._id}
                  className="bento-tile flex flex-col justify-between rounded-3xl p-4 transition hover:-translate-y-1"
                >
                  <div
                    className={`flex h-28 items-end justify-between rounded-2xl bg-gradient-to-br p-4 text-white ${
                      index % 2 === 0
                        ? "from-indigo-500/80 via-slate-900/80 to-slate-900"
                        : "from-orange-400/80 via-rose-500/80 to-slate-900"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]">{event.status}</p>
                    <span className="rounded-full bg-white/20 px-2 py-1 text-[10px]">
                      {event.maxSeats ? `${event.maxSeats} seats` : "Open"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {getTags(event).map((tag) => (
                        <span
                          key={`${event._id}-${tag}`}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            tag === "Free Food" ? "warm-chip" : "accent-chip"
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold">{event.title}</h2>
                    <p className="mt-2 text-xs text-slate-500">
                      {event.date}
                      {event.startTime && event.endTime
                        ? ` · ${event.startTime} - ${event.endTime}`
                        : event.startTime
                        ? ` · ${event.startTime}`
                        : ""}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                    {getRegistrationCloseLabel(event) && (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {getRegistrationCloseLabel(event)}
                      </p>
                    )}
                    {event.description && (
                      <p className="mt-3 text-sm text-slate-600">{event.description}</p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {event.maxSeats
                        ? `${event.seatsRemaining ?? event.maxSeats} seats left`
                        : "Open capacity"}
                    </span>
                    <span className={event.registrationOpen === false ? "text-red-500" : "text-green-500"}>
                      {event.registrationOpen === false ? "Registration closed" : "Registration open"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-400 to-orange-400" />
                  </div>
                  {!isHappeningNow(event) && event.registrationOpen !== false && (
                    <button
                      className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      type="button"
                      onClick={() => {
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
                        className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                        type="button"
                        onClick={() => handleEdit(event)}
                      >
                        Edit
                      </button>
                      <button
                        className="flex-1 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                        type="button"
                        onClick={() => handleDelete(event._id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="glass-panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Intelligent Calendar</h2>
              <p className="text-xs text-slate-500">Conflicts highlighted automatically</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
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
                  <div key={dateKey} className="relative rounded-2xl border border-white/60 bg-white/60 p-3">
                    <p className="text-xs font-semibold text-slate-500">{dateLabel}</p>
                    {dayEvents.length === 0 && (
                      <p className="mt-3 text-xs text-slate-400">No events</p>
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
                                ? "border-red-300 bg-red-50 text-red-700"
                                : tone
                            }`}
                          >
                            <p className="font-semibold">{event.title}</p>
                            <p className="mt-1">
                              {event.startTime} - {event.endTime}
                              {event.venue ? ` · ${event.venue}` : ""}
                            </p>
                            <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 opacity-0 shadow transition group-hover:opacity-100">
                              <p className="text-sm font-semibold text-slate-800">{event.title}</p>
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
        </div>

        <div className="space-y-6">
          {canCreate && (
            <form className="bento-tile rounded-3xl p-6" onSubmit={handleCreate}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editingEventId ? "Edit Event" : "Create Event"}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                  Organizer
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Title</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Venue</label>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                    type="text"
                    name="venue"
                    value={form.venue}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Date</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Max seats</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="number"
                      name="maxSeats"
                      value={form.maxSeats}
                      onChange={handleChange}
                      min="0"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Event start</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="time"
                      name="startTime"
                      value={form.startTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Event end</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="time"
                      name="endTime"
                      value={form.endTime}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Registration closes</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="date"
                      name="registrationCloseDate"
                      value={form.registrationCloseDate}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Close time</label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                      type="time"
                      name="registrationCloseTime"
                      value={form.registrationCloseTime}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Description</label>
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--primary)]"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows="3"
                  />
                </div>
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formError}
                  </div>
                )}
                <button
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? editingEventId
                      ? "Saving..."
                      : "Creating..."
                    : editingEventId
                    ? "Save changes"
                    : "Create Event"}
                </button>
                {editingEventId && (
                  <button
                    className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                    type="button"
                    onClick={() => {
                      setEditingEventId(null);
                      setForm(initialEventForm);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="glass-panel rounded-3xl p-6">
            <h3 className="text-sm font-semibold">Smart Notification Center</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                <p className="font-semibold">Urgent</p>
                <p>Two venue conflicts detected next week.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-slate-600">
                <p className="font-semibold">Updates</p>
                <p>AI recommendations refreshed 5 minutes ago.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDrawerOpen && selectedEvent && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 px-4 py-6 sm:items-center">
          <div className="bento-tile w-full max-w-lg rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Registration
                </p>
                <h3 className="mt-2 text-xl font-semibold">{selectedEvent.title}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedEvent.date}
                  {selectedEvent.startTime ? ` · ${selectedEvent.startTime}` : ""}
                  {selectedEvent.venue ? ` · ${selectedEvent.venue}` : ""}
                </p>
                {getRegistrationCloseLabel(selectedEvent) && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {getRegistrationCloseLabel(selectedEvent)}
                  </p>
                )}
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500"
                type="button"
                onClick={() => setIsDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Confirm your spot and receive a QR pass for fast check-in.
            </p>
            {selectedEvent.registrationOpen === false && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Registration is closed for this event.
              </div>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={handleConfirmRegistration}
                disabled={isRegistering || selectedEvent.registrationOpen === false}
              >
                {isRegistering ? "Registering..." : "Confirm registration"}
              </button>
              <button
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
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
