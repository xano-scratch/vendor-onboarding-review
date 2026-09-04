import { query, input, s, ref, inp, auth, col, c, or, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { vendors } from "../tables/vendors.js";
import { required_approvals } from "../tables/required_approvals.js";
import { approval_events } from "../tables/approval_events.js";

// GET onboarding/submissions/{submission_id} — approver and up. The full case: the
// submission, its vendor, the deciding rule version, the required-approval
// checklist in order, the ordered audit trail, and an actor lookup so the client
// can name who took each action.
export const submissionQuery = query({
  name: "submissions/{submission_id}",
  verb: "GET",
  apiGroup: onboarding,
  auth: users,
  input: { submission_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({ expr: expr(ref("me"), "!=", c.null()), error_type: "unauthorized", error: c.text("Session is not valid") }),
    s.precondition({
      expr: or(expr(ref("me.role"), "=", c.text("approver")), expr(ref("me.role"), "=", c.text("admin"))),
      error_type: "accessdenied",
      error: c.text("You need an approver or admin role to view a case"),
    }),
    s.db.get_by_id({ table: submissions, id: inp("submission_id"), as: "submission" }),
    s.precondition({ expr: expr(ref("submission"), "!=", c.null()), error_type: "notfound", error: c.text("Submission not found") }),
    s.db.get_by_id({ table: vendors, id: ref("submission.vendor_id"), as: "vendor" }),
    s.db.query({
      table: required_approvals,
      where: expr(col("submission_id"), "=", inp("submission_id")),
      sort: [{ sortBy: "sequence", dir: "asc" }],
      as: "approvals",
    }),
    s.db.query({
      table: approval_events,
      where: expr(col("submission_id"), "=", inp("submission_id")),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "events",
    }),
    s.db.query({ table: users, output: ["id", "name", "role"], as: "actors" }),
  ],
  response: {
    submission: ref("submission"),
    vendor: ref("vendor"),
    rule_version: ref("submission.rule_version"),
    required_approvals: ref("approvals"),
    audit_trail: ref("events"),
    actors: ref("actors"),
  },
});
