import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser, resendVerification, verifyRegistration } from "../lib/api.js";
import { setAuth } from "../lib/auth.js";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "student",
  department: "",
  studentId: "",
  year: ""
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isResending, setIsResending] = useState(false);

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
        department: form.department || undefined,
        studentId: form.role === "student" ? form.studentId || undefined : undefined,
        year: form.role === "student" ? form.year || undefined : undefined
          };

      const result = mode === "login"
        ? await loginUser(payload)
        : await registerUser(payload);

      if (result?.verificationRequired) {
        setVerificationRequired(true);
        setVerificationEmail(result.email || form.email);
        setError("");
        return;
      }

      setAuth({ token: result.token, user: result.user });
      navigate("/events");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await verifyRegistration({
        email: verificationEmail,
        code: verificationCode.trim()
      });

      setAuth({ token: result.token, user: result.user });
      navigate("/events");
    } catch (err) {
      setError(err.message || "Unable to verify code");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!verificationEmail) {
      return;
    }
    setError("");
    setIsResending(true);

    try {
      await resendVerification({ email: verificationEmail });
    } catch (err) {
      setError(err.message || "Unable to resend code");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-3xl border border-white/40 bg-white/70 p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary)] text-white text-lg font-bold shadow">
        EM
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "login"
          ? "Use your campus email and password."
          : "Create an account to register or host events."}
      </p>

      {!verificationRequired ? (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
          <div>
            <label className="text-xs font-semibold text-slate-500">Full name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
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
            <label className="text-xs font-semibold text-slate-500">Email</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@campus.edu"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Password</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
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
                <label className="text-xs font-semibold text-slate-500">Role</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
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
                <label className="text-xs font-semibold text-slate-500">Department (Optional)</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  type="text"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  placeholder="Computer Science"
                />
              </div>
              {form.role === "student" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Student ID</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      type="text"
                      name="studentId"
                      value={form.studentId}
                      onChange={handleChange}
                      placeholder="STU-2026-0245"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Year</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                      type="text"
                      name="year"
                      value={form.year}
                      onChange={handleChange}
                      placeholder="2"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            className="w-full rounded-full bg-[color:var(--primary)] px-3 py-2 font-semibold text-white transition hover:shadow-lg disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <label className="text-xs font-semibold text-slate-500">Verification Email</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500"
              type="email"
              value={verificationEmail}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">6-digit Code</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              type="text"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              placeholder="Enter code"
              maxLength={6}
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              The code was sent to {verificationEmail}. It is valid for 7 days.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            className="w-full rounded-full bg-[color:var(--primary)] px-3 py-2 font-semibold text-white transition hover:shadow-lg disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Verifying..." : "Verify & Complete"}
          </button>
          <button
            className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-70"
            type="button"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? "Resending..." : "Resend Code"}
          </button>
        </form>
      )}

      {!verificationRequired && (
        <button
          className="mt-4 w-full text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          type="button"
          onClick={() => {
            setMode((prev) => (prev === "login" ? "register" : "login"));
            setError("");
          }}
        >
          {mode === "login"
            ? "Need an account? Register here"
            : "Already have an account? Sign in"}
        </button>
      )}
    </section>
  );
}
