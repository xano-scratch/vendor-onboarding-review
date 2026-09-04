// Shared demo dataset — the single source of truth for both the deploy-time
// table seeds (`table({ seed })`) and the POST onboarding/seed reset endpoint.
// Keeping one typed copy means a fresh deploy is browsable immediately AND the
// reset endpoint reloads exactly the same governed state.
//
// Rows omit `id`, so on a truncate-reset table they auto-number 1..N in array
// order. Foreign keys below reference those positions (vendor 1..5, submission
// 1..5, approval 1..10), so the arrays must stay in the listed order.

export type Role = "requester" | "approver" | "admin";
export type Category = "software" | "hardware" | "services" | "data_processor";
export type SpendBand = "low" | "mid" | "high";
export type DataLevel = "none" | "internal" | "pii";
export type SubmissionStatus =
  | "submitted"
  | "in_review"
  | "blocked"
  | "approved"
  | "rejected";
export type RiskTier = "low" | "medium" | "high";
export type ApprovalRole = "approver" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type EventAction =
  | "submit"
  | "score"
  | "approve"
  | "reject"
  | "complete"
  | "block";

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}
export interface SeedVendor {
  name: string;
  category: Category;
  country: string;
  tax_id: string;
  annual_spend_band: SpendBand;
  data_access_level: DataLevel;
}
export interface SeedRule {
  version: number;
  attribute: string;
  match_value: string;
  points: number;
  active: boolean;
}
export interface SeedSubmission {
  vendor_id: number;
  status: SubmissionStatus;
  risk_score: number;
  risk_tier: RiskTier;
  rule_version: number;
  submitted_by: number;
}
export interface SeedApproval {
  submission_id: number;
  role_required: ApprovalRole;
  sequence: number;
  status: ApprovalStatus;
  reason?: string;
}
export interface SeedEvent {
  submission_id: number;
  approval_id: number;
  actor_id: number;
  action: EventAction;
  from_status?: string;
  to_status?: string;
  note?: string;
}

// One shared password for every demo account (documented in the README).
export const DEMO_PASSWORD = "Passw0rd!23";

// users → ids 1,2,3 (one per role).
export const SEED_USERS: SeedUser[] = [
  { name: "Riley Chen", email: "riley@northwind-holdings.test", password: DEMO_PASSWORD, role: "requester" },
  { name: "Avery Stone", email: "avery@northwind-holdings.test", password: DEMO_PASSWORD, role: "approver" },
  { name: "Morgan Lee", email: "morgan@northwind-holdings.test", password: DEMO_PASSWORD, role: "admin" },
];

// vendors → ids 1..5, spread across categories and data-access levels.
export const SEED_VENDORS: SeedVendor[] = [
  { name: "Northwind Analytics", category: "services", country: "US", tax_id: "US-4471-A", annual_spend_band: "low", data_access_level: "none" },
  { name: "Meridian Cloud", category: "software", country: "US", tax_id: "US-8820-C", annual_spend_band: "mid", data_access_level: "internal" },
  { name: "SecureVault Data", category: "data_processor", country: "US", tax_id: "US-6014-P", annual_spend_band: "high", data_access_level: "pii" },
  { name: "Contoso Hardware", category: "hardware", country: "DE", tax_id: "DE-3352-H", annual_spend_band: "mid", data_access_level: "none" },
  { name: "Globex Systems", category: "software", country: "IN", tax_id: "IN-9107-S", annual_spend_band: "high", data_access_level: "pii" },
];

// risk_rules → version 1, the active scoring matrix. Every data_access_level has
// a rule, so every vendor matches at least one rule and the score is never empty.
export const RULE_VERSION = 1;
export const SEED_RULES: SeedRule[] = [
  { version: RULE_VERSION, attribute: "data_access_level", match_value: "none", points: 0, active: true },
  { version: RULE_VERSION, attribute: "data_access_level", match_value: "internal", points: 20, active: true },
  { version: RULE_VERSION, attribute: "data_access_level", match_value: "pii", points: 50, active: true },
  { version: RULE_VERSION, attribute: "annual_spend_band", match_value: "low", points: 0, active: true },
  { version: RULE_VERSION, attribute: "annual_spend_band", match_value: "mid", points: 10, active: true },
  { version: RULE_VERSION, attribute: "annual_spend_band", match_value: "high", points: 20, active: true },
  { version: RULE_VERSION, attribute: "category", match_value: "services", points: 0, active: true },
  { version: RULE_VERSION, attribute: "category", match_value: "hardware", points: 0, active: true },
  { version: RULE_VERSION, attribute: "category", match_value: "software", points: 5, active: true },
  { version: RULE_VERSION, attribute: "category", match_value: "data_processor", points: 15, active: true },
  { version: RULE_VERSION, attribute: "country", match_value: "US", points: 0, active: true },
  { version: RULE_VERSION, attribute: "country", match_value: "DE", points: 5, active: true },
  { version: RULE_VERSION, attribute: "country", match_value: "IN", points: 10, active: true },
];

