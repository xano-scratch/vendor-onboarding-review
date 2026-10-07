import { auth, c, cmp, col, expr, fl, guard, inp, input, obj, query, ref, s, withFilters } from "@xano/sdk";
import type { InferRow } from "@xano/sdk";
import { user } from "../../table/user.js";
import { vendors } from "../../table/vendors.js";
import { risk_rules } from "../../table/risk_rules.js";
import { submissions } from "../../table/submissions.js";
import { required_approvals } from "../../table/required_approvals.js";
import { approval_events } from "../../table/approval_events.js";
import { workspace_setting } from "../../base/index.js";
import { onboarding } from "../onboarding.js";
import { rbac } from "../../rbac.js";

const OPEN = c.array(["submitted", "in_review", "blocked"]);
const readSla = () => [
  s.db.query({ table: workspace_setting, output: ["review_sla_days"], returnType: "single", as: "ws" }),
  s.set_var("sla_days", withFilters(ref("ws.review_sla_days", { safe: true }), fl.first_notnull(c.int(5)))),
];

type QueueItem = {
  id: number; vendor_id: number; vendor_name: string; vendor_category: string;
  status: string; risk_tier: string; risk_score: number; rule_version: number;
  submitted_by: number; submitted_by_name: string; created_at: number; outstanding: number;
};
const pageShape = <T,>() => ({} as { items: T[]; curPage: number; nextPage: number | null; prevPage: number | null; itemsTotal: number; pageTotal: number; sla_days: number });

// Enrich one page of submissions (bound as `page`, metadata envelope) into `items`: vendor name + the
// count of approvals still outstanding on each case. Returned as Statement[]; the response is declared
// with responseShape, so the widened tuple does not matter here.
const enrichPage = () => [
  s.set_var("items", c.array([])),
  s.foreach({ list: ref("page.items"), as: "sub", body: [
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name", "category"], as: "v" }),
    s.db.get({ table: user, fieldValue: ref("sub.submitted_by"), output: ["name"], as: "submitter" }),
    s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", ref("sub.id")), expr(col("status"), "=", c.text("pending"))], returnType: "count", as: "outstanding" }),
    s.update_var("items", withFilters(ref("items"), fl.array_push(obj({
      id: ref("sub.id"), vendor_id: ref("sub.vendor_id"), vendor_name: ref("v.name", { safe: true }), vendor_category: ref("v.category", { safe: true }),
      status: ref("sub.status"), risk_tier: ref("sub.risk_tier"), risk_score: ref("sub.risk_score"), rule_version: ref("sub.rule_version"),
      submitted_by: ref("sub.submitted_by"), submitted_by_name: ref("submitter.name", { safe: true }), created_at: ref("sub.created_at"), outstanding: ref("outstanding"),
    })))),
  ] }),
];

/** The overview counts, scoped to the person's role. A requester sees their own cases; a reviewer or admin
 * sees the whole queue. recent_approved feeds the "approved this week" trend (perDay on the client). */
export const overview = query({
  name: "overview", verb: "GET", apiGroup: onboarding, auth: user,
  stack: [
    ...rbac.signedIn(),
    s.set_var("cutoff", withFilters(c.now(), fl.epochms_add_secs(c.int(-604800)))),
    s.set_var("cutoff14", withFilters(c.now(), fl.epochms_add_secs(c.int(-1209600)))),
    s.set_var("awaiting_mine", c.int(0)),
    s.conditional({
      when: rbac.has(ref("me.role"), "submissions.read_all"),
      then: [
        s.db.query({ table: submissions, where: cmp(col("status"), "in", OPEN), returnType: "count", as: "open_cases" }),
        s.db.query({ table: submissions, where: expr(col("status"), "=", c.text("blocked")), returnType: "count", as: "blocked" }),
        s.db.query({ table: submissions, where: [cmp(col("status"), "in", c.array(["submitted", "in_review"])), expr(col("risk_tier"), "=", c.text("high"))], returnType: "count", as: "high_awaiting" }),
        s.db.query({ table: submissions, where: [expr(col("status"), "=", c.text("approved")), expr(col("created_at"), ">=", ref("cutoff"))], returnType: "count", as: "approved_7d" }),
        s.db.query({ table: submissions, where: [expr(col("status"), "=", c.text("approved")), expr(col("created_at"), ">=", ref("cutoff14"))], output: ["created_at"], sort: [{ sortBy: "created_at", dir: "asc" }], paging: { per_page: 50, metadata: false }, as: "recent_approved" }),
        s.db.query({ table: required_approvals, where: [expr(col("status"), "=", c.text("pending")), expr(col("role_required"), "=", ref("me.role"))], returnType: "count", as: "mine" }),
        s.update_var("awaiting_mine", ref("mine")),
      ],
      else: [
        s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", auth("id")), cmp(col("status"), "in", OPEN)], returnType: "count", as: "open_cases" }),
        s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", auth("id")), expr(col("status"), "=", c.text("blocked"))], returnType: "count", as: "blocked" }),
        s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", auth("id")), cmp(col("status"), "in", c.array(["submitted", "in_review"])), expr(col("risk_tier"), "=", c.text("high"))], returnType: "count", as: "high_awaiting" }),
        s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", auth("id")), expr(col("status"), "=", c.text("approved")), expr(col("created_at"), ">=", ref("cutoff"))], returnType: "count", as: "approved_7d" }),
        s.db.query({ table: submissions, where: [expr(col("submitted_by"), "=", auth("id")), expr(col("status"), "=", c.text("approved")), expr(col("created_at"), ">=", ref("cutoff14"))], output: ["created_at"], sort: [{ sortBy: "created_at", dir: "asc" }], paging: { per_page: 50, metadata: false }, as: "recent_approved" }),
      ],
    }),
  ],
  response: { open_cases: ref("open_cases"), blocked: ref("blocked"), high_awaiting: ref("high_awaiting"), approved_7d: ref("approved_7d"), awaiting_mine: ref("awaiting_mine"), recent_approved: ref("recent_approved") },
  responseShape: {} as { open_cases: number; blocked: number; high_awaiting: number; approved_7d: number; awaiting_mine: number; recent_approved: { created_at: number }[] },
});

