import { f, table } from "@xano/sdk";
import { RULES } from "./_seed-data.js";

/** The versioned scoring set. The rule that decides a tier lives here, so a reviewer can audit which
 * version decided a past case. One version is active at a time; old versions are kept inactive. */
export const risk_rules = table({
  name: "risk_rules",
  description: "The versioned risk scoring rules. A rule adds points when a vendor attribute matches its value.",
  schema: {
    version: f.int({ required: true }),
    attribute: f.enum(["category", "country", "annual_spend_band", "data_access_level"], { required: true }),
    match_value: f.text({ required: true }),
    points: f.int({ required: true }),
    active: f.bool(),
  },
  index: [{ type: "btree", fields: [{ name: "version", op: "asc" }] }],
  seed: RULES,
});
