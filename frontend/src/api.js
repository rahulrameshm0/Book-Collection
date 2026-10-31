const ACCESS_KEY = "morrow_access";
const REFRESH_KEY = "morrow_refresh";
const USER_KEY = "morrow_user";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession({ access, refresh, user }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error("No refresh token");
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const data = await response.json();
        localStorage.setItem(ACCESS_KEY, data.access);
        return data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function errorMessage(data) {
  if (!data) return "Something went wrong. Try again.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return first[0];
  if (typeof first === "string") return first;
  return "Something went wrong. Try again.";
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const makeRequest = async (token) => {
    const headers = { "Content-Type": "application/json" };
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await makeRequest(localStorage.getItem(ACCESS_KEY));

  if (response.status === 401 && auth && localStorage.getItem(REFRESH_KEY)) {
    try {
      const token = await refreshAccessToken();
      response = await makeRequest(token);
    } catch {
      clearSession();
      window.dispatchEvent(new Event("morrow:unauthorized"));
      throw new ApiError("Your session expired. Please sign in again.", 401, null);
    }
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      window.dispatchEvent(new Event("morrow:unauthorized"));
    }
    throw new ApiError(errorMessage(data), response.status, data);
  }

  return data;
}
