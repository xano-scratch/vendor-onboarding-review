// The one contract (CRAFT.md §4): paths from xano/routes.gen.ts, types from the query defs (type-only, never
// a value). The base app's own endpoints are in src/base/api.ts.
import type { InferResponse } from "@xano/sdk";
import type { overview, queue, mine, caseDetail, vendorList, rulesList } from "../../../xano/query/onboarding/reads.js";
import type { submit, rescore, activateRules, updateSettings } from "../../../xano/query/onboarding/writes.js";
import { routePath } from "../../../xano/routes.gen.js";

export { ApiError, XANO_HOST, qs, request, token } from "@/base/request";
export { baseApi } from "@/base/api";
import { qs, request } from "@/base/request";

export type Tier = "low" | "medium" | "high";
export type Status = "submitted" | "in_review" | "blocked" | "approved" | "rejected";
export type Category = "software" | "hardware" | "services" | "data_processor";
export type SpendBand = "low" | "mid" | "high";
export type DataLevel = "none" | "internal" | "pii";

export type Overview = InferResponse<typeof overview>;
export type QueuePage = InferResponse<typeof queue>;
export type CaseItem = QueuePage["items"][number];
export type CaseDetailData = InferResponse<typeof caseDetail>;
export type CaseStep = CaseDetailData["approvals"][number];
export type CaseEvent = CaseDetailData["events"][number];
export type VendorPage = InferResponse<typeof vendorList>;
export type VendorItem = VendorPage["items"][number];
export type Rules = InferResponse<typeof rulesList>;
export type Rule = Rules["rules"][number];
export type Submitted = InferResponse<typeof submit>;

export type QueueQuery = Partial<{ status: string; risk_tier: string; page: string; per_page: string }>;
export type MineQuery = Partial<{ status: string; page: string; per_page: string }>;
export type VendorQuery = Partial<{ category: string; data_access_level: string; page: string; per_page: string }>;
export type SubmitBody = Partial<{ vendor_id: number; name: string; category: Category; country: string; annual_spend_band: SpendBand; data_access_level: DataLevel }>;

export const api = {
  overview: () => request<Overview>("GET", routePath("GET overview")),
  queue: (q: QueueQuery = {}) => request<QueuePage>("GET", routePath("GET queue") + qs(q)),
  mine: (q: MineQuery = {}) => request<QueuePage>("GET", routePath("GET submissions/mine") + qs(q)),
  caseDetail: (id: number | string) => request<CaseDetailData>("GET", routePath("GET submissions/{id}", { id: Number(id) })),
  vendors: (q: VendorQuery = {}) => request<VendorPage>("GET", routePath("GET vendors") + qs(q)),
  rules: () => request<Rules>("GET", routePath("GET rules")),
  submit: (body: SubmitBody) => request<Submitted>("POST", routePath("POST submissions"), body),
  approve: (id: number, approvalId: number) => request<{ ok: boolean; status: string }>("POST", routePath("POST submissions/{id}/approvals/{approval_id}/approve", { id, approval_id: approvalId })),
  reject: (id: number, approvalId: number, reason: string) => request<{ ok: boolean; status: string }>("POST", routePath("POST submissions/{id}/approvals/{approval_id}/reject", { id, approval_id: approvalId }), { reason }),
  complete: (id: number) => request<{ ok: boolean; status: string }>("POST", routePath("POST submissions/{id}/complete", { id })),
  rescore: (id: number) => request<InferResponse<typeof rescore>>("POST", routePath("POST submissions/{id}/rescore", { id })),
  activateRules: () => request<InferResponse<typeof activateRules>>("POST", routePath("POST rules/activate")),
  updateSettings: (days: number) => request<InferResponse<typeof updateSettings>>("PATCH", routePath("PATCH settings"), { review_sla_days: days }),
};
