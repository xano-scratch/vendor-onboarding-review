import { table, f } from "@xanots/sdk";

import { SEED_USERS } from "../seed-data.js";

// The auth table. Role backs native, API-layer RBAC (never row-level security):
// each endpoint reads the caller's role and gates the action with s.precondition.
export const users = table({
  name: "users",
  auth: true,
  // `id` (int PK) + `created_at` (epochms) are auto-injected.
  schema: {
    name: f.text({ required: true }),
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    role: f.enum(["requester", "approver", "admin"], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
  seed: SEED_USERS,
});
