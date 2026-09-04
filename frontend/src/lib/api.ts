// The one contract. Request/response TYPES are derived from the xanots query defs
// (InferInput / InferResponse), imported type-only so nothing from the backend —
// its stack, its seed data — is pulled into the browser bundle. The runtime paths
// live in ROUTES below and are verified against the compiled backend with
// `npx xanots routes xano/index.ts`, so a rename shows up as a drift there.

import type { InferInput, InferResponse } from "@xanots/sdk";
import type { loginQuery } from "../../../xano/api/login.js";
import type { submitQuery } from "../../../xano/api/submit.js";
import type { queueQuery } from "../../../xano/api/queue.js";
import type { submissionQuery } from "../../../xano/api/submission.js";
import type { approveQuery } from "../../../xano/api/approve.js";
import type { rejectQuery } from "../../../xano/api/reject.js";
import type { completeQuery } from "../../../xano/api/complete.js";
import type { rescoreQuery } from "../../../xano/api/rescore.js";

// ── Types derived from the backend defs ─────────────────────────────────────
export type LoginBody = InferInput<typeof loginQuery>;
export type LoginResponse = InferResponse<typeof loginQuery>;
export type SubmitBody = InferInput<typeof submitQuery>;
export type SubmitResponse = InferResponse<typeof submitQuery>;
export type QueueResponse = InferResponse<typeof queueQuery>;
export type SubmissionResponse = InferResponse<typeof submissionQuery>;
export type ApproveResponse = InferResponse<typeof approveQuery>;
export type RejectResponse = InferResponse<typeof rejectQuery>;
export type CompleteResponse = InferResponse<typeof completeQuery>;
export type RescoreResponse = InferResponse<typeof rescoreQuery>;

// The login user is built with obj() over a maybe-null db.get row, so InferResponse
// types every field as `T | null`. The endpoint's preconditions guarantee it is
// non-null, so we normalize once here into a clean session type.
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
export type CurrentUser = SessionUser;
export function toSessionUser(u: LoginResponse["user"]): SessionUser {
  return {
    id: Number(u?.id),
    name: String(u?.name ?? ""),
    email: String(u?.email ?? ""),
    role: (u?.role ?? "requester") as Role,
  };
}

export type Submission = QueueResponse["submissions"][number];
export type Vendor = QueueResponse["vendors"][number];
export type PendingApproval = QueueResponse["pending_approvals"][number];
export type Approval = SubmissionResponse["required_approvals"][number];
export type AuditEvent = SubmissionResponse["audit_trail"][number];
export type Actor = SubmissionResponse["actors"][number];

export type Role = "requester" | "approver" | "admin";
export type RiskTier = "low" | "medium" | "high";

// ── The deployed backend host ───────────────────────────────────────────────
// Injected as window.XANO_HOST by `xanots deploy --static`, or VITE_XANO_HOST in
// dev. Read the bracket form so a static deploy's injected global is found.
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ── Route metadata (verified: npx xanots routes xano/index.ts) ────────────────
const GROUP = "/api:onboarding";
const ROUTES = {
  login: `${GROUP}/auth/login`,
  submit: `${GROUP}/submissions`,
  queue: `${GROUP}/queue`,
  seed: `${GROUP}/seed`,
  detail: (id: number) => `${GROUP}/submissions/${id}`,
  approve: (sid: number, aid: number) => `${GROUP}/submissions/${sid}/approvals/${aid}/approve`,
  reject: (sid: number, aid: number) => `${GROUP}/submissions/${sid}/approvals/${aid}/reject`,
  complete: (id: number) => `${GROUP}/submissions/${id}/complete`,
  rescore: (id: number) => `${GROUP}/submissions/${id}/rescore`,
} as const;

// ── Auth token (kept in localStorage so a reload stays signed in) ────────────
const TOKEN_KEY = "vor_token";
let authToken: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string | null): void {
  authToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function call<T>(
  path: string,
  verb: "GET" | "POST",
  body?: unknown,
  queryParams?: Record<string, string | undefined>,
): Promise<T> {
  let url = XANO_HOST + path;
  if (queryParams) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) qs.set(key, value);
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (authToken) headers["authorization"] = `Bearer ${authToken}`;

  const res = await fetch(url, {
    method: verb,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text || `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* keep the raw text */
    }
    throw new ApiError(res.status, message);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// ── The typed API surface ───────────────────────────────────────────────────
export function login(body: LoginBody): Promise<LoginResponse> {
  return call<LoginResponse>(ROUTES.login, "POST", body);
}
export function submitVendor(body: SubmitBody): Promise<SubmitResponse> {
  return call<SubmitResponse>(ROUTES.submit, "POST", body);
}
export function getQueue(filters: { status?: string; risk_tier?: string }): Promise<QueueResponse> {
  return call<QueueResponse>(ROUTES.queue, "GET", undefined, filters);
}
export function getSubmission(id: number): Promise<SubmissionResponse> {
  return call<SubmissionResponse>(ROUTES.detail(id), "GET");
}
export function approveStep(submissionId: number, approvalId: number): Promise<ApproveResponse> {
  return call<ApproveResponse>(ROUTES.approve(submissionId, approvalId), "POST", {});
}
export function rejectStep(submissionId: number, approvalId: number, reason: string): Promise<RejectResponse> {
  return call<RejectResponse>(ROUTES.reject(submissionId, approvalId), "POST", { reason });
}
export function completeSubmission(id: number): Promise<CompleteResponse> {
  return call<CompleteResponse>(ROUTES.complete(id), "POST", {});
}
export function rescoreSubmission(id: number): Promise<RescoreResponse> {
  return call<RescoreResponse>(ROUTES.rescore(id), "POST", {});
}
export function resetDemo(): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(ROUTES.seed, "POST", {});
}

// ── Demo accounts (all share one documented password) ───────────────────────
export const DEMO_PASSWORD = "Passw0rd!23";
export const DEMO_ACCOUNTS: { role: Role; name: string; email: string; blurb: string }[] = [
  { role: "requester", name: "Riley Chen", email: "riley@northwind-holdings.test", blurb: "Submits vendors for review" },
  { role: "approver", name: "Avery Stone", email: "avery@northwind-holdings.test", blurb: "Signs off approver steps" },
  { role: "admin", name: "Morgan Lee", email: "morgan@northwind-holdings.test", blurb: "Signs admin steps, completes cases" },
];
