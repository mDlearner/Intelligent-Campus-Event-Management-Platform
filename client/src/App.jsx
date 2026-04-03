import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Events from "./pages/Events.jsx";
import EventDetail from "./pages/EventDetail.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Profile from "./pages/Profile.jsx";

export default function App() {
  const location = useLocation();
  const routeKey = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const [routeStack, setRouteStack] = useState({
    previous: location,
    current: location,
    isTransitioning: false
  });

  useEffect(() => {
    const cursor = document.createElement("div");
    cursor.id = "cursor";
    cursor.className = "cursor";
    document.body.appendChild(cursor);

    const ring = document.createElement("div");
    ring.id = "cursor-ring";
    ring.className = "cursor-ring";
    document.body.appendChild(ring);

    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener("mousemove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      cursor.style.left = mx + "px";
      cursor.style.top = my + "px";
    });

    function animRing() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + "px";
      ring.style.top = ry + "px";
      requestAnimationFrame(animRing);
    }
    animRing();

    document.querySelectorAll("button, a, .bento-card").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        cursor.style.width = "18px";
        cursor.style.height = "18px";
        ring.style.width = "52px";
        ring.style.height = "52px";
      });
      el.addEventListener("mouseleave", () => {
        cursor.style.width = "10px";
        cursor.style.height = "10px";
        ring.style.width = "36px";
        ring.style.height = "36px";
      });
    });

    return () => {
      document.removeEventListener("mousemove", () => {});
      if (cursor) cursor.remove();
      if (ring) ring.remove();
    };
  }, []);

  useEffect(() => {
    setRouteStack((previousState) => {
      if (previousState.current.pathname === location.pathname && previousState.current.search === location.search) {
        return previousState;
      }

      return {
        previous: previousState.current,
        current: location,
        isTransitioning: true
      };
    });

    const timeoutId = window.setTimeout(() => {
      setRouteStack((previousState) => ({
        previous: previousState.current,
        current: previousState.current,
        isTransitioning: false
      }));
    }, 340);

    return () => window.clearTimeout(timeoutId);
  }, [location]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen text-[color:var(--text)] relative">
      {/* Ambient Glows */}
      <div className="ambient ambient-1" />
      <div className="ambient ambient-2" />
      <div className="ambient ambient-3" />
      <div className="ambient ambient-4" />

      <Navbar />
      <main className="relative z-40 mx-auto max-w-8xl px-4 pb-14 pt-28 lg:px-8">
        <div className="route-shell">
          {routeStack.isTransitioning && (
            <div className="route-layer route-layer-exit" aria-hidden="true">
              <Routes location={routeStack.previous}>
                <Route path="/" element={<Home />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/ended" element={<Events showEnded />} />
                <Route path="/events/:eventId" element={<EventDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </div>
          )}
          <div key={routeKey} className={`route-layer route-layer-enter ${routeStack.isTransitioning ? "route-layer-entering" : ""}`}>
            <Routes location={routeStack.current}>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/ended" element={<Events showEnded />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}
