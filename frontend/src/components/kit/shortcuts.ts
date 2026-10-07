import { useEffect, useRef } from "react";

/** Is the person typing somewhere, so a single-key shortcut must not fire? */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest?.("[role=dialog] input, [cmdk-input]");
}

/**
 * A keyboard shortcut. `key` is KeyboardEvent.key ("/", "k", "Escape"). `mod` means ⌘ on a Mac, Ctrl
 * elsewhere. Single keys are ignored while the person is typing; `mod` shortcuts always work.
 */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { mod?: boolean; enabled?: boolean } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  const { mod = false, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      const hasMod = e.metaKey || e.ctrlKey;
      if (mod !== hasMod) return;
      if (!mod && (e.altKey || isTyping(e.target))) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [key, mod, enabled]);
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere. */
export const modKey = (k: string) =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? `⌘${k}` : `Ctrl ${k}`;
