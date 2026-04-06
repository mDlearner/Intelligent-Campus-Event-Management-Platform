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
  clubName: "",
  studentId: "",
  year: ""
};

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const DEPARTMENTS = [
  "Artificial Intelligence and Machine Learning",
  "Information Technology (IT)",
  "Electronics and Communication Engineering (ECE)",
  "Civil Engineering (CE)",
  "Mechanical Engineering (ME)",
  "Electrical and Electronics Engineering (EEE)",
  "Computer Science and Engineering (CSE)"
];

const STUDENT_YEARS = ["1", "2", "3", "4"];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationSentTo, setVerificationSentTo] = useState("");
  const [secondaryVerificationSentTo, setSecondaryVerificationSentTo] = useState("");
  const [verificationStage, setVerificationStage] = useState("primary");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [isResending, setIsResending] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    const normalizedValue = name === "studentId" ? value.replace(/\D/g, "").slice(0, 12) : value;
    setForm((prev) => {
      const next = { ...prev, [name]: normalizedValue };

      if (name === "role") {
        if (value === "student") {
          next.clubName = "";
        } else if (value === "club") {
          next.department = "";
          next.studentId = "";
          next.year = "";
        } else if (value === "admin") {
          next.department = "";
          next.clubName = "";
          next.studentId = "";
          next.year = "";
        }
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "register" && !strongPasswordRegex.test(form.password)) {
        setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character");
        return;
      }

      if (mode === "register" && form.role === "student" && form.studentId.length !== 12) {
        setError("Student ID must be 12 digits");
        return;
      }

      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            department: form.role === "student" ? form.department || undefined : undefined,
            clubName: form.role === "club" ? form.clubName || undefined : undefined,
            studentId: form.role === "student" ? form.studentId || undefined : undefined,
            year: form.role === "student" ? form.year || undefined : undefined
          };

      const result = mode === "login"
        ? await loginUser(payload)
        : await registerUser(payload);

      if (result?.verificationRequired) {
        setVerificationRequired(true);
        setVerificationEmail(result.email || form.email);
        setVerificationSentTo(result.verificationSentTo || result.email || form.email);
        setSecondaryVerificationSentTo(result.secondaryVerificationSentTo || "");
        setVerificationStage(result.verificationStage || "primary");
        setVerificationCode("");
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
      const normalizedCode = verificationCode.replace(/\D/g, "").slice(0, 6);
      const result = await verifyRegistration({
        email: verificationEmail,
        code: normalizedCode,
        stage: verificationStage
      });

      if (result?.secondaryVerificationRequired) {
        setVerificationStage(result.verificationStage || "secondary");
        setVerificationCode("");
        setError("");
        if (secondaryVerificationSentTo) {
          setVerificationSentTo(secondaryVerificationSentTo);
        }
        return;
      }

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
      const result = await resendVerification({ email: verificationEmail, stage: verificationStage });
      if (result?.verificationSentTo) {
        setVerificationSentTo(result.verificationSentTo);
      }
      if (result?.secondaryVerificationSentTo) {
        setSecondaryVerificationSentTo(result.secondaryVerificationSentTo);
        if (verificationStage === "secondary") {
          setVerificationSentTo(result.secondaryVerificationSentTo);
        }
      }
      if (result?.verificationStage) {
        setVerificationStage(result.verificationStage);
      }
    } catch (err) {
      setError(err.message || "Unable to resend code");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div className="glass-panel rounded-3xl p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--bg)] text-lg font-bold shadow-[0_10px_24px_rgba(240,192,64,0.22)]">
          EM
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--text)]">
        {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-[var(--text2)]">
          {mode === "login"
            ? "Use your campus email and password."
            : "Create an account to register or host events."}
        </p>

        {!verificationRequired ? (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "register" && (
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Full name</label>
            <input
              className="neo-input mt-2"
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
            <label className="text-xs font-semibold text-[var(--text3)]">Email</label>
            <input
              className="neo-input mt-2"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@campus.edu"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Password</label>
            <input
              className="neo-input mt-2"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
            {mode === "register" && (
              <p className="mt-2 text-xs text-[var(--text3)]">
                Must be 8+ chars with uppercase, lowercase, number, and special character.
              </p>
            )}
          </div>
          {mode === "register" && (
            <>
              <div>
                <label className="text-xs font-semibold text-[var(--text3)]">Role</label>
                <select
                  className="neo-input mt-2"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                >
                  <option value="student">Student</option>
                  <option value="club">Club</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {form.role === "student" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text3)]">Department</label>
                  <select
                    className="neo-input mt-2"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    required
                  >
                    <option value="" disabled>
                      Select department
                    </option>
                    {DEPARTMENTS.map((departmentName) => (
                      <option key={departmentName} value={departmentName}>
                        {departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.role === "club" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text3)]">Club Name</label>
                  <input
                    className="neo-input mt-2"
                    type="text"
                    name="clubName"
                    value={form.clubName}
                    onChange={handleChange}
                    placeholder="Coding Club"
                    required
                  />
                </div>
              )}
              {form.role === "student" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text3)]">Student ID</label>
                    <input
                      className="neo-input mt-2"
                      type="text"
                      name="studentId"
                      value={form.studentId}
                      onChange={handleChange}
                      placeholder="123456789012"
                      maxLength={12}
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text3)]">Year</label>
                    <select
                      className="neo-input mt-2"
                      name="year"
                      value={form.year}
                      onChange={handleChange}
                      required
                    >
                      <option value="" disabled>
                        Select year
                      </option>
                      {STUDENT_YEARS.map((yearValue) => (
                        <option key={yearValue} value={yearValue}>
                          {yearValue}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-2xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-center text-sm text-[var(--rose)]">
              {error}
            </div>
          )}

          <button
            className="neo-btn w-full px-3 py-2"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">Verification Email</label>
            <input
              className="neo-input mt-2 opacity-80"
              type="email"
              value={verificationEmail}
              disabled
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text3)]">6-digit Code</label>
            <input
              className="neo-input mt-2"
              type="text"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter code"
              maxLength={6}
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
            />
            <p className="mt-2 text-xs text-[var(--text3)]">
              {secondaryVerificationSentTo
                ? verificationStage === "secondary"
                  ? "Step 2 of 2: Enter the secondary OTP."
                  : "Step 1 of 2: Enter the primary OTP."
                : "Enter the verification code."} The code was sent to {verificationSentTo || verificationEmail}.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-[var(--rose)]/30 bg-[rgba(255,107,138,0.1)] px-3 py-2 text-center text-sm text-[var(--rose)]">
              {error}
            </div>
          )}

          <button
            className="neo-btn w-full px-3 py-2"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Verifying..."
              : secondaryVerificationSentTo && verificationStage === "secondary"
              ? "Verify Step 2 & Complete"
              : secondaryVerificationSentTo
              ? "Verify Step 1"
              : "Verify & Complete"}
          </button>
          <button
            className="neo-btn-ghost w-full px-3 py-2 text-sm disabled:opacity-70"
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
          className="mt-4 w-full text-sm font-semibold text-[var(--text2)] transition hover:text-[var(--text)]"
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
      </div>
    </section>
  );
}
