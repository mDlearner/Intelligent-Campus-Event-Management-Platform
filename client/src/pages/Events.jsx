import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createEvent, fetchEvents, registerForEvent } from "../lib/api.js";
import { getAuth, getToken } from "../lib/auth.js";

const initialEventForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  venue: "",
  maxSeats: ""
};

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialEventForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auth, setAuth] = useState(() => getAuth());
  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";

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
        venue: form.venue,
        maxSeats: form.maxSeats ? Number(form.maxSeats) : 0
      };

      const created = await createEvent(payload, token);
      setEvents((prev) => [created, ...prev]);
      setForm(initialEventForm);
    } catch (err) {
      setFormError(err.message || "Unable to create event");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(eventId) {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await registerForEvent(eventId, token);
      window.dispatchEvent(new Event("registrations-updated"));
      alert("Registered successfully");
    } catch (err) {
      alert(err.message || "Unable to register");
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold">Upcoming Events</h1>
      {canCreate && (
        <form
          className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2"
          onSubmit={handleCreate}
        >
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold">Create Event</h2>
          </div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Venue</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="text"
              name="venue"
              value={form.venue}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Start time</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="time"
              name="startTime"
              value={form.startTime}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">End time</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="time"
              name="endTime"
              value={form.endTime}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max seats (0 = unlimited)</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="number"
              name="maxSeats"
              value={form.maxSeats}
              onChange={handleChange}
              min="0"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="3"
            />
          </div>
          {formError && (
            <div className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="md:col-span-2">
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="mt-6 text-slate-600">Loading events...</p>}
      {error && (
        <p className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <div key={event._id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {event.date} · {event.venue}
            </p>
            {event.description && (
              <p className="mt-2 text-sm text-slate-600">{event.description}</p>
            )}
            <button
              className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              type="button"
              onClick={() => handleRegister(event._id)}
            >
              Register
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