// Tier thresholds (illustrative; a real team tunes them). Kept here so the
// scoring function and any docs read from one place.
export const TIER_HIGH_AT = 60;
export const TIER_MEDIUM_AT = 30;

// submissions → ids 1..5, at different tiers and lifecycle states.
export const SEED_SUBMISSIONS: SeedSubmission[] = [
  { vendor_id: 1, status: "submitted", risk_score: 0, risk_tier: "low", rule_version: RULE_VERSION, submitted_by: 1 },
  { vendor_id: 2, status: "in_review", risk_score: 35, risk_tier: "medium", rule_version: RULE_VERSION, submitted_by: 1 },
  { vendor_id: 3, status: "submitted", risk_score: 85, risk_tier: "high", rule_version: RULE_VERSION, submitted_by: 1 },
  { vendor_id: 4, status: "approved", risk_score: 15, risk_tier: "low", rule_version: RULE_VERSION, submitted_by: 1 },
  { vendor_id: 5, status: "blocked", risk_score: 85, risk_tier: "high", rule_version: RULE_VERSION, submitted_by: 1 },
];

// required_approvals → ids 1..10, derived from each submission's tier.
export const SEED_APPROVALS: SeedApproval[] = [
  { submission_id: 1, role_required: "approver", sequence: 1, status: "pending" }, // id 1
  { submission_id: 2, role_required: "approver", sequence: 1, status: "approved" }, // id 2
  { submission_id: 2, role_required: "approver", sequence: 2, status: "pending" }, // id 3
  { submission_id: 3, role_required: "approver", sequence: 1, status: "pending" }, // id 4
  { submission_id: 3, role_required: "approver", sequence: 2, status: "pending" }, // id 5
  { submission_id: 3, role_required: "admin", sequence: 3, status: "pending" }, // id 6
  { submission_id: 4, role_required: "approver", sequence: 1, status: "approved" }, // id 7
  { submission_id: 5, role_required: "approver", sequence: 1, status: "approved" }, // id 8
  { submission_id: 5, role_required: "approver", sequence: 2, status: "rejected", reason: "Vendor failed the security questionnaire" }, // id 9
  { submission_id: 5, role_required: "admin", sequence: 3, status: "pending" }, // id 10
];

// approval_events → the append-only audit trail. approval_id 0 means the event
// is submission-scoped (submit / complete / block), not tied to one step.
export const SEED_EVENTS: SeedEvent[] = [
  { submission_id: 1, approval_id: 0, actor_id: 1, action: "submit", from_status: "", to_status: "submitted", note: "Vendor submitted for onboarding review" },
  { submission_id: 2, approval_id: 0, actor_id: 1, action: "submit", from_status: "", to_status: "submitted", note: "Vendor submitted for onboarding review" },
  { submission_id: 2, approval_id: 2, actor_id: 2, action: "approve", from_status: "submitted", to_status: "in_review", note: "First approval granted" },
  { submission_id: 3, approval_id: 0, actor_id: 1, action: "submit", from_status: "", to_status: "submitted", note: "Vendor submitted for onboarding review" },
  { submission_id: 3, approval_id: 0, actor_id: 3, action: "block", from_status: "submitted", to_status: "submitted", note: "Completion blocked: three approvals still pending" },
  { submission_id: 4, approval_id: 0, actor_id: 1, action: "submit", from_status: "", to_status: "submitted", note: "Vendor submitted for onboarding review" },
  { submission_id: 4, approval_id: 7, actor_id: 2, action: "approve", from_status: "submitted", to_status: "in_review", note: "Approval granted" },
  { submission_id: 4, approval_id: 0, actor_id: 3, action: "complete", from_status: "in_review", to_status: "approved", note: "All approvals in; onboarding approved" },
  { submission_id: 5, approval_id: 0, actor_id: 1, action: "submit", from_status: "", to_status: "submitted", note: "Vendor submitted for onboarding review" },
  { submission_id: 5, approval_id: 8, actor_id: 2, action: "approve", from_status: "submitted", to_status: "in_review", note: "First approval granted" },
  { submission_id: 5, approval_id: 9, actor_id: 2, action: "reject", from_status: "in_review", to_status: "blocked", note: "Vendor failed the security questionnaire" },
];
