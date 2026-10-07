import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LoadError } from "./states";
import { StatusBadge, type Tone } from "./status-badge";

export interface KanbanColumn { id: string; title: string; tone?: Tone; hint?: string; /** Warn when a column holds more than this. */ limit?: number }

type Key = string | number;

/**
 * A board of cards in columns: a pipeline's stages, a ticket's states (a signature view, CRAFT.md §17).
 * Move a card by dragging it (mouse), with its Move menu (touch, keyboard), or with Shift + ← / → when
 * it has focus. `onMove` should be optimistic (`optimistic()`): the board shows the move at once.
 * On a phone the columns scroll sideways, one screen-width each.
 */
export function KanbanBoard<T>({ label, columns, items, error, onRetry, columnOf, itemKey, renderCard, onMove, onOpen, canMove = () => true, emptyColumn = "Nothing here" }: {
  label: string;
  columns: KanbanColumn[];
  items: T[] | null | undefined;
  error?: unknown;
  onRetry?: () => void;
  columnOf: (item: T) => string;
  itemKey: (item: T) => Key;
  renderCard: (item: T) => ReactNode;
  onMove: (item: T, to: string) => void;
  onOpen?: (item: T) => void;
  canMove?: (item: T, to: string) => boolean;
  emptyColumn?: string;
}) {
  const [drag, setDrag] = useState<Key | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  // A keyboard move remounts the card in its new column, which drops focus: give it back to the card
  // (only when focus fell to the page, so it never steals it from somewhere else).
  const refocus = useRef<{ key: Key; to: string } | null>(null);
  useEffect(() => {
    const r = refocus.current;
    const el = r && root.current?.querySelector<HTMLElement>(`[data-kanban-card="${CSS.escape(String(r.key))}"] > [tabindex]`);
    if (!r || !el) return;
    if (el.closest("[data-kanban-column]")?.getAttribute("data-kanban-column") === r.to) refocus.current = null;
    if (!document.activeElement || document.activeElement === document.body) el.focus();
  });
  if (error) return <LoadError error={error} onRetry={onRetry} />;
  const byKey = new Map((items ?? []).map((i) => [String(itemKey(i)), i]));
  const move = (item: T, to: string) => {
    if (columnOf(item) === to || !canMove(item, to)) return;
    onMove(item, to);
    setSaid(`Moved to ${columns.find((c) => c.id === to)?.title ?? to}.`);
  };

  return (
    <div ref={root} className="flex flex-col gap-2">
    {/* Phone: the columns as a strip of chips; tapping one scrolls the board to it. */}
    <nav aria-label="Jump to a column" className="kit-scroll-x -mx-4 flex gap-2 px-4 md:hidden">
      {columns.map((col) => (
        <button key={col.id} type="button" data-kanban-jump={col.id}
          onClick={() => root.current?.querySelector(`[data-kanban-column="${CSS.escape(col.id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
          className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs whitespace-nowrap">
          {col.title} <span className="text-muted-foreground tabular-nums">{items ? (items ?? []).filter((i) => columnOf(i) === col.id).length : ""}</span>
        </button>
      ))}
    </nav>
    <div data-kit="kanban" data-signature-view="kanban" aria-label={label} role="group"
      className="kit-scroll-x -mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-2 md:mx-0 md:px-0">
      <p aria-live="polite" className="sr-only">{said}</p>
      {columns.map((col, ci) => {
        const list = (items ?? []).filter((i) => columnOf(i) === col.id);
        const tooMany = col.limit !== undefined && list.length > col.limit;
        return (
          <section key={col.id} aria-label={col.title} data-kanban-column={col.id}
            onDragOver={(e) => { if (drag !== null) { e.preventDefault(); setOver(col.id); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); const it = byKey.get(String(drag)); setOver(null); setDrag(null); if (it) move(it, col.id); }}
            className={cn("flex w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-lg border bg-muted/40 p-2 transition-colors sm:w-72 md:w-auto md:min-w-56 md:flex-1",
              over === col.id && "border-primary bg-primary/5")}>
            <header className="flex items-center justify-between gap-2 px-1 pt-1">
              <div className="flex min-w-0 items-center gap-2">
                <StatusBadge tone={col.tone ?? "neutral"} dot>{col.title}</StatusBadge>
                <span className={cn("text-xs tabular-nums", tooMany ? "font-medium text-warning" : "text-muted-foreground")}
                  title={tooMany ? `Over the limit of ${col.limit}` : undefined}>
                  {items ? list.length : "–"}{col.limit !== undefined && ` / ${col.limit}`}
                </span>
              </div>
            </header>
            {col.hint && <p className="px-1 text-xs text-muted-foreground">{col.hint}</p>}
            <ul className="flex min-h-16 flex-col gap-2">
              {!items ? Array.from({ length: 3 }, (_, i) => <li key={`skeleton-${i}`}><Skeleton className="h-20 w-full" /></li>)
                : list.length === 0 ? <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">{emptyColumn}</li>
                : list.map((item) => {
                  const k = itemKey(item);
                  const targets = columns.filter((c) => c.id !== col.id && canMove(item, c.id));
                  return (
                    <li key={k} draggable={targets.length > 0} data-kanban-card={k}
                      onDragStart={(e) => { setDrag(k); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(k)); }}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      className={cn("group relative rounded-md border bg-card text-[0.8125rem] shadow-xs transition-shadow hover:shadow-sm", drag === k && "opacity-50")}>
                      <div role={onOpen ? "button" : undefined} tabIndex={0}
                        onClick={() => onOpen?.(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && onOpen) { e.preventDefault(); onOpen(item); }
                          if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
                            e.preventDefault();
                            const step = e.key === "ArrowRight" ? 1 : -1;
                            for (let n = ci + step; n >= 0 && n < columns.length; n += step) {
                              if (canMove(item, columns[n].id)) { refocus.current = { key: k, to: columns[n].id }; move(item, columns[n].id); break; }
                            }
                          }
                        }}
                        className={cn("flex min-w-0 flex-col gap-1 rounded-md p-3 pr-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", onOpen && "cursor-pointer")}>
                        {renderCard(item)}
                      </div>
                      {targets.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger aria-label="Move" data-kit="kanban-move"
                            className="absolute top-2 right-2 grid size-7 place-items-center rounded text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
                            {targets.map((c) => <DropdownMenuItem key={c.id} onSelect={() => move(item, c.id)}>{c.title}</DropdownMenuItem>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
    </div>
    </div>
  );
}
