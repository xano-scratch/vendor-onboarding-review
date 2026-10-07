import { f, table } from "@xano/sdk";
import { user } from "./user.js";
import { submissions } from "./submissions.js";
import { APPROVALS } from "./_seed-data.js";

/** The approval set DERIVED from a case's risk tier: the dynamic part. A high tier generates more rows,
 * including an admin row. Completion is blocked at the API layer until every row here is approved. */
export const required_approvals = table({
  name: "required_approvals",
  description: "One required sign-off on a case: which role must grant it, in which order, and whether it has been decided.",
  schema: {
    submission_id: f.tableRef(submissions, { required: true }),
    role_required: f.enum(["approver", "admin"], { required: true }),
    sequence: f.int({ required: true }),
    status: f.enum(["pending", "approved", "rejected"], { required: true }),
    /** 0 until decided, then the person who decided it. */
    decided_by: f.tableRef(user, { default: 0 }),
    reason: f.text(),
  },
  index: [
    { type: "btree", fields: [{ name: "submission_id", op: "asc" }, { name: "sequence", op: "asc" }] },
    { type: "btree", fields: [{ name: "status", op: "asc" }] },
  ],
  seed: APPROVALS,
});
