import { s, c, expr, type Value } from "@xanots/sdk";

import { required_approvals } from "../tables/required_approvals.js";
import { approval_events } from "../tables/approval_events.js";

// Derive the required-approval set from a submission's risk tier — the dynamic
// rule the whole app enforces: low → one approver, medium → two approvers, high →
// two approvers plus an admin. Returned as ONE conditional statement so it drops
// into a stack as a single element and never widens the tuple (see the
// "helper returning Statement[]" gotcha in llms.txt).
export function deriveApprovals(submissionId: Value, tier: Value) {
  const step = (role: "approver" | "admin", sequence: number) =>
    s.db.add({
      table: required_approvals,
      row: { submission_id: submissionId, role_required: role, sequence, status: "pending" },
    });
  return s.conditional({
    when: expr(tier, "=", c.text("high")),
    then: [step("approver", 1), step("approver", 2), step("admin", 3)],
    elif: [{ when: expr(tier, "=", c.text("medium")), then: [step("approver", 1), step("approver", 2)] }],
    else: [step("approver", 1)],
  });
}

// The audit-trail helper — one append-only row per state change. Also a single
// statement, safe to inline.
export function auditEvent(fields: {
  submissionId: Value;
  actorId: Value;
  action: "submit" | "score" | "approve" | "reject" | "complete" | "block";
  fromStatus: Value | string;
  toStatus: Value | string;
  note: Value | string;
  approvalId?: Value | number;
}) {
  return s.db.add({
    table: approval_events,
    row: {
      submission_id: fields.submissionId,
      approval_id: fields.approvalId ?? 0,
      actor_id: fields.actorId,
      action: fields.action,
      from_status: fields.fromStatus,
      to_status: fields.toStatus,
      note: fields.note,
    },
  });
}
