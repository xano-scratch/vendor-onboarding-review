// Live updates (BASELINE.md "Live"): one websocket per signed-in tab, to the backend's `live` server.
//   - `useLive("job", reload)`: a screen reloads when someone else (a person, their agent, the assistant) changes
//     a job. The server sends ids only; each screen refetches what its person may see.
//   - `useNotificationPush(fn)`: the bell rings the moment a notification is written.
//   - `useOnline()` / `useRoom("job-12")`: who's here, and who's looking at this record.
// The socket is an enhancement: every screen loads over HTTP first, and while the socket is down `useLive`
// polls every 30 s instead, so nothing breaks when it can't connect.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { socketUrl } from "../../../xano/routes.gen.js";
import { XANO_HOST, token } from "./request";

export type LiveChange = { entity: string; id: number | null; op: string; actor_id: number | null };
export type LiveState = "connecting" | "live" | "offline";
type Member = { id: string };
type Ctx = {
  state: LiveState;
  me: number;
  online: number[];
  rooms: Record<string, number[]>;
  onChange: (fn: (c: LiveChange) => void) => () => void;
  onNotification: (fn: (n: { id: number; kind: string; title: string; link: string }) => void) => () => void;
  join: (room: string) => () => void;
};
const LiveContext = createContext<Ctx | null>(null);

const roomName = (r: string) => r.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);

