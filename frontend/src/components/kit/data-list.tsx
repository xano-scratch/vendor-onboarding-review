import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LoadError } from "./states";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Classes for the cell and its header (width, alignment): "w-28 text-right tabular-nums". */
  className?: string;
  /** Hide this column below a breakpoint on the wide layout. */
  hideBelow?: "xl" | "2xl";
}

type Key = string | number;

/**
 * A list of records that is right at every width (CRAFT.md §11, §15): a dense table with a sticky header
 * from `lg`, one tappable row per record below it, with its status in view. It owns the three states
 * (skeleton rows shaped like the page, an error with Try again, your empty state), row keyboard
 * navigation (↑ ↓, Enter opens), and optional selection with bulk actions.
 */
export function DataList<T>({
  label, rows, error, onRetry, columns, rowKey, mobileRow, onOpen, activeKey, empty, pageSize = 10,
  selection, footer, className,
}: {
  /** What the list is, for screen readers: "Notes". */
  label: string;
  rows: T[] | null | undefined;
  error?: unknown;
  onRetry?: () => void;
  columns: Column<T>[];
  rowKey: (row: T) => Key;
  /** The phone row: the title, one line of context, and the status badge. */
  mobileRow: (row: T) => ReactNode;
  onOpen?: (row: T) => void;
  /** The record open in a sheet beside the list, shown as selected. */
  activeKey?: Key | null;
  empty: ReactNode;
  pageSize?: number;
  selection?: { selected: Set<Key>; onChange: (next: Set<Key>) => void; actions: (keys: Key[]) => ReactNode };
  footer?: ReactNode;
  className?: string;
}) {
  const body = useRef<HTMLTableSectionElement>(null);
  if (error) return <LoadError error={error} onRetry={onRetry} className={className} />;
  const hide = (c: Column<T>) => (c.hideBelow === "xl" ? "hidden xl:table-cell" : c.hideBelow === "2xl" ? "hidden 2xl:table-cell" : "");
  const sel = selection?.selected ?? new Set<Key>();
  const allKeys = (rows ?? []).map(rowKey);
  const allOn = allKeys.length > 0 && allKeys.every((k) => sel.has(k));
  const toggle = (k: Key, on: boolean) => { const n = new Set(sel); if (on) n.add(k); else n.delete(k); selection?.onChange(n); };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const tr = e.currentTarget;
    if (e.key === "Enter" && onOpen) { e.preventDefault(); onOpen(row); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (tr.nextElementSibling as HTMLElement | null)?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (tr.previousElementSibling as HTMLElement | null)?.focus(); }
  };

  if (rows && rows.length === 0) return <div className={className}>{empty}</div>;

  return (
    <div data-kit="data-list" className={cn("flex flex-col gap-3", className)}>
      {/* Wide: a table. overflow-clip (never auto/hidden) keeps the header sticky to the page's scroll pane. */}
      <div className="hidden overflow-clip rounded-lg border bg-card lg:block">
        <table aria-label={label} className="w-full text-[0.8125rem]">
          <thead>
            <tr className="border-b">
              {selection && (
                <th className="sticky top-0 z-10 w-10 bg-card px-3">
                  <Checkbox aria-label="Select all" checked={allOn} disabled={!rows?.length}
                    onCheckedChange={(v) => selection.onChange(v ? new Set(allKeys) : new Set())} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.id} scope="col" className={cn("sticky top-0 z-10 h-9 bg-card px-3 text-left align-middle text-[0.6875rem] font-medium tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase", hide(c), c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={body}>
            {!rows
              ? Array.from({ length: pageSize }, (_, i) => (
                <tr key={`skeleton-${i}`} className="h-11 border-b last:border-0">
                  {selection && <td className="px-3"><Skeleton className="size-4" /></td>}
                  {columns.map((c, j) => <td key={c.id} className={cn("px-3", hide(c))}><Skeleton className={cn("h-4", j === 0 ? "w-3/4" : "w-16")} /></td>)}
                </tr>
              ))
              : rows.map((row) => {
                const k = rowKey(row);
                const active = activeKey !== undefined && activeKey !== null && String(activeKey) === String(k);
                return (
                  <tr key={k} tabIndex={onOpen ? 0 : -1} data-kit-row={k} aria-current={active || undefined}
                    onClick={(e) => { if (onOpen && !(e.target as HTMLElement).closest("button, a, input, [role=checkbox], [role=menuitem]")) onOpen(row); }}
                    onKeyDown={(e) => onRowKey(e, row)}
                    className={cn("h-11 border-b transition-colors last:border-0 focus-visible:bg-muted/50 focus-visible:outline-none",
                      onOpen && "cursor-pointer hover:bg-muted/50 active:bg-muted", (active || sel.has(k)) && "bg-muted/50")}>
                    {selection && (
                      <td className="w-10 px-3">
                        <Checkbox aria-label="Select row" checked={sel.has(k)} onCheckedChange={(v) => toggle(k, v === true)} />
                      </td>
                    )}
                    {columns.map((c) => <td key={c.id} className={cn("px-3 py-2 align-middle", hide(c), c.className)}>{c.cell(row)}</td>)}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Narrow: one tappable row per record, with its checkbox when the list can select. */}
      <ul aria-label={label} className="divide-y overflow-clip rounded-lg border bg-card lg:hidden">
        {!rows
          ? Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
            <li key={`skeleton-${i}`} className="flex flex-col gap-2 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></li>
          ))
          : rows.map((row) => {
            const k = rowKey(row);
            return (
              <li key={k} className={cn(selection && "flex items-stretch", sel.has(k) && "bg-muted/50")}>
                {selection && (
                  <label className="flex shrink-0 items-center pr-1 pl-3">
                    <Checkbox aria-label="Select row" checked={sel.has(k)} onCheckedChange={(v) => toggle(k, v === true)} />
                  </label>
                )}
                {onOpen
                  ? <button type="button" onClick={() => onOpen(row)} className="flex w-full min-w-0 flex-1 flex-col gap-1 p-3 text-left text-[0.8125rem] transition-colors hover:bg-muted/50 active:bg-muted">{mobileRow(row)}</button>
                  : <div className="flex min-w-0 flex-1 flex-col gap-1 p-3 text-[0.8125rem]">{mobileRow(row)}</div>}
              </li>
            );
          })}
      </ul>

      {/* Sticks to the bottom of the scroll pane, which ends above the phone's tab bar. */}
      {selection && sel.size > 0 && (
        <div role="region" aria-label="Bulk actions" data-kit="bulk-bar"
          className="sticky bottom-3 z-20 mx-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-popover px-3 py-2 text-[0.8125rem] shadow-lg">
          <span className="tabular-nums">{sel.size} selected</span>
          <div className="flex flex-wrap items-center gap-2">{selection.actions([...sel])}</div>
          <Button variant="ghost" size="icon" aria-label="Clear selection" onClick={() => selection.onChange(new Set())}><X /></Button>
        </div>
      )}
      {footer}
    </div>
  );
}

/** Page n of m, with the total, and previous / next. Hidden when everything fits on one page. */
export function Pager({ page, pageTotal, itemsTotal, onPage, noun = "results" }: {
  page: number; pageTotal: number; itemsTotal?: number; onPage: (p: number) => void; noun?: string;
}) {
  if (pageTotal <= 1) return itemsTotal !== undefined ? <p className="text-xs text-muted-foreground tabular-nums">{itemsTotal} {noun}</p> : null;
  return (
    <nav aria-label="Pages" data-kit="pager" className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span className="tabular-nums">{itemsTotal !== undefined ? `${itemsTotal} ${noun} · ` : ""}Page {page} of {pageTotal}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft />Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pageTotal} onClick={() => onPage(page + 1)}>Next<ChevronRight /></Button>
      </div>
    </nav>
  );
}
