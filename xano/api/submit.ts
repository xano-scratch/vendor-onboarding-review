import { query, input, s, ref, inp, auth, col, c, expr } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";
import { vendors } from "../tables/vendors.js";
import { submissions } from "../tables/submissions.js";
import { required_approvals } from "../tables/required_approvals.js";
import { scoreVendor } from "../functions/score_vendor.js";
import { deriveApprovals, auditEvent } from "./_derive.js";

// POST onboarding/submissions — requester and up (any signed-in user). Create the
// vendor from the intake form, score it against the active rules, open the case,
// and DERIVE the required-approval set from the tier. One readable place holds
// the whole "submit a vendor" rule.
export const submitQuery = query({
  name: "submissions",
  verb: "POST",
  apiGroup: onboarding,
  auth: users,
  input: {
    name: input.text({ required: true }),
    category: input.enum(["software", "hardware", "services", "data_processor"], { required: true }),
    country: input.text({ required: true }),
    tax_id: input.text({ required: true }),
    annual_spend_band: input.enum(["low", "mid", "high"], { required: true }),
    data_access_level: input.enum(["none", "internal", "pii"], { required: true }),
  },
  stack: [
    s.db.add({
      table: vendors,
      row: {
        name: inp("name"),
        category: inp("category"),
        country: inp("country"),
        tax_id: inp("tax_id"),
        annual_spend_band: inp("annual_spend_band"),
        data_access_level: inp("data_access_level"),
      },
      as: "vendor",
    }),
    s.function.run({ fn: scoreVendor, input: { vendor_id: ref("vendor.id") }, as: "scored" }),
    s.db.add({
      table: submissions,
      row: {
        vendor_id: ref("vendor.id"),
        status: "submitted",
        risk_score: ref("scored.score"),
        risk_tier: ref("scored.tier"),
        rule_version: ref("scored.version"),
        submitted_by: auth("id"),
      },
      as: "submission",
    }),
    deriveApprovals(ref("submission.id"), ref("scored.tier")),
    auditEvent({
      submissionId: ref("submission.id"),
      actorId: auth("id"),
      action: "submit",
      fromStatus: "",
      toStatus: "submitted",
      note: "Vendor submitted for onboarding review",
    }),
    s.db.query({
      table: required_approvals,
      where: expr(col("submission_id"), "=", ref("submission.id")),
      sort: [{ sortBy: "sequence", dir: "asc" }],
      as: "approvals",
    }),
  ],
  response: {
    submission: ref("submission"),
    risk_score: ref("scored.score"),
    risk_tier: ref("scored.tier"),
    rule_version: ref("scored.version"),
    required_approvals: ref("approvals"),
  },
});
