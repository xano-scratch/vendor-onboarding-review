import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { toast } from "sonner";

/**
 * Load something for a screen: `data` (null while the first load runs), `error`, `reload()`, and
 * `setData` for optimistic edits. A newer load always wins over an older one; a reload keeps the old
 * data on screen until the new data arrives.
 *
 *   const notes = useLoad(() => api.notes(q), [q.status, q.search]);
 */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (d) => { if (mine === seq.current) { setData(d); setLoading(false); } },
      (e: unknown) => { if (mine === seq.current) { setError(e); setLoading(false); } },
    );
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps);
  return { data, setData, error, loading, reload };
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "That didn't work. Try again.");

/**
 * An optimistic write (CRAFT.md §15.6): `apply()` changes the screen at once and returns how to put it
 * back; `run()` does the write. On failure the change is rolled back and the reason toasted. On success,
 * `success` is toasted, with Undo when `undo` is given (Undo rolls the screen back, then runs `undo`).
 *
 * The rollback must undo only its own change: put back the one record it touched, with a functional
 * update. Never restore a copy of the whole list taken in `apply()`: it would wipe out other writes and
 * reloads that landed in the meantime.
 *
 *   await optimistic({
 *     apply: () => {
 *       setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, stage: to } : r)) ?? rs);
 *       return () => setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, stage: from } : r)) ?? rs);
 *     },
 *     run: () => api.move(id, to), success: `Moved to ${label}`, undo: () => api.move(id, from),
 *   });
 */
export async function optimistic<R>(o: {
  apply: () => () => void;
  run: () => Promise<R>;
  success?: string;
  undo?: () => Promise<unknown>;
  onSettled?: () => void;
}): Promise<R | undefined> {
  const rollback = o.apply();
  try {
    const result = await o.run();
    if (o.success) {
      toast.success(o.success, o.undo ? {
        action: {
          label: "Undo",
          onClick: () => {
            rollback();
            o.undo!().then(() => o.onSettled?.(), (e) => { toast.error(messageOf(e)); o.onSettled?.(); });
          },
        },
      } : undefined);
    }
    o.onSettled?.();
    return result;
  } catch (e) {
    rollback();
    toast.error(messageOf(e));
    o.onSettled?.();
    return undefined;
  }
}
