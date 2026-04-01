import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile, updateProfile } from "../lib/api.js";
import { getAuth, getToken, setAuth } from "../lib/auth.js";

const initialProfile = {
  name: "",
  email: "",
  role: "",
  department: "",
  studentId: "",
  year: ""
};

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(initialProfile);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const data = await fetchProfile(token);
        if (isMounted) {
          setProfile(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Unable to load profile");
        }
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  function handleChange(event) {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("saving");

    try {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const payload = {
        name: profile.name,
        department: profile.department,
        studentId: profile.studentId,
        year: profile.year
      };

      const updated = await updateProfile(payload, token);
      const currentAuth = getAuth();
      if (currentAuth) {
        setAuth({ ...currentAuth, user: { ...currentAuth.user, ...updated } });
      }
      setStatus("saved");
    } catch (err) {
      setError(err.message || "Unable to update profile");
      setStatus("idle");
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div className="glass-panel rounded-3xl p-6">
        <p className="text-sm font-semibold text-slate-500">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">Update Your Profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep your information current for check-ins and event management.
        </p>
      </div>

      <form className="glass-panel rounded-3xl p-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Full Name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Email</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              type="email"
              value={profile.email}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Role</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              type="text"
              value={profile.role}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Department</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
              type="text"
              name="department"
              value={profile.department}
              onChange={handleChange}
              placeholder="Computer Science"
            />
          </div>
          {profile.role === "student" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500">Student ID</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  type="text"
                  name="studentId"
                  value={profile.studentId}
                  onChange={handleChange}
                  placeholder="STU-2026-0245"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Year</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  type="text"
                  name="year"
                  value={profile.year}
                  onChange={handleChange}
                  placeholder="2"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-70"
            type="submit"
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Save Changes"}
          </button>
          {status === "saved" && (
            <span className="text-sm font-semibold text-emerald-600">Profile updated ✓</span>
          )}
        </div>
      </form>
    </section>
  );
}
