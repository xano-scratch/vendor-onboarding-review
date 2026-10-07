import { defineApprovals } from "@xano-sdk/agents";
import { user } from "./table/user.js";
import { rbac } from "./rbac.js";
import { approveStep, completeCase } from "./function/case_actions.js";

/**
 * What an agent (or the assistant) asks a person's OK for (AGENT-APPROVALS.md). Each action's function does
 * the thing as `actor_id` and re-checks that person's permission, so an approval never lets someone do more
 * than they could by hand. `change_role` is the base app's; keep it.
 * - `approve_step`: the person whose agent asked confirms their own draft (no `approvers` → self-decide).
 * - `complete_case`: only an admin confirms, and completeCase still refuses an incomplete case.
 */
export const approvals = defineApprovals({
  user,
  canonical: "approvals",
  actions: {
    approve_step: { fn: approveStep, label: "Approve step" },
    complete_case: { fn: completeCase, label: "Complete case", approvers: ["admin"] },
    change_role: { fn: rbac.setRoleFn, label: "Change role", editable: "role", approvers: rbac.rolesWith("team.manage") },
  },
  // One waiting request for Morgan (admin): Avery's agent teed up completing the high-risk case #5. Morgan
  // decides it under Approvals; completeCase still refuses until case 5's remaining steps are granted.
  seed: [{
    user_id: 2, source: "mcp", agent_label: "Claude Code", connection_id: 0, action: "complete_case",
    title: "Complete the Dataflow Analytics case", preview: "An admin confirms this. Completion is refused at the API layer until every required approval is granted.",
    link: "/cases/5", approve_label: "Complete case", editable_field: "", requester_name: "Avery Chen", approver_roles: ",admin,",
    payload: { submission_id: 5 }, status: "pending", expires_at: Date.now() + 7 * 86_400_000,
  }],
});
