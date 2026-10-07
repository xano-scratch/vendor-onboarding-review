import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { addDays, dayKey, isToday, startOfMonth, startOfWeek, type WeekStart } from "./dates";
import { LoadError } from "./states";
import type { Tone } from "./status-badge";

const DOT: Record<Tone, string> = { neutral: "bg-muted-foreground", info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-destructive" };

type Key = string | number;

/**
 * A month of things on days: bookings, deadlines, posts (a signature view, CRAFT.md §17). Up to `perDay`
 * items show in a day; the rest open in a popover. Drag an item to another day when `onMove` is given.
 * On a phone it reads as an agenda of the month's days that have something on them.
 */
export function MonthCalendar<T>({ label, items, error, onRetry, dayOf, itemKey, renderItem, toneOf, titleOf, onOpen, onMove, month, onMonthChange, perDay = 3, weekStartsOn = "monday" }: {
  label: string;
  items: T[] | null | undefined;
  error?: unknown;
  onRetry?: () => void;
  dayOf: (item: T) => string | null;
  itemKey: (item: T) => Key;
  /** "chip" in a day cell, "agenda" on a phone (room for a status and an owner). */
  renderItem: (item: T, where: "chip" | "agenda") => ReactNode;
  /** The item's status tone: its chip gets that colour's edge, as its badge has elsewhere. */
  toneOf?: (item: T) => Tone;
  /** The full text shown on hover over a (truncated) chip. */
  titleOf?: (item: T) => string;
  onOpen?: (item: T) => void;
  onMove?: (item: T, day: string) => void;
  month?: Date;
  onMonthChange?: (m: Date) => void;
  perDay?: number;
  /** The first column of each week. */
  weekStartsOn?: WeekStart;
}) {
  const [own, setOwn] = useState(() => startOfMonth(new Date()));
  const m = month ?? own;
  const setM = onMonthChange ?? setOwn;
  const [drag, setDrag] = useState<Key | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Only the weeks the month touches (4 to 6), so no rows of empty next-month days.
  const grid = useMemo(() => {
    const s = startOfWeek(startOfMonth(m), weekStartsOn);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const weeks = Math.ceil((Math.round((last.getTime() - s.getTime()) / 86_400_000) + 1) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(s, i));
  }, [m, weekStartsOn]);
  if (error) return <LoadError error={error} onRetry={onRetry} />;
  const all = items ?? [];
  const on = (k: string) => all.filter((i) => dayOf(i) === k);
  const byKey = new Map(all.map((i) => [String(itemKey(i)), i]));
  const chip = (i: T) => (
    <button key={itemKey(i)} type="button" draggable={!!onMove} data-calendar-item={itemKey(i)} title={titleOf?.(i)}
      onDragStart={(e) => { setDrag(itemKey(i)); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(itemKey(i))); }}
      onDragEnd={() => { setDrag(null); setOver(null); }}
      onClick={() => onOpen?.(i)}
      className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {toneOf && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[toneOf(i)])} />}
      <span className="min-w-0 truncate">{renderItem(i, "chip")}</span>
    </button>
  );
  const title = m.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div data-kit="calendar" data-signature-view="calendar" role="group" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight /></Button>
        <Button variant="ghost" size="sm" onClick={() => setM(startOfMonth(new Date()))}>Today</Button>
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="hidden overflow-clip rounded-lg border md:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs text-muted-foreground">
          {grid.slice(0, 7).map((d) => <div key={d.getDay()} className="px-2 py-1.5">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d) => {
            const k = dayKey(d);
            const list = items ? on(k) : [];
            const outside = d.getMonth() !== m.getMonth();
            return (
              <div key={k} data-calendar-day={k}
                onDragOver={(e) => { if (drag !== null && onMove) { e.preventDefault(); setOver(k); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                onDrop={(e) => { e.preventDefault(); const it = byKey.get(String(drag)); setDrag(null); setOver(null); if (it && onMove && dayOf(it) !== k) onMove(it, k); }}
                className={cn("flex min-h-20 min-w-0 flex-col gap-1 border-b p-1 [&:not(:nth-child(7n))]:border-r", outside && "bg-muted/30", over === k && "bg-primary/10 ring-2 ring-primary ring-inset")}>
                <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums", isToday(d) ? "bg-primary font-medium text-primary-foreground" : outside ? "text-muted-foreground/60" : "text-muted-foreground")}>{d.getDate()}</span>
                {!items ? (d.getDate() % 4 === 0 && <Skeleton className="h-4 w-full" />) : (
                  <>
                    {list.slice(0, perDay).map(chip)}
                    {list.length > perDay && (
                      <Popover>
                        <PopoverTrigger className="px-1.5 text-left text-xs text-muted-foreground hover:text-foreground">+{list.length - perDay} more</PopoverTrigger>
                        <PopoverContent className="flex w-56 flex-col gap-1 p-2">
                          <div className="px-1 pb-1 text-xs font-medium">{d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</div>
                          {list.map(chip)}
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {!items ? <Skeleton className="h-24 w-full" /> : (() => {
          const days = grid.filter((d) => d.getMonth() === m.getMonth() && on(dayKey(d)).length);
          if (!days.length) return <p className="text-[0.8125rem] text-muted-foreground">Nothing in {title}.</p>;
          return days.map((d) => (
            <section key={dayKey(d)} aria-label={d.toDateString()}>
              <h3 className={cn("pb-1 text-xs font-medium", isToday(d) ? "text-primary-text" : "text-muted-foreground")}>{d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</h3>
              <ul className="divide-y rounded-lg border bg-card">
                {on(dayKey(d)).map((i) => (
                  <li key={itemKey(i)}><button type="button" onClick={() => onOpen?.(i)} className="flex w-full min-w-0 flex-col gap-1 p-3 text-left text-[0.8125rem]">{renderItem(i, "agenda")}</button></li>
                ))}
              </ul>
            </section>
          ));
        })()}
      </div>
    </div>
  );
}
