// Keyboard (BASELINE.md): "?" lists every shortcut, and "g" then a letter goes to a screen (G then O: Overview).
// The letters come from the nav itself, the first free letter of each label, so a template gets them for free.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isTyping, modKey, useHotkey, type NavGroup } from "@/components/kit";

const OPEN = "base:shortcuts";
export const openShortcuts = () => window.dispatchEvent(new Event(OPEN));

export type GoKey = { key: string; label: string; href: string };

/** "g" + a letter for each screen: the first letter of its label that no earlier screen took. */
export function goKeys(nav: NavGroup[], extra: { label: string; href: string }[]): GoKey[] {
  const taken = new Set<string>();
  const out: GoKey[] = [];
  for (const it of [...nav.flatMap((g) => g.items), ...extra]) {
    if (out.some((o) => o.href === it.href)) continue;
    const letter = [...it.label.toLowerCase()].find((ch) => /[a-z]/.test(ch) && !taken.has(ch));
    if (!letter) continue;
    taken.add(letter);
    out.push({ key: letter, label: it.label, href: it.href });
  }
  return out;
}

const Kbd = ({ children }: { children: string }) => <kbd className="rounded border bg-muted px-1.5 font-mono text-[0.6875rem]">{children}</kbd>;

/** Mount once in the shell. `actions` are the domain's single-key shortcuts (["N", "New job"]). */
export function Shortcuts({ go, actions = [] }: { go: GoKey[]; actions?: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pendingG = useRef<number>(0);
  useHotkey("?", () => setOpen(true));
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const hit = go.find((g) => g.key === k);
        if (hit) { e.preventDefault(); navigate(hit.href); }
        return;
      }
      if (k === "g") pendingG.current = Date.now();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [go, navigate]);
  const rows = useMemo<[string, string][]>(() => [
    [modKey("K"), "Search, jump anywhere, run an action"],
    ["/", "Search the list you're on"],
    ["?", "These shortcuts"],
    ...actions,
    ...go.map((g): [string, string] => [`G then ${g.key.toUpperCase()}`, `Go to ${g.label}`]),
  ], [go, actions]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" data-kit="shortcuts">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Single keys work anywhere except while you're typing.</DialogDescription>
        </DialogHeader>
        <dl className="max-h-[60vh] divide-y overflow-y-auto text-[0.8125rem]">
          {rows.map(([k, what]) => (
            <div key={k + what} className="flex items-center justify-between gap-4 py-1.5">
              <dt className="text-muted-foreground">{what}</dt>
              <dd className="flex shrink-0 gap-1">{k.split(" then ").map((p, i) => <span key={p} className="flex items-center gap-1">{i > 0 && <span className="text-xs text-muted-foreground">then</span>}<Kbd>{p}</Kbd></span>)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
