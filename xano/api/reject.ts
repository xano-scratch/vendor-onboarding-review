import { query, input, s, ref, inp, auth, c, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { auditEvent } from "./_derive.js";

// POST onboarding/submissions/{submission_id}/approvals/{approval_id}/reject —
// role-matched. Reject one step with a reason and block the case. Same role match
// as approve: only someone in the step's required role can decide it.
export const rejectQuery = query({
  name: "submissions/{submission_id}/approvals/{approval_id}/reject",
  verb: "POST",
  apiGroup: onboarding,
  auth: users,
  input: {
    submission_id: input.int({ required: true }),
    approval_id: input.int({ required: true }),
    reason: input.text({ required: true }),
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
    s.db.edit({ table: required_approvals, fieldName: "id", fieldValue: inp("approval_id"), row: { status: "rejected", reason: inp("reason") }, as: "rejected" }),
    s.db.edit({ table: submissions, fieldName: "id", fieldValue: inp("submission_id"), row: { status: "blocked" }, as: "updated" }),
    auditEvent({
      submissionId: inp("submission_id"),
      approvalId: inp("approval_id"),
      actorId: auth("id"),
      action: "reject",
      fromStatus: ref("submission.status"),
      toStatus: "blocked",
      note: inp("reason"),
    }),
  ],
  response: {
    approval: ref("rejected"),
    submission: ref("updated"),
  },
});
