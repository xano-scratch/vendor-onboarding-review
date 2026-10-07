import { and, auth, c, cmp, col, expr, fl, guard, inp, input, obj, or, ref, s, tool, withFilters } from "@xano/sdk";
import { vendors } from "../../table/vendors.js";
import { risk_rules } from "../../table/risk_rules.js";
import { submissions } from "../../table/submissions.js";
import { required_approvals } from "../../table/required_approvals.js";
import { rbac } from "../../rbac.js";

const STATUS = ["submitted", "in_review", "blocked", "approved", "rejected"] as const;
const TIER = ["low", "medium", "high"] as const;

/** The rules that fire for a vendor's attributes (same match as score_vendor), for explain_score. */
const firedRules = () => s.db.query({
  table: risk_rules,
  where: [
    expr(col("active"), "=", c.bool(true)),
    or(
      and(expr(col("attribute"), "=", c.text("category")), expr(col("match_value"), "=", ref("v.category"))),
      and(expr(col("attribute"), "=", c.text("country")), expr(col("match_value"), "=", ref("v.country"))),
      and(expr(col("attribute"), "=", c.text("annual_spend_band")), expr(col("match_value"), "=", ref("v.annual_spend_band"))),
      and(expr(col("attribute"), "=", c.text("data_access_level")), expr(col("match_value"), "=", ref("v.data_access_level"))),
    ),
  ],
  output: ["attribute", "match_value", "points"], paging: { per_page: 50, metadata: false }, sort: [{ sortBy: "points", dir: "desc" }], as: "fired",
});

/** The open review queue by tier and status, with what is blocking each case. Reviewers and admins. */
export const queueSummaryTool = tool({
  name: "queue_summary", title: "Summarise the review queue",
  description: "Open vendor cases (or only one status or tier): vendor, risk tier, status and how many approvals are still outstanding. For 'what's in the queue' or 'what's blocked'. Reviewers and admins only.",
  annotations: { readOnlyHint: true },
  input: {
    status: input.enum([...STATUS], { description: "Only cases in this status." }),
    risk_tier: input.enum([...TIER], { description: "Only cases at this risk tier." }),
  },
  stack: [
    ...rbac.require("submissions.read_all"),
    s.db.query({ table: submissions, where: [cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }), cmp(col("risk_tier"), "=", inp("risk_tier"), { ignoreEmpty: true })], sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 20, metadata: false }, output: ["id", "vendor_id", "risk_tier", "status"], as: "rows" }),
    s.set_var("out", c.array([])),
    s.foreach({ list: ref("rows"), as: "row", body: [
      s.db.get({ table: vendors, fieldValue: ref("row.vendor_id"), output: ["name"], as: "v" }),
      s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", ref("row.id")), expr(col("status"), "=", c.text("pending"))], returnType: "count", as: "outstanding" }),
      s.update_var("out", withFilters(ref("out"), fl.array_push(obj({ vendor: ref("v.name", { safe: true }), tier: ref("row.risk_tier"), status: ref("row.status"), outstanding_approvals: ref("outstanding"), link: withFilters(c.text("/cases/"), fl.concat(ref("row.id"))) })))),
    ] }),
  ],
  response: ref("out"),
});

/** Find a case by vendor name or case id, scoped to what the person may see. Uses db.query + foreach so
 * loop items are never null (no maybe-null drilling). */
export const findCaseTool = tool({
  name: "find_case", title: "Find a case",
  description: "Find a vendor onboarding case by vendor name (q) or case id. Returns the case's tier, status, outstanding approvals and a link. A requester finds only their own cases.",
  annotations: { readOnlyHint: true },
  input: { q: input.text(), id: input.int() },
  stack: [
    ...rbac.signedIn(),
    s.set_var("results", c.array([])),
    s.conditional({
      when: expr(inp("id"), ">", c.int(0)),
      then: [
        s.db.query({ table: submissions, where: expr(col("id"), "=", inp("id")), paging: { per_page: 1, metadata: false }, as: "subs" }),
        s.foreach({ list: ref("subs"), as: "sub", body: [
          s.conditional({
            when: or(rbac.has(ref("me.role"), "submissions.read_all"), expr(ref("sub.submitted_by"), "=", auth("id"))),
            then: [
              s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), output: ["name"], as: "v" }),
              s.db.query({ table: required_approvals, where: [expr(col("submission_id"), "=", ref("sub.id")), expr(col("status"), "=", c.text("pending"))], returnType: "count", as: "outstanding" }),
              s.update_var("results", withFilters(ref("results"), fl.array_push(obj({ case_id: ref("sub.id"), vendor: ref("v.name", { safe: true }), tier: ref("sub.risk_tier"), status: ref("sub.status"), outstanding_approvals: ref("outstanding"), link: withFilters(c.text("/cases/"), fl.concat(ref("sub.id"))) })))),
            ],
          }),
        ] }),
      ],
      else: [
        s.db.query({ table: vendors, where: cmp(col("name"), "includes", inp("q"), { ignoreEmpty: true }), paging: { per_page: 8, metadata: false }, output: ["id", "name"], as: "vlist" }),
        s.foreach({ list: ref("vlist"), as: "vv", body: [
          s.db.query({ table: submissions, where: expr(col("vendor_id"), "=", ref("vv.id")), sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 1, metadata: false }, as: "latest" }),
          s.foreach({ list: ref("latest"), as: "sub", body: [
            s.conditional({
              when: or(rbac.has(ref("me.role"), "submissions.read_all"), expr(ref("sub.submitted_by"), "=", auth("id"))),
              then: [s.update_var("results", withFilters(ref("results"), fl.array_push(obj({ case_id: ref("sub.id"), vendor: ref("vv.name"), tier: ref("sub.risk_tier"), status: ref("sub.status"), link: withFilters(c.text("/cases/"), fl.concat(ref("sub.id"))) }))))],
            }),
          ] }),
        ] }),
      ],
    }),
  ],
  response: ref("results"),
});

/** Explain why a case got its tier: which active rules fired, the points, and the deciding version. */
export const explainScoreTool = tool({
  name: "explain_score", title: "Explain a case's risk score",
  description: "Explain why one case got its risk tier: the active rules that fired, their points, and the deciding rule version. Give it a case id. A requester may only ask about their own cases.",
  annotations: { readOnlyHint: true },
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.signedIn(),
    s.db.get({ table: submissions, fieldValue: inp("id"), as: "sub" }),
    guard.found("sub", { message: "No such case." }),
    s.conditional({ when: rbac.lacks(ref("me.role"), "submissions.read_all"), then: [guard.require(expr(ref("sub.submitted_by"), "=", auth("id")), { errorType: "notfound", message: "No such case." })] }),
    s.db.get({ table: vendors, fieldValue: ref("sub.vendor_id"), as: "v" }),
    guard.found("v", { message: "The vendor record is missing." }),
    firedRules(),
    s.array.map({ source: ref("fired"), as: "matched_rules", transform: { attribute: ref("$this.attribute"), value: ref("$this.match_value"), points: ref("$this.points") } }),
  ],
  response: obj({ case_id: ref("sub.id"), vendor: ref("v.name"), tier: ref("sub.risk_tier"), score: ref("sub.risk_score"), deciding_version: ref("sub.rule_version"), matched_rules: ref("matched_rules") }),
});

export const onboardingAssistantTools = [queueSummaryTool, findCaseTool, explainScoreTool];
