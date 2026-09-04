import { workspace } from "@xanots/sdk";

import { users } from "./tables/users.js";
import { vendors } from "./tables/vendors.js";
import { risk_rules } from "./tables/risk_rules.js";
import { submissions } from "./tables/submissions.js";
import { required_approvals } from "./tables/required_approvals.js";
import { approval_events } from "./tables/approval_events.js";

import { scoreVendor } from "./functions/score_vendor.js";

import { onboarding } from "./api/onboarding.js";
import { loginQuery } from "./api/login.js";
import { submitQuery } from "./api/submit.js";
import { rescoreQuery } from "./api/rescore.js";
import { queueQuery } from "./api/queue.js";
import { submissionQuery } from "./api/submission.js";
import { approveQuery } from "./api/approve.js";
import { rejectQuery } from "./api/reject.js";
import { completeQuery } from "./api/complete.js";
import { seedQuery } from "./api/seed.js";

/**
 * The vendor-onboarding-review backend.
 *
 * A governed procurement backend: risk-tier each vendor from one versioned rule
 * set, derive the approvals that tier requires, and block completion at the API
 * layer until every required approval is granted by someone in the right role.
 * Auth is API-layer RBAC (an auth table, minted tokens, per-endpoint role
 * guards), never row-level security.
 */
export default workspace("vendor-onboarding-review")
  .registerTables([users, vendors, risk_rules, submissions, required_approvals, approval_events])
  .registerFunctions([scoreVendor])
  .registerApiGroups([onboarding])
  .registerQueries([
    loginQuery,
    submitQuery,
    rescoreQuery,
    queueQuery,
    submissionQuery,
    approveQuery,
    rejectQuery,
    completeQuery,
    seedQuery,
  ]);
