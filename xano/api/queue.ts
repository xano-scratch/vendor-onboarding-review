import { query, input, s, ref, inp, auth, col, c, cmp, or, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { vendors } from "../tables/vendors.js";
import { required_approvals } from "../tables/required_approvals.js";

// GET onboarding/queue — approver and up. The review queue, optionally filtered by
// status and tier. Returns the submissions plus the vendor and pending-approval
// lookups the client joins against, so every row shows its vendor and its
// outstanding-approval count.
export const queueQuery = query({
  name: "queue",
  verb: "GET",
  apiGroup: onboarding,
  auth: users,
  input: {
    // Optional filters — an empty value drops the predicate (ignoreEmpty).
    status: input.text(),
    risk_tier: input.text(),
  },
  stack: [
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({ expr: expr(ref("me"), "!=", c.null()), error_type: "unauthorized", error: c.text("Session is not valid") }),
    s.precondition({
      expr: or(expr(ref("me.role"), "=", c.text("approver")), expr(ref("me.role"), "=", c.text("admin"))),
      error_type: "accessdenied",
      error: c.text("You need an approver or admin role to view the queue"),
    }),
    s.db.query({
      table: submissions,
      where: [
        cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
        cmp(col("risk_tier"), "=", inp("risk_tier"), { ignoreEmpty: true }),
      ],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
    s.db.query({ table: vendors, as: "vendor_rows" }),
    s.db.query({
      table: required_approvals,
      where: expr(col("status"), "=", c.text("pending")),
      as: "pending_rows",
    }),
  ],
  response: {
    submissions: ref("rows"),
    vendors: ref("vendor_rows"),
    pending_approvals: ref("pending_rows"),
  },
});
