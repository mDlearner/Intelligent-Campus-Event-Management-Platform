import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEvents } from "../lib/api.js";
import { getAuth } from "../lib/auth.js";
import { formatTimeRange12h } from "../lib/time.js";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [carouselTrackIndex, setCarouselTrackIndex] = useState(0);
  const [isTrackAnimating, setIsTrackAnimating] = useState(true);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [hoveredScheduleEventId, setHoveredScheduleEventId] = useState(null);
  const didInitializeScheduleRef = useRef(false);
  const wheelLockRef = useRef(false);
  const wheelLockTimeoutRef = useRef(null);
  const carouselContainerRef = useRef(null);
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

  const todayKey = useMemo(() => formatDateKey(new Date()), []);

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

  const filteredPrimaryEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return primaryEvents;
    }

    return primaryEvents.filter((event) => {
      const title = String(event?.title || "").toLowerCase();
      const venue = String(event?.venue || "").toLowerCase();
      const categories = Array.isArray(event?.categories)
        ? event.categories.join(" ").toLowerCase()
        : "";

      return title.includes(query) || venue.includes(query) || categories.includes(query);
    });
  }, [primaryEvents, searchQuery]);

  const slideshowEvents = useMemo(() => filteredPrimaryEvents.slice(0, 7), [filteredPrimaryEvents]);

  const renderedCarouselSlides = useMemo(() => {
    if (slideshowEvents.length <= 1) {
      return slideshowEvents;
    }

    const first = slideshowEvents[0];
    const last = slideshowEvents[slideshowEvents.length - 1];
    return [last, ...slideshowEvents, first];
  }, [slideshowEvents]);

  const activeSlideEvent = slideshowEvents[activeSlideIndex] || null;

  const scheduleEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    // When there's a search query, show matching events from all dates
    if (query) {
      const allEvents = [];
      for (const dayEvents of eventsByDate.values()) {
        allEvents.push(...dayEvents);
      }
      
      return allEvents.filter((event) => {
        const title = String(event?.title || "").toLowerCase();
        const venue = String(event?.venue || "").toLowerCase();
        const categories = Array.isArray(event?.categories)
          ? event.categories.join(" ").toLowerCase()
          : "";
        return title.includes(query) || venue.includes(query) || categories.includes(query);
      }).sort((a, b) => {
        const dateA = parseEventDate(a) || new Date(0);
        const dateB = parseEventDate(b) || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });
    }
    
    // When no search, show only selected date events
    const byDay = eventsByDate.get(selectedDate) || [];
    return byDay;
  }, [eventsByDate, selectedDate, searchQuery]);

  const defaultScheduleDate = useMemo(() => {
    const todayEvents = eventsByDate.get(todayKey) || [];
    if (todayEvents.length > 0) {
      return todayKey;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const nextUpcoming = events
      .map((event) => ({ event, dateObj: parseEventDate(event) }))
      .filter((item) => Boolean(item.dateObj) && item.dateObj >= todayStart)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())[0];

    return nextUpcoming ? formatDateKey(nextUpcoming.dateObj) : todayKey;
  }, [events, eventsByDate, todayKey]);

  useEffect(() => {
    if (!events.length || didInitializeScheduleRef.current) {
      return;
    }

    didInitializeScheduleRef.current = true;
    setSelectedDate(defaultScheduleDate);
  }, [defaultScheduleDate, events.length]);

  useEffect(() => {
    setActiveSlideIndex(0);
    setCarouselTrackIndex(slideshowEvents.length > 1 ? 1 : 0);
    setIsTrackAnimating(true);
  }, [slideshowEvents.length]);

  useEffect(() => {
    return () => {
      if (wheelLockTimeoutRef.current) {
        window.clearTimeout(wheelLockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = carouselContainerRef.current;
    if (!container) {
      return undefined;
    }

    const handleWheel = (event) => {
      if (slideshowEvents.length <= 1) {
        return;
      }

      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;

      if (Math.abs(delta) < 8) {
        return;
      }

      event.preventDefault();

      if (wheelLockRef.current) {
        return;
      }

      wheelLockRef.current = true;
      if (wheelLockTimeoutRef.current) {
        window.clearTimeout(wheelLockTimeoutRef.current);
      }

      wheelLockTimeoutRef.current = window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 420);

      if (delta > 0) {
        showNextSlide();
      } else {
        showPreviousSlide();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [slideshowEvents.length]);

  useEffect(() => {
    if (slideshowEvents.length <= 1) {
      return undefined;
    }

    if (isCarouselPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIsTrackAnimating(true);
      setCarouselTrackIndex((prev) => prev + 1);
      setActiveSlideIndex((prev) => (prev + 1) % slideshowEvents.length);
    }, 4500);

    return () => {
      window.clearInterval(timer);
    };
  }, [slideshowEvents.length, isCarouselPaused]);

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

  function displayDate(value) {
    if (!value) {
      return "Date TBA";
    }

    const parsed = parseEventDate({ date: value, startTime: "00:00" });
    if (!parsed) {
      return value;
    }

    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  }

  function scheduleMeta(event) {
    const parsed = parseEventDate(event);
    if (!parsed) {
      return `DATE TBA | ${displayTime(event)}`;
    }

    const todayKey = formatDateKey(new Date());
    const eventKey = formatDateKey(parsed);
    const dayLabel =
      eventKey === todayKey
        ? "TODAY"
        : parsed.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase();

    return `${dayLabel} | ${parsed
      .toLocaleDateString(undefined, { month: "short", day: "numeric" })
      .toUpperCase()} | ${displayTime(event)}`;
  }

  function categoryTone(value) {
    const key = String(value || "").toLowerCase();
    if (key.includes("academic") || key.includes("seminar")) {
      return "border-[var(--gold)]/40 text-[var(--gold2)] bg-[rgba(240,192,64,0.1)]";
    }
    if (key.includes("workshop")) {
      return "border-[var(--blue)]/40 text-[var(--blue)] bg-[rgba(77,159,255,0.1)]";
    }
    if (key.includes("cultural")) {
      return "border-[var(--rose)]/40 text-[var(--rose)] bg-[rgba(255,107,138,0.1)]";
    }
    if (key.includes("competition")) {
      return "border-orange-500/40 text-orange-300 bg-[rgba(249,115,22,0.1)]";
    }
    if (key.includes("social impact")) {
      return "border-[var(--teal)]/40 text-[var(--teal)] bg-[rgba(0,212,170,0.1)]";
    }
    if (key.includes("sport")) {
      return "border-emerald-500/40 text-emerald-300 bg-[rgba(16,185,129,0.1)]";
    }
    if (key.includes("innovation") || key.includes("research")) {
      return "border-cyan-500/40 text-cyan-300 bg-[rgba(34,211,238,0.1)]";
    }
    if (key.includes("hackathon")) {
      return "border-purple-500/40 text-purple-300 bg-[rgba(168,85,247,0.1)]";
    }
    if (key.includes("free food")) {
      return "border-lime-500/40 text-lime-300 bg-[rgba(132,204,22,0.1)]";
    }
    if (key.includes("career")) {
      return "border-indigo-500/40 text-indigo-300 bg-[rgba(99,102,241,0.1)]";
    }
    return "border-[var(--border2)] text-[var(--text2)] bg-[rgba(255,255,255,0.05)]";
  }

  function getSlideTransition(event) {
    const category = Array.isArray(event?.categories) ? event.categories[0]?.toLowerCase() : "";
    if (category?.includes("academic") || category?.includes("seminar")) {
      return "transition-opacity duration-1000 ease-in-out";
    }
    if (category?.includes("sport")) {
      return "transition-all duration-1000 ease-in-out";
    }
    if (category?.includes("workshop")) {
      return "transition-all duration-1000 ease-in-out";
    }
    if (category?.includes("social") || category?.includes("cultural")) {
      return "transition-all duration-1000 ease-in-out";
    }
    return "transition-opacity duration-1000 ease-in-out";
  }

  function getSlideTransformClass(event, isActive) {
    const category = Array.isArray(event?.categories) ? event.categories[0]?.toLowerCase() : "";
    if (category?.includes("sport")) {
      return isActive ? "opacity-100 scale-100" : "opacity-0 scale-95";
    }
    if (category?.includes("workshop")) {
      return isActive ? "opacity-100 blur-0" : "opacity-0 blur-md";
    }
    if (category?.includes("social") || category?.includes("cultural")) {
      return isActive ? "opacity-100 rotate-0" : "opacity-0 -rotate-12";
    }
    return isActive ? "opacity-100" : "opacity-0";
  }

  function displayTime(event) {
    if (!event?.startTime && !event?.endTime) {
      return "Time TBA";
    }

    return formatTimeRange12h(event?.startTime, event?.endTime);
  }

  function showPreviousSlide() {
    if (slideshowEvents.length <= 1) {
      return;
    }

    setIsTrackAnimating(true);
    setCarouselTrackIndex((prev) => prev - 1);
    setActiveSlideIndex((prev) => (prev === 0 ? slideshowEvents.length - 1 : prev - 1));
  }

  function showNextSlide() {
    if (slideshowEvents.length <= 1) {
      return;
    }

    setIsTrackAnimating(true);
    setCarouselTrackIndex((prev) => prev + 1);
    setActiveSlideIndex((prev) => (prev + 1) % slideshowEvents.length);
  }

  function goToSlide(index) {
    if (slideshowEvents.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, slideshowEvents.length - 1));
    setIsTrackAnimating(true);
    setCarouselTrackIndex(slideshowEvents.length > 1 ? safeIndex + 1 : 0);
    setActiveSlideIndex(safeIndex);
  }

  function handleCarouselTransitionEnd() {
    if (slideshowEvents.length <= 1) {
      return;
    }

    if (carouselTrackIndex === 0) {
      setIsTrackAnimating(false);
      setCarouselTrackIndex(slideshowEvents.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsTrackAnimating(true);
        });
      });
      return;
    }

    if (carouselTrackIndex === slideshowEvents.length + 1) {
      setIsTrackAnimating(false);
      setCarouselTrackIndex(1);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsTrackAnimating(true);
        });
      });
    }
  }

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

  function renderPreviewCard(item, type) {
    if (!item) {
      return null;
    }

    const image = type === "speaker" ? item.imageUrl : item.logo;
    const label = type === "speaker" ? (item.title || "Speaker") : (item.website ? "Official Sponsor" : "Sponsor");

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border2)] bg-[rgba(255,255,255,0.04)] p-3">
        {image ? (
          <img
            src={image}
            alt={item.name || label}
            className="h-12 w-12 shrink-0 rounded-full border border-[var(--border2)] object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-[10px] font-semibold text-[var(--text3)]">
            {type === "speaker" ? "SP" : "SU"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{item.name || label}</p>
          <p className="truncate text-xs font-semibold text-[var(--text3)]">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full space-y-8">
      <section className="glass-panel rounded-3xl p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text3)]">
              Spotlight
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Upcoming Events</h3>
            <p className="mt-1 text-xs text-[var(--text3)]">
              Browse the latest events with auto-scroll and manual navigation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={showPreviousSlide}
              className="rounded-full border border-[var(--border2)] bg-[var(--surface2)]/50 px-3 py-1 text-sm text-[var(--text2)] hover:text-[var(--text)]"
              aria-label="Previous event"
            >
              {"<"}
            </button>
            <p className="min-w-[64px] text-center text-xs text-[var(--text3)]">
              {slideshowEvents.length > 0
                ? `${activeSlideIndex + 1}/${slideshowEvents.length}`
                : "0/0"}
            </p>
            <button
              type="button"
              onClick={showNextSlide}
              className="rounded-full border border-[var(--border2)] bg-[var(--surface2)]/50 px-3 py-1 text-sm text-[var(--text2)] hover:text-[var(--text)]"
              aria-label="Next event"
            >
              {">"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-3xl bg-[var(--surface2)]/60" />
        ) : !activeSlideEvent ? (
          <div className="rounded-2xl border border-dashed border-[var(--border2)] px-4 py-6 text-sm text-[var(--text2)]">
            No upcoming events to showcase.
          </div>
        ) : (
          <div
            className="space-y-4"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onFocusCapture={() => setIsCarouselPaused(true)}
            onBlurCapture={() => setIsCarouselPaused(false)}
          >
            <div className="overflow-hidden rounded-3xl">
              <div
                ref={carouselContainerRef}
                className="relative min-h-[420px] w-full"
                onTransitionEnd={handleCarouselTransitionEnd}
              >
                {renderedCarouselSlides.map((slideEvent, slideIndex) => (
                  <article
                    key={`slide-${slideEvent._id}-${slideIndex}`}
                    className={`group absolute inset-0 min-h-[420px] w-full overflow-hidden rounded-2xl transition-opacity duration-1000 ease-in-out ${
                      slideIndex === activeSlideIndex ? "opacity-100" : "opacity-0"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/events/${slideEvent._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/events/${slideEvent._id}`);
                      }
                    }}
                  >
                    {slideEvent.imageUrl ? (
                      <img
                        src={slideEvent.imageUrl}
                        alt={slideEvent.title}
                        className="absolute inset-0 h-full w-full scale-105 object-cover blur-[1.5px] transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,212,170,0.35),transparent_38%),radial-gradient(circle_at_80%_16%,rgba(240,192,64,0.28),transparent_34%),linear-gradient(130deg,#121828_0%,#1C2540_45%,#080B12_100%)]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,11,18,0.92)] via-[rgba(8,11,18,0.74)] to-[rgba(8,11,18,0.88)]" />

                    <div className="relative flex min-h-[420px] flex-col justify-between p-6 md:p-8 md:pb-10">
                      <div className="max-w-2xl">
                        <h4 className="text-4xl font-semibold leading-tight text-[var(--text)] md:text-5xl">
                        {slideEvent.title}
                        </h4>

                        <div className="mt-6 flex flex-wrap gap-3 text-sm">
                          <span className="rounded-full border border-[var(--border2)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[var(--gold2)]">
                            {displayDate(slideEvent.date)}
                          </span>
                          <span className="rounded-full border border-[var(--border2)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[var(--text)]">
                            {displayTime(slideEvent)}
                          </span>
                          <span className="rounded-full border border-[var(--border2)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[var(--text2)]">
                            {slideEvent.venue || "Venue TBA"}
                          </span>
                        </div>

                        {slideEvent.description && (
                          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--text2)] line-clamp-3 md:text-lg md:leading-8">
                            {slideEvent.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="w-fit rounded-full bg-[var(--gold)] px-5 py-2 text-sm font-semibold text-[var(--bg)] transition hover:bg-[var(--gold2)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/events/${slideEvent._id}`);
                        }}
                      >
                        View Event
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {slideshowEvents.map((event, index) => (
                <button
                  key={`dot-${event._id}`}
                  type="button"
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeSlideIndex
                      ? "w-8 bg-[var(--gold)]"
                      : "w-2.5 bg-[var(--surface2)] hover:bg-[var(--text3)]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-4 py-3 text-sm text-[var(--rose)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[rgba(8,12,20,0.75)] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-80">
            <div className="absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[var(--teal)]/15 blur-3xl" />
            <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[var(--gold)]/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">
                This Week to Date
              </p>
              <h3 className="mt-2 text-4xl italic text-[var(--text)]">
                {selectedDate === todayKey ? "Today" : selectedDateDisplay}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-[var(--text2)]">
                {scheduleEvents.length > 0 && selectedDate === todayKey
                  ? "Showing today’s schedule first. If no events are live today, the next upcoming event appears automatically."
                  : "Showing the selected day’s schedule. Click a day in the calendar to browse other dates."}
              </p>
            </div>
            {!loading && !error && (
              <p className="text-xs text-[var(--text3)]">
                {scheduleEvents.length} event{scheduleEvents.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div className="relative mt-5">
            <div className="absolute bottom-0 left-[20px] top-0 w-px bg-gradient-to-b from-[var(--gold)]/70 via-[var(--teal)]/60 to-transparent" />

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`load-${idx}`} className="flex gap-4 animate-pulse border-b border-[var(--border)] pb-4">
                    <div className="h-10 w-10 rounded-full bg-[var(--surface2)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 rounded-full bg-[var(--surface2)]" />
                      <div className="h-4 w-2/3 rounded-full bg-[var(--surface2)]" />
                      <div className="h-3 w-1/2 rounded-full bg-[var(--surface2)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : scheduleEvents.length === 0 ? (
              <div className="mt-2 rounded-2xl border border-dashed border-[var(--border2)] px-4 py-6 text-sm text-[var(--text2)]">
                No events found for this date.
              </div>
            ) : (
              <div className="space-y-1">
                {scheduleEvents.map((event, index) => (
                  <article
                    key={`schedule-${event._id}`}
                    className="group relative cursor-pointer border-b border-[var(--border)] py-4 transition hover:bg-[rgba(255,255,255,0.025)]"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/events/${event._id}`)}
                    onKeyDown={(keyboardEvent) => {
                      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        navigate(`/events/${event._id}`);
                      }
                    }}
                    onMouseEnter={() => setHoveredScheduleEventId(event._id)}
                    onMouseLeave={() => setHoveredScheduleEventId(null)}
                  >
                    <div className="grid items-start gap-4 md:grid-cols-[44px_minmax(0,1fr)_max-content]">
                      <div
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition group-hover:border-[var(--gold)] group-hover:text-[var(--gold)] ${
                        index === 0
                          ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)]"
                          : "border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)]"
                      }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text3)]">
                          {scheduleMeta(event)}
                        </p>
                        <h4 className="mt-1 text-xl font-semibold leading-tight text-[var(--text)] transition group-hover:text-[var(--gold2)]">
                          {event.title}
                        </h4>
                        <p className="mt-1 text-sm text-[var(--text2)]">{event.venue || "Venue TBA"}</p>

                        {hoveredScheduleEventId === event._id && (
                          <div className="mt-4 grid gap-4 rounded-3xl border border-[var(--border2)] bg-[rgba(255,255,255,0.03)] p-4 lg:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text3)]">
                                Speakers
                              </p>
                              <div className="mt-3 space-y-2">
                                {Array.isArray(event.speakers) && event.speakers.length > 0 ? (
                                  event.speakers.slice(0, 3).map((speaker, speakerIndex) => (
                                    <div key={`${event._id}-speaker-${speakerIndex}`}>
                                      {renderPreviewCard(speaker, "speaker")}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-[var(--text3)]">No speakers added yet.</p>
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text3)]">
                                Sponsors
                              </p>
                              <div className="mt-3 space-y-2">
                                {Array.isArray(event.sponsors) && event.sponsors.length > 0 ? (
                                  event.sponsors.slice(0, 3).map((sponsor, sponsorIndex) => (
                                    <div key={`${event._id}-sponsor-${sponsorIndex}`}>
                                      {renderPreviewCard(sponsor, "sponsor")}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-[var(--text3)]">No sponsors added yet.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <span
                        className={`hidden rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] md:inline-flex ${categoryTone(
                          Array.isArray(event.categories) ? event.categories[0] : ""
                        )}`}
                      >
                        {Array.isArray(event.categories) && event.categories[0]
                          ? event.categories[0]
                          : "General"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="glass-panel rounded-3xl p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text3)]">
              Search
            </p>
            <label className="mt-3 block">
              <span className="sr-only">Search events</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border2)] bg-[rgba(28,37,64,0.6)] px-4 py-3 text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--gold)] focus:bg-[rgba(28,37,64,0.8)] transition-all duration-300 ease-out"
                placeholder="Events, clubs, venues..."
              />
            </label>
          </div>

          <div className="glass-panel rounded-3xl p-5 md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">Calendar</h3>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-[var(--border2)] bg-[var(--surface2)]/50 px-2 py-1 text-sm text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  type="button"
                  onClick={showPreviousMonth}
                  aria-label="Previous month"
                >
                  {"<"}
                </button>
                <p className="min-w-[120px] text-center text-sm font-semibold text-[var(--text)]">
                  {monthLabel(calendarMonth)}
                </p>
                <button
                  className="rounded-lg border border-[var(--border2)] bg-[var(--surface2)]/50 px-2 py-1 text-sm text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  type="button"
                  onClick={showNextMonth}
                  aria-label="Next month"
                >
                  {">"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
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
                    className={`relative min-h-[44px] rounded-lg border px-1 py-1 text-center text-xs font-semibold transition ${
                      day.inCurrentMonth
                        ? "border-[var(--border2)] bg-[var(--surface2)]/30 text-[var(--text)]"
                        : "border-transparent bg-[var(--surface2)]/10 text-[var(--text3)]"
                    } ${isSelected ? "border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)]" : ""}`}
                  >
                    {day.dayNumber}
                    {hasEvents && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--gold)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <footer className="glass-panel rounded-3xl border border-[var(--border)] px-6 py-8 md:px-8">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">
              Campus Events
            </p>
            <h4 className="mt-2 text-2xl font-semibold text-[var(--text)]">
              Stay connected with campus life.
            </h4>
            <p className="mt-3 text-sm leading-6 text-[var(--text2)]">
              Discover events, follow schedules, and keep track of speakers, sponsors, and
              registrations in one place.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">
              Contact
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text2)]">
              <li><a className="transition hover:text-[var(--gold2)]" href="mailto:support@campusevents.edu">support@campusevents.edu</a></li>
              <li><a className="transition hover:text-[var(--gold2)]" href="tel:+10000000000">+1 (000) 000-0000</a></li>
              <li>Campus Events Office, Main Building</li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">
              Links
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text2)]">
              <li><button type="button" className="transition hover:text-[var(--gold2)]" onClick={() => navigate("/events")}>All Events</button></li>
              <li><button type="button" className="transition hover:text-[var(--gold2)]" onClick={() => navigate("/dashboard")}>Dashboard</button></li>
              <li><button type="button" className="transition hover:text-[var(--gold2)]" onClick={() => navigate("/profile")}>Profile</button></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">
              Terms & Policies
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text2)]">
              <li><a className="transition hover:text-[var(--gold2)]" href="#terms">Terms of Service</a></li>
              <li><a className="transition hover:text-[var(--gold2)]" href="#privacy">Privacy Policy</a></li>
              <li><a className="transition hover:text-[var(--gold2)]" href="#cookies">Cookie Policy</a></li>
              <li><a className="transition hover:text-[var(--gold2)]" href="#accessibility">Accessibility</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--border)] pt-6 text-sm text-[var(--text3)] md:flex-row md:items-center md:justify-between">
          <p>© 2026 Campus Events. All rights reserved.</p>
          <p>Built for events, schedules, registrations, and campus communities.</p>
        </div>
      </footer>

    </section>
  );
}
