import { defineRbac } from "@xano-sdk/rbac";
import { user } from "./table/user.js";

/** Who may do what (RBAC.md). Roles are user.role's values (xano/app.ts ROLES). `team.manage` is required.
 * One map, read by the endpoint guards, the agent tools, the assistant, the approvers and the UI. */
export const rbac = defineRbac({
  user,
  canonical: "rbac",
  permissions: {
    // A requester files vendors and tracks their own cases; approvers and admins may file too.
    "submissions.create": ["requester", "approver", "admin"],
    // The full review queue and any case: reviewers and admins, not requesters (who see only their own).
    "submissions.read_all": ["approver", "admin"],
    // Clear (approve or reject) a review step; the step's own role is matched on top of this.
    "approvals.decide": ["approver", "admin"],
    // The final gate: only an admin completes a case.
    "submissions.complete": ["admin"],
    // Publish a new active rule version, rescore a case: the people who govern the rule set.
    "rules.manage": ["admin"],
    "team.manage": ["admin"],
  },
});
