import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getAuth } from "../lib/auth.js";

const linkClasses = ({ isActive }) =>
  `rounded px-3 py-2 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => getAuth());

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

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="text-lg font-semibold">Campus Events</div>
        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClasses}>Home</NavLink>
          <NavLink to="/events" className={linkClasses}>Events</NavLink>
          <NavLink to="/dashboard" className={linkClasses}>Dashboard</NavLink>
          {auth ? (
            <button
              className="rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <NavLink to="/login" className={linkClasses}>Login</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
