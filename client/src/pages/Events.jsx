import { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchEventsPaginated, createEvent, updateEvent, deleteEvent, registerForEvent } from '../lib/api.js';
import { getAuth, getToken } from '../lib/auth.js';
import { formatTime12h, formatTimeRange12h, formatEventDateTimeRange, getEventDateTimeSpan } from '../lib/time.js';
import { getCategoryTone, getEventTags, getRegistrationCloseLabel } from '../lib/eventUi.js';
import { validateEventPayload } from '../lib/schemas.js';

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

export default function Events({ showEnded = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pageSize = 8;
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(initialEventForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
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
  }, [searchParams]);

  useEffect(() => {
    const category = searchParams.get("category") || "All Categories";
    if (category !== selectedCategory) {
      setSelectedCategory(category);
    }
  }, [searchParams]);

  const eventsQuery = useInfiniteQuery({
    queryKey: ['events-paginated'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchEventsPaginated(pageParam, pageSize),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.page + 1 : undefined),
    refetchOnMount: 'always'
  });

  const events = useMemo(
    () => (eventsQuery.data?.pages || []).flatMap((page) => page.items || []),
    [eventsQuery.data]
  );
  const loading = eventsQuery.isLoading;
  const isLoadingMore = eventsQuery.isFetchingNextPage;
  const hasNextPage = eventsQuery.hasNextPage;
  const error = eventsQuery.error?.message || '';

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
        description: form.description || "",
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

      const validation = validateEventPayload(payload);
      if (!validation.success) {
        const errorMessages = Object.entries(validation.errors)
          .map(([field, msgs]) => msgs.join(', '))
          .join('; ');
        setFormError(errorMessages || "Validation failed");
        return;
      }

      if (editingEventId) {
        const updated = await updateEvent(editingEventId, payload, token);
        queryClient.invalidateQueries({ queryKey: ['events-paginated'] });
        setEditingEventId(null);
      } else {
        await createEvent(payload, token);
        queryClient.invalidateQueries({ queryKey: ['events-paginated'] });
      }
      setForm(initialEventForm);
    } catch (err) {
      setFormError(err.message || "Unable to create event");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(event) {
    navigate("/events/create", { state: { event } });
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
      queryClient.invalidateQueries({ queryKey: ['events-paginated'] });
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
      queryClient.invalidateQueries({ queryKey: ['events-paginated'] });
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

    const span = getEventDateTimeSpan(event.date, event.startTime, event.endDate, event.endTime);
    if (!span) {
      return false;
    }

    const now = new Date();
    return now >= span.start && now <= span.end;
  }

  function isEventEnded(event) {
    if (!event?.date || !DATE_REGEX.test(event.date)) {
      return false;
    }

    const span = getEventDateTimeSpan(event.date, event.startTime, event.endDate, event.endTime);
    if (!span) {
      return false;
    }

    return span.end < new Date();
  }

  const scopedEvents = useMemo(
    () => events.filter((event) => (showEnded ? isEventEnded(event) : !isEventEnded(event))),
    [events, showEnded]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set();
    scopedEvents.forEach((event) => {
      (event?.categories || []).forEach((category) => {
        if (typeof category === "string" && category.trim()) {
          categories.add(category.trim());
        }
      });
    });
    return ["All Categories", ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  }, [scopedEvents]);

  const filteredEvents = scopedEvents.filter((event) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [event?.title, event?.venue, event?.description, ...(event?.categories || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    if (!matchesQuery) {
      return false;
    }

    const matchesCategory =
      selectedCategory === "All Categories" ||
      (event?.categories || []).some(
        (category) => String(category).toLowerCase() === selectedCategory.toLowerCase()
      );
    if (!matchesCategory) {
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
      return getEventTags(event).includes("Workshop");
    }
    if (activeFilter === "Paid Event") {
      return getEventTags(event).includes("Paid Event");
    }
    return true;
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
                setSearchQuery(event.target.value);
              }}
              onBlur={() => {
                const nextParams = new URLSearchParams(searchParams);
                const trimmedQuery = searchQuery.trim();
                if (trimmedQuery) {
                  nextParams.set("search", trimmedQuery);
                } else {
                  nextParams.delete("search");
                }
                setSearchParams(nextParams, { replace: true });
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                const nextParams = new URLSearchParams(searchParams);
                const trimmedQuery = searchQuery.trim();
                if (trimmedQuery) {
                  nextParams.set("search", trimmedQuery);
                } else {
                  nextParams.delete("search");
                }
                setSearchParams(nextParams, { replace: true });
              }}
            />
          </div>
          <div className="glass-panel rounded-full px-4 py-3 lg:w-64">
            <select
              className="w-full bg-transparent text-sm font-semibold text-[var(--text)] outline-none"
              value={selectedCategory}
              onChange={(event) => {
                const nextCategory = event.target.value;
                setSelectedCategory(nextCategory);
                const nextParams = new URLSearchParams(searchParams);
                if (nextCategory && nextCategory !== "All Categories") {
                  nextParams.set("category", nextCategory);
                } else {
                  nextParams.delete("category");
                }
                setSearchParams(nextParams, { replace: true });
              }}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category} className="bg-[var(--bg2)] text-[var(--text)]">
                  {category}
                </option>
              ))}
            </select>
          </div>
          {!showEnded && (
            <div className="flex flex-wrap gap-2">
              {["All", "Happening Now", "This Week", "Workshops", "Paid Event"].map((filter) => (
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

      <div className="mt-3 space-y-6">
          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`event-skeleton-${index}`} className="bento-tile animate-pulse rounded-3xl p-4">
                  <div className="h-52 rounded-2xl bg-[var(--surface2)]/70" />
                  <div className="mt-4 h-4 w-2/3 rounded-full bg-[var(--surface2)]/70" />
                  <div className="mt-3 h-3 w-1/2 rounded-full bg-[var(--surface2)]/70" />
                </div>
              ))}
            </div>
          )}
          {!loading && error && (
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
                  className="bento-tile flex flex-col justify-between rounded-3xl p-5 transition hover:-translate-y-1 hover:border-[var(--gold2)] hover:shadow-lg hover:shadow-[rgba(240,192,64,0.1)] cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/events/${event._id}`)}
                >
                  <div
                    className={`relative flex h-52 items-end justify-between overflow-hidden rounded-2xl p-4 text-white ${
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
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="flex flex-wrap gap-2">
                      {getEventTags(event).map((tag) => (
                        <span
                          key={`${event._id}-${tag}`}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${getCategoryTone(tag)}`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold text-[var(--text)]">{event.title}</h2>
                      {event.registrationOpen !== false && (
                        <span className="shrink-0 rounded-full bg-[var(--gold)]/20 px-3 py-1 text-[10px] font-semibold text-[var(--gold)]">
                          Seats: {event.seatsRemaining ?? event.maxSeats}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[var(--text2)]">
                      {formatEventDateTimeRange(event.date, event.startTime, event.endDate, event.endTime)}
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
                    <div className="mt-4 flex items-center justify-end text-xs font-semibold text-[var(--text3)]">
                      <span className={event.registrationOpen === false ? "font-semibold text-[var(--rose)]" : "font-semibold text-[var(--teal)]"}>
                        {event.registrationOpen === false ? "Registration closed" : "Registration open"}
                      </span>
                    </div>
                  )}
                  <div className="mt-3 h-2 rounded-full bg-[var(--surface2)]">
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
                        className="flex-1 rounded-full border border-[var(--blue)]/30 bg-[rgba(77,159,255,0.1)] px-3 py-2 text-xs font-bold text-[var(--blue)] transition hover:bg-[rgba(77,159,255,0.2)]"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(event);
                        }}
                      >
                        Edit
                      </button>
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

          {!loading && !error && hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                className="rounded-full border border-[var(--border2)] bg-[var(--surface2)]/50 px-5 py-2 text-sm font-semibold text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => eventsQuery.fetchNextPage()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading more...' : 'Load more events'}
              </button>
            </div>
          )}

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
                  {selectedEvent.startTime ? ` · ${formatTime12h(selectedEvent.startTime)}` : ""}
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
