import { f, table } from "@xano/sdk";
import { user } from "./user.js";
import { VENDORS } from "./_seed-data.js";

/** A vendor under consideration: the subject of an onboarding case. Its attributes drive the risk score. */
export const vendors = table({
  name: "vendors",
  description: "A vendor under consideration. Its category, country, spend band and data access drive the risk score.",
  schema: {
    name: f.text({ required: true }),
    category: f.enum(["software", "hardware", "services", "data_processor"], { required: true }),
    country: f.text(),
    annual_spend_band: f.enum(["low", "mid", "high"], { required: true }),
    data_access_level: f.enum(["none", "internal", "pii"], { required: true }),
    /** Who first filed this vendor. */
    submitted_by: f.tableRef(user, { required: true }),
  },
  index: [
    { type: "btree", fields: [{ name: "category", op: "asc" }] },
    { type: "btree", fields: [{ name: "data_access_level", op: "asc" }] },
  ],
  seed: VENDORS,
});
