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
  const [showQrPass, setShowQrPass] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
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
    <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="bento-tile rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text3)]">
            My Dashboard
          </p>
          <div className="mt-4 space-y-2 text-sm text-[var(--text2)]">
            <button className="neo-btn flex w-full items-center justify-between px-3 py-2 font-semibold" type="button">
              Overview
              <span className="rounded-full bg-[var(--gold2)]/20 px-2 py-0.5 text-[10px]">Live</span>
            </button>
            <button className="neo-btn-ghost flex w-full items-center justify-between px-3 py-2" type="button" onClick={() => navigate("/events")}>
              Browse Events
              <span className="text-xs text-[var(--text3)]">Discover</span>
            </button>
            <button className="neo-btn-ghost flex w-full items-center justify-between px-3 py-2" type="button">
              Registrations
              <span className="text-xs text-[var(--text3)]">{registrations.length}</span>
            </button>
            <button className="neo-btn-ghost flex w-full items-center justify-between px-3 py-2" type="button">
              Calendar
              <span className="text-xs text-[var(--text3)]">View</span>
            </button>
          </div>
        </div>
        <div className="bento-tile rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Actions</h3>
          {notice && (
            <div className="mt-3 rounded-xl border border-[var(--teal)]/30 bg-[rgba(0,212,170,0.1)] px-3 py-2 text-xs text-[var(--teal)]">
              {notice}
            </div>
          )}
          <div className="mt-4 space-y-2">
            {canCreate && (
              <button
                className="neo-btn w-full px-3 py-2 text-xs"
                type="button"
                onClick={() => navigate("/events/create")}
              >
                + Create Event
              </button>
            )}
            <button
              className="neo-btn-ghost w-full px-3 py-2 text-xs"
              type="button"
              onClick={() => navigate("/events")}
            >
              View Calendar
            </button>
            <button
              className="neo-btn-ghost w-full px-3 py-2 text-xs"
              type="button"
              onClick={handleSendReminders}
            >
              Send Reminders
            </button>
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bento-tile rounded-2xl p-4">
            <p className="text-xs font-semibold text-[var(--text3)]">Registered Events</p>
            <p className="mt-3 text-3xl font-bold text-[var(--gold)]">
              {loading ? "…" : registrations.length}
            </p>
          </div>
          <div className="bento-tile rounded-2xl p-4">
            <p className="text-xs font-semibold text-[var(--text3)]">This Week</p>
            <p className="mt-3 text-3xl font-bold text-[var(--teal)]">
              {loading ? "…" : upcomingThisWeek}
            </p>
          </div>
          <div className="bento-tile rounded-2xl p-4">
            <p className="text-xs font-semibold text-[var(--text3)]">Notifications</p>
            <p className="mt-3 text-3xl font-bold text-[var(--blue)]">
              {loading ? "…" : notifications.length}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bento-tile rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">Dashboard</h2>
              <span className="rounded-full bg-[rgba(0,212,170,0.12)] px-2 py-1 text-[10px] font-semibold text-[var(--teal)]">
                Live
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--text2)]">
              Overview of your registered events and activity.
            </p>
            <div className="mt-6 rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/35 p-4">
              <svg viewBox="0 0 400 140" className="h-32 w-full">
                <defs>
                  <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <path
                  d="M10 110 C 60 40, 120 80, 180 50 C 230 30, 280 40, 330 20"
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="4"
                />
                <circle cx="180" cy="50" r="6" fill="#4f46e5" />
                <circle cx="330" cy="20" r="6" fill="#f97316" />
              </svg>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-[var(--text)]">Notifications</h3>
            <div className="mt-4 space-y-3 text-xs">
                <div className="rounded-xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-[var(--rose)]">
                <p className="font-semibold">Alerts</p>
                <p>Check your registrations and calendar.</p>
              </div>
                <div className="rounded-xl border border-[var(--border2)] bg-[var(--surface2)]/35 px-3 py-2 text-[var(--text2)]">
                <p className="font-semibold">Updates</p>
                <p>Stay tuned for new events and opportunities.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bento-tile rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">My Registered Events</h2>
            {registrations.length > 0 && (
              <button
                className="neo-btn rounded-full px-3 py-1 text-xs"
                type="button"
                onClick={() => {
                  setSelectedRegistration(registrations[0]);
                  setShowQrPass(true);
                }}
              >
                Show QR Pass
              </button>
            )}
          </div>
          {loading && <p className="mt-3 text-sm text-[var(--text2)]">Loading events...</p>}
          {!loading && registrations.length === 0 && (
            <div className="mt-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/30 px-4 py-6 text-sm text-[var(--text2)]">
              No registrations yet. Find your first event and unlock your QR pass.
            </div>
          )}
          {!loading && registrations.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {registrations.map((registration) => (
                <div
                  key={registration._id}
                  className="rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/30 p-4 transition hover:-translate-y-0.5 hover:border-[var(--gold2)]"
                >
                  <p className="text-sm font-bold text-[var(--text)]">
                    {registration.event?.title || "Untitled event"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text2)]">
                    {registration.event?.date || "TBA"}
                    {registration.event?.venue ? ` · ${registration.event.venue}` : ""}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="neo-btn rounded-full px-3 py-1 text-xs"
                      type="button"
                      onClick={() => {
                        setSelectedRegistration(registration);
                        setShowQrPass(true);
                      }}
                    >
                      Show QR
                    </button>
                    <button
                      className="neo-btn-ghost rounded-full px-3 py-1 text-xs"
                      type="button"
                      onClick={() => navigate(`/events/${registration.event?._id}`)}
                      disabled={!registration.event?._id}
                    >
                      Event Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showQrPass && selectedRegistration && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(8,11,18,0.72)] px-4 py-6">
          <div className="bento-tile w-full max-w-md rounded-3xl p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text3)]">QR Pass</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--text)]">Ready for check-in</h3>
            <div className="mt-6 flex items-center justify-center">
              <div className="grid h-40 w-40 place-items-center rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/35">
                <div className="grid h-28 w-28 grid-cols-6 gap-1">
                  {Array.from({ length: 36 }).map((_, index) => (
                    <div
                      key={`qr-${index}`}
                      className={`${index % 3 === 0 ? "bg-[var(--text)]" : "bg-[var(--surface2)]"} rounded-sm`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/35 px-4 py-3 text-left text-xs text-[var(--text2)]">
              <p className="text-sm font-semibold text-[var(--text)]">{auth?.user?.name || "Student"}</p>
              <p className="mt-1">ID: {auth?.user?.studentId || "Not set"}</p>
              <p className="mt-1">Year: {auth?.user?.year || "Not set"}</p>
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">Event details</p>
              <p className="mt-1">{selectedRegistration?.event?.title || "Event"}</p>
              <p className="mt-1">
                {selectedRegistration?.event?.date || "TBA"}
                {selectedRegistration?.event?.startTime
                  ? ` · ${selectedRegistration.event.startTime}`
                  : ""}
                {selectedRegistration?.event?.venue
                  ? ` · ${selectedRegistration.event.venue}`
                  : ""}
              </p>
            </div>
            <p className="mt-4 text-sm text-[var(--text2)]">
              Download to wallet for quick entry.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="neo-btn flex-1 px-4 py-2 text-sm"
                type="button"
                onClick={() => setShowQrPass(false)}
              >
                Download to Wallet
              </button>
              <button
                className="neo-btn-ghost flex-1 px-4 py-2 text-sm"
                type="button"
                onClick={() => setShowQrPass(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
