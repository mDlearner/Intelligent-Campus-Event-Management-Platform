import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMyNotifications, fetchMyRegistrations, sendReminders } from "../lib/api.js";
import { getAuth, getToken } from "../lib/auth.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => getAuth());
  const [registrations, setRegistrations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");
  const canCreate = auth?.user?.role === "club" || auth?.user?.role === "admin";
  const upcomingThisWeek = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 7);

    return registrations.filter((registration) => {
      const dateValue = registration?.event?.date;
      if (!dateValue) {
        return false;
      }
      const eventDate = new Date(dateValue);
      return eventDate >= now && eventDate <= cutoff;
    }).length;
  }, [registrations]);

  useEffect(() => {
    function handleAuthChange() {
      setAuth(getAuth());
    }

    function handleRegistrationsUpdate() {
      setRefreshKey((prev) => prev + 1);
    }

    window.addEventListener("auth-changed", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("registrations-updated", handleRegistrationsUpdate);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("registrations-updated", handleRegistrationsUpdate);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRegistrations() {
      const token = getToken();
      if (!token) {
        if (isMounted) {
          setRegistrations([]);
          setNotifications([]);
          setLoading(false);
        }
        return;
      }

      try {
        const [registrationsData, notificationsData] = await Promise.all([
          fetchMyRegistrations(token),
          fetchMyNotifications(token)
        ]);
        if (isMounted) {
          setRegistrations(registrationsData);
          setNotifications(notificationsData);
        }
      } catch {
        if (isMounted) {
          setRegistrations([]);
          setNotifications([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    loadRegistrations();

    return () => {
      isMounted = false;
    };
  }, [auth, refreshKey]);

  async function handleSendReminders() {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const result = await sendReminders(token);
      setNotice(`Scheduled ${result.scheduledCount} reminder(s).`);
    } catch (err) {
      setNotice(err.message || "Unable to schedule reminders");
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Registered Events</p>
        <p className="mt-2 text-2xl font-semibold">
          {loading ? "…" : registrations.length}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Upcoming This Week</p>
        <p className="mt-2 text-2xl font-semibold">
          {loading ? "…" : upcomingThisWeek}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Notifications</p>
        <p className="mt-2 text-2xl font-semibold">
          {loading ? "…" : notifications.length}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-3">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        {notice && (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {notice}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {canCreate && (
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
              type="button"
              onClick={() => navigate("/events")}
            >
              Create Event
            </button>
          )}
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            type="button"
            onClick={() => navigate("/events")}
          >
            View Calendar
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            type="button"
            onClick={handleSendReminders}
          >
            Send Reminder
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-3">
        <h2 className="text-lg font-semibold">My Registered Events</h2>
        {loading && <p className="mt-3 text-sm text-slate-600">Loading events...</p>}
        {!loading && registrations.length === 0 && (
          <p className="mt-3 text-sm text-slate-600">No registrations yet.</p>
        )}
        {!loading && registrations.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {registrations.map((registration) => (
              <div
                key={registration._id}
                className="rounded border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {registration.event?.title || "Untitled event"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {registration.event?.date || "TBA"}
                  {registration.event?.venue ? ` · ${registration.event.venue}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
