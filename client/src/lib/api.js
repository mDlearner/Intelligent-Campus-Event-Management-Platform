const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = payload?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
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
