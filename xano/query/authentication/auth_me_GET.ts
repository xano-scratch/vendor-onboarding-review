import { auth, c, query, ref, s } from "@xano/sdk";
import { Getting_Started_Template_create_event_log } from "../../_shared.js";
import { user } from "../../table/user.js";
import { Authentication } from "../authentication.js";

// query "auth/me" — generated from a Xano bundle.
export const auth_me = query({
  name: "auth/me",
  guid: "8e64176a70b122ffed0ce68ceed6b9ce",
  verb: "GET",
  description: "Get the user record belonging to the authentication token",
  auth: user,
  apiGroup: Authentication,
  tags: [
    "xano:quick-start",
  ],
  response: ref("user"),
  stack: [
    s.db.get({
      table: user,
      fieldValue: auth("id"),
      output: [
        "id",
        "created_at",
        "name",
        "email",
        "account_id",
        "role",
      ],
      as: "user",
    }),
    s.function.run({
      fn: Getting_Started_Template_create_event_log,
      as: "event_log",
      input: {
        user_id: ref("user.id"),
        account_id: ref("user.account_id"),
        action: c.text("get_auth_user"),
        metadata: ref("user"),
      },
    }),
  ],
});
