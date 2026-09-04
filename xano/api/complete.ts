import { query, input, s, ref, inp, auth, col, c, and, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { auditEvent } from "./_derive.js";

// POST onboarding/submissions/{submission_id}/complete — admin only. THE
// API-layer gate: a case cannot complete until every required approval is granted.
// If any is still outstanding, the endpoint writes a `block` audit event and
// refuses; only when all are approved does it mark the case approved.
export const completeQuery = query({
  name: "submissions/{submission_id}/complete",
  verb: "POST",
  apiGroup: onboarding,
  auth: users,
  input: { submission_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({ expr: expr(ref("me"), "!=", c.null()), error_type: "unauthorized", error: c.text("Session is not valid") }),
    s.precondition({ expr: expr(ref("me.role"), "=", c.text("admin")), error_type: "accessdenied", error: c.text("Only an admin can complete a submission") }),
    s.db.get_by_id({ table: submissions, id: inp("submission_id"), as: "submission" }),
    s.precondition({ expr: expr(ref("submission"), "!=", c.null()), error_type: "notfound", error: c.text("Submission not found") }),
    // How many required approvals are NOT yet approved (pending or rejected)?
    s.db.query({
      table: required_approvals,
      where: and(expr(col("submission_id"), "=", inp("submission_id")), expr(col("status"), "!=", c.text("approved"))),
      returnType: "count",
      as: "not_approved",
    }),
    // If any remain, record the block BEFORE refusing — the audit trail must show
    // that completion was attempted and gated.
    s.conditional({
      when: expr(ref("not_approved"), ">", c.int(0)),
      then: [
        auditEvent({
          submissionId: inp("submission_id"),
          actorId: auth("id"),
          action: "block",
          fromStatus: ref("submission.status"),
          toStatus: ref("submission.status"),
          note: "Completion blocked: required approvals are still pending",
        }),
      ],
    }),
    s.precondition({
      expr: expr(ref("not_approved"), "=", c.int(0)),
      error_type: "badrequest",
      error: c.text("Cannot complete: every required approval must be granted first"),
    }),
    s.db.edit({ table: submissions, fieldName: "id", fieldValue: inp("submission_id"), row: { status: "approved" }, as: "updated" }),
    auditEvent({
      submissionId: inp("submission_id"),
      actorId: auth("id"),
      action: "complete",
      fromStatus: ref("submission.status"),
      toStatus: "approved",
      note: "All approvals in; onboarding approved",
    }),
  ],
  response: {
    submission: ref("updated"),
  },
});
