// Deterministic seed data for the whole onboarding domain, generated once so the five tables cross-reference
// each other by stable ids (submissions → vendors, required_approvals → submissions, approval_events →
// required_approvals). Dates are relative to the deploy, so the board and the overview always have this
// week's work (CRAFT.md §2). The scoreOf() here mirrors the live score_vendor function, so a seeded case's
// tier is exactly what the rule set would compute.

export type Category = "software" | "hardware" | "services" | "data_processor";
export type SpendBand = "low" | "mid" | "high";
export type DataLevel = "none" | "internal" | "pii";
export type SubStatus = "submitted" | "in_review" | "blocked" | "approved" | "rejected";
export type Tier = "low" | "medium" | "high";
export type ReqRole = "approver" | "admin";
export type ReqStatus = "pending" | "approved" | "rejected";
export type RuleAttribute = "category" | "country" | "annual_spend_band" | "data_access_level";
export type EvAction = "submit" | "score" | "rescore" | "approve" | "reject" | "complete" | "block";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const now = Date.now();
const ago = (days: number) => now - days * DAY;

/** The active rule version every seeded case was scored under. */
export const ACTIVE_VERSION = 3;
/** The illustrative tier thresholds, in one place (the README documents them). */
export const THRESHOLDS = { medium: 20, high: 60 } as const;

