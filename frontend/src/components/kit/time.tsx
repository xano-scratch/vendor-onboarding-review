import { useSyncExternalStore } from "react";

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;
const abs = (d: Date) => d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const toDate = (v: number | string | Date) => (v instanceof Date ? v : new Date(v));

/** "3 hours ago", "in 2 days", "yesterday". */
export function relative(v: number | string | Date, now = Date.now()): string {
  const d = toDate(v);
  const s = (d.getTime() - now) / 1000;
  const a = Math.abs(s);
  if (!rtf) return abs(d);
  if (a < 45) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// One clock for every <Ago> on the page: it ticks every 30 s while any is mounted, so "just now" moves on.
let clock = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) timer = setInterval(() => { clock = Date.now(); listeners.forEach((l) => l()); }, 30_000);
  return () => { listeners.delete(fn); if (!listeners.size) { clearInterval(timer); timer = undefined; } };
}
const getClock = () => clock;

/** A relative time that always carries its absolute one (CRAFT.md §15.9). Empty value → `fallback`. */
export function Ago({ value, fallback = "Never", className }: { value: number | string | Date | null | undefined; fallback?: string; className?: string }) {
  useSyncExternalStore(subscribe, getClock, getClock); // re-render on each tick
  if (value === null || value === undefined || value === "" || value === 0) return <span className={className}>{fallback}</span>;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return <span className={className}>{fallback}</span>;
  return <time dateTime={d.toISOString()} title={abs(d)} className={className}>{relative(d)}</time>;
}

/** A calendar date: "Tue 7 Oct", with the full date on hover. */
export function DateLabel({ value, className }: { value: number | string | Date; className?: string }) {
  const d = toDate(value);
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleDateString(undefined, { dateStyle: "full" })} className={className}>
      {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
    </time>
  );
}
