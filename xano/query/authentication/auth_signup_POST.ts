import { c, expr, inp, input, obj, query, ref, s } from "@xano/sdk";
import { SIGNUP_ROLE } from "../../app.js";
import { Getting_Started_Template_create_event_log } from "../../_shared.js";
import { user } from "../../table/user.js";
import { Authentication } from "../authentication.js";

// query "auth/signup" — generated from a Xano bundle.
export const auth_signup = query({
  name: "auth/signup",
  guid: "ad508f9d25b77a54e415db5c45d0d8d0",
  verb: "POST",
  description: "Signup and retrieve an authentication token",
  apiGroup: Authentication,
  tags: [
    "xano:quick-start",
  ],
  input: {
    name: input.text(),
    email: input.email({
      methods: [
        "trim",
        "lower",
      ],
    }),
    password: input.text(),
  },
  response: {
    authToken: ref("authToken"),
    user_id: ref("user.id"),
  },
  stack: [
    s.db.get({
      table: user,
      fieldName: "email",
      fieldValue: inp("email"),
      as: "user",
    }),
    s.precondition({
      expr: expr(ref("user"), "=", c.null()),
      error_type: "accessdenied",
      error: c.text("This account is already in use."),
    }),
    s.db.add({
      table: user,
      data: [
        {
          name: "created_at",
          value: c.text("now"),
        },
        {
          name: "name",
          value: inp("name"),
        },
        {
          name: "email",
          value: inp("email"),
        },
        {
          name: "password",
          value: inp("password"),
        },
        {
          name: "role",
          value: c.text(SIGNUP_ROLE),
        },
      ],
      as: "user",
    }),
    s.security.create_auth_token({
      table: user,
      id: ref("user.id"),
      extras: c.obj({}),
      expiration: c.int(86400),
      as: "authToken",
    }),
    s.function.run({
      fn: Getting_Started_Template_create_event_log,
      as: "event_log",
      input: {
        user_id: ref("user.id"),
        account_id: c.int(0),
        action: c.text("signup"),
        metadata: obj({
          id: ref("user.id"),
          created_at: ref("user.created_at"),
          name: ref("user.name"),
          email: ref("user.email"),
          account_id: ref("user.account_id"),
          role: ref("user.role"),
        }),
      },
    }),
  ],
});
