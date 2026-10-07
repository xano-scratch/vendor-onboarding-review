import { c, cmp, col, expr, fl, guard, inp, input, obj, prompt, ref, resource, s, withFilters } from "@xano/sdk";
import { vendors } from "../../table/vendors.js";
import { submissions } from "../../table/submissions.js";
import { required_approvals } from "../../table/required_approvals.js";
import { approval_events } from "../../table/approval_events.js";
import { agent } from "../../agent.js";
import { approvals } from "../../approvals.js";
import { rbac } from "../../rbac.js";
import { scoreVendor } from "../../function/score_vendor.js";
import { changed, notifyRoles } from "../../base/index.js";

const CATEGORY = ["software", "hardware", "services", "data_processor"] as const;
const SPEND = ["low", "mid", "high"] as const;
const DATA = ["none", "internal", "pii"] as const;
const STATUS = ["submitted", "in_review", "blocked", "approved", "rejected"] as const;
const TIER = ["low", "medium", "high"] as const;
const when = (field: string) => withFilters(ref(`$this.${field}`), fl.epochms_date(c.text("D j M, H:i"), c.text("UTC")));

/** Turn submission rows (bound as `rows`) into a compact, model-friendly list in `out`. */
const asCases = () => [
  s.set_var("out", c.array([])),
  s.foreach({ list: ref("rows"), as: "row", body: [
    s.db.get({ table: vendors, fieldValue: ref("row.vendor_id"), output: ["name"], as: "v" }),
    s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", ref("row.id")), expr(col("status"), "=", c.text("pending"))], returnType: "count", as: "outstanding" }),
    s.update_var("out", withFilters(ref("out"), fl.array_push(obj({
      case_id: ref("row.id"), vendor: ref("v.name", { safe: true }), risk_tier: ref("row.risk_tier"), status: ref("row.status"),
      outstanding_approvals: ref("outstanding"), link: withFilters(c.text("/cases/"), fl.concat(ref("row.id"))),
    })))),
  ] }),
];

export const listReviewQueueTool = agent.tool({
  name: "list_review_queue", access: "read", title: "List the review queue",
  description: "List vendor onboarding cases awaiting review, newest first, optionally filtered by tier or status. A requester sees only their own cases; a reviewer or admin sees the whole queue. Works on a read-only key.",
  input: {
    status: input.enum([...STATUS], { nullable: true, description: "Only cases in this status." }),
    risk_tier: input.enum([...TIER], { nullable: true, description: "Only cases at this risk tier." }),
  },
  stack: [
    s.conditional({
      when: rbac.has(ref("person.role"), "submissions.read_all"),
      then: [s.db.query({ table: submissions, where: [cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }), cmp(col("risk_tier"), "=", inp("risk_tier"), { ignoreEmpty: true })], sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 25, metadata: false }, as: "rows" })],
      else: [s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", ref("conn.user_id")), cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }), cmp(col("risk_tier"), "=", inp("risk_tier"), { ignoreEmpty: true })], sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 25, metadata: false }, as: "rows" })],
    }),
    ...asCases(),
  ],
  response: ref("out"),
});

