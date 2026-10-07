import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useHotkey } from "./shortcuts";

/** The row of controls above a list: tabs on their own line, then search and filters. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-kit="toolbar" className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}

export interface TabOption { value: string; label: string; count?: number }

/**
 * Status tabs: one line that scrolls sideways on a phone and never wraps; the active tab is a 2 px
 * underline (CRAFT.md §15). Arrow keys move between tabs.
 */
export function StatusTabs({ value, onChange, options, label = "Filter by status", className }: {
  value: string; onChange: (v: string) => void; options: TabOption[]; label?: string; className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} data-kit="status-tabs" className={cn("kit-scroll-x -mx-1 flex gap-1 border-b px-1", className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const n = (i + d + options.length) % options.length;
              onChange(options[n].value);
              refs.current[n]?.focus();
            }}
            className={cn("relative -mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[0.8125rem] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {o.label}
            {o.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Search that waits for a pause in typing, with "/" to focus it and Escape to clear it. */
export function SearchInput({ value, onChange, placeholder = "Search", className, delay = 250 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; delay?: number;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text.trim()), delay);
    return () => clearTimeout(t);
  }, [text, value, onChange, delay]);
  useHotkey("/", () => ref.current?.focus());
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={ref} type="search" value={text} placeholder={placeholder} aria-label={placeholder} data-kit="search"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { setText(""); onChange(""); e.currentTarget.blur(); } }}
        className="h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden" />
      {text ? (
        <button type="button" aria-label="Clear search" onClick={() => { setText(""); onChange(""); ref.current?.focus(); }}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[0.6875rem] text-muted-foreground sm:block">/</kbd>
      )}
    </div>
  );
}

const ALL = "__all";

/** A filter dropdown. "" means no filter, shown as `allLabel`. */
export function FilterSelect({ value, onChange, options, allLabel, label, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel: string; label?: string; className?: string;
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger size="sm" aria-label={label ?? allLabel} className={cn("w-full sm:w-44", className)}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
