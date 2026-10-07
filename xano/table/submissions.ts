import { f, table } from "@xano/sdk";
import { user } from "./user.js";
import { vendors } from "./vendors.js";
import { SUBMISSIONS } from "./_seed-data.js";

/** One onboarding case: a vendor routed through risk scoring and the approvals its tier requires.
 * Owned by submitted_by (a requester sees only their own). */
export const submissions = table({
  name: "submissions",
  description: "An onboarding case: a vendor, its computed risk score and tier, and the rule version that decided it.",
  schema: {
    vendor_id: f.tableRef(vendors, { required: true }),
    status: f.enum(["submitted", "in_review", "blocked", "approved", "rejected"], { required: true }),
    risk_score: f.int(),
    risk_tier: f.enum(["low", "medium", "high"], { required: true }),
    /** The active rule version that produced this case's score, pinned so the audit holds. */
    rule_version: f.int(),
    submitted_by: f.tableRef(user, { required: true }),
  },
  index: [
    { type: "btree", fields: [{ name: "status", op: "asc" }] },
    { type: "btree", fields: [{ name: "risk_tier", op: "asc" }] },
    { type: "btree", fields: [{ name: "submitted_by", op: "asc" }] },
  ],
  seed: SUBMISSIONS,
});
