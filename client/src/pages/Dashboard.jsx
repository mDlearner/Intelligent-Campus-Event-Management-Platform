import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchMyNotifications, fetchMyRegistrations } from "../lib/api.js";
import { getAuth, getToken } from "../lib/auth.js";
import { formatEventDateTimeRange } from "../lib/time.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState(() => getAuth());
  const [showQrPass, setShowQrPass] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const token = getToken();
      if (!token) {
        return { registrations: [], notifications: [] };
      }

      const [registrationsData, notificationsData] = await Promise.all([
        fetchMyRegistrations(token),
        fetchMyNotifications(token)
      ]);

      return { registrations: registrationsData, notifications: notificationsData };
    },
    enabled: !!getToken()
  });

  const registrations = dashboardQuery.data?.registrations || [];
  const notifications = dashboardQuery.data?.notifications || [];
  const loading = dashboardQuery.isLoading;

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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

  return (
    <section className="space-y-6">
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

        <div className="bento-tile rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">My Registered Events</h2>
          </div>
          {loading && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`dashboard-registration-skeleton-${index}`} className="animate-pulse rounded-2xl border border-[var(--border2)] bg-[var(--surface2)]/30 p-4">
                  <div className="h-4 w-3/4 rounded-full bg-[var(--surface2)]/70" />
                  <div className="mt-3 h-3 w-1/2 rounded-full bg-[var(--surface2)]/70" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-8 w-20 rounded-full bg-[var(--surface2)]/70" />
                    <div className="h-8 w-24 rounded-full bg-[var(--surface2)]/70" />
                  </div>
                </div>
              ))}
            </div>
          )}
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
                {formatEventDateTimeRange(
                  selectedRegistration?.event?.date,
                  selectedRegistration?.event?.startTime,
                  selectedRegistration?.event?.endDate,
                  selectedRegistration?.event?.endTime
                )}
                {selectedRegistration?.event?.venue ? ` · ${selectedRegistration.event.venue}` : ""}
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
