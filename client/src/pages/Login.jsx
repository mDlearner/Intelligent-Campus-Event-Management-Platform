import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../lib/api.js";
import { setAuth } from "../lib/auth.js";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "student",
  department: ""
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            department: form.department || undefined
          };

      const result = mode === "login"
        ? await loginUser(payload)
        : await registerUser(payload);

      setAuth({ token: result.token, user: result.user });
      navigate("/events");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "login"
          ? "Use your campus email and password."
          : "Create an account to register or host events."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" && (
          <div>
            <label className="text-sm font-medium">Full name</label>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Alex Johnson"
              required
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@campus.edu"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />
        </div>
        {mode === "register" && (
          <>
            <div>
              <label className="text-sm font-medium">Role</label>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="student">Student</option>
                <option value="club">Club</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Department (optional)</label>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                type="text"
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="Computer Science"
              />
            </div>
          </>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          className="w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-70"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>

      <button
        className="mt-4 w-full text-sm text-slate-600"
        type="button"
        onClick={() => {
          setMode((prev) => (prev === "login" ? "register" : "login"));
          setError("");
        }}
      >
        {mode === "login"
          ? "Need an account? Register here."
          : "Already have an account? Sign in."}
      </button>
    </section>
  );
}
