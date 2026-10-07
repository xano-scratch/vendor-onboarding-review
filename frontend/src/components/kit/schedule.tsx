import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { addDays, dayKey, fromDayKey, isToday, startOfWeek, type WeekStart } from "./dates";
import { LoadError } from "./states";

export interface Lane { id: string; label: string; detail?: string }

type Key = string | number;
const NONE = "__none";

/**
 * Who does what, on which day: lanes (people, rooms, vehicles) down the side, a week across, and a tray of
 * what isn't placed yet (a signature view, CRAFT.md §17). Drag a card to a cell (mouse), or use its
 * "Schedule…" button (touch, keyboard) to pick a lane and a day. On a phone it reads as an agenda.
 * `onMove` gets the lane id and day key, either may be null (back to the tray); make it optimistic.
 */
export function ScheduleBoard<T>({ label, lanes, items, error, onRetry, laneOf, dayOf, itemKey, renderItem, onMove, onOpen, weekStart, onWeekChange, weekStartsOn = "monday", days = 7, trayLabel = "Not scheduled", capacity, weekends = true, canMove = () => true, unschedule = true, trayEmpty = "Everything is scheduled.", laneNoun = "Who", unassignedLabel = "Not assigned" }: {
  label: string;
  lanes: Lane[];
  items: T[] | null | undefined;
  error?: unknown;
  onRetry?: () => void;
  laneOf: (item: T) => string | null;
  /** The item's day as a day key (YYYY-MM-DD), or null. */
  dayOf: (item: T) => string | null;
  itemKey: (item: T) => Key;
  renderItem: (item: T, where: "cell" | "tray" | "agenda") => ReactNode;
  onMove: (item: T, lane: string | null, day: string | null) => void;
  onOpen?: (item: T) => void;
  weekStart?: Date;
  onWeekChange?: (start: Date) => void;
  /** Which day "This week" starts on, when the board picks the week itself. */
  weekStartsOn?: WeekStart;
  days?: number;
  trayLabel?: string;
  /** More than this on one person's day tints the cell as over capacity. */
  capacity?: number;
  /** Show Saturday and Sunday. Off for a Monday–Friday operation: the five days get the room. */
  weekends?: boolean;
  /** Whether this person may move this item (CRAFT.md §17): false hides its drag and its Schedule… button. */
  canMove?: (item: T) => boolean;
  /** Whether a placed item can go back to the tray (a drop there, or "Not assigned" / "No day" in the dialog). */
  unschedule?: boolean;
  /** What the tray says when it is empty. */
  trayEmpty?: string;
  /** The lane picker's label in the Schedule dialog: "Who" for people, "Room", "Vehicle". */
  laneNoun?: string;
  /** The lane picker's empty choice: "Not assigned", "No room". */
  unassignedLabel?: string;
}) {
  const [ownStart, setOwnStart] = useState(() => startOfWeek(new Date(), weekStartsOn));
  const start = weekStart ?? ownStart;
  const setStart = onWeekChange ?? setOwnStart;
  const [drag, setDrag] = useState<Key | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [picking, setPicking] = useState<T | null>(null);
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)).filter((d) => weekends || (d.getDay() !== 0 && d.getDay() !== 6)), [start, days, weekends]);
  const keys = new Set(dayList.map(dayKey));
  if (error) return <LoadError error={error} onRetry={onRetry} />;

  const all = items ?? [];
  const byKey = new Map(all.map((i) => [String(itemKey(i)), i]));
  const placed = (lane: string, day: string) => all.filter((i) => laneOf(i) === lane && dayOf(i) === day);
  const tray = all.filter((i) => !laneOf(i) || !dayOf(i));
  const drop = (lane: string | null, day: string | null) => {
    const it = byKey.get(String(drag)); setDrag(null); setOver(null);
    if (it && !unschedule && (!lane || !day) && laneOf(it) && dayOf(it)) return;
    if (it && (laneOf(it) !== lane || dayOf(it) !== day)) onMove(it, lane, day);
  };
  const dropProps = (id: string, lane: string | null, day: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (drag !== null) { e.preventDefault(); setOver(id); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); drop(lane, day); },
  });
  const card = (item: T, where: "cell" | "tray") => {
    const k = itemKey(item);
    const movable = canMove(item);
    return (
      <div key={k} draggable={movable} data-schedule-item={k}
        onDragStart={(e) => { setDrag(k); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(k)); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        className={cn("group relative rounded-md border bg-card text-xs shadow-xs", movable && "cursor-grab active:cursor-grabbing", drag === k && "opacity-50")}>
        <button type="button" onClick={() => onOpen?.(item)} className={cn("flex w-full min-w-0 flex-col gap-0.5 rounded-md p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", movable && "pr-8")}>
          {renderItem(item, where)}
        </button>
        {movable && <button type="button" aria-label="Schedule…" data-kit="schedule-move" onClick={() => setPicking(item)}
          className="absolute top-1 right-1 grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
          <CalendarClock className="size-3.5" />
        </button>}
      </div>
    );
  };
  const range = `${dayList[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${dayList[dayList.length - 1].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div data-kit="schedule" data-signature-view="schedule" role="group" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setStart(addDays(start, -days))}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setStart(addDays(start, days))}><ChevronRight /></Button>
        <Button variant="ghost" size="sm" onClick={() => setStart(startOfWeek(new Date(), weekStartsOn))}>This week</Button>
        <span className="text-[0.8125rem] font-medium tabular-nums">{range}</span>
      </div>

      {/* The tray: what isn't placed yet. A drop here unschedules. */}
      <section aria-label={trayLabel} {...dropProps("tray", null, null)}
        className={cn("rounded-lg border border-dashed p-2 transition-colors", over === "tray" && "border-primary bg-primary/5")}>
        <h3 className="flex items-center justify-between gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground">
          <span>{trayLabel} <span className="tabular-nums">· {items ? tray.length : "–"}</span></span>
          {items && tray.length > 4 && <span className="hidden font-normal md:inline">Scroll for more →</span>}
        </h3>
        {/* One row that scrolls sideways, so a long tray never pushes the week below the fold. */}
        {!items ? <Skeleton className="h-12 w-full" /> : tray.length === 0
          ? <p className="px-1 pb-1 text-xs text-muted-foreground">{trayEmpty}</p>
          : <div className="kit-scroll-x flex gap-2 pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]">{tray.map((i) => <div key={itemKey(i)} className="w-52 shrink-0">{card(i, "tray")}</div>)}</div>}
      </section>

      {/* Wide: lanes × days. */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <div className="grid min-w-[52rem]" style={{ gridTemplateColumns: `11rem repeat(${dayList.length}, minmax(7rem, 1fr))` }}>
          <div className="sticky left-0 z-10 border-r border-b bg-card" />
          {dayList.map((d) => {
            const n = items ? all.filter((i) => dayOf(i) === dayKey(d) && laneOf(i)).length : 0;
            return (
              <div key={dayKey(d)} className={cn("flex items-center justify-between gap-1 border-b px-2 py-2 text-xs", isToday(d) ? "font-medium text-primary-text" : "text-muted-foreground")}>
                <span>{d.toLocaleDateString(undefined, { weekday: "short" })} <span className="tabular-nums">{d.getDate()}</span></span>
                {n > 0 && <span className="rounded-full bg-muted px-1.5 text-muted-foreground tabular-nums" title={`${n} scheduled`}>{n}</span>}
              </div>
            );
          })}
          {lanes.map((lane) => (
            <div key={lane.id} className="contents">
              {(() => {
                const load = items ? all.filter((i) => laneOf(i) === lane.id && keys.has(dayOf(i) ?? "")).length : 0;
                const max = capacity !== undefined ? capacity * dayList.length : undefined;
                return (
                  <div className="sticky left-0 z-10 flex min-w-0 flex-col gap-1 border-r border-b bg-card px-3 py-2.5 text-[0.8125rem]">
                    <span className="truncate font-medium" title={lane.label}>{lane.label}</span>
                    <span className="truncate text-xs text-muted-foreground" title={lane.detail}>
                      {lane.detail ? `${lane.detail} · ` : ""}
                      <span className="tabular-nums">{load}{max !== undefined ? ` / ${max}` : ""}</span> {days === 7 ? "this week" : `in ${days} days`}
                    </span>
                    {max !== undefined && (
                      <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <span className={cn("block h-full rounded-full", load > max ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, (load / max) * 100)}%` }} />
                      </span>
                    )}
                  </div>
                );
              })()}
              {dayList.map((d) => {
                const k = dayKey(d);
                const id = `${lane.id}|${k}`;
                const here = items ? placed(lane.id, k) : [];
                const full = capacity !== undefined && here.length > capacity;
                return (
                  <div key={id} data-schedule-cell={id} data-over-capacity={full || undefined} {...dropProps(id, lane.id, k)}
                    title={full ? `Over capacity: ${here.length} on one day (limit ${capacity})` : undefined}
                    className={cn("flex min-h-20 flex-col gap-1 border-b p-1 transition-colors hover:bg-muted/30 [&:not(:last-child)]:border-r", isToday(d) && "bg-primary/[0.03]", full && "bg-warning/10", over === id && "bg-primary/10 ring-2 ring-primary ring-inset")}>
                    {!items ? <Skeleton className="h-10 w-full" /> : here.map((i) => card(i, "cell"))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Narrow: an agenda, day by day. */}
      <div className="flex flex-col gap-3 md:hidden">
        {dayList.map((d) => {
          const k = dayKey(d);
          const list = all.filter((i) => dayOf(i) === k && laneOf(i));
          return (
            <section key={k} aria-label={d.toDateString()}>
              <h3 className={cn("pb-1 text-xs font-medium", isToday(d) ? "text-primary-text" : "text-muted-foreground")}>
                {d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              </h3>
              {!items ? <Skeleton className="h-12 w-full" /> : list.length === 0 ? <p className="text-xs text-muted-foreground">Nothing scheduled.</p> : (
                <ul className="divide-y rounded-lg border bg-card">
                  {list.map((i) => (
                    <li key={itemKey(i)} className="flex items-center gap-2">
                      <button type="button" onClick={() => onOpen?.(i)} className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 text-left text-[0.8125rem]">
                        {renderItem(i, "agenda")}
                        <span className="text-xs text-muted-foreground">{lanes.find((l) => l.id === laneOf(i))?.label}</span>
                      </button>
                      {canMove(i) && <Button variant="ghost" size="icon" aria-label="Schedule…" className="mr-1" onClick={() => setPicking(i)}><CalendarClock /></Button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <MoveDialog item={picking} lanes={lanes} dayList={dayList} laneOf={laneOf} dayOf={dayOf} keys={keys} unschedule={unschedule}
        laneNoun={laneNoun} unassignedLabel={unassignedLabel}
        onClose={() => setPicking(null)} onMove={(lane, day) => { if (picking) onMove(picking, lane, day); setPicking(null); }} />
    </div>
  );
}

function MoveDialog<T>({ item, lanes, dayList, laneOf, dayOf, keys, unschedule, laneNoun, unassignedLabel, onClose, onMove }: {
  item: T | null; lanes: Lane[]; dayList: Date[]; laneOf: (i: T) => string | null; dayOf: (i: T) => string | null; keys: Set<string>; unschedule: boolean;
  laneNoun: string; unassignedLabel: string;
  onClose: () => void; onMove: (lane: string | null, day: string | null) => void;
}) {
  const [lane, setLane] = useState(NONE);
  const [day, setDay] = useState(NONE);
  // Reset only when a different item opens: laneOf/dayOf are usually inline functions, new every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (item) { setLane(laneOf(item) ?? NONE); setDay(dayOf(item) ?? NONE); } }, [item]);
  const current = item ? dayOf(item) : null;
  const pick = laneNoun === "Who" ? "Pick who and which day." : `Pick the ${laneNoun.toLowerCase()} and the day.`;
  const dayOptions = [...dayList.map(dayKey), ...(current && !keys.has(current) ? [current] : [])];
  return (
    <Dialog open={item !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
          <DialogDescription>{unschedule ? `${pick} Leave either empty to put it back in the tray.` : pick}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="kit-schedule-lane">{laneNoun}</Label>
            <Select value={lane} onValueChange={setLane}>
              <SelectTrigger id="kit-schedule-lane" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {unschedule && <SelectItem value={NONE}>{unassignedLabel}</SelectItem>}
                {lanes.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kit-schedule-day">Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger id="kit-schedule-day" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {unschedule && <SelectItem value={NONE}>No day</SelectItem>}
                {dayOptions.map((k) => <SelectItem key={k} value={k}>{fromDayKey(k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-kit="schedule-save" disabled={!unschedule && (lane === NONE || day === NONE)} onClick={() => onMove(lane === NONE ? null : lane, day === NONE ? null : day)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
