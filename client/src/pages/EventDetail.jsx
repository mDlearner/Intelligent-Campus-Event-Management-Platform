import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchEvents } from "../lib/api.js";

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        const events = await fetchEvents();
        const found = events.find((e) => e._id === eventId);
        if (found) {
          setEvent(found);
        } else {
          setError("Event not found");
        }
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

  function getCategoryTone(tag) {
    if (tag === "Workshop") {
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    }
    if (tag === "Hackathon") {
      return "border-purple-200 bg-purple-50 text-purple-700";
    }
    if (tag === "Cultural") {
      return "border-pink-200 bg-pink-50 text-pink-700";
    }
    if (tag === "Social Impact") {
      return "border-green-200 bg-green-50 text-green-700";
    }
    if (tag === "Innovation & Research") {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }
    if (tag === "Academic Seminar") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (tag === "Competition") {
      return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return (
    <section className="space-y-6">
      <button
        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        type="button"
        onClick={() => navigate("/events")}
      >
        <span>←</span>
        Back to Events
      </button>

      <div className="glass-panel rounded-3xl p-8">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-bold">{event.title}</h1>
            <p className="mt-3 text-lg text-slate-600">{event.venue}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
            {event.status}
          </span>
        </div>

        {event.imageUrl && (
          <div className="relative mb-8 -mx-8 h-[320px] overflow-hidden rounded-2xl bg-slate-900 md:h-[360px]">
            <img
              src={event.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-35 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/35 to-slate-900/10" />
            <img
              src={event.imageUrl}
              alt={event.title}
              className="relative z-10 h-full w-full object-contain p-6 md:p-8"
            />
          </div>
        )}

        {event.categories && event.categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {event.categories.map((cat) => (
              <span
                key={cat}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${getCategoryTone(cat)}`}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Date</p>
            <p className="mt-2 text-lg font-semibold">{event.date}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Time</p>
            <p className="mt-2 text-lg font-semibold">
              {event.startTime} - {event.endTime}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Seats Available</p>
            <p className="mt-2 text-lg font-semibold">{event.maxSeats}</p>
          </div>
        </div>

        {event.registrationCloseDate && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Registration closes:</p>
            <p className="mt-1 text-amber-700">
              {event.registrationCloseDate}
              {event.registrationCloseTime ? ` at ${event.registrationCloseTime}` : ""}
            </p>
          </div>
        )}

        <div className="mb-8 border-t border-slate-200 pt-8">
          <h2 className="mb-4 text-2xl font-semibold">Description</h2>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700">
            {event.description || "No description provided"}
          </p>
        </div>

        {event.speakers && event.speakers.length > 0 && (
          <div className="mb-8 border-t border-slate-200 pt-8">
            <h2 className="mb-6 text-2xl font-semibold">Speakers</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {event.speakers.map((speaker, index) => (
                <div key={index} className="glass-panel relative overflow-hidden rounded-3xl border border-white/40 p-6 text-center backdrop-blur-xl">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:var(--primary)]/20 blur-2xl" />
                  {speaker.imageUrl && (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={speaker.imageUrl}
                        alt={speaker.name}
                        className="h-32 w-32 rounded-full border-4 border-white/80 object-cover shadow-xl"
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-900">{speaker.name || "Speaker"}</h3>
                  {speaker.title && <p className="mt-1 text-sm font-medium text-slate-700">{speaker.title}</p>}
                  {speaker.bio && <p className="mt-3 text-sm text-slate-600">{speaker.bio}</p>}
                  
                  {speaker.socialLinks && (
                    <div className="mt-4 flex justify-center gap-3">
                      {speaker.socialLinks.linkedin && (
                        <a
                          href={speaker.socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-blue-700 transition hover:bg-white"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-sky-600 transition hover:bg-white"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-700 transition hover:bg-white"
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
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-[color:var(--primary)] transition hover:bg-white"
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
          <div className="border-t border-slate-200 pt-8">
            <h2 className="mb-6 text-2xl font-semibold">Sponsors</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {event.sponsors.map((sponsor, index) => (
                <div
                  key={index}
                  className="glass-panel relative flex min-h-[176px] items-center gap-5 overflow-hidden rounded-3xl border border-white/40 p-6 backdrop-blur-xl"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[color:var(--primary)]/20 blur-2xl" />

                  <div className="relative z-10 flex h-32 w-32 shrink-0 items-center justify-center">
                    {sponsor.logo ? (
                      <img
                        src={sponsor.logo}
                        alt={sponsor.name}
                        className="h-32 w-32 rounded-full border-4 border-white/80 object-cover shadow-xl"
                      />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/80 bg-white/70 shadow-xl">
                        <span className="text-xs font-semibold text-slate-500">No Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 min-w-0 flex-1 text-left">
                    <h3 className="truncate text-lg font-semibold text-slate-900">
                      {sponsor.name || "Sponsor"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">Official Sponsor</p>
                    {sponsor.website && (
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-white"
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
      </div>
    </section>
  );
}
