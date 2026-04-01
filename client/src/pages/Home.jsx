import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEvents } from "../lib/api.js";
import { getAuth } from "../lib/auth.js";

function parseEventDate(event) {
  if (!event?.date) {
    return null;
  }

  const [year, month, day] = String(event.date).split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  if (event?.startTime) {
    const [hours, minutes] = String(event.startTime).split(":").map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  }

  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSpeakerLabel(event) {
  const firstSpeaker = Array.isArray(event?.speakers) ? event.speakers[0] : null;
  if (!firstSpeaker?.name) {
    return "TBA";
  }

  if (firstSpeaker.title) {
    return `${firstSpeaker.name} (${firstSpeaker.title})`;
  }

  return firstSpeaker.name;
}

function monthLabel(value) {
  return value.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function Home() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(() => getAuth());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));

  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const data = await fetchEvents();
        if (isMounted) {
          setEvents(Array.isArray(data) ? data : []);
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

  const eventsByDate = useMemo(() => {
    const map = new Map();

    for (const event of events) {
      if (!event?.date) {
        continue;
      }
      const key = String(event.date);
      const bucket = map.get(key) || [];
      bucket.push(event);
      map.set(key, bucket);
    }

    for (const [key, list] of map.entries()) {
      const sorted = [...list].sort((a, b) => {
        const first = parseEventDate(a);
        const second = parseEventDate(b);
        if (!first && !second) {
          return 0;
        }
        if (!first) {
          return 1;
        }
        if (!second) {
          return -1;
        }
        return first.getTime() - second.getTime();
      });
      map.set(key, sorted);
    }

    return map;
  }, [events]);

  const { primaryEvents, primaryLabel } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const normalized = events
      .map((event) => ({ event, dateObj: parseEventDate(event) }))
      .filter((item) => Boolean(item.dateObj));

    const upcoming = normalized
      .filter((item) => item.dateObj >= todayStart)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map((item) => item.event);

    if (upcoming.length > 0) {
      return { primaryEvents: upcoming, primaryLabel: "Upcoming Events" };
    }

    const past = normalized
      .filter((item) => item.dateObj < todayStart)
      .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
      .map((item) => item.event);

    return { primaryEvents: past, primaryLabel: "Past Events" };
  }, [events]);

  const scheduleEvents = useMemo(() => {
    return eventsByDate.get(selectedDate) || [];
  }, [eventsByDate, selectedDate]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstWeekday = firstDay.getDay();

    const days = [];
    const totalCells = Math.ceil((firstWeekday + lastDay.getDate()) / 7) * 7;

    for (let index = 0; index < totalCells; index += 1) {
      const cellDate = new Date(year, month, index - firstWeekday + 1);
      const inCurrentMonth = cellDate.getMonth() === month;
      const key = formatDateKey(cellDate);
      const dayEvents = eventsByDate.get(key) || [];

      days.push({
        key,
        date: cellDate,
        inCurrentMonth,
        dayNumber: cellDate.getDate(),
        dayEvents
      });
    }

    return days;
  }, [calendarMonth, eventsByDate]);

  const selectedDateDisplay = useMemo(() => {
    const parsed = parseEventDate({ date: selectedDate, startTime: "00:00" });
    if (!parsed) {
      return selectedDate;
    }

    return parsed.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [selectedDate]);

  function showPreviousMonth() {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }

  function showNextMonth() {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }

  return (
    <section className="space-y-8">
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Campus Pulse
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              Events that matter right now.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Home now focuses on the next events first. If there are no upcoming events,
              you will see the latest completed ones instead.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-semibold text-white shadow"
              type="button"
              onClick={() => navigate("/events")}
            >
              Browse Events
            </button>
            {canCreate && (
              <button
                className="rounded-full border border-white/60 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => navigate("/events")}
              >
                Create Event
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{primaryLabel}</h2>
          {!loading && !error && (
            <p className="text-xs text-slate-500">{primaryEvents.length} events</p>
          )}
        </div>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="bento-tile animate-pulse rounded-2xl p-4">
                <div className="h-5 w-2/3 rounded-full bg-slate-200/70" />
                <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-200/70" />
                <div className="mt-3 h-4 w-1/3 rounded-full bg-slate-200/70" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && primaryEvents.length === 0 && (
          <div className="glass-panel rounded-2xl p-6 text-sm text-slate-600">
            No events are available yet.
          </div>
        )}

        {!loading && !error && primaryEvents.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {primaryEvents.map((event) => (
              <article key={event._id} className="bento-tile rounded-2xl p-4">
                <h3 className="text-base font-semibold text-slate-900">{event.title}</h3>
                <p className="mt-2 text-xs text-slate-600">
                  {event.date}
                  {event.startTime ? ` | ${event.startTime}` : ""}
                  {event.endTime ? ` - ${event.endTime}` : ""}
                </p>
                <p className="mt-2 text-xs text-slate-600">Venue: {event.venue || "TBA"}</p>
                <p className="mt-1 text-xs text-slate-600">Speaker: {getSpeakerLabel(event)}</p>
                {event.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600">{event.description}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass-panel rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Whole-Day Schedule</h3>
            <p className="text-xs text-slate-500">{selectedDateDisplay}</p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Click any date in the calendar to load that day schedule.
          </p>

          {scheduleEvents.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
              No events scheduled for this day.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {scheduleEvents.map((event) => (
                <div
                  key={`schedule-${event._id}`}
                  className="bento-tile grid gap-2 rounded-2xl p-4 md:grid-cols-[120px_minmax(0,1fr)]"
                >
                  <div className="text-sm font-semibold text-slate-800">
                    {event.startTime || "00:00"}
                    {event.endTime ? ` - ${event.endTime}` : ""}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-600">Speaker: {getSpeakerLabel(event)}</p>
                    <p className="mt-1 text-xs text-slate-600">Venue: {event.venue || "TBA"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Monthly Calendar</h3>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-white/60 bg-white/70 px-2 py-1 text-sm text-slate-700"
                type="button"
                onClick={showPreviousMonth}
                aria-label="Previous month"
              >
                {"<"}
              </button>
              <p className="min-w-[120px] text-center text-sm font-semibold text-slate-700">
                {monthLabel(calendarMonth)}
              </p>
              <button
                className="rounded-lg border border-white/60 bg-white/70 px-2 py-1 text-sm text-slate-700"
                type="button"
                onClick={showNextMonth}
                aria-label="Next month"
              >
                {">"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const isSelected = day.key === selectedDate;
              const hasEvents = day.dayEvents.length > 0;

              return (
                <button
                  key={`day-${day.key}`}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                  className={`group relative min-h-[66px] rounded-xl border px-2 py-2 text-left transition ${
                    day.inCurrentMonth
                      ? "border-slate-200 bg-white/80"
                      : "border-transparent bg-slate-100/60 text-slate-400"
                  } ${isSelected ? "ring-2 ring-[color:var(--primary)]" : ""}`}
                >
                  <span className="text-xs font-semibold">{day.dayNumber}</span>
                  {hasEvents && (
                    <span className="absolute bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[color:var(--accent)]" />
                  )}

                  {hasEvents && (
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl group-hover:block">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {day.key}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {day.dayEvents.slice(0, 3).map((event) => (
                          <li key={`popover-${event._id}`} className="text-xs text-slate-700">
                            <p className="font-semibold">{event.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {event.startTime || "00:00"}
                              {event.endTime ? ` - ${event.endTime}` : ""}
                            </p>
                          </li>
                        ))}
                        {day.dayEvents.length > 3 && (
                          <li className="text-[11px] text-slate-500">
                            +{day.dayEvents.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
