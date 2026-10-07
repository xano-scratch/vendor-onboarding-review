import { useSyncExternalStore } from "react";

/** The person's theme: light, dark, or the system's. Remembered, and applied before paint by index.html. */
export type ThemeMode = "light" | "dark" | "system";
const KEY = "kit.theme";
const listeners = new Set<() => void>();
const media = () => (typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null);

function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}
function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && !!media()?.matches);
  document.documentElement.classList.toggle("dark", dark);
}
export function setThemeMode(mode: ThemeMode) {
  try { if (mode === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch { /* storage off */ }
  apply(mode);
  listeners.forEach((l) => l());
}
let watching = false;
function subscribe(l: () => void) {
  listeners.add(l);
  if (!watching && media()) {
    watching = true;
    media()!.addEventListener("change", () => { if (read() === "system") { apply("system"); listeners.forEach((x) => x()); } });
  }
  return () => listeners.delete(l);
}
const snapshot = () => `${read()}|${typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? 1 : 0}`;

/** `{ mode, dark, setMode, toggle }`: one source of truth for every control that changes the theme. */
export function useTheme() {
  const [mode, dark] = useSyncExternalStore(subscribe, snapshot, () => "system|0").split("|") as [ThemeMode, string];
  return {
    mode,
    dark: dark === "1",
    setMode: setThemeMode,
    toggle: () => setThemeMode(dark === "1" ? "light" : "dark"),
  };
}