// ----- vendors -------------------------------------------------------------------------------------------
export type VendorRow = { id: number; name: string; category: Category; country: string; annual_spend_band: SpendBand; data_access_level: DataLevel; submitted_by: number };
const VENDOR_DATA: Omit<VendorRow, "id">[] = [
  { name: "Dataflow Analytics", category: "data_processor", country: "United States", annual_spend_band: "high", data_access_level: "pii", submitted_by: 3 },
  { name: "Meridian Software", category: "software", country: "United States", annual_spend_band: "mid", data_access_level: "internal", submitted_by: 3 },
  { name: "Granite Peak Logistics", category: "services", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
  { name: "Northwind Traders", category: "services", country: "Germany", annual_spend_band: "mid", data_access_level: "internal", submitted_by: 3 },
  { name: "Contoso Cloud", category: "software", country: "Ireland", annual_spend_band: "high", data_access_level: "internal", submitted_by: 2 },
  { name: "Clearwater Data Services", category: "data_processor", country: "China", annual_spend_band: "high", data_access_level: "pii", submitted_by: 3 },
  { name: "Brightline Systems", category: "software", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
  { name: "Ironclad Hardware", category: "hardware", country: "United States", annual_spend_band: "mid", data_access_level: "none", submitted_by: 1 },
  { name: "Harbor Point Services", category: "services", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
  { name: "Steelbridge Components", category: "hardware", country: "Germany", annual_spend_band: "high", data_access_level: "internal", submitted_by: 3 },
  { name: "Vaultpoint Storage", category: "data_processor", country: "United States", annual_spend_band: "mid", data_access_level: "pii", submitted_by: 3 },
  { name: "Northwave AI", category: "software", country: "China", annual_spend_band: "high", data_access_level: "pii", submitted_by: 2 },
  { name: "Lakeside Analytics", category: "data_processor", country: "India", annual_spend_band: "mid", data_access_level: "internal", submitted_by: 3 },
  { name: "Verano Software", category: "software", country: "United States", annual_spend_band: "low", data_access_level: "internal", submitted_by: 3 },
  { name: "Crossdock Trading", category: "services", country: "United States", annual_spend_band: "mid", data_access_level: "none", submitted_by: 3 },
  { name: "Clarion Advisory", category: "services", country: "United Kingdom", annual_spend_band: "high", data_access_level: "internal", submitted_by: 3 },
  { name: "Transit Partners", category: "services", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
  { name: "Vertex Devices", category: "hardware", country: "United States", annual_spend_band: "high", data_access_level: "none", submitted_by: 3 },
  { name: "Meadowlark Data", category: "data_processor", country: "Ireland", annual_spend_band: "high", data_access_level: "pii", submitted_by: 3 },
  { name: "Keystone Services", category: "services", country: "Japan", annual_spend_band: "mid", data_access_level: "internal", submitted_by: 3 },
  { name: "Summit Field Services", category: "services", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
  { name: "Beacon Data Partners", category: "data_processor", country: "United States", annual_spend_band: "high", data_access_level: "internal", submitted_by: 2 },
  { name: "Sterling Software", category: "software", country: "Canada", annual_spend_band: "mid", data_access_level: "none", submitted_by: 3 },
  { name: "Cedarline Supply", category: "hardware", country: "United States", annual_spend_band: "low", data_access_level: "none", submitted_by: 3 },
];
export const VENDORS: VendorRow[] = VENDOR_DATA.map((v, i) => ({ id: i + 1, ...v }));

// ----- risk_rules ----------------------------------------------------------------------------------------
export type RuleRow = { id: number; version: number; attribute: RuleAttribute; match_value: string; points: number; active: boolean };
const RULE_DATA: Omit<RuleRow, "id">[] = [
  // The active set (version 3): one governed scoring table a reviewer can read top to bottom.
  { version: 3, attribute: "data_access_level", match_value: "pii", points: 40, active: true },
  { version: 3, attribute: "data_access_level", match_value: "internal", points: 15, active: true },
  { version: 3, attribute: "data_access_level", match_value: "none", points: 0, active: true },
  { version: 3, attribute: "category", match_value: "data_processor", points: 25, active: true },
  { version: 3, attribute: "category", match_value: "software", points: 10, active: true },
  { version: 3, attribute: "category", match_value: "services", points: 5, active: true },
  { version: 3, attribute: "category", match_value: "hardware", points: 5, active: true },
  { version: 3, attribute: "annual_spend_band", match_value: "high", points: 20, active: true },
  { version: 3, attribute: "annual_spend_band", match_value: "mid", points: 10, active: true },
  { version: 3, attribute: "country", match_value: "China", points: 15, active: true },
  { version: 3, attribute: "country", match_value: "India", points: 10, active: true },
  // The prior version (2), kept inactive so the version that decided each past case is still on the record.
  { version: 2, attribute: "data_access_level", match_value: "pii", points: 30, active: false },
  { version: 2, attribute: "category", match_value: "data_processor", points: 20, active: false },
  { version: 2, attribute: "annual_spend_band", match_value: "high", points: 15, active: false },
];
export const RULES: RuleRow[] = RULE_DATA.map((r, i) => ({ id: i + 1, ...r }));

const ACTIVE_RULES = RULE_DATA.filter((r) => r.active);
export function scoreOf(v: Pick<VendorRow, "category" | "country" | "annual_spend_band" | "data_access_level">): { score: number; tier: Tier } {
  let score = 0;
  for (const r of ACTIVE_RULES) {
    const val = r.attribute === "category" ? v.category : r.attribute === "country" ? v.country : r.attribute === "annual_spend_band" ? v.annual_spend_band : v.data_access_level;
    if (val === r.match_value) score += r.points;
  }
  const tier: Tier = score >= THRESHOLDS.high ? "high" : score >= THRESHOLDS.medium ? "medium" : "low";
  return { score, tier };
}

// ----- submissions ---------------------------------------------------------------------------------------
export type SubmissionRow = { id: number; vendor_id: number; status: SubStatus; risk_score: number; risk_tier: Tier; rule_version: number; submitted_by: number; created_at: number };
// [vendor id, status, submitted_by, days ago]. Case 5 = the high-risk demo case (in_review, one step left);
// case 8 = a completed medium case; case 3 = a blocked case. These three are referenced by SEED_ACTIVITY.
const SUB_SPECS: [number, SubStatus, number, number][] = [
  [7, "submitted", 3, 1],
  [4, "submitted", 3, 2],
  [3, "blocked", 3, 3],
  [5, "in_review", 2, 4],
  [1, "in_review", 3, 4],
  [6, "submitted", 3, 2],
  [8, "in_review", 1, 5],
  [2, "approved", 3, 4],
  [11, "in_review", 3, 7],
  [13, "blocked", 3, 8],
  [14, "submitted", 3, 1],
  [12, "rejected", 2, 14],
  [16, "in_review", 3, 3],
  [19, "approved", 3, 10],
  [15, "approved", 3, 6],
  [10, "in_review", 3, 2],
  [18, "submitted", 3, 1],
  [22, "in_review", 2, 2],
  [20, "rejected", 3, 13],
  [23, "approved", 3, 2],
];
export const SUBMISSIONS: SubmissionRow[] = SUB_SPECS.map(([vid, status, by, days], i) => {
  const { score, tier } = scoreOf(VENDORS[vid - 1]);
  return { id: i + 1, vendor_id: vid, status, risk_score: score, risk_tier: tier, rule_version: ACTIVE_VERSION, submitted_by: by, created_at: ago(days) };
});

// ----- required_approvals + approval_events (derived from the tier and the case status) ------------------
export type ApprovalRow = { id: number; submission_id: number; role_required: ReqRole; sequence: number; status: ReqStatus; decided_by: number; reason: string };
export type EventRow = { id: number; submission_id: number; approval_id: number; actor_id: number; action: EvAction; from_status: string; to_status: string; note: string; created_at: number };

const stepsForTier = (tier: Tier): ReqRole[] => (tier === "high" ? ["approver", "approver", "admin"] : tier === "medium" ? ["approver", "approver"] : ["approver"]);

const APPROVALS: ApprovalRow[] = [];
const EVENTS: EventRow[] = [];
let apId = 0;
let evId = 0;
for (const sub of SUBMISSIONS) {
  const roles = stepsForTier(sub.risk_tier);
  EVENTS.push({ id: ++evId, submission_id: sub.id, approval_id: 0, actor_id: sub.submitted_by, action: "submit", from_status: "", to_status: "submitted", note: "", created_at: sub.created_at });
  roles.forEach((role, idx) => {
    const sequence = idx + 1;
    let status: ReqStatus = "pending";
    let decided_by = 0;
    let reason = "";
    if (sub.status === "approved") { status = "approved"; decided_by = role === "admin" ? 1 : 2; }
    else if (sub.status === "in_review") { if (sequence === 1) { status = "approved"; decided_by = 2; } }
    else if (sub.status === "blocked") {
      if (roles.length === 1) { if (sequence === 1) { status = "rejected"; decided_by = 2; reason = "No signed data processing agreement on file; returned to the requester."; } }
      else { if (sequence === 1) { status = "approved"; decided_by = 2; } else if (sequence === 2) { status = "rejected"; decided_by = 2; reason = "Security questionnaire incomplete; two controls unanswered."; } }
    } else if (sub.status === "rejected") { if (sequence === 1) { status = "rejected"; decided_by = 2; reason = "Vendor withdrew before the review finished."; } }
    const stepId = ++apId;
    APPROVALS.push({ id: stepId, submission_id: sub.id, role_required: role, sequence, status, decided_by, reason });
    const at = sub.created_at + sequence * HOUR;
    if (status === "approved") {
      EVENTS.push({ id: ++evId, submission_id: sub.id, approval_id: stepId, actor_id: decided_by, action: "approve", from_status: sequence === 1 ? "submitted" : "in_review", to_status: "in_review", note: "", created_at: at });
    } else if (status === "rejected") {
      const to = sub.status === "rejected" ? "rejected" : "blocked";
      EVENTS.push({ id: ++evId, submission_id: sub.id, approval_id: stepId, actor_id: decided_by, action: "reject", from_status: "in_review", to_status: to, note: reason, created_at: at });
      EVENTS.push({ id: ++evId, submission_id: sub.id, approval_id: 0, actor_id: decided_by, action: "block", from_status: "in_review", to_status: to, note: "", created_at: at + 60_000 });
    }
  });
  if (sub.status === "approved") {
    EVENTS.push({ id: ++evId, submission_id: sub.id, approval_id: 0, actor_id: 1, action: "complete", from_status: "in_review", to_status: "approved", note: "", created_at: sub.created_at + (roles.length + 1) * HOUR });
  }
}
export { APPROVALS, EVENTS };
