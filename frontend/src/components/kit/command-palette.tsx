import { useEffect, useMemo, useState } from "react";
import { Search, type LucideIcon } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { modKey, useHotkey } from "./shortcuts";

export interface PaletteItem {
  id: string;
  label: string;
  /** "Go to", "Actions", "Notes"… Items show grouped in the order their groups first appear. */
  group: string;
  icon?: LucideIcon;
  /** A second line of context: a status, an owner, a date. */
  hint?: string;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
}

const OPEN = "kit:command-palette";
/** Open the palette from anywhere (a header button, a first-run step). */
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN));

/**
 * ⌘K / Ctrl K: jump to any screen, run an action, or find a record. `items` are the static ones (nav,
 * actions); `search` finds records as the person types (debounced, newest answer wins).
 */
export function CommandPalette({ items, search, placeholder = "Search or jump to…" }: {
  items: PaletteItem[]; search?: (q: string) => Promise<PaletteItem[]>; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PaletteItem[]>([]);
  useHotkey("k", () => setOpen((o) => !o), { mod: true });
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  useEffect(() => { if (!open) { setQ(""); setFound([]); } }, [open]);
  useEffect(() => {
    if (!search || q.trim().length < 2) { setFound([]); return; }
    let live = true;
    const t = setTimeout(() => { search(q.trim()).then((r) => { if (live) setFound(r); }, () => { if (live) setFound([]); }); }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, search]);

  const groups = useMemo(() => {
    const all = [...items, ...found.map((f) => ({ ...f, keywords: [...(f.keywords ?? []), q] }))];
    const m = new Map<string, PaletteItem[]>();
    for (const it of all) m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return [...m.entries()];
  }, [items, found, q]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a screen, run an action, or find a record">
      <CommandInput placeholder={placeholder} value={q} onValueChange={setQ} data-kit="command-input" />
      <CommandList data-kit="command-palette">
        <CommandEmpty>No matches. Try fewer words.</CommandEmpty>
        {groups.map(([group, list]) => (
          <CommandGroup key={group} heading={group}>
            {list.map((it) => {
              const Icon = it.icon;
              return (
                <CommandItem key={`${group}:${it.id}`} value={`${it.label} ${it.hint ?? ""} ${group} ${it.id}`} keywords={it.keywords}
                  onSelect={() => { setOpen(false); it.run(); }}>
                  {Icon && <Icon aria-hidden className="text-muted-foreground" />}
                  <span className="min-w-0 truncate" title={it.label}>{it.label}</span>
                  {it.hint && <span className="min-w-0 truncate text-xs text-muted-foreground">{it.hint}</span>}
                  {it.shortcut && <CommandShortcut>{it.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** The header's search button: opens the palette, and says how to open it from the keyboard. */
export function PaletteButton({ className, label = "Search" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={openCommandPalette} data-kit="palette-button"
      className={cn("inline-flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64 sm:flex-none", className)}>
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{label}…</span>
      <kbd className="ml-auto hidden rounded border px-1.5 font-mono text-[0.6875rem] sm:inline">{modKey("K")}</kbd>
      <span className="sr-only">Open search ({modKey("K")})</span>
    </button>
  );
}
