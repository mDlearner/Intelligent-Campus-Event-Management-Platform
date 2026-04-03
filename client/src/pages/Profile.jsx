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
        <p className="text-sm font-semibold text-[var(--text3)]">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-[var(--text)]">Update Your Profile</h1>
        <p className="mt-2 text-sm text-[var(--text2)]">
          Keep your information current for check-ins and event management.
        </p>
      </div>

      <form className="glass-panel rounded-3xl p-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Full Name</label>
            <input
              className="neo-input mt-2 text-sm"
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Email</label>
            <input
              className="neo-input mt-2 text-sm opacity-80"
              type="email"
              value={profile.email}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Role</label>
            <input
              className="neo-input mt-2 text-sm opacity-80"
              type="text"
              value={profile.role}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Department</label>
            <input
              className="neo-input mt-2 text-sm"
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
                <label className="text-xs font-semibold text-[var(--text3)]">Student ID</label>
                <input
                  className="neo-input mt-2 text-sm"
                  type="text"
                  name="studentId"
                  value={profile.studentId}
                  onChange={handleChange}
                  placeholder="STU-2026-0245"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text3)]">Year</label>
                <input
                  className="neo-input mt-2 text-sm"
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
          <div className="mt-4 rounded-2xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-sm text-[var(--rose)]">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="neo-btn rounded-full px-5 py-2 text-sm disabled:opacity-70"
            type="submit"
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Save Changes"}
          </button>
          {status === "saved" && (
            <span className="text-sm font-semibold text-[var(--teal)]">Profile updated ✓</span>
          )}
        </div>
      </form>
    </section>
  );
}
