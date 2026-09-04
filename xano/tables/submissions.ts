import { table, f } from "@xanots/sdk";

import { vendors } from "./vendors.js";
import { users } from "./users.js";
import { SEED_SUBMISSIONS } from "../seed-data.js";

// One onboarding case: a vendor put forward for review, with the risk tier that
// decided its approval requirements and the rule version that produced it.
export const submissions = table({
  name: "submissions",
  schema: {
    vendor_id: f.tableRef(vendors, { required: true }),
    status: f.enum(["submitted", "in_review", "blocked", "approved", "rejected"], { required: true }),
    risk_score: f.int({ required: true }),
    risk_tier: f.enum(["low", "medium", "high"], { required: true }),
    rule_version: f.int({ required: true }),
    submitted_by: f.tableRef(users, { required: true }),
  },
  index: [{ type: "btree", fields: [{ name: "status" }] }],
  seed: SEED_SUBMISSIONS,
});