export const getCaseTool = agent.tool({
  name: "get_case", access: "read", title: "Get one case",
  description: "Fetch one onboarding case: its vendor, risk tier and deciding rule version, the ordered approval checklist, and the audit trail. A requester may only read their own cases. Works on a read-only key.",
  input: { id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.conditional({ when: rbac.lacks(ref("person.role"), "submissions.read_all"), then: [guard.require(expr(ref("sub.submitted_by"), "=", ref("conn.user_id")), { errorType: "notfound", message: "No such case." })] }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name", "category", "country", "annual_spend_band", "data_access_level"], as: "v" }),
    s.db.query({ table: required_approvals, where: expr(col("submission_id"), "=", inp("id")), sort: [{ sortBy: "sequence", dir: "asc" }], paging: { per_page: 50, metadata: false }, output: ["role_required", "sequence", "status"], as: "steps" }),
    s.array.map({ source: ref("steps"), as: "checklist", transform: { step: ref("$this.sequence"), must_be_granted_by: ref("$this.role_required"), status: ref("$this.status") } }),
    s.db.query({ table: approval_events, where: expr(col("submission_id"), "=", inp("id")), sort: [{ sortBy: "created_at", dir: "asc" }], paging: { per_page: 100, metadata: false }, output: ["action", "note", "created_at"], as: "evs" }),
    s.array.map({ source: ref("evs"), as: "trail", transform: { action: ref("$this.action"), note: ref("$this.note"), when: when("created_at") } }),
  ],
  response: obj({
    case_id: ref("sub.id"), vendor: ref("v.name", { safe: true }), category: ref("v.category", { safe: true }),
    risk_tier: ref("sub.risk_tier"), risk_score: ref("sub.risk_score"), status: ref("sub.status"), rule_version: ref("sub.rule_version"),
    checklist: ref("checklist"), trail: ref("trail"), link: withFilters(c.text("/cases/"), fl.concat(inp("id"))),
  }),
});

export const scorePreviewTool = agent.tool({
  name: "score_preview", access: "read", title: "Preview a vendor's risk tier",
  description: "Given a vendor's attributes, return the risk tier and the approvals it WOULD require under the active rule set, so you can advise before submitting. Works on a read-only key.",
  input: {
    category: input.enum([...CATEGORY], { required: true }),
    country: input.text(),
    annual_spend_band: input.enum([...SPEND], { required: true }),
    data_access_level: input.enum([...DATA], { required: true }),
  },
  stack: [
    s.function.run({ fn: scoreVendor, as: "scored", input: { category: inp("category"), country: inp("country"), annual_spend_band: inp("annual_spend_band"), data_access_level: inp("data_access_level") } }),
    s.set_var("required_steps", c.int(1)),
    s.conditional({ when: expr(ref("scored.tier"), "!=", c.text("low")), then: [s.update_var("required_steps", c.int(2))] }),
    s.set_var("needs_admin", c.bool(false)),
    s.conditional({ when: expr(ref("scored.tier"), "=", c.text("high")), then: [s.update_var("required_steps", c.int(3)), s.update_var("needs_admin", c.bool(true))] }),
  ],
  response: obj({ score: ref("scored.score"), tier: ref("scored.tier"), rule_version: ref("scored.rule_version"), required_steps: ref("required_steps"), needs_admin: ref("needs_admin") }),
});

export const submitVendorTool = agent.tool({
  name: "submit_vendor", access: "write", title: "Submit a vendor",
  description: "Submit a new vendor on the connecting person's behalf: scores it, derives the approvals its tier requires, and opens the case. The person's own routine intake, so it is NOT held for approval.",
  input: {
    name: input.text({ required: true, methods: ["trim"] }),
    category: input.enum([...CATEGORY], { required: true }),
    country: input.text({ methods: ["trim"] }),
    annual_spend_band: input.enum([...SPEND], { required: true }),
    data_access_level: input.enum([...DATA], { required: true }),
  },
  logDetail: withFilters(c.text("submitted vendor "), fl.concat(inp("name"))),
  stack: [
    rbac.allows(ref("person.role"), "submissions.create", "You can't submit vendors."),
    s.db.add({ table: vendors, row: { name: inp("name"), category: inp("category"), country: inp("country"), annual_spend_band: inp("annual_spend_band"), data_access_level: inp("data_access_level"), submitted_by: ref("conn.user_id") }, as: "vendor" }),
    s.function.run({ fn: scoreVendor, as: "scored", input: { category: inp("category"), country: inp("country"), annual_spend_band: inp("annual_spend_band"), data_access_level: inp("data_access_level") } }),
    s.db.add({ table: submissions, row: { vendor_id: ref("vendor.id"), status: c.text("submitted"), risk_score: ref("scored.score"), risk_tier: ref("scored.tier"), rule_version: ref("scored.rule_version"), submitted_by: ref("conn.user_id") }, as: "sub" }),
    s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("approver"), sequence: c.int(1), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } }),
    s.conditional({ when: expr(ref("scored.tier"), "!=", c.text("low")), then: [s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("approver"), sequence: c.int(2), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
    s.conditional({ when: expr(ref("scored.tier"), "=", c.text("high")), then: [s.db.add({ table: required_approvals, row: { submission_id: ref("sub.id"), role_required: c.text("admin"), sequence: c.int(3), status: c.text("pending"), decided_by: c.int(0), reason: c.text("") } })] }),
    s.db.add({ table: approval_events, row: { submission_id: ref("sub.id"), approval_id: c.int(0), actor_id: ref("conn.user_id"), action: c.text("submit"), from_status: c.text(""), to_status: c.text("submitted"), note: c.text("") } }),
    changed({ entity: "submission", id: ref("sub.id"), op: "created", verb: "submitted", actor: ref("conn.user_id"), via: ref("conn.name"), link: withFilters(c.text("/cases/"), fl.concat(ref("sub.id"))),
      title: withFilters(c.text("submitted "), fl.concat(inp("name")), fl.concat(c.text(" for review"))) }),
    notifyRoles({ roles: rbac.rolesWith("approvals.decide"), kind: "approval", link: withFilters(c.text("/cases/"), fl.concat(ref("sub.id"))), actor: ref("conn.user_id"),
      title: withFilters(c.text("A vendor case is waiting: "), fl.concat(inp("name"))) }),
  ],
  response: obj({ case_id: ref("sub.id"), vendor: inp("name"), risk_tier: ref("scored.tier"), link: withFilters(c.text("/cases/"), fl.concat(ref("sub.id"))) }),
});

export const approveStepTool = agent.tool({
  name: "approve_step", access: "write", asksApproval: true, title: "Draft approving a review step",
  description: "Draft approving a required step on a case, for the person to confirm in the app. It is NOT done: you get an approval_id and the person approves it under Approvals. Your role must match the step's required role.",
  input: { case_id: input.int({ required: true }), approval_id: input.int({ required: true }) },
  logDetail: withFilters(c.text("asked to approve a step on case #"), fl.concat(inp("case_id"))),
  stack: [
    rbac.allows(ref("person.role"), "approvals.decide", "You can't decide review steps."),
    s.db.get({ table: required_approvals, fieldValue: inp("approval_id"), as: "step" }),
    guard.found("step", { errorType: "notfound", message: "No such approval step." }),
    guard.require(expr(ref("step.submission_id"), "=", inp("case_id")), { errorType: "notfound", message: "That step is not on this case." }),
    guard.require(expr(ref("step.status"), "=", c.text("pending")), { errorType: "badrequest", message: "That step has already been decided." }),
    guard.require(expr(ref("person.role"), "=", ref("step.role_required")), { errorType: "accessdenied", message: "Your role does not match this approval step." }),
    s.db.get({ table: submissions, fieldValue: inp("case_id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "v" }),
    guard.found("v", { message: "The vendor record is missing." }),
    approvals.request({
      ...agent.asker, action: "approve_step",
      title: withFilters(c.text("Approve the review step on "), fl.concat(ref("v.name"))),
      preview: withFilters(c.text("Grant the sequence-"), fl.concat(ref("step.sequence")), fl.concat(c.text(" review step so the case can proceed."))),
      link: withFilters(c.text("/cases/"), fl.concat(inp("case_id"))),
      payload: obj({ submission_id: inp("case_id"), approval_id: inp("approval_id") }),
    }),
  ],
  response: ref("approval"),
});

export const completeCaseTool = agent.tool({
  name: "complete_case", access: "write", asksApproval: true, title: "Draft completing a case",
  description: "Draft completing a case (the final gate) for an admin to confirm. It is NOT done: an admin approves it under Approvals, and completion is still refused until every required approval is granted. Tell the person it is ready to review.",
  input: { case_id: input.int({ required: true }) },
  logDetail: withFilters(c.text("asked to complete case #"), fl.concat(inp("case_id"))),
  stack: [
    rbac.allows(ref("person.role"), "approvals.decide", "You can't request completion."),
    s.db.get({ table: submissions, fieldValue: inp("case_id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "v" }),
    guard.found("v", { message: "The vendor record is missing." }),
    approvals.request({
      ...agent.asker, action: "complete_case",
      title: withFilters(c.text("Complete the "), fl.concat(ref("v.name")), fl.concat(c.text(" case"))),
      preview: c.text("An admin confirms this. Completion is refused at the API layer until every required approval is granted."),
      link: withFilters(c.text("/cases/"), fl.concat(inp("case_id"))),
      payload: obj({ submission_id: inp("case_id") }),
    }),
    notifyRoles({ roles: rbac.rolesWith("submissions.complete"), kind: "approval", link: "/approvals", actor: ref("conn.user_id"),
      title: withFilters(ref("conn.name"), fl.concat(c.text(" asks to complete the ")), fl.concat(ref("v.name")), fl.concat(c.text(" case"))) }),
  ],
  response: ref("approval"),
});

/** A reusable prompt an agent can invoke to summarise the queue using the read tools above. */
export const summariseQueuePrompt = prompt({
  name: "summarise_queue", title: "Summarise the review queue",
  description: "Summarise the vendor onboarding review queue and what is blocking each case.",
  response: c.text("Summarise the current vendor onboarding review queue. Call list_review_queue, then for each blocked or high-risk case call get_case and state which required approval is still outstanding and who must grant it. Group by risk tier, highest first. Keep it to a few lines."),
});

/** A resource twin of get_case, addressable as case://{id}, scoped to the connecting person. */
export const caseResource = resource({
  name: "case", uri: "case://{id}", mimeType: "text/plain",
  description: "A vendor onboarding case: its vendor, risk tier, status and how many approvals are still outstanding.",
  input: { id: input.int({ required: true }) },
  stack: [
    ...agent.connection(),
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.conditional({ when: rbac.lacks(ref("person.role"), "submissions.read_all"), then: [guard.require(expr(ref("sub.submitted_by"), "=", ref("conn.user_id")), { errorType: "notfound", message: "No such case." })] }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "v" }),
    guard.found("v", { message: "The vendor record is missing." }),
    s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", inp("id")), expr(col("status"), "=", c.text("pending"))], returnType: "count", as: "outstanding" }),
    s.set_var("summary", withFilters(c.text("Case #"), fl.concat(inp("id")), fl.concat(c.text(": ")), fl.concat(ref("v.name")),
      fl.concat(c.text(" — tier ")), fl.concat(ref("sub.risk_tier")), fl.concat(c.text(", status ")), fl.concat(ref("sub.status")),
      fl.concat(c.text(", ")), fl.concat(ref("outstanding")), fl.concat(c.text(" approval(s) outstanding.")))),
  ],
  response: ref("summary"),
});

export const onboardingAgentTools = [listReviewQueueTool, getCaseTool, scorePreviewTool, submitVendorTool, approveStepTool, completeCaseTool];
export const onboardingAgentPrompts = [summariseQueuePrompt];
export const onboardingAgentResources = [caseResource];
