import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export type Shortcut = {
  id: string;
  keys: string;
  label: string;
  section: string;
  run: () => void;
  // hidden shortcuts work but stay out of the palette, for things like
  // arrow-key movement that only make sense with a note focused.
  hidden?: boolean;
};

type Registry = {
  list: () => Shortcut[];
  subscribe: (fn: () => void) => () => void;
  add: (s: Shortcut) => () => void;
};

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function createRegistry(): Registry {
  let shortcuts: Shortcut[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    list: () => shortcuts,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    add: (s) => {
      shortcuts = [...shortcuts.filter((x) => x.id !== s.id), s];
      emit();
      return () => {
        shortcuts = shortcuts.filter((x) => x !== s);
        emit();
      };
    },
  };
}

const Ctx = createContext<Registry | null>(null);

function typingIn(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// A modal dialog or an open menu owns the keyboard; letters typed there must
// never reach the board behind it.
function keyboardTaken(target: EventTarget | null) {
  if (document.querySelector("[role=dialog], [role=alertdialog]")) return true;
  return target instanceof Element && !!target.closest("[role=menu], [role=listbox]");
}

// matches compares a keydown with a combo like "mod+k", "shift+v" or "?".
// Shift is ignored for punctuation, since "?" needs it on most layouts.
export function matches(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, combo: string, mac = isMac) {
  const parts = combo.toLowerCase().split("+");
  const key = parts.pop()!;
  const want = { mod: parts.includes("mod"), ctrl: parts.includes("ctrl"), shift: parts.includes("shift"), alt: parts.includes("alt") };
  const meta = mac ? want.mod : false;
  const ctrl = mac ? want.ctrl : want.mod || want.ctrl;
  if (e.metaKey !== meta || e.ctrlKey !== ctrl || e.altKey !== want.alt) return false;
  const pressed = e.key.toLowerCase();
  const letter = /^[a-z0-9]$/.test(key);
  if (letter && e.shiftKey !== want.shift) return false;
  const aliases: Record<string, string[]> = { backspace: ["backspace", "delete"], esc: ["escape"], up: ["arrowup"], down: ["arrowdown"], left: ["arrowleft"], right: ["arrowright"] };
  return (aliases[key] ?? [key]).includes(pressed);
}

export function KeysProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createRegistry);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || keyboardTaken(e.target)) return;
      const typing = typingIn(e.target);
      const list = registry.list();
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i];
        if (typing && !s.keys.includes("mod+")) continue;
        if (s.keys.split(" ").some((combo) => matches(e, combo))) {
          e.preventDefault();
          s.run();
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [registry]);

  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>;
}

function useRegistry() {
  const r = useContext(Ctx);
  if (!r) throw new Error("useShortcut needs a KeysProvider");
  return r;
}

// useShortcut registers s while the component is mounted and enabled. The
// latest run is always called, so callers needn't memoise it.
export function useShortcut(s: Shortcut, enabled = true) {
  const registry = useRegistry();
  const run = useRef(s.run);
  useEffect(() => {
    run.current = s.run;
  });
  const { id, keys, label, section, hidden } = s;
  useEffect(() => {
    if (!enabled) return;
    return registry.add({ id, keys, label, section, hidden, run: () => run.current() });
  }, [registry, enabled, id, keys, label, section, hidden]);
}

export function useShortcuts() {
  const registry = useRegistry();
  return useSyncExternalStore(registry.subscribe, registry.list);
}

const names: Record<string, string> = {
  mod: isMac ? "⌘" : "Ctrl",
  ctrl: isMac ? "⌃" : "Ctrl",
  shift: "⇧",
  alt: isMac ? "⌥" : "Alt",
  backspace: "⌫",
  enter: "↵",
  esc: "Esc",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "Space",
};

export function keyLabel(combo: string) {
  return combo
    .split("+")
    .map((p) => names[p.toLowerCase()] ?? p.toUpperCase())
    .join(isMac ? "" : "+");
}

export function Kbd({ keys, className = "" }: { keys: string; className?: string }) {
  const first = keys.split(" ")[0];
  return (
    <kbd className={`pointer-coarse:hidden inline-flex min-w-[1.6em] items-center justify-center rounded-key border-[1.5px] border-current px-1 font-sans text-xs leading-[1.5] font-bold opacity-80 ${className}`}>
      {keyLabel(first)}
    </kbd>
  );
}
