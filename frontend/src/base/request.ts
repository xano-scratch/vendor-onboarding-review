// The one request helper (CRAFT.md §4): the base URL the deploy injects, the Bearer token, JSON, plain-words
// errors, and 401 → sign out. The domain's lib/api.ts builds on it; paths come from xano/routes.gen.ts.

declare global {
  interface Window {
    XANO_HOST?: string;
  }
}

export const XANO_HOST: string = (typeof window !== "undefined" && window.XANO_HOST) || import.meta.env.VITE_XANO_HOST || "";

const KEY = "app.token";
/** The person's session token. localStorage, inside try/catch (a sandboxed frame throws). */
export const token = {
  get: (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* sandboxed */ } },
};

/** An error with the HTTP status, so a screen can tell a 404 from a 500 (and modules a 429). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export class Unauthorized extends ApiError {
  constructor(message = "Your session ended. Sign in again.") { super(message, 401); }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

/** A query string from the set values only: qs({ q: "", page: "2" }) → "?page=2". */
export const qs = (q: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export async function request<T>(verb: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  const t = token.get();
  if (t) headers.authorization = `Bearer ${t}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(XANO_HOST + path, { method: verb, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("We can't reach the server. Check your connection, then try again.", 0);
  }
  if (res.status >= 500) throw new ApiError("The server had a problem with that request. Try again in a moment.", res.status);
  if (res.status === 401) {
    if (t) { token.set(null); onUnauthorized(); }
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Unauthorized(t ? undefined : j?.message || "Sign in to continue.");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(j?.message || `That didn't work (${res.status}).`, res.status);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