export function LiveProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const [state, setState] = useState<LiveState>("connecting");
  const [online, setOnline] = useState<number[]>([]);
  const [rooms, setRooms] = useState<Record<string, number[]>>({});
  const changeFns = useRef(new Set<(c: LiveChange) => void>());
  const notifyFns = useRef(new Set<(n: { id: number; kind: string; title: string; link: string }) => void>());
  const wanted = useRef(new Map<string, number>());   // room → how many screens want it
  const sock = useRef<WebSocket | null>(null);

  const send = useCallback((f: object) => { const s = sock.current; if (s?.readyState === 1) s.send(JSON.stringify(f)); }, []);

  useEffect(() => {
    let url = "";
    try { url = XANO_HOST ? socketUrl("live", XANO_HOST) : ""; } catch { url = ""; }
    if (!url) { setState("offline"); return; }
    let stopped = false, attempt = 0, ping: ReturnType<typeof setInterval> | undefined, retry: ReturnType<typeof setTimeout> | undefined;
    const presence = (set: (fn: (ids: number[]) => number[]) => void, f: { action: string; payload?: { members?: Member[]; member?: Member } }) => {
      const id = (m?: Member) => Number(m?.id ?? 0);
      if (f.action === "presence_full") set(() => [...new Set((f.payload?.members ?? []).map(id).filter(Boolean))]);
      else if (f.action === "presence_join") set((ids) => [...new Set([...ids, id(f.payload?.member)].filter(Boolean))]);
      else if (f.action === "presence_leave") set((ids) => ids.filter((x) => x !== id(f.payload?.member)));
    };
    const open = () => {
      const t = token.get();
      if (!t || stopped) return;
      setState("connecting");
      const s = new WebSocket(url, t);
      sock.current = s;
      s.onopen = () => {
        // The server's context is ready a moment after open: an immediate first frame is refused.
        setTimeout(() => {
          if (s.readyState !== 1) return;
          s.send(JSON.stringify({ action: "join", channel: "app" }));
          s.send(JSON.stringify({ action: "join", channel: `users/${userId}` }));
          for (const r of wanted.current.keys()) s.send(JSON.stringify({ action: "join", channel: `rooms/${r}` }));
        }, 250);
        // A listen-only socket is dropped after ~10 minutes idle.
        ping = setInterval(() => s.readyState === 1 && s.send(JSON.stringify({ action: "ping" })), 30_000);
      };
      s.onmessage = (e) => {
        let f: { action: string; channel?: string; type?: string; payload?: Record<string, unknown> & { members?: Member[]; member?: Member } };
        try { f = JSON.parse(String(e.data)); } catch { return; }
        if (f.action === "join" && f.channel === "app") {
          setState("live");
          // Back after a gap: anything sent meanwhile was missed, so every screen refreshes once.
          if (attempt > 0) for (const fn of changeFns.current) fn({ entity: "*", id: null, op: "reconnected", actor_id: null });
          attempt = 0;
        }
        if (f.action === "message" && f.channel === "app" && f.type === "changed") {
          const p = f.payload ?? {};
          const c: LiveChange = { entity: String(p.entity ?? ""), id: p.id == null ? null : Number(p.id), op: String(p.op ?? ""), actor_id: p.actor_id == null ? null : Number(p.actor_id) };
          for (const fn of changeFns.current) fn(c);
        }
        if (f.action === "message" && f.channel === `users/${userId}` && f.type === "notification") {
          const p = f.payload ?? {};
          for (const fn of notifyFns.current) fn({ id: Number(p.id), kind: String(p.kind ?? ""), title: String(p.title ?? ""), link: String(p.link ?? "") });
        }
        if (f.channel === "app") presence(setOnline, f);
        if (f.channel?.startsWith("rooms/")) {
          const r = f.channel.slice(6);
          presence((fn) => setRooms((all) => ({ ...all, [r]: fn(all[r] ?? []) })), f);
        }
      };
      s.onclose = (e) => {
        clearInterval(ping);
        sock.current = null;
        if (stopped) return;
        setState("offline");
        if (e.code === 4401) return;   // refused at the door (signed out): don't hammer it
        attempt += 1;
        retry = setTimeout(open, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)));
      };
    };
    open();
    return () => { stopped = true; clearInterval(ping); clearTimeout(retry); sock.current?.close(); sock.current = null; };
  }, [userId]);

  // A hook for QA and the header's dot: <html data-live="live|connecting|offline">.
  useEffect(() => { document.documentElement.dataset.live = state; }, [state]);

  // Stable callbacks: a screen's effect depends on them, so they must not change when presence does.
  const onChange = useCallback((fn: (c: LiveChange) => void) => { changeFns.current.add(fn); return () => { changeFns.current.delete(fn); }; }, []);
  const onNotification = useCallback((fn: (n: { id: number; kind: string; title: string; link: string }) => void) => {
    notifyFns.current.add(fn); return () => { notifyFns.current.delete(fn); };
  }, []);
  const join = useCallback((raw: string) => {
    const r = roomName(raw);
    const n = wanted.current.get(r) ?? 0;
    wanted.current.set(r, n + 1);
    if (n === 0) send({ action: "join", channel: `rooms/${r}` });
    return () => {
      const left = (wanted.current.get(r) ?? 1) - 1;
      if (left > 0) { wanted.current.set(r, left); return; }
      wanted.current.delete(r);
      send({ action: "leave", channel: `rooms/${r}` });
      setRooms((all) => { const { [r]: _gone, ...rest } = all; void _gone; return rest; });
    };
  }, [send]);
  const value = useMemo<Ctx>(() => ({ state, me: userId, online, rooms, onChange, onNotification, join }), [state, userId, online, rooms, onChange, onNotification, join]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

const useCtx = () => useContext(LiveContext);

/** "live" | "connecting" | "offline" ("offline" outside the signed-in shell). */
export const useLiveState = (): LiveState => useCtx()?.state ?? "offline";

/**
 * Reload when one of these entities changes on the server (by anyone, including you in another tab); "*" is any.
 * `reload` should keep the old data on screen while it loads, as the kit's `useLoad` does. Debounced, so a
 * burst of changes is one reload. While the socket is down it polls instead (every `pollMs`).
 */
export function useLive(entities: string | string[], reload: () => void, { pollMs = 30_000 }: { pollMs?: number } = {}) {
  const ctx = useCtx();
  const ref = useRef(reload);
  ref.current = reload;
  const key = Array.isArray(entities) ? entities.join(",") : entities;
  useEffect(() => {
    if (!ctx) return;
    const want = new Set(key.split(","));
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = ctx.onChange((c) => {
      if (c.entity !== "*" && !want.has("*") && !want.has(c.entity)) return;
      clearTimeout(t);
      t = setTimeout(() => ref.current(), 150);
    });
    return () => { off(); clearTimeout(t); };
  }, [ctx?.onChange, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const offline = ctx?.state === "offline";
  useEffect(() => {
    if (!offline || !pollMs) return;
    const i = setInterval(() => document.visibilityState === "visible" && ref.current(), pollMs);
    return () => clearInterval(i);
  }, [offline, pollMs]);
}

/** Run `fn` when a notification for the signed-in person arrives. */
export function useNotificationPush(fn: (n: { id: number; kind: string; title: string; link: string }) => void) {
  const ctx = useCtx();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => ctx?.onNotification((n) => ref.current(n)), [ctx?.onNotification]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The ids of everyone signed in with the app open right now (you included once your socket joins). */
export const useOnline = (): number[] => useCtx()?.online ?? [];

/** Who else is looking at this record or board right now (ids, not you). Pass null to join nothing. */
export function useRoom(room: string | null): number[] {
  const ctx = useCtx();
  useEffect(() => (room && ctx ? ctx.join(room) : undefined), [room, ctx?.join]); // eslint-disable-line react-hooks/exhaustive-deps
  const ids = room && ctx ? ctx.rooms[roomName(room)] ?? [] : [];
  return ids.filter((id) => id !== ctx?.me);
}
