import { guard, inp, input, query, ref, s } from "@xano/sdk";
import { user } from "../../table/user.js";
import { demo_persona } from "../../base/tables.js";
import { Authentication } from "../authentication.js";

/** Public: the personas the sign-in screen offers. No secrets in it. */
export const demoPersonas = query({
  name: "auth/demo/personas", verb: "GET", apiGroup: Authentication,
  description: "The demo personas shown on the sign-in screen.",
  stack: [s.db.query({ table: demo_persona, output: ["key", "label", "description"], sort: [{ sortBy: "id", dir: "asc" }], as: "rows" })],
  response: ref("rows"),
});

/** Public: sign in as a demo persona. Mints a token only for an email listed in demo_persona. */
export const demoLogin = query({
  name: "auth/demo", verb: "POST", apiGroup: Authentication,
  description: "One-click demo sign-in. Delete the demo_persona rows to turn it off.",
  input: { persona: input.text({ required: true }) },
  stack: [
    s.db.get({ table: demo_persona, fieldName: "key", fieldValue: inp("persona"), as: "p" }),
    guard.found("p", { message: "Demo sign-in is off for that persona." }),
    s.db.get({ table: user, fieldName: "email", fieldValue: ref("p.email"), output: ["id", "name", "email", "role"], as: "u" }),
    guard.found("u", { message: "The demo account is not seeded." }),
    s.security.create_auth_token({ table: user, id: ref("u.id"), as: "authToken" }),
  ],
  response: { authToken: ref("authToken"), user_id: ref("u.id") },
});
