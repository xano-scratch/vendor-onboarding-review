import { f, table } from "@xano/sdk";
import { account } from "./account.js";
import { user } from "./user.js";

// table "event_log" — generated from a Xano bundle.
export const event_log = table({
  name: "event_log",
  guid: "e9148697952846994def7eb0a467d6cd",
  description: "Stores logs of user activities and events within the application.",
  schema: {
    id: f.int({
      required: true,
    }),
    created_at: f.timestamp({
      default: "now",
      access: "private",
    }),
    user_id: f.tableRef(user, {
      description: "Reference to the user who performed the action.",
    }),
    account_id: f.tableRef(account, {
      description: "Reference to the company associated with the user event.",
    }),
    action: f.text({
      description: "A description of the action performed by the user (e.g., 'login', 'created_invoice', 'updated_profile').",
      methods: [
        "trim",
      ],
    }),
    metadata: f.json({
      description: "Additional data related to the event, such as resource IDs, old/new values, or other contextual information.",
    }),
  },
  useXdo: true,
  tags: [
    "xano:quick-start",
  ],
});
