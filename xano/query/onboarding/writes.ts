import { auth, c, col, expr, fl, guard, inp, input, obj, query, ref, s, withFilters } from "@xano/sdk";
import type { InferRow, Value } from "@xano/sdk";
import { user } from "../../table/user.js";
import { vendors } from "../../table/vendors.js";
import { risk_rules } from "../../table/risk_rules.js";
import { submissions } from "../../table/submissions.js";
import { required_approvals } from "../../table/required_approvals.js";
import { approval_events } from "../../table/approval_events.js";
import { workspace_setting } from "../../base/index.js";
import { onboarding } from "../onboarding.js";
import { rbac } from "../../rbac.js";
import { scoreVendor } from "../../function/score_vendor.js";
import { approveStep, completeCase } from "../../function/case_actions.js";
import { changed, notify, notifyRoles } from "../../base/index.js";

const CATEGORY = ["software", "hardware", "services", "data_processor"] as const;
const SPEND = ["low", "mid", "high"] as const;
const DATA = ["none", "internal", "pii"] as const;
const caseLink = (idRef: Value) => withFilters(c.text("/cases/"), fl.concat(idRef));

/** Submit a vendor: link or create the vendor, score it against the active rules, derive the approvals its
 * tier requires (low → 1 approver, medium → 2, high → 2 + an admin), and open the case. submissions.create. */
