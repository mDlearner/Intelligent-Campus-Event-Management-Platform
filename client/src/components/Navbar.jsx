import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getAuth } from "../lib/auth.js";

export default function Navbar() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => getAuth());
  const [searchValue, setSearchValue] = useState("");

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

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = searchValue.trim();
    const target = query ? `/events?search=${encodeURIComponent(query)}` : "/events";
    navigate(target);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[rgba(8,11,18,0.75)] backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gold)] text-[var(--bg)] text-xs font-bold">
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
          <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5">
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
              className="bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] lg:w-64"
              placeholder="Search events…"
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </form>

        {/* Nav Links & Auth */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 rounded-full border border-[var(--border2)] bg-[var(--surface)] p-1 lg:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--surface2)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--surface2)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Events
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--surface2)] text-[var(--gold)]"
                    : "text-[var(--text2)] hover:text-[var(--text)]"
                }`
              }
            >
              Dashboard
            </NavLink>
          </div>

          {auth ? (
            <button
              className="rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--bg)] transition hover:bg-[var(--gold2)]"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <NavLink
              to="/login"
              className="rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--bg)] transition hover:bg-[var(--gold2)]"
            >
              Login
            </NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}
