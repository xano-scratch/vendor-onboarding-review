import { table, f } from "@xanots/sdk";

import { SEED_RULES } from "../seed-data.js";

// The versioned scoring rule set. A rule fires when the vendor's `attribute`
// column equals `match_value`; its `points` add to the risk score. Marking a new
// version `active` and the old one inactive is how the rules are governed over
// time, and each submission records the `version` that decided its tier.
export const risk_rules = table({
  name: "risk_rules",
  schema: {
    version: f.int({ required: true }),
    attribute: f.text({ required: true }),
    match_value: f.text({ required: true }),
    points: f.int({ required: true }),
    active: f.bool({ required: true }),
  },
  index: [{ type: "btree", fields: [{ name: "active" }] }],
  seed: SEED_RULES,
});