export const submit = query({
  name: "submissions", verb: "POST", apiGroup: onboarding, auth: user,
  input: {
    vendor_id: input.int(),
    name: input.text({ methods: ["trim"] }),
    category: input.enum([...CATEGORY]),
    country: input.text({ methods: ["trim"] }),
    annual_spend_band: input.enum([...SPEND]),
    data_access_level: input.enum([...DATA]),
  },
  stack: [
    ...rbac.require("submissions.create"),
    s.set_var("vendor_id_final", c.int(0)),
    s.conditional({
      when: expr(inp("vendor_id"), ">", c.int(0)),
      then: [
        s.db.get({ table: vendors, fieldValue: inp("vendor_id"), as: "existing" }),
        guard.found("existing", { errorType: "badrequest", message: "No such vendor to submit." }),
        s.update_var("vendor_id_final", ref("existing.id")),
      ],
      else: [
        guard.require(expr(withFilters(inp("name"), fl.strlen()), ">=", c.int(2)), { errorType: "badrequest", message: "Give the vendor a name." }),
        guard.require(expr(inp("category"), "!=", c.null()), { errorType: "badrequest", message: "Pick a category." }),
        guard.require(expr(inp("annual_spend_band"), "!=", c.null()), { errorType: "badrequest", message: "Pick an annual spend band." }),
        guard.require(expr(inp("data_access_level"), "!=", c.null()), { errorType: "badrequest", message: "Pick a data access level." }),
        s.db.add({ table: vendors, row: { name: inp("name"), category: inp("category"), country: inp("country"), annual_spend_band: inp("annual_spend_band"), data_access_level: inp("data_access_level"), submitted_by: ref("me.id") }, as: "created" }),
        s.update_var("vendor_id_final", ref("created.id")),
      ],
    }),
    s.db.get({ table: vendors, fieldValue: ref("vendor_id_final"), as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.function.run({ fn: scoreVendor, as: "scored", input: { category: ref("vendor.category"), country: ref("vendor.country"), annual_spend_band: ref("vendor.annual_spend_band"), data_access_level: ref("vendor.data_access_level") } }),
    s.db.add({ table: submissions, row: { vendor_id: ref("vendor_id_final"), status: c.text("submitted"), risk_score: ref("scored.score"), risk_tier: ref("scored.tier"), rule_version: ref("scored.rule_version"), submitted_by: ref("me.id") }, as: "sub" }),
    s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("approver"), sequence: c.int(1), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } }),
    s.conditional({ when: expr(ref("scored.tier"), "!=", c.text("low")), then: [s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("approver"), sequence: c.int(2), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
    s.conditional({ when: expr(ref("scored.tier"), "=", c.text("high")), then: [s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("admin"), sequence: c.int(3), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
    s.db.add({ table: approval_events, row: { submission_id: ref("sub.id"), approval_id: c.int(0), actor_id: ref("me.id"), action: c.text("submit"), from_status: c.text(""), to_status: c.text("submitted"), note: c.text("") } }),
    changed({ entity: "submission", id: ref("sub.id"), op: "created", verb: "submitted", link: caseLink(ref("sub.id")),
      title: withFilters(c.text("submitted "), fl.concat(ref("vendor.name")), fl.concat(c.text(" for review"))) }),
    notifyRoles({ roles: rbac.rolesWith("approvals.decide"), kind: "approval", link: caseLink(ref("sub.id")), actor: ref("me.id"),
      title: withFilters(c.text("A vendor case is waiting: "), fl.concat(ref("vendor.name"))) }),
    s.db.query({ table: required_approvals, where: expr(col("submission_id"), "=", ref("sub.id")), sort: [{ sortBy: "sequence", dir: "asc" }], paging: { per_page: 10, metadata: false }, as: "steps" }),
  ],
  response: { submission: ref("sub"), approvals: ref("steps") },
  responseShape: {} as { submission: InferRow<typeof submissions>; approvals: InferRow<typeof required_approvals>[] },
});

/** Approve one review step. The caller must hold approvals.decide and their role must match the step's
 * required role (an approver cannot clear an admin step). Delegates to the shared approveStep function. */
export const approve = query({
  name: "submissions/{id}/approvals/{approval_id}/approve", verb: "POST", apiGroup: onboarding, auth: user,
  input: { id: input.int({ required: true }), approval_id: input.int({ required: true }) },
  stack: [
    ...rbac.require("approvals.decide"),
    s.function.run({ fn: approveStep, as: "result", input: { submission_id: inp("id"), approval_id: inp("approval_id"), actor_id: auth("id") } }),
  ],
  response: ref("result"),
  responseShape: {} as { ok: boolean; status: string },
});

/** Reject one review step with a reason and block the case. Same role gate as approve. */
export const reject = query({
  name: "submissions/{id}/approvals/{approval_id}/reject", verb: "POST", apiGroup: onboarding, auth: user,
  input: { id: input.int({ required: true }), approval_id: input.int({ required: true }), reason: input.text({ required: true, methods: ["trim"] }) },
  stack: [
    ...rbac.require("approvals.decide"),
    guard.require(expr(withFilters(inp("reason"), fl.strlen()), ">=", c.int(3)), { errorType: "badrequest", message: "Give a short reason for returning this case." }),
    s.db.get({ table: required_approvals, fieldValue: inp("approval_id"), as: "step" }),
    guard.found("step", { message: "No such approval step." }),
    guard.require(expr(ref("step.submission_id"), "=", inp("id")), { errorType: "notfound", message: "That step is not on this case." }),
    guard.require(expr(ref("step.status"), "=", c.text("pending")), { errorType: "badrequest", message: "That step has already been decided." }),
    guard.require(expr(ref("me.role"), "=", ref("step.role_required")), { errorType: "accessdenied", message: "Your role does not match this approval step." }),
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.db.patch({ table: required_approvals, fieldValue: inp("approval_id"), data: obj({ status: c.text("rejected"), decided_by: auth("id"), reason: inp("reason") }) }),
    s.db.patch({ table: submissions, fieldValue: inp("id"), data: obj({ status: c.text("blocked") }) }),
    s.db.add({ table: approval_events, row: { submission_id: inp("id"), approval_id: inp("approval_id"), actor_id: auth("id"), action: c.text("reject"), from_status: ref("sub.status"), to_status: c.text("blocked"), note: inp("reason") } }),
    s.db.add({ table: approval_events, row: { submission_id: inp("id"), approval_id: c.int(0), actor_id: auth("id"), action: c.text("block"), from_status: ref("sub.status"), to_status: c.text("blocked"), note: c.text("") } }),
    changed({ entity: "submission", id: inp("id"), op: "updated", verb: "blocked", link: caseLink(inp("id")),
      title: withFilters(c.text("blocked "), fl.concat(ref("vendor.name", { safe: true })), fl.concat(c.text(" at review"))) }),
    notify({ to: ref("sub.submitted_by"), kind: "rejected", link: caseLink(inp("id")),
      title: withFilters(ref("vendor.name", { safe: true }), fl.concat(c.text(" was returned at review"))) }),
  ],
  response: { ok: c.bool(true), status: c.text("blocked") },
});

/** The API-layer completion gate. Admin only (submissions.complete). Delegates to completeCase, which
 * refuses with a block event until every required approval is granted. */
export const complete = query({
  name: "submissions/{id}/complete", verb: "POST", apiGroup: onboarding, auth: user,
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.require("submissions.complete"),
    s.function.run({ fn: completeCase, as: "result", input: { submission_id: inp("id"), actor_id: auth("id") } }),
  ],
  response: ref("result"),
  responseShape: {} as { ok: boolean; status: string },
});

/** Recompute a case's tier against the current active rules and re-derive only the pending approval rows,
 * keeping decided ones. rules.manage (admin). */
export const rescore = query({
  name: "submissions/{id}/rescore", verb: "POST", apiGroup: onboarding, auth: user,
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.require("rules.manage"),
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.function.run({ fn: scoreVendor, as: "scored", input: { category: ref("vendor.category"), country: ref("vendor.country"), annual_spend_band: ref("vendor.annual_spend_band"), data_access_level: ref("vendor.data_access_level") } }),
    s.db.patch({ table: submissions, fieldValue: inp("id"), data: obj({ risk_score: ref("scored.score"), risk_tier: ref("scored.tier"), rule_version: ref("scored.rule_version") }), as: "updated" }),
    s.db.bulk.delete({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("id")), expr(col("status"), "=", c.text("pending"))] }),
    s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("id")), expr(col("sequence"), "=", c.int(1))], returnType: "count", as: "c1" }),
    s.conditional({ when: expr(ref("c1"), "=", c.int(0)), then: [s.db.add({ table: required_approvals, row: { submission_id: inp("id"), role_required: c.text("approver"), sequence: c.int(1), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
    s.conditional({
      when: expr(ref("scored.tier"), "!=", c.text("low")),
      then: [
        s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("id")), expr(col("sequence"), "=", c.int(2))], returnType: "count", as: "c2" }),
        s.conditional({ when: expr(ref("c2"), "=", c.int(0)), then: [s.db.add({ table: required_approvals, row: { submission_id: inp("id"), role_required: c.text("approver"), sequence: c.int(2), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
      ],
    }),
    s.conditional({
      when: expr(ref("scored.tier"), "=", c.text("high")),
      then: [
        s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("id")), expr(col("sequence"), "=", c.int(3))], returnType: "count", as: "c3" }),
        s.conditional({ when: expr(ref("c3"), "=", c.int(0)), then: [s.db.add({ table: required_approvals, row: { submission_id: inp("id"), role_required: c.text("admin"), sequence: c.int(3), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
      ],
    }),
    s.db.add({ table: approval_events, row: { submission_id: inp("id"), approval_id: c.int(0), actor_id: auth("id"), action: c.text("rescore"), from_status: ref("sub.status"), to_status: ref("sub.status"), note: withFilters(c.text("Rescored to "), fl.concat(ref("scored.tier"))) } }),
    changed({ entity: "submission", id: inp("id"), op: "updated", verb: "rescored", link: caseLink(inp("id")),
      title: withFilters(c.text("rescored "), fl.concat(ref("vendor.name")), fl.concat(c.text(" to ")), fl.concat(ref("scored.tier"))) }),
  ],
  response: { submission: ref("updated") },
  responseShape: {} as { submission: InferRow<typeof submissions> },
});

/** Publish a new active rule version: snapshot the current active rules into the next version and retire
 * the prior one, so the version that decided each past case is preserved. rules.manage (admin). */
export const activateRules = query({
  name: "rules/activate", verb: "POST", apiGroup: onboarding, auth: user,
  stack: [
    ...rbac.require("rules.manage"),
    s.db.query({ table: risk_rules, where: expr(col("active"), "=", c.bool(true)), output: ["version"], sort: [{ sortBy: "version", dir: "desc" }], returnType: "single", as: "cur" }),
    s.set_var("newv", withFilters(ref("cur.version", { safe: true }), fl.first_notnull(c.int(0)), fl.add(c.int(1)))),
    s.db.query({ table: risk_rules, where: expr(col("active"), "=", c.bool(true)), paging: { per_page: 200, metadata: false }, as: "active_rules" }),
    s.foreach({ list: ref("active_rules"), as: "r", body: [s.db.patch({ table: risk_rules, fieldValue: ref("r.id"), data: obj({ active: c.bool(false) }) })] }),
    s.foreach({ list: ref("active_rules"), as: "r", body: [s.db.add({ table: risk_rules, row: { version: ref("newv"), attribute: ref("r.attribute"), match_value: ref("r.match_value"), points: ref("r.points"), active: c.bool(true) } })] }),
    changed({ entity: "rule", id: ref("newv"), op: "created", verb: "published", link: c.text("/rules"), actor: auth("id"),
      title: withFilters(c.text("published risk rule version "), fl.concat(ref("newv"))) }),
  ],
  response: { version: ref("newv") },
  responseShape: {} as { version: number },
});

/** Set the review SLA (days) that flags a case overdue on the board. rules.manage (admin). */
export const updateSettings = query({
  name: "settings", verb: "PATCH", apiGroup: onboarding, auth: user,
  input: { review_sla_days: input.int({ required: true }) },
  stack: [
    ...rbac.require("rules.manage"),
    guard.require(expr(inp("review_sla_days"), ">=", c.int(1)), { errorType: "badrequest", message: "The review SLA is 1 to 90 days." }),
    guard.require(expr(inp("review_sla_days"), "<=", c.int(90)), { errorType: "badrequest", message: "The review SLA is 1 to 90 days." }),
    s.db.query({ table: workspace_setting, returnType: "single", as: "ws" }),
    guard.found("ws", { message: "The workspace settings row is missing." }),
    s.db.patch({ table: workspace_setting, fieldValue: ref("ws.id"), data: obj({ review_sla_days: inp("review_sla_days") }), as: "updated" }),
  ],
  response: { review_sla_days: ref("updated.review_sla_days") },
  responseShape: {} as { review_sla_days: number },
});
