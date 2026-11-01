import type { User } from "./types";

const ACCESS_KEY = "shelf_access";
const REFRESH_KEY = "shelf_refresh";
const USER_KEY = "shelf_user";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function storeSession(session: {
  access?: string;
  refresh?: string;
  user?: User;
}) {
  if (session.access) localStorage.setItem(ACCESS_KEY, session.access);
  if (session.refresh) localStorage.setItem(REFRESH_KEY, session.refresh);
  if (session.user) localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasSession() {
  return Boolean(localStorage.getItem(ACCESS_KEY) || localStorage.getItem(REFRESH_KEY));
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new ApiError("Your session ended. Sign in again.", 401);

  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (response) => {
        if (!response.ok) throw new ApiError("Your session ended. Sign in again.", 401);
        const data = (await response.json()) as { access: string };
        localStorage.setItem(ACCESS_KEY, data.access);
        return data.access;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function messageFrom(data: unknown): string {
  if (!data) return "Something went wrong. Try again.";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }
  return "Something went wrong. Try again.";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const send = (token: string | null) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`/api${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send(localStorage.getItem(ACCESS_KEY));

  if (response.status === 401 && auth) {
    try {
      const token = await refreshAccessToken();
      response = await send(token);
    } catch {
      clearSession();
      window.dispatchEvent(new Event("shelf:unauthorized"));
      throw new ApiError("Your session ended. Sign in again.", 401);
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      window.dispatchEvent(new Event("shelf:unauthorized"));
    }
    throw new ApiError(messageFrom(data), response.status, data);
  }

  return data as T;
}

export function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** "About 9 hours", at an unhurried 250 words a minute. */
export function readingTime(words: number) {
  const minutes = words / 250;
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)} min read`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} to read`;
}
