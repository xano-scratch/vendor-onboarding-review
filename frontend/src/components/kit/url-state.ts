import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";

const MEMO = "kit.q:";

/**
 * Query-string state: the URL is the source of truth, so back, refresh and a shared link all restore the
 * view. Values are strings; a value equal to its default (or empty) is dropped from the URL. Changing any
 * key other than `page` resets `page`.
 *
 *   const [q, setQ] = useUrlState({ status: "all", search: "", page: "1" });
 *   setQ({ status: "open" });
 */
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const defaultsRef = useRef(defaults);
  const values = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const k of Object.keys(defaultsRef.current) as K[]) out[k] = params.get(k) ?? defaultsRef.current[k];
    return out;
  }, [params]);
  const set = useCallback((patch: Partial<Record<K, string>>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
        if (v === undefined || v === "" || v === defaultsRef.current[k]) next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);

  // Remember this list's filters for the session, so its nav link brings them back (CRAFT.md §15.10).
  useEffect(() => {
    const keep = new URLSearchParams(params);
    keep.delete("open");
    try { sessionStorage.setItem(MEMO + pathname, keep.toString()); } catch { /* storage off */ }
  }, [params, pathname]);

  return [values, set] as const;
}

/** A nav link that brings back the filters the list had last time this session. */
export function rememberedHref(path: string): string {
  try {
    const q = sessionStorage.getItem(MEMO + path);
    return q ? `${path}?${q}` : path;
  } catch {
    return path;
  }
}

/** The record open in a side sheet, as `?open=<id>` (Escape and Back close it). */
export function useOpenParam(name = "open") {
  const [params, setParams] = useSearchParams();
  const id = params.get(name);
  const open = useCallback((value: string | number) => {
    setParams((prev) => { const n = new URLSearchParams(prev); n.set(name, String(value)); return n; });
  }, [name, setParams]);
  const close = useCallback(() => {
    setParams((prev) => { const n = new URLSearchParams(prev); n.delete(name); return n; }, { replace: true });
  }, [name, setParams]);
  return [id, open, close] as const;
}
