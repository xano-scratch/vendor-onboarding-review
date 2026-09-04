import { query, input, s, ref, inp, auth, col, c, and, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { scoreVendor } from "../functions/score_vendor.js";
import { deriveApprovals, auditEvent } from "./_derive.js";

// POST onboarding/submissions/{submission_id}/rescore — admin only. Re-evaluate
// the case against the CURRENT active rule version and re-derive the still-pending
// approval set, preserving any step already approved or rejected.
export const rescoreQuery = query({
  name: "submissions/{submission_id}/rescore",
  verb: "POST",
  apiGroup: onboarding,
  auth: users,
  input: { submission_id: input.int({ required: true }) },
  stack: [
    // Admin guard (API-layer RBAC — read the caller's live role, then gate).
    s.db.get_by_id({ table: users, id: auth("id"), as: "me" }),
    s.precondition({ expr: expr(ref("me"), "!=", c.null()), error_type: "unauthorized", error: c.text("Session is not valid") }),
    s.precondition({ expr: expr(ref("me.role"), "=", c.text("admin")), error_type: "accessdenied", error: c.text("Only an admin can rescore a submission") }),
    // Load the case.
    s.db.get_by_id({ table: submissions, id: inp("submission_id"), as: "submission" }),
    s.precondition({ expr: expr(ref("submission"), "!=", c.null()), error_type: "notfound", error: c.text("Submission not found") }),
    // Recompute against the active rules.
    s.function.run({ fn: scoreVendor, input: { vendor_id: ref("submission.vendor_id") }, as: "scored" }),
    s.db.edit({
      table: submissions,
      fieldName: "id",
      fieldValue: inp("submission_id"),
      row: { risk_score: ref("scored.score"), risk_tier: ref("scored.tier"), rule_version: ref("scored.version") },
      as: "updated",
    }),
    // Re-derive only the pending steps; leave decided (approved/rejected) ones.
    s.db.bulk.delete({
      table: required_approvals,
      where: and(expr(col("submission_id"), "=", inp("submission_id")), expr(col("status"), "=", c.text("pending"))),
    }),
    deriveApprovals(inp("submission_id"), ref("scored.tier")),
    auditEvent({
      submissionId: inp("submission_id"),
      actorId: auth("id"),
      action: "score",
      fromStatus: ref("submission.status"),
      toStatus: ref("submission.status"),
      note: "Rescored against the active rule version",
    }),
    s.db.query({
      table: required_approvals,
      where: expr(col("submission_id"), "=", inp("submission_id")),
      sort: [{ sortBy: "sequence", dir: "asc" }],
      as: "approvals",
    }),
  ],
  response: {
    submission: ref("updated"),
    risk_score: ref("scored.score"),
    risk_tier: ref("scored.tier"),
    rule_version: ref("scored.version"),
    required_approvals: ref("approvals"),
  },
});
