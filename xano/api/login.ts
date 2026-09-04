import { query, input, s, ref, inp, c, expr, obj } from "@xanots/sdk";

import { onboarding } from "./onboarding.js";
import { users } from "../tables/users.js";

// POST onboarding/auth/login — public. Mint an auth token for a seeded user. The
// caller's role rides in the users table and every other endpoint reads it, so
// this is the entry point to the whole governed flow.
export const loginQuery = query({
  name: "auth/login",
  verb: "POST",
  apiGroup: onboarding,
  auth: false,
  input: {
    // Plaintext password (input.text, NOT input.password) so check_password does
    // the one and only hash — input.password would double-hash and never match.
    email: input.text({ required: true, methods: ["trim", "lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: users,
      fieldName: "email",
      fieldValue: inp("email"),
      // `output` overrides visibility so we can read the internal password hash.
      output: ["id", "name", "email", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u"), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("Invalid email or password"),
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error_type: "unauthorized",
      error: c.text("Invalid email or password"),
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    authToken: ref("token"),
    user: obj({
      id: ref("u.id"),
      name: ref("u.name"),
      email: ref("u.email"),
      role: ref("u.role"),
    }),
  },
});
