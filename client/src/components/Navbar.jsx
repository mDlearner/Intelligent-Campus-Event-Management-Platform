import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getAuth } from "../lib/auth.js";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState(() => getAuth());
  const [searchValue, setSearchValue] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    if (!isMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname.startsWith("/events")) {
      setSearchValue(params.get("search") || "");
      return;
    }
    setSearchValue("");
  }, [location.pathname, location.search]);

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = searchValue.trim();
    const target = query ? `/events?search=${encodeURIComponent(query)}` : "/events";
    navigate(target);
    setIsMenuOpen(false);
  }

  function handleMobileNavigate(path) {
    navigate(path);
    setIsMenuOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-[70] border-b border-[var(--border)] bg-[var(--bg2)] lg:bg-[rgba(8,11,18,0.78)] lg:backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-8xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gold)] text-[var(--bg)] text-xs font-bold shadow-[0_8px_24px_rgba(240,192,64,0.25)]">
            CE
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text2)]">Campus</p>
            <p className="text-base font-semibold text-[var(--text)]">Events</p>
          </div>
        </div>

        {/* Search */}
        <form
          className="order-3 w-full lg:order-none lg:w-auto"
          onSubmit={handleSearchSubmit}
        >
          <div className="neo-panel flex items-center gap-2 rounded-full px-3 py-2">
            <span className="text-[var(--text3)]">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z"
                />
              </svg>
            </span>
            <input
              className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--text3)] transition-colors duration-300 lg:w-64"
              placeholder="Search events…"
              type="search"
              value={searchValue}
              onChange={(e) => {
                const nextValue = e.target.value;
                setSearchValue(nextValue);
                if (!nextValue.trim() && location.pathname.startsWith("/events")) {
                  navigate("/events", { replace: true });
                }
              }}
            />
          </div>
        </form>

        {/* Nav Links & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)]/45 text-[var(--text2)] transition hover:text-[var(--text)] lg:hidden"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            {isMenuOpen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>

          <div className="hidden items-center gap-1 rounded-full border border-[var(--border2)] bg-[rgba(22,29,46,0.8)] p-1 lg:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgba(240,192,64,0.15)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/events"
              end
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgba(240,192,64,0.15)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Events
            </NavLink>
            <NavLink
              to="/events/ended"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgba(240,192,64,0.15)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Ended
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgba(240,192,64,0.15)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/profile"
              aria-label="Profile"
              title="Profile"
              className={({ isActive }) =>
                `inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                  isActive
                    ? "bg-[rgba(240,192,64,0.15)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                }`
              }
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21a8 8 0 10-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NavLink>
          </div>

          <NavLink
            to="/profile"
            aria-label="Profile"
            title="Profile"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)]/45 text-[var(--text2)] transition hover:text-[var(--text)] lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21a8 8 0 10-16 0" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </NavLink>

          {canCreate && (
            <button
              className="neo-btn hidden px-4 py-1.5 text-xs uppercase tracking-wider sm:inline-flex"
              type="button"
              onClick={() => navigate("/events/create")}
            >
              Create Event
            </button>
          )}

          {auth ? (
            <button
              className="neo-btn hidden px-4 py-1.5 text-xs uppercase tracking-wider sm:inline-flex"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <NavLink
              to="/login"
              className="neo-btn hidden px-4 py-1.5 text-xs uppercase tracking-wider sm:inline-flex"
            >
              Login
            </NavLink>
          )}

          {canCreate && (
            <button
              className="neo-btn inline-flex px-4 py-1.5 text-xs uppercase tracking-wider sm:hidden"
              type="button"
              onClick={() => navigate("/events/create")}
            >
              Create
            </button>
          )}
        </div>
      </nav>

      {isMenuOpen && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close mobile menu overlay"
            className="fixed inset-0 z-[68] bg-[rgba(8,11,18,0.42)]"
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            id="mobile-navigation"
            className="fixed inset-y-0 right-0 z-[69] w-[86vw] max-w-sm border-l border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text3)]">Menu</p>
              <button
                type="button"
                className="neo-btn-ghost px-3 py-1 text-xs"
                onClick={() => setIsMenuOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)]" onClick={() => handleMobileNavigate("/")}>Home</button>
              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)]" onClick={() => handleMobileNavigate("/events")}>Events</button>
              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)]" onClick={() => handleMobileNavigate("/events/ended")}>Ended</button>
              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)]" onClick={() => handleMobileNavigate("/dashboard")}>Dashboard</button>
              <button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)]" onClick={() => handleMobileNavigate("/profile")}>Profile</button>
            </div>

            <div className="mt-4 grid gap-2">
              {canCreate && (
                <button
                  className="neo-btn w-full px-4 py-2 text-xs uppercase tracking-wider"
                  type="button"
                  onClick={() => handleMobileNavigate("/events/create")}
                >
                  Create Event
                </button>
              )}

              {auth ? (
                <button
                  className="neo-btn-ghost w-full px-4 py-2 text-xs uppercase tracking-wider"
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  Logout
                </button>
              ) : (
                <button
                  className="neo-btn-ghost w-full px-4 py-2 text-xs uppercase tracking-wider"
                  type="button"
                  onClick={() => handleMobileNavigate("/login")}
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