/** The review queue: cases filtered by status and tier, paged, each with its vendor and outstanding count.
 * Feeds the Review board. Reviewers and admins only; a requester uses submissions/mine. */
export const queue = query({
  name: "queue", verb: "GET", apiGroup: onboarding, auth: user,
  input: { status: input.text(), risk_tier: input.text(), page: input.int(), per_page: input.int() },
  stack: [
    ...rbac.require("submissions.read_all"),
    s.set_var("size", c.int(20)),
    s.conditional({ when: expr(inp("per_page"), ">", c.int(0)), then: [s.update_var("size", inp("per_page"))] }),
    s.conditional({ when: expr(ref("size"), ">", c.int(100)), then: [s.update_var("size", c.int(100))] }),
    s.db.query({
      table: submissions,
      where: [cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }), cmp(col("risk_tier"), "=", inp("risk_tier"), { ignoreEmpty: true })],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: ref("size"), metadata: true, totals: true },
      as: "page",
    }),
    ...readSla(),
    ...enrichPage(),
  ],
  response: { items: ref("items"), curPage: ref("page.curPage"), nextPage: ref("page.nextPage"), prevPage: ref("page.prevPage"), itemsTotal: ref("page.itemsTotal"), pageTotal: ref("page.pageTotal"), sla_days: ref("sla_days") },
  responseShape: pageShape<QueueItem>(),
});

/** The requester's own cases (they can't see the full queue), filtered by status, paged, same enrichment. */
export const mine = query({
  name: "submissions/mine", verb: "GET", apiGroup: onboarding, auth: user,
  input: { status: input.text(), page: input.int(), per_page: input.int() },
  stack: [
    ...rbac.signedIn(),
    s.set_var("size", c.int(20)),
    s.conditional({ when: expr(inp("per_page"), ">", c.int(0)), then: [s.update_var("size", inp("per_page"))] }),
    s.conditional({ when: expr(ref("size"), ">", c.int(100)), then: [s.update_var("size", c.int(100))] }),
    s.db.query({
      table: submissions,
      where: [expr(col("submitted_by"), "=", auth("id")), cmp(col("status"), "=", inp("status"), { ignoreEmpty: true })],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { page: inp("page"), per_page: ref("size"), metadata: true, totals: true },
      as: "page",
    }),
    ...readSla(),
    ...enrichPage(),
  ],
  response: { items: ref("items"), curPage: ref("page.curPage"), nextPage: ref("page.nextPage"), prevPage: ref("page.prevPage"), itemsTotal: ref("page.itemsTotal"), pageTotal: ref("page.pageTotal"), sla_days: ref("sla_days") },
  responseShape: pageShape<QueueItem>(),
});

type CaseStep = { id: number; role_required: string; sequence: number; status: string; reason: string; decided_by: number; decided_by_name: string };
type CaseEvent = { id: number; action: string; from_status: string; to_status: string; note: string; created_at: number; actor_name: string };

/** One case: its vendor, the ordered required-approval checklist with decider names, the deciding rule
 * version (on the submission), and the full ordered audit trail. The owner, or anyone with read_all. */
