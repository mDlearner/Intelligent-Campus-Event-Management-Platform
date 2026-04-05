const API_BASE = import.meta.env.VITE_API_URL || "";
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function buildRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const requestId = buildRequestId();
  const headers = {
    "Content-Type": "application/json",
    "x-request-id": requestId
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        `Request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s (Ref: ${requestId})`
      );
      timeoutError.status = 408;
      timeoutError.requestId = requestId;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const serverRequestId = response.headers.get("x-request-id") || payload?.requestId || requestId;
    const message = payload?.message || `Request failed (${response.status})`;
    const displayMessage = serverRequestId ? `${message} (Ref: ${serverRequestId})` : message;
    const error = new Error(displayMessage);
    error.status = response.status;
    error.payload = payload;
    error.requestId = serverRequestId;
    error.rawMessage = message;
    throw error;
  }

  return payload;
}

export function loginUser(credentials) {
  return apiFetch("/api/auth/login", { method: "POST", body: credentials });
}

export function registerUser(payload) {
  return apiFetch("/api/auth/register", { method: "POST", body: payload });
}

export function verifyRegistration(payload) {
  return apiFetch("/api/auth/verify", { method: "POST", body: payload });
}

export function resendVerification(payload) {
  return apiFetch("/api/auth/resend", { method: "POST", body: payload });
}

export function fetchEvents() {
  return apiFetch("/api/events");
}

export function fetchEventsPaginated(page = 1, limit = 8) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });
  return apiFetch(`/api/events?${params.toString()}`);
}

export function fetchEventById(eventId) {
  return apiFetch(`/api/events/${eventId}`);
}

export function fetchMyRegistrations(token) {
  return apiFetch("/api/events/registrations/me", { token });
}

export function fetchMyNotifications(token) {
  return apiFetch("/api/notifications/me", { token });
}

export function sendReminders(token) {
  return apiFetch("/api/notifications/reminders", { method: "POST", token });
}

export function createEvent(payload, token) {
  return apiFetch("/api/events", { method: "POST", body: payload, token });
}

export function updateEvent(eventId, payload, token) {
  return apiFetch(`/api/events/${eventId}`, { method: "PUT", body: payload, token });
}

export function deleteEvent(eventId, token) {
  return apiFetch(`/api/events/${eventId}`, { method: "DELETE", token });
}

export function registerForEvent(eventId, token) {
  return apiFetch(`/api/events/${eventId}/register`, { method: "POST", token });
}

export function fetchProfile(token) {
  return apiFetch("/api/auth/profile", { token });
}

export function updateProfile(payload, token) {
  return apiFetch("/api/auth/profile", { method: "PUT", body: payload, token });
}
