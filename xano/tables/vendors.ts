import { table, f } from "@xanots/sdk";

import { SEED_VENDORS } from "../seed-data.js";

// The subject of an onboarding case. Its attributes feed the risk score.
export const vendors = table({
  name: "vendors",
  schema: {
    name: f.text({ required: true }),
    category: f.enum(["software", "hardware", "services", "data_processor"], { required: true }),
    country: f.text({ required: true }),
    tax_id: f.text({ required: true }),
    annual_spend_band: f.enum(["low", "mid", "high"], { required: true }),
    data_access_level: f.enum(["none", "internal", "pii"], { required: true }),
  },
  seed: SEED_VENDORS,
});
