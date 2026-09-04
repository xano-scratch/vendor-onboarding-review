import { defineFunction, input, s, ref, inp, col, c, and, or, expr, withFilters, fl } from "@xanots/sdk";

import { vendors } from "../tables/vendors.js";
import { risk_rules } from "../tables/risk_rules.js";
import { TIER_HIGH_AT, TIER_MEDIUM_AT } from "../seed-data.js";

// The one governed scoring rule, centralized so both submit and rescore decide a
// tier the exact same way. Given a vendor, it sums the points of every ACTIVE
// risk rule whose (attribute, match_value) matches one of the vendor's fields,
// then maps that score to a tier. It also reports the active rule version, so a
// submission can record which version of the rules decided it.
export const scoreVendor = defineFunction({
  name: "score_vendor",
  input: { vendor_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: vendors, id: inp("vendor_id"), as: "vendor" }),
    s.precondition({
      expr: expr(ref("vendor"), "!=", c.null()),
      error_type: "notfound",
      error: c.text("Vendor not found"),
    }),
    // Record the active rule version (guarded existence, then drill).
    s.db.query({
      table: risk_rules,
      where: expr(col("active"), "=", c.bool(true)),
      returnType: "single",
      as: "active_rule",
    }),
    s.conditional({
      when: expr(ref("active_rule"), "!=", c.null()),
      then: [s.set_var("version", ref("active_rule.version"))],
      else: [s.set_var("version", c.int(0))],
    }),
    // Every active rule that matches one of this vendor's attributes.
    s.db.query({
      table: risk_rules,
      where: and(
        expr(col("active"), "=", c.bool(true)),
        or(
          and(expr(col("attribute"), "=", c.text("data_access_level")), expr(col("match_value"), "=", ref("vendor.data_access_level"))),
          and(expr(col("attribute"), "=", c.text("annual_spend_band")), expr(col("match_value"), "=", ref("vendor.annual_spend_band"))),
          and(expr(col("attribute"), "=", c.text("category")), expr(col("match_value"), "=", ref("vendor.category"))),
          and(expr(col("attribute"), "=", c.text("country")), expr(col("match_value"), "=", ref("vendor.country"))),
        ),
      ),
      as: "matched",
    }),
    // Sum the matched rules' points → the risk score.
    s.array.map({ source: ref("matched"), transform: ref("$this.points"), as: "points_list" }),
    s.set_var("score", withFilters(ref("points_list"), fl.sum(), fl.to_int())),
    // Map the score to a tier.
    s.conditional({
      when: expr(ref("score"), ">=", c.int(TIER_HIGH_AT)),
      then: [s.set_var("tier", c.text("high"))],
      elif: [{ when: expr(ref("score"), ">=", c.int(TIER_MEDIUM_AT)), then: [s.set_var("tier", c.text("medium"))] }],
      else: [s.set_var("tier", c.text("low"))],
    }),
  ],
  response: { score: ref("score"), tier: ref("tier"), version: ref("version") },
});
