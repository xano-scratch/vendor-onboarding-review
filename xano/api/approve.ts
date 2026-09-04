import { query, input, s, ref, inp, auth, col, c, and, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { auditEvent } from "./_derive.js";

// POST onboarding/submissions/{submission_id}/approvals/{approval_id}/approve —
// role-matched. Grant one required step. The API layer enforces that the caller's
// role EQUALS the role the step requires (an approver cannot sign an admin step),
// that the step belongs to this case, and that it is still pending.
export const approveQuery = query({
  name: "submissions/{submission_id}/approvals/{approval_id}/approve",
  verb: "POST",
  apiGroup: onboarding,
  auth: users,
  input: {
    submission_id: input.int({ required: true }),
    approval_id: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({ expr: expr(ref("me"), "!=", c.null()), error_type: "unauthorized", error: c.text("Session is not valid") }),
    s.db.get_by_id({ table: required_approvals, id: inp("approval_id"), as: "step" }),
    s.precondition({ expr: expr(ref("step"), "!=", c.null()), error_type: "notfound", error: c.text("Approval step not found") }),
    s.precondition({ expr: expr(ref("step.submission_id"), "=", inp("submission_id")), error_type: "badrequest", error: c.text("That approval step is not part of this submission") }),
    s.precondition({ expr: expr(ref("step.status"), "=", c.text("pending")), error_type: "badrequest", error: c.text("That approval step has already been decided") }),
    s.precondition({ expr: expr(ref("me.role"), "=", ref("step.role_required")), error_type: "accessdenied", error: c.text("Your role does not match this approval step") }),
    s.db.get_by_id({ table: submissions, id: inp("submission_id"), as: "submission" }),
    s.precondition({ expr: expr(ref("submission"), "!=", c.null()), error_type: "notfound", error: c.text("Submission not found") }),
    s.db.edit({ table: required_approvals, fieldName: "id", fieldValue: inp("approval_id"), row: { status: "approved" }, as: "granted" }),
    s.db.edit({ table: submissions, fieldName: "id", fieldValue: inp("submission_id"), row: { status: "in_review" }, as: "updated" }),
    auditEvent({
      submissionId: inp("submission_id"),
      approvalId: inp("approval_id"),
      actorId: auth("id"),
      action: "approve",
      fromStatus: ref("submission.status"),
      toStatus: "in_review",
      note: "Approval granted",
    }),
    s.db.query({
      table: required_approvals,
      where: and(expr(col("submission_id"), "=", inp("submission_id")), expr(col("status"), "!=", c.text("approved"))),
      returnType: "count",
      as: "outstanding",
    }),
  ],
  response: {
    approval: ref("granted"),
    submission: ref("updated"),
    outstanding: ref("outstanding"),
  },
});
