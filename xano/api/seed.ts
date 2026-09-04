import { query, s, c } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { vendors } from "../tables/vendors.js";
import { risk_rules } from "../tables/risk_rules.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { approval_events } from "../tables/approval_events.js";
import {
  SEED_USERS,
  SEED_VENDORS,
  SEED_RULES,
  SEED_SUBMISSIONS,
  SEED_APPROVALS,
  SEED_EVENTS,
} from "../seed-data.js";

// POST onboarding/seed — public. Reset the workspace to the demo dataset. Truncate
// with reset restarts the id sequences, so the re-inserted rows keep the foreign
// keys the seed arrays assume. s.db.add hashes each password on write, so the demo
// accounts can sign in. The tables also ship this same data as deploy-time seeds,
// so a fresh deploy is already browsable; this endpoint is the on-demand reset.
export const seedQuery = query({
  name: "seed",
  verb: "POST",
  apiGroup: onboarding,
  auth: false,
  stack: [
    s.db.truncate({ table: approval_events, reset: true }),
    s.db.truncate({ table: required_approvals, reset: true }),
    s.db.truncate({ table: submissions, reset: true }),
    s.db.truncate({ table: risk_rules, reset: true }),
    s.db.truncate({ table: vendors, reset: true }),
    s.db.truncate({ table: users, reset: true }),
    ...SEED_USERS.map((row) => s.db.add({ table: users, row })),
    ...SEED_VENDORS.map((row) => s.db.add({ table: vendors, row })),
    ...SEED_RULES.map((row) => s.db.add({ table: risk_rules, row })),
    ...SEED_SUBMISSIONS.map((row) => s.db.add({ table: submissions, row })),
    ...SEED_APPROVALS.map((row) => s.db.add({ table: required_approvals, row })),
    ...SEED_EVENTS.map((row) => s.db.add({ table: approval_events, row })),
  ],
  response: { ok: c.bool(true) },
});
