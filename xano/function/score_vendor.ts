import { and, c, col, defineFunction, expr, fl, inp, input, or, ref, s, withFilters } from "@xano/sdk";
import { risk_rules } from "../table/risk_rules.js";

/**
 * The one scoring rule, in one place. Sums the points of the ACTIVE risk_rules whose attribute/match_value
 * match a vendor's attributes, maps the total to a tier, and returns the deciding rule version. Called by
 * both submit and rescore, so the rule that decides a tier lives in exactly one governed place.
 * Illustrative thresholds: < 20 low, 20–59 medium, 60+ high.
 */
export const scoreVendor = defineFunction({
  name: "onboarding/score_vendor",
  input: {
    category: input.text({ required: true }),
    country: input.text(),
    annual_spend_band: input.text({ required: true }),
    data_access_level: input.text({ required: true }),
  },
  stack: [
    // The active rule version (every active rule carries it); 0 only if no rules are active.
    s.db.query({ table: risk_rules, where: expr(col("active"), "=", c.bool(true)), sort: [{ sortBy: "version", dir: "desc" }], output: ["version"], returnType: "single", as: "vrow" }),
    s.set_var("rule_version", withFilters(ref("vrow.version", { safe: true }), fl.first_notnull(c.int(0)))),
    // The active rules that fire for this vendor's four attributes.
    s.db.query({
      table: risk_rules,
      where: [
        expr(col("active"), "=", c.bool(true)),
        or(
          and(expr(col("attribute"), "=", c.text("category")), expr(col("match_value"), "=", inp("category"))),
          and(expr(col("attribute"), "=", c.text("country")), expr(col("match_value"), "=", inp("country"))),
          and(expr(col("attribute"), "=", c.text("annual_spend_band")), expr(col("match_value"), "=", inp("annual_spend_band"))),
          and(expr(col("attribute"), "=", c.text("data_access_level")), expr(col("match_value"), "=", inp("data_access_level"))),
        ),
      ],
      output: ["points"],
      paging: { per_page: 200, metadata: false },
      as: "matched",
    }),
    s.array.map({ source: ref("matched"), as: "points_list", transform: ref("$this.points") }),
    s.set_var("score", withFilters(ref("points_list"), fl.sum())),
    s.set_var("tier", c.text("low")),
    s.conditional({ when: expr(ref("score"), ">=", c.int(20)), then: [s.update_var("tier", c.text("medium"))] }),
    s.conditional({ when: expr(ref("score"), ">=", c.int(60)), then: [s.update_var("tier", c.text("high"))] }),
  ],
  response: { score: ref("score"), tier: ref("tier"), rule_version: ref("rule_version") },
});
