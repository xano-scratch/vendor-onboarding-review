import { table, f } from "@xanots/sdk";

import { submissions } from "./submissions.js";
import { required_approvals } from "./required_approvals.js";
import { users } from "./users.js";
import { SEED_EVENTS } from "../seed-data.js";

// The append-only audit trail. Every state-changing action writes one row here,
// naming the actor and the status transition, so a reviewer can reconstruct
// exactly who did what and why a case is where it is.
//
// `approval_id` is an optional foreign key: it points at one required-approval
// step for approve/reject events, and takes the `0` sentinel (the SDK's optional
// tableRef pattern) for submission-scoped events (submit/complete/block).
export const approval_events = table({
  name: "approval_events",
  schema: {
    submission_id: f.tableRef(submissions, { required: true }),
    approval_id: f.tableRef(required_approvals, { required: true, default: 0 }),
    actor_id: f.tableRef(users, { required: true }),
    action: f.enum(["submit", "score", "approve", "reject", "complete", "block"], { required: true }),
    from_status: f.text(),
    to_status: f.text(),
    note: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "submission_id" }] }],
  seed: SEED_EVENTS,
});
