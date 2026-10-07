import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FirstRunStep {
  id: string;
  title: string;
  /** Why it's worth doing, in one line. */
  description?: string;
  /** Where the step happens, or what it does. */
  href?: string;
  onClick?: () => void;
  /** Done is read from real data (a key exists, a record moved), not from a click. */
  done: boolean;
}

/**
 * The first-run checklist on the overview: the three to five things that show what the app can do, in
 * order, each one click from where it happens (CRAFT.md §18). Dismissing it is remembered per person.
 */
export function FirstRun({ storageKey, title = "Get to know the app", steps, className }: {
  /** Unique per person: `first-run:${me.id}`. */
  storageKey: string; title?: string; steps: FirstRunStep[]; className?: string;
}) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(storageKey) === "dismissed"; } catch { return false; } });
  const done = steps.filter((s) => s.done).length;
  // Open in full on the first visit only; after that (or once a step is done) it's one line with the next
  // step, expandable, so it never owns the screen.
  const [expanded, setExpanded] = useState(() => {
    if (done > 0) return false;
    try { return localStorage.getItem(`${storageKey}:seen`) !== "1"; } catch { return true; }
  });
  // Mark it seen after it shows, not while working out the first state (StrictMode runs that twice).
  useEffect(() => { if (!hidden && steps.length) { try { localStorage.setItem(`${storageKey}:seen`, "1"); } catch { /* storage off */ } } }, [storageKey, hidden, steps.length]);
  if (hidden || !steps.length) return null;
  const dismiss = () => { try { localStorage.setItem(storageKey, "dismissed"); } catch { /* storage off */ } setHidden(true); };
  const next = steps.find((s) => !s.done);
  return (
    <section data-kit="first-run" aria-label={title} className={cn("rounded-lg border bg-card", className)}>
      <header className={cn("flex items-center gap-3 p-4", expanded && "border-b")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="text-sm font-medium">{done === steps.length ? "You've seen the best of it" : title}</h2>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <div aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <span className="shrink-0 tabular-nums">{done} of {steps.length} done</span>
            {!expanded && next && (
              <span className="min-w-0 truncate">· Next:{" "}
                {next.href ? <Link to={next.href} className="font-medium text-foreground underline-offset-4 hover:underline">{next.title}</Link>
                  : <button type="button" onClick={next.onClick} className="font-medium text-foreground underline-offset-4 hover:underline">{next.title}</button>}
              </span>
            )}
          </div>
        </div>
        {done > 0 && done < steps.length && (
          <Button variant="ghost" size="icon" aria-label={expanded ? "Show only the next step" : "Show every step"} aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Hide this checklist" onClick={dismiss}><X /></Button>
      </header>
      <ol className={cn("divide-y", !expanded && "hidden")}>
        {steps.map((s, i) => {
          if (!expanded) return null;
          const inner = (
            <>
              <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
                s.done ? "border-primary bg-primary text-primary-foreground" : s === next ? "border-primary text-primary-text" : "text-muted-foreground")}>
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[0.8125rem] font-medium", s.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{s.title}</span>
                {s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}
              </span>
              {!s.done && <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              <span className="sr-only">{s.done ? "(done)" : ""}</span>
            </>
          );
          const cls = "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
          return (
            <li key={s.id} data-first-run-step={s.id} data-done={s.done || undefined}>
              {s.href ? <Link to={s.href} className={cls}>{inner}</Link>
                : <button type="button" onClick={s.onClick} className={cls}>{inner}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
