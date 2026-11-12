import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "thoughts.theme";
// These must stay in step with --color-paper in index.css and the
// theme-color metas in index.html.
const paper = { light: "#f4f6f8", dark: "#0e1624" };

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function stored(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

let current = stored();

const showingFor = (t: Theme) => (t === "system" ? (prefersDark.matches ? "dark" : "light") : t);

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = t;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = t === "system" ? (meta.media.includes("dark") ? paper.dark : paper.light) : paper[t];
  }
}

apply(current);
prefersDark.addEventListener("change", emit);
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  current = stored();
  apply(current);
  emit();
});

export function setTheme(t: Theme) {
  const change = () => {
    current = t;
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // Remembering is a nicety.
    }
    apply(t);
    emit();
  };
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || still || showingFor(t) === showingFor(current)) return change();
  const root = document.documentElement;
  root.classList.add("theme-wipe");
  document.startViewTransition(change).finished.finally(() => root.classList.remove("theme-wipe"));
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useTheme = () => useSyncExternalStore(subscribe, () => current);
export const useShowing = () => useSyncExternalStore(subscribe, () => showingFor(current));
