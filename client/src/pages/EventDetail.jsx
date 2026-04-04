import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchEventById, registerForEvent } from "../lib/api.js";
import { getToken } from "../lib/auth.js";
import { formatEventDateTimeRange, formatTime12h, formatTimeRange12h } from "../lib/time.js";

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const data = await fetchEventById(eventId);
        setEvent(data);
      } catch (err) {
        setError(err.message || "Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-[color:var(--accent)]" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-700">
        {error || "Event not found"}
      </div>
    );
  }

  async function handleRegister() {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setIsRegistering(true);
      setNotice("");
      await registerForEvent(event._id, token);
      setNotice("Registration confirmed. Your dashboard has been updated.");
      window.dispatchEvent(new Event("registrations-updated"));
      setEvent((prev) => {
        if (!prev) {
          return prev;
        }
        const nextRegistered = Number(prev.registeredCount || 0) + 1;
        const seats = Number(prev.maxSeats || 0);
        return {
          ...prev,
          registeredCount: nextRegistered,
          seatsRemaining: seats > 0 ? Math.max(seats - nextRegistered, 0) : null,
          registrationOpen: seats > 0 ? nextRegistered < seats : true
        };
      });
    } catch (err) {
      setNotice(err.message || "Unable to register for this event");
    } finally {
      setIsRegistering(false);
    }
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

  return (
    <section className="space-y-6">
      <button
        className="flex items-center gap-2 rounded-full border border-[var(--border2)] bg-[var(--surface)]/50 px-4 py-2 text-xs font-semibold text-[var(--text2)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
        type="button"
        onClick={() => navigate("/events")}
      >
        <span>←</span>
        Back to Events
      </button>

      <div className="glass-panel overflow-hidden rounded-3xl">
        {event.imageUrl && (
          <div className="relative h-[420px] overflow-hidden rounded-3xl md:h-[460px]">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-full w-full rounded-3xl object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(8,11,18,0.32)] via-[rgba(8,11,18,0.48)] to-[rgba(8,11,18,0.74)]" />

            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-8">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Event Detail</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl text-white">{event.title}</h1>
                <p className="mt-3 text-sm text-white/80">{event.venue}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 backdrop-blur-sm">
                  {event.status || "upcoming"}
                </span>
                <span
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur-sm ${
                    event.registrationOpen === false
                      ? "bg-[rgba(255,107,138,0.22)] text-[var(--rose)]"
                      : "bg-[rgba(0,212,170,0.22)] text-[var(--teal)]"
                  }`}
                >
                  {event.registrationOpen === false ? "Registration Closed" : "Registration Open"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="p-8">
          {!event.imageUrl && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text3)]">Event Detail</p>
                <h1 className="mt-2 text-3xl font-semibold md:text-4xl text-[var(--text)]">{event.title}</h1>
                <p className="mt-3 text-sm text-[var(--text2)]">{event.venue}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--surface2)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text2)]">
                  {event.status || "upcoming"}
                </span>
                <span
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                    event.registrationOpen === false
                      ? "bg-[rgba(255,107,138,0.2)] text-[var(--rose)]"
                      : "bg-[rgba(0,212,170,0.2)] text-[var(--teal)]"
                  }`}
                >
                  {event.registrationOpen === false ? "Registration Closed" : "Registration Open"}
                </span>
              </div>
            </div>
          )}

        {event.categories && event.categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {event.categories.map((cat) => (
              <span
                key={cat}
                className={`rounded-full border px-4 py-2 text-sm font-bold ${getCategoryTone(cat)}`}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text3)]">Date</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {formatEventDateTimeRange(event.date, event.startTime, event.endDate, event.endTime)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text3)]">Time</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {formatTimeRange12h(event.startTime, event.endTime)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text3)]">Seats Available</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {event.seatsRemaining ?? event.maxSeats}
            </p>
          </div>
        </div>

        {event.registrationCloseDate && (
          <div className="mb-8 rounded-2xl border border-[var(--gold)]/30 bg-[rgba(240,192,64,0.08)] p-4">
            <p className="font-semibold text-[var(--gold)]">Registration closes:</p>
            <p className="mt-1 text-[var(--text2)]">
              {event.registrationCloseDate}
              {event.registrationCloseTime ? ` at ${formatTime12h(event.registrationCloseTime)}` : ""}
            </p>
          </div>
        )}

        <div className="mb-8 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 text-2xl font-bold text-[var(--text)]">Description</h2>
          <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed text-[var(--text2)]">
            {event.description || "No description provided"}
          </p>
        </div>

        <div className="mb-8 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 text-2xl font-semibold text-[var(--text)]">Registration</h2>
          <p className="text-sm text-[var(--text2)]">
            Reserve your spot now. Your registration will appear in Dashboard instantly.
          </p>
          {notice && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                notice.toLowerCase().includes("confirmed")
                  ? "border-[var(--teal)]/30 bg-[rgba(0,212,170,0.1)] text-[var(--teal)]"
                  : "border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] text-[var(--rose)]"
              }`}
            >
              {notice}
            </div>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-60 transition hover:bg-[var(--gold2)]"
              type="button"
              onClick={handleRegister}
              disabled={isRegistering || event.registrationOpen === false}
            >
              {isRegistering ? "Registering..." : "Register For This Event"}
            </button>
            <button
              className="rounded-full border border-[var(--border2)] bg-[var(--surface)]/50 px-5 py-2 text-sm font-semibold text-[var(--text2)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
              type="button"
              onClick={() => navigate("/dashboard")}
            >
              Open Dashboard
            </button>
          </div>
        </div>

        {event.speakers && event.speakers.length > 0 && (
          <div className="mb-8 border-t border-[var(--border)] pt-8">
            <h2 className="mb-6 text-2xl font-semibold text-[var(--text)]">Speakers</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {event.speakers.map((speaker, index) => (
                <div key={index} className="glass-panel relative overflow-hidden rounded-3xl border border-[var(--border2)] p-6 text-center backdrop-blur-xl transition hover:border-[var(--gold2)] hover:shadow-lg hover:shadow-[rgba(240,192,64,0.1)]">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--gold)]/10 blur-2xl" />
                  {speaker.imageUrl && (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={speaker.imageUrl}
                        alt={speaker.name}
                        className="h-32 w-32 rounded-full border-4 border-[var(--border2)] object-cover shadow-xl"
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-[var(--text)]">{speaker.name || "Speaker"}</h3>
                  {speaker.title && <p className="mt-1 text-sm font-bold text-[var(--text2)]">{speaker.title}</p>}
                  {speaker.bio && <p className="mt-3 text-sm font-semibold text-[var(--text3)]">{speaker.bio}</p>}
                  
                  {speaker.socialLinks && (
                    <div className="mt-4 flex justify-center gap-3">
                      {speaker.socialLinks.linkedin && (
                        <a
                          href={speaker.socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] transition hover:border-[var(--blue)] hover:bg-[var(--surface)] hover:text-[var(--blue)]"
                          title="LinkedIn"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                          </svg>
                        </a>
                      )}
                      {speaker.socialLinks.twitter && (
                        <a
                          href={speaker.socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] transition hover:border-[var(--blue)] hover:bg-[var(--surface)] hover:text-[var(--blue)]"
                          title="Twitter"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9 0 11-4s1-6.75-1-7.5a5.5 5.5 0 00-.5-.05z" />
                          </svg>
                        </a>
                      )}
                      {speaker.socialLinks.github && (
                        <a
                          href={speaker.socialLinks.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] transition hover:border-[var(--text2)] hover:bg-[var(--surface)] hover:text-[var(--text2)]"
                          title="GitHub"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                        </a>
                      )}
                      {speaker.socialLinks.website && (
                        <a
                          href={speaker.socialLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] transition hover:border-[var(--gold)] hover:bg-[var(--surface)] hover:text-[var(--gold)]"
                          title="Website"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0 1c-4.968 0-9 4.031-9 9s4.031 9 9 9 9-4.031 9-9-4.031-9-9-9zm3.5 9c0 1.933-1.567 3.5-3.5 3.5s-3.5-1.567-3.5-3.5 1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {event.sponsors && event.sponsors.length > 0 && (
          <div className="border-t border-[var(--border)] pt-8">
            <h2 className="mb-6 text-2xl font-bold text-[var(--text)]">Sponsors</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {event.sponsors.map((sponsor, index) => (
                <div
                  key={index}
                  className="glass-panel relative flex min-h-[176px] items-center gap-5 overflow-hidden rounded-3xl border border-[var(--border2)] p-6 backdrop-blur-xl transition hover:border-[var(--gold2)]"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--gold)]/10 blur-2xl" />

                  <div className="relative z-10 flex h-32 w-32 shrink-0 items-center justify-center">
                    {sponsor.logo ? (
                      <img
                        src={sponsor.logo}
                        alt={sponsor.name}
                        className="h-32 w-32 rounded-full border-4 border-[var(--border2)] object-cover shadow-xl"
                      />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[var(--border2)] bg-[var(--surface2)] shadow-xl">
                        <span className="text-xs font-bold text-[var(--text3)]">No Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 min-w-0 flex-1 text-left">
                    <h3 className="truncate text-lg font-bold text-[var(--text)]">
                      {sponsor.name || "Sponsor"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--text2)]">Official Sponsor</p>
                    {sponsor.website && (
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex rounded-full border border-[var(--gold)]/40 bg-[rgba(240,192,64,0.1)] px-3 py-1 text-xs font-semibold text-[var(--gold)] transition hover:border-[var(--gold)] hover:bg-[rgba(240,192,64,0.2)]"
                      >
                        Visit website
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <button
            className="rounded-full border border-[var(--border2)] bg-[var(--gold)] px-5 py-2 text-sm font-semibold text-[var(--bg)] transition hover:bg-[var(--gold2)]"
            type="button"
            onClick={() => navigate("/events")}
          >
            Browse More Events
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}
