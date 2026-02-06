import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEvents } from "../lib/api.js";
import { getAuth } from "../lib/auth.js";

export default function Home() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-bold">Intelligent Campus Events</h1>
        <p className="mt-3 text-slate-600">
          Discover upcoming events, register in seconds, and stay informed with automated
          reminders and real-time updates.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white"
            type="button"
            onClick={() => navigate("/events")}
          >
            Browse Events
          </button>
          {canCreate && (
            <button
              className="rounded border border-slate-300 px-4 py-2"
              type="button"
              onClick={() => navigate("/events")}
            >
              Create Event
            </button>
          )}
        </div>
      </div>
      {auth && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Upcoming This Week</h2>
          {loading && <p className="mt-3 text-sm text-slate-600">Loading events...</p>}
          {error && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {!loading && !error && upcomingWeek.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">No events scheduled this week.</p>
          )}
          {!loading && !error && upcomingWeek.length > 0 && (
            <ul className="mt-4 space-y-3 text-slate-700">
              {upcomingWeek.map((event) => (
                <li key={event._id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {event.date}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
