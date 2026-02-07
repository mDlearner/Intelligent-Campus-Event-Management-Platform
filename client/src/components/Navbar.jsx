import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getAuth } from "../lib/auth.js";

const linkClasses = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive
      ? "bg-[color:var(--primary)] text-white shadow"
      : "text-slate-600 hover:bg-slate-100/70"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => getAuth());
  const [searchValue, setSearchValue] = useState("");
  const [notificationCount, setNotificationCount] = useState(() => {
    const stored = window.localStorage.getItem("notification-count");
    return stored ? Number(stored) : 0;
  });

  useEffect(() => {
    function handleAuthChange() {
      setAuth(getAuth());
    }

    function handleNotificationChange() {
      const stored = window.localStorage.getItem("notification-count");
      setNotificationCount(stored ? Number(stored) : 0);
    }

    window.addEventListener("auth-changed", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("storage", handleNotificationChange);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("storage", handleNotificationChange);
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
    <header className="sticky top-0 z-30 border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-white shadow">
            CE
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Campus</p>
            <p className="text-lg font-semibold">Event Hub</p>
          </div>
        </div>
        <div className="order-3 w-full lg:order-none lg:w-auto">
          <form
            className="glass-panel flex items-center gap-3 rounded-full px-4 py-2"
            onSubmit={handleSearchSubmit}
          >
            <span className="text-slate-500">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z"
                />
              </svg>
            </span>
            <input
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 lg:w-64"
              placeholder="Search events, clubs, venues"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </form>
        </div>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-2 lg:flex">
            <NavLink to="/" className={linkClasses}>Home</NavLink>
            <NavLink to="/events" className={linkClasses}>Events</NavLink>
            <NavLink to="/dashboard" className={linkClasses}>Dashboard</NavLink>
          </nav>
          <button
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-600 shadow"
            type="button"
            aria-label="Notifications"
          >
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[color:var(--accent)] px-1 text-[10px] font-semibold text-white">
                {notificationCount}
              </span>
            )}
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 10-12 0v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.454 1.31m5.715 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </button>
          {auth ? (
            <button
              className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 shadow"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <NavLink to="/login" className={linkClasses}>Login</NavLink>
          )}
          <button
            className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white lg:flex"
            type="button"
            onClick={() => navigate("/profile")}
            aria-label="Open profile"
          >
            {auth?.user?.name ? auth.user.name.slice(0, 2).toUpperCase() : "ME"}
          </button>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3 lg:hidden">
        <NavLink to="/" className={linkClasses}>Home</NavLink>
        <NavLink to="/events" className={linkClasses}>Events</NavLink>
        <NavLink to="/dashboard" className={linkClasses}>Dashboard</NavLink>
      </div>
    </header>
  );
}
