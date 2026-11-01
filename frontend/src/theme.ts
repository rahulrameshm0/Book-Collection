import { useSyncExternalStore } from "react";

export type SiteTheme = "light" | "dark";

const THEME_KEY = "shelf_theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function storedTheme(): SiteTheme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function currentTheme(): SiteTheme {
  return storedTheme() ?? (systemDark.matches ? "dark" : "light");
}

function apply() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#151922" : "#F2F3F5");
  listeners.forEach((listener) => listener());
}

// Follow the system setting until the reader picks a theme themselves.
systemDark.addEventListener("change", () => {
  if (!storedTheme()) apply();
});

export function setTheme(theme: SiteTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): SiteTheme {
  return useSyncExternalStore(subscribe, currentTheme);
}

apply();
