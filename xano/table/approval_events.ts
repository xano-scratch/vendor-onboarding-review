import { f, table } from "@xano/sdk";
import { user } from "./user.js";
import { submissions } from "./submissions.js";
import { required_approvals } from "./required_approvals.js";
import { EVENTS } from "./_seed-data.js";

/** The append-only, per-case governed audit trail. Distinct from the base app's cross-app activity feed:
 * this is the exact history a reviewer reads on one case (who did what, and the status it moved from and to). */
export const approval_events = table({
  name: "approval_events",
  description: "Append-only audit trail for one case: every submit, approve, reject, complete and block, with actor and status transition.",
  schema: {
    submission_id: f.tableRef(submissions, { required: true }),
    /** The step this event decided, when it decided one (0 for submit, complete and block). */
    approval_id: f.tableRef(required_approvals, { default: 0 }),
    actor_id: f.tableRef(user, { required: true }),
    action: f.enum(["submit", "score", "rescore", "approve", "reject", "complete", "block"], { required: true }),
    from_status: f.text(),
    to_status: f.text(),
    note: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "submission_id", op: "asc" }, { name: "created_at", op: "asc" }] }],
  seed: EVENTS,
});