export const caseDetail = query({
  name: "submissions/{id}", verb: "GET", apiGroup: onboarding, auth: user,
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.signedIn(),
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.conditional({
      when: rbac.lacks(ref("me.role"), "submissions.read_all"),
      then: [guard.require(expr(ref("sub.submitted_by"), "=", auth("id")), { errorType: "notfound", message: "No such case." })],
    }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), as: "vendor" }),
    guard.found("vendor", { message: "The vendor record is missing." }),
    s.db.query({ table: required_approvals, where: expr(col("submission_id"), "=", inp("id")), sort: [{ sortBy: "sequence", dir: "asc" }], paging: { per_page: 50, metadata: false }, as: "steps" }),
    s.set_var("approvals", c.array([])),
    s.foreach({ list: ref("steps"), as: "step", body: [
      s.db.get({ table: user, fieldValue: ref("step.decided_by"), output: ["name"], as: "decider" }),
      s.update_var("approvals", withFilters(ref("approvals"), fl.array_push(obj({
        id: ref("step.id"), role_required: ref("step.role_required"), sequence: ref("step.sequence"), status: ref("step.status"),
        reason: ref("step.reason"), decided_by: ref("step.decided_by"), decided_by_name: ref("decider.name", { safe: true }),
      })))),
    ] }),
    s.db.query({ table: approval_events, where: expr(col("submission_id"), "=", inp("id")), sort: [{ sortBy: "created_at", dir: "asc" }, { sortBy: "id", dir: "asc" }], paging: { per_page: 100, metadata: false }, as: "events_raw" }),
    s.set_var("events", c.array([])),
    s.foreach({ list: ref("events_raw"), as: "ev", body: [
      s.db.get({ table: user, fieldValue: ref("ev.actor_id"), output: ["name"], as: "actor" }),
      s.update_var("events", withFilters(ref("events"), fl.array_push(obj({
        id: ref("ev.id"), action: ref("ev.action"), from_status: ref("ev.from_status"), to_status: ref("ev.to_status"),
        note: ref("ev.note"), created_at: ref("ev.created_at"), actor_name: ref("actor.name", { safe: true }),
      })))),
    ] }),
  ],
  response: { submission: ref("sub"), vendor: ref("vendor"), approvals: ref("approvals"), events: ref("events") },
  responseShape: {} as { submission: InferRow<typeof submissions>; vendor: InferRow<typeof vendors>; approvals: CaseStep[]; events: CaseEvent[] },
});

type VendorItem = InferRow<typeof vendors> & { latest_tier: string | null; latest_status: string | null };

/** Vendors, filterable by category and data access, paged, each with its latest submission's tier/status
 * (so a requester can check a vendor before re-filing). Anyone signed in. */
export const vendorList = query({
  name: "vendors", verb: "GET", apiGroup: onboarding, auth: user,
  input: { category: input.text(), data_access_level: input.text(), page: input.int(), per_page: input.int() },
  stack: [
    ...rbac.signedIn(),
    s.set_var("size", c.int(24)),
    s.conditional({ when: expr(inp("per_page"), ">", c.int(0)), then: [s.update_var("size", inp("per_page"))] }),
    s.conditional({ when: expr(ref("size"), ">", c.int(100)), then: [s.update_var("size", c.int(100))] }),
    s.db.query({
      table: vendors,
      where: [cmp(col("category"), "=", inp("category"), { ignoreEmpty: true }), cmp(col("data_access_level"), "=", inp("data_access_level"), { ignoreEmpty: true })],
      sort: [{ sortBy: "name", dir: "asc" }],
      paging: { page: inp("page"), per_page: ref("size"), metadata: true, totals: true },
      as: "page",
    }),
    s.set_var("items", c.array([])),
    s.foreach({ list: ref("page.items"), as: "v", body: [
      s.db.query({ table: submissions, where: expr(col("vendor_id"), "=", ref("v.id")), sort: [{ sortBy: "created_at", dir: "desc" }], returnType: "single", as: "latest" }),
      s.update_var("items", withFilters(ref("items"), fl.array_push(obj({
        id: ref("v.id"), name: ref("v.name"), category: ref("v.category"), country: ref("v.country"),
        annual_spend_band: ref("v.annual_spend_band"), data_access_level: ref("v.data_access_level"), submitted_by: ref("v.submitted_by"),
        latest_tier: ref("latest.risk_tier", { safe: true }), latest_status: ref("latest.status", { safe: true }),
      })))),
    ] }),
  ],
  response: { items: ref("items"), curPage: ref("page.curPage"), nextPage: ref("page.nextPage"), prevPage: ref("page.prevPage"), itemsTotal: ref("page.itemsTotal"), pageTotal: ref("page.pageTotal") },
  responseShape: {} as { items: VendorItem[]; curPage: number; nextPage: number | null; prevPage: number | null; itemsTotal: number; pageTotal: number },
});

/** The active rule set (version, attribute, match_value, points), the active version, and the review SLA,
 * so the UI can explain a score and show the governance settings. Reviewers and admins. */
export const rulesList = query({
  name: "rules", verb: "GET", apiGroup: onboarding, auth: user,
  stack: [
    ...rbac.require("submissions.read_all"),
    s.db.query({ table: risk_rules, where: expr(col("active"), "=", c.bool(true)), sort: [{ sortBy: "attribute", dir: "asc" }, { sortBy: "points", dir: "desc" }], paging: { per_page: 100, metadata: false }, as: "rules" }),
    s.db.query({ table: risk_rules, where: expr(col("active"), "=", c.bool(true)), output: ["version"], sort: [{ sortBy: "version", dir: "desc" }], returnType: "single", as: "vrow" }),
    ...readSla(),
  ],
  response: { rules: ref("rules"), version: withFilters(ref("vrow.version", { safe: true }), fl.first_notnull(c.int(0))), sla_days: ref("sla_days") },
  responseShape: {} as { rules: InferRow<typeof risk_rules>[]; version: number; sla_days: number },
});
