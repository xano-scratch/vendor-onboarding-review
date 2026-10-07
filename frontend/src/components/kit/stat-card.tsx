import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A small trend line in the accent, with a soft area under it. Values are plotted left to right. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label?: string }) {
  if (values.length < 2) return null;
  const w = 120, h = 32, pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - min) * (h - pad * 2)) / span] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label ?? `Trend: ${values.join(", ")}`}
      className={cn("h-8 w-full text-primary", className)}>
      <path d={area} fill="currentColor" opacity={0.1} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One number that matters, what it means, and where it's heading. `delta` is the change against the
 * previous period; `goodWhen` says which direction is good (so a rising backlog reads as a warning).
 * With `href`, the whole card opens the list behind the number.
 */
export function StatCard({ label, value, hint, trend, delta, goodWhen = "up", href, loading, className }: {
  label: string; value: ReactNode; hint?: ReactNode; trend?: number[];
  delta?: { value: number; label?: string }; goodWhen?: "up" | "down"; href?: string; loading?: boolean; className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-0.5 text-[0.8125rem] text-muted-foreground">
          {label}
          {href && <ChevronRight aria-hidden className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />}
        </span>
        {delta && delta.value !== 0 && (() => {
          const up = delta.value > 0;
          const good = up === (goodWhen === "up");
          const Arrow = up ? ArrowUpRight : ArrowDownRight;
          return (
            <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", good ? "text-success" : "text-warning")}
              title={delta.label ?? "Against the previous period"}>
              <Arrow aria-hidden className="size-3.5" />{up ? "+" : ""}{delta.value}
            </span>
          );
        })()}
      </div>
      {/* The trend sits beside the number, so every card in a row is the same compact height. */}
      <div className="flex items-end justify-between gap-3">
        {loading ? <Skeleton className="mt-1 h-8 w-16" /> : <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>}
        {trend && !loading && <Sparkline values={trend} className="h-8 w-24 shrink-0" label={`${label}, trend`} />}
      </div>
      {hint && <div className="truncate text-xs text-muted-foreground" title={typeof hint === "string" ? hint : undefined}>{hint}</div>}
    </>
  );
  const cls = cn("group flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4", href && "transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className);
  return href
    ? <Link to={href} data-kit="stat-card" className={cls}>{body}</Link>
    : <div data-kit="stat-card" className={cls}>{body}</div>;
}

/** Count rows per day for the last `days` days (oldest first): the series a Sparkline wants. */
export function perDay<T>(rows: T[], at: (row: T) => number | string | null | undefined, days = 14, now = Date.now()): number[] {
  const out = new Array(days).fill(0) as number[];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const first = start.getTime() - (days - 1) * 86_400_000;
  for (const r of rows) {
    const v = at(r);
    if (v === null || v === undefined || v === "") continue;
    const i = Math.floor((new Date(v).getTime() - first) / 86_400_000);
    if (i >= 0 && i < days) out[i]++;
  }
  return out;
}
