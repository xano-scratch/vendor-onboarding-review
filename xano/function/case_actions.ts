import { c, col, defineFunction, expr, fl, guard, inp, input, obj, ref, s, withFilters } from "@xano/sdk";
import { user } from "../table/user.js";
import { vendors } from "../table/vendors.js";
import { submissions } from "../table/submissions.js";
import { required_approvals } from "../table/required_approvals.js";
import { approval_events } from "../table/approval_events.js";
import { rbac } from "../rbac.js";
import { changed, notify } from "../base/index.js";

const caseLink = (idInput: string) => withFilters(c.text("/cases/"), fl.concat(inp(idInput)));

/**
 * Approve one required step, as the approver. Shared by the REST approve endpoint and the agent's
 * approve_step draft (re-checked here, so a demoted approver can't approve at decision time). The caller's
 * role must equal the step's required role, so an approver cannot clear an admin step.
 */
export const approveStep = defineFunction({
  name: "onboarding/approve_step",
  input: { submission_id: input.int({ required: true }), approval_id: input.int({ required: true }), actor_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: user, fieldValue: inp("actor_id"), output: ["id", "name", "role"], as: "actor" }),
    guard.found("actor", { errorType: "unauthorized", message: "Sign in again." }),
    rbac.allows(ref("actor.role"), "approvals.decide", "You can't decide review steps."),
    s.db.get({ table: required_approvals, fieldValue: inp("approval_id"), as: "step" }),
    guard.found("step", { message: "No such approval step." }),
    guard.require(expr(ref("step.submission_id"), "=", inp("submission_id")), { errorType: "notfound", message: "That step is not on this case." }),
    guard.require(expr(ref("step.status"), "=", c.text("pending")), { errorType: "badrequest", message: "That step has already been decided." }),
    guard.require(expr(ref("actor.role"), "=", ref("step.role_required")), { errorType: "accessdenied", message: "Your role does not match this approval step." }),
    s.db.get({ table: submissions, fieldValue: inp("submission_id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.db.patch({ table: required_approvals, fieldValue: inp("approval_id"), data: obj({ status: c.text("approved"), decided_by: inp("actor_id") }) }),
    s.set_var("to_status", ref("sub.status")),
    s.conditional({
      when: expr(ref("sub.status"), "=", c.text("submitted")),
      then: [s.db.patch({ table: submissions, fieldValue: inp("submission_id"), data: obj({ status: c.text("in_review") }) }), s.update_var("to_status", c.text("in_review"))],
    }),
    s.db.add({ table: approval_events, row: { submission_id: inp("submission_id"), approval_id: inp("approval_id"), actor_id: inp("actor_id"), action: c.text("approve"), from_status: ref("sub.status"), to_status: ref("to_status"), note: c.text("") } }),
    changed({ entity: "submission", id: inp("submission_id"), op: "updated", actor: inp("actor_id"), verb: "approved", link: caseLink("submission_id"),
      title: withFilters(c.text("approved a review step on "), fl.concat(ref("vendor.name"))) }),
    notify({ to: ref("sub.submitted_by"), kind: "approved", actor: inp("actor_id"), link: caseLink("submission_id"),
      title: withFilters(c.text("A review step was approved on "), fl.concat(ref("vendor.name"))) }),
  ],
  response: { ok: c.bool(true), status: ref("to_status") },
});

/**
 * The API-layer completion gate, as an admin. Shared by the REST complete endpoint and the agent's
 * complete_case draft. Refuses (403, with a `block` audit event) until EVERY required approval is granted,
 * even when reached through an approval, so an incomplete case can never be completed.
 */
export const completeCase = defineFunction({
  name: "onboarding/complete_case",
  input: { submission_id: input.int({ required: true }), actor_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: user, fieldValue: inp("actor_id"), output: ["id", "name", "role"], as: "actor" }),
    guard.found("actor", { errorType: "unauthorized", message: "Sign in again." }),
    rbac.allows(ref("actor.role"), "submissions.complete", "Only an admin can complete a case."),
    s.db.get({ table: submissions, fieldValue: inp("submission_id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("submission_id")), expr(col("status"), "!=", c.text("approved"))], returnType: "count", as: "outstanding" }),
    s.conditional({
      when: expr(ref("outstanding"), ">", c.int(0)),
      then: [
        s.db.add({ table: approval_events, row: { submission_id: inp("submission_id"), approval_id: c.int(0), actor_id: inp("actor_id"), action: c.text("block"), from_status: ref("sub.status"), to_status: ref("sub.status"), note: c.text("Completion blocked: a required approval is still pending.") } }),
        changed({ entity: "submission", id: inp("submission_id"), op: "updated", actor: inp("actor_id") }),
      ],
    }),
    guard.require(expr(ref("outstanding"), "=", c.int(0)), { errorType: "accessdenied", message: "A required approval is still pending; the case cannot be completed." }),
    s.db.patch({ table: submissions, fieldValue: inp("submission_id"), data: obj({ status: c.text("approved") }) }),
    s.db.add({ table: approval_events, row: { submission_id: inp("submission_id"), approval_id: c.int(0), actor_id: inp("actor_id"), action: c.text("complete"), from_status: ref("sub.status"), to_status: c.text("approved"), note: c.text("") } }),
    changed({ entity: "submission", id: inp("submission_id"), op: "moved", actor: inp("actor_id"), verb: "completed", link: caseLink("submission_id"),
      title: withFilters(c.text("completed the "), fl.concat(ref("vendor.name")), fl.concat(c.text(" case"))) }),
    notify({ to: ref("sub.submitted_by"), kind: "completed", actor: inp("actor_id"), link: caseLink("submission_id"),
      title: withFilters(ref("vendor.name"), fl.concat(c.text(" was approved and completed"))) }),
  ],
  response: { ok: c.bool(true), status: c.text("approved") },
});
