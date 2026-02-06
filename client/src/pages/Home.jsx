import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-bold">Intelligent Campus Events</h1>
        <p className="mt-3 text-slate-600">
          Discover upcoming events, register in seconds, and stay informed with automated
          reminders and real-time updates.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white"
            type="button"
            onClick={() => navigate("/events")}
          >
            Browse Events
          </button>
          <button
            className="rounded border border-slate-300 px-4 py-2"
            type="button"
            onClick={() => navigate("/events")}
          >
            Create Event
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Highlights</h2>
        <ul className="mt-4 space-y-3 text-slate-700">
          <li>Role-based access for students, clubs, and admins.</li>
          <li>Smart scheduling with clash detection.</li>
          <li>Notifications for registrations and reminders.</li>
        </ul>
      </div>
    </section>
  );
}
