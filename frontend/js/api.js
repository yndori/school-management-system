const DEFAULT_API_PORT = "5501";
const configuredApiUrl = localStorage.getItem("apiBaseUrl");
const inferredApiUrl = `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}/api`;
const API_URL = configuredApiUrl || inferredApiUrl;

export async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function resetPassword(email) {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Reset request failed");
  return data;
}

export async function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  // Optional: Notify backend
  await fetch(`${API_URL}/auth/logout`, { method: "POST" }).catch(() => {});
}

export function getAuthToken() {
  return localStorage.getItem("token");
}

export function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!getAuthToken();
}
