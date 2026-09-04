import { table, f } from "@xanots/sdk";

import { submissions } from "./submissions.js";
import { SEED_APPROVALS } from "../seed-data.js";

// The approval set DERIVED from a submission's risk tier: low → one approver,
// medium → two approvers, high → two approvers plus an admin. A case cannot
// complete until every row here is `approved`.
export const required_approvals = table({
  name: "required_approvals",
  schema: {
    submission_id: f.tableRef(submissions, { required: true }),
    role_required: f.enum(["approver", "admin"], { required: true }),
    sequence: f.int({ required: true }),
    status: f.enum(["pending", "approved", "rejected"], { required: true }),
    reason: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "submission_id" }] }],
  seed: SEED_APPROVALS,
});
