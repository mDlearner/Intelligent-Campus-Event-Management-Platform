import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEvents } from "../lib/api.js";
import { getAuth } from "../lib/auth.js";

export default function Home() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("For You");
  const [favorites, setFavorites] = useState(() => new Set());
  const [auth, setAuth] = useState(() => getAuth());
  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";

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

  const upcomingWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 7);

    function parseDateOnly(value) {
      if (!value) {
        return null;
      }

      if (typeof value === "string") {
        const parts = value.split("-");
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          const parsed = new Date(year, month - 1, day);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return events.filter((event) => {
      const eventDate = parseDateOnly(event?.date);
      if (!eventDate) {
        return false;
      }
      return eventDate >= today && eventDate <= cutoff;
    });
  }, [events]);

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
    if (title.includes("hack") || title.includes("code") || title.includes("dev")) {
      tags.push("Hackathon");
    }
    if (title.includes("music") || title.includes("dance") || title.includes("cultural")) {
      tags.push("Cultural");
    }
    if (title.includes("workshop") || title.includes("learn")) {
      tags.push("Workshop");
    }
    if (title.includes("food") || title.includes("pizza")) {
      tags.push("Free Food");
    }
    if (tags.length === 0) {
      tags.push("Campus");
    }
    return tags.slice(0, 2);
  }

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
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
      if (activeFilter === "Free Food") {
        return getTags(event).includes("Free Food");
      }
      if (activeFilter === "Workshops") {
        return getTags(event).includes("Workshop");
      }
      return true;
    });
  }, [events, searchQuery, activeFilter]);

  function toggleFavorite(eventId) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  const filters = ["For You", "Happening Now", "Free Food", "Workshops"];

  return (
    <section className="space-y-8">
      <div className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Campus Pulse
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              Discover the energy of campus life in real time.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Find what is happening now, secure your spot in seconds, and keep your schedule
              organized with smart reminders and live updates.
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
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="glass-panel flex flex-1 items-center gap-3 rounded-full px-4 py-3">
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
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Search by club, event name, or venue"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeFilter === filter
                    ? "bg-[color:var(--accent)] text-white"
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="space-y-4">
          <div className="bento-tile rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Navigation
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <button className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-white" type="button">
                Home Feed
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">Live</span>
              </button>
              <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-100/70" type="button">
                My Events
                <span className="text-xs text-slate-400">0</span>
              </button>
              <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-100/70" type="button">
                Saved
                <span className="text-xs text-slate-400">{favorites.size}</span>
              </button>
              <button className="flex w-full items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-100/70" type="button">
                Campus Map
                <span className="text-xs text-slate-400">New</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">For You</h2>
            <p className="text-xs text-slate-500">Powered by campus trends</p>
          </div>

          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-${index}`} className="bento-tile animate-pulse rounded-3xl p-4">
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
              No events matched your filters. Try a different category or search phrase.
            </div>
          )}
          {!loading && !error && filteredEvents.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredEvents.map((event, index) => {
                const tags = getTags(event);
                const isFavorite = favorites.has(event._id);
                return (
                  <article
                    key={event._id}
                    className="bento-tile group overflow-hidden rounded-3xl p-4 transition hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div
                      className={`flex h-32 items-end justify-between rounded-2xl bg-gradient-to-br p-4 text-white ${
                        index % 3 === 0
                          ? "from-indigo-500/80 via-slate-900/80 to-slate-900"
                          : index % 3 === 1
                          ? "from-orange-400/80 via-rose-500/80 to-slate-900"
                          : "from-emerald-400/80 via-cyan-500/80 to-slate-900"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em]">Featured</p>
                      <button
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                          isFavorite ? "bg-white text-rose-500" : "bg-white/20 text-white"
                        }`}
                        type="button"
                        onClick={() => toggleFavorite(event._id)}
                        aria-label="Save event"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-4 w-4"
                          fill={isFavorite ? "currentColor" : "none"}
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.48 3.499a5.25 5.25 0 017.372 7.372L12 17.723l-6.852-6.852a5.25 5.25 0 017.372-7.372l.48.48.48-.48z"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
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
                      <h3 className="mt-3 text-lg font-semibold">{event.title}</h3>
                      <p className="mt-2 text-xs text-slate-500">
                        {event.date}
                        {event.startTime ? ` · ${event.startTime}` : ""}
                        {event.venue ? ` · ${event.venue}` : ""}
                      </p>
                      {event.description && (
                        <p className="mt-3 text-sm text-slate-600">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
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
                      </div>
                      {event.registrationOpen !== false && (
                        <button
                          className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          type="button"
                          onClick={() => navigate("/events")}
                        >
                          Register now
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <h3 className="text-sm font-semibold">Happening Soon</h3>
            {loading && <p className="mt-3 text-xs text-slate-500">Loading updates...</p>}
            {!loading && upcomingWeek.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">No events scheduled this week.</p>
            )}
            {!loading && upcomingWeek.length > 0 && (
              <ul className="mt-3 space-y-3 text-xs text-slate-600">
                {upcomingWeek.slice(0, 3).map((event) => (
                  <li key={`soon-${event._id}`} className="rounded-xl border border-white/60 bg-white/60 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                    <p className="mt-1">
                      {event.date}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bento-tile rounded-2xl p-4">
            <h3 className="text-sm font-semibold">Club Leaderboard</h3>
            <div className="mt-3 space-y-3 text-xs text-slate-600">
              {[
                { name: "Robotics Guild", points: 420 },
                { name: "Design Collective", points: 368 },
                { name: "Cultural Union", points: 312 }
              ].map((club) => (
                <div key={club.name} className="flex items-center justify-between">
                  <span>{club.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                    {club.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
