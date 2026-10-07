// The base app's Xano tests, shipped in every template and run by `deploy --test` (STANDARDS.md "Every module
// proves itself"). Each makes its own people: a test run starts with an empty database.
import { c, ref, s, workflowTest } from "@xano/sdk";
import { ROLES, SIGNUP_ROLE } from "../app.js";
import { user } from "../table/user.js";
import { access_link, notification } from "./tables.js";
import { notifyFn } from "./functions.js";
import { acceptLink, checkLink } from "../query/authentication/links.js";

const FAR = Date.UTC(2099, 0, 1);
// The tokens and their SHA-256 (hex, what fl.sha256 gives), so a test can hold the token the app never stores.
const INVITE = { token: "base-test-invite", hash: "b99698882b8d2f10d2b6168fae69c3b1a089fe5582c1f722121a4a42966345be" };
const RESET = { token: "base-test-reset", hash: "2f01ac66df420f7620c1663868130b4f5301f075562d35f5a8046b71f6e61f9d" };

const person = (key: string, role: string) => s.db.add({ table: user, as: key, row: {
  name: c.text(`Test ${key}`), email: c.text(`${key}@base-test.example`), password: c.text("Base-test-1"), role: c.text(role),
} });

export const baseTests = [
  workflowTest({
    name: "base: an invite link signs a new person in, once",
    description: "An admin's invite: the link says what it's for, accepting makes the account with the invited role and notifies the admin, and a second use is refused.",
    stack: [
      person("admin", ROLES[0]),
      s.db.add({ table: access_link, as: "link", row: {
        kind: c.text("invite"), email: c.text("joiner@base-test.example"), name: c.text("Jo Joiner"), role: c.text(SIGNUP_ROLE),
        token_hash: c.text(INVITE.hash), expires_at: c.int(FAR), revoked: c.bool(false), created_by: ref("admin.id"),
      } }),
      s.api.call({ api: checkLink, input: { token: c.text(INVITE.token) }, as: "check" }),
      s.expect.to_equal({ expr: ref("check.kind"), value: c.text("invite") }),
      s.api.call({ api: acceptLink, input: { token: c.text(INVITE.token), name: c.text("Jo Joiner"), password: c.text("Joined-in-1") }, as: "joined" }),
      s.expect.to_be_defined({ expr: ref("joined.authToken") }),
      s.db.get({ table: user, fieldName: "email", fieldValue: c.text("joiner@base-test.example"), as: "jo" }),
      s.expect.to_equal({ expr: ref("jo.role"), value: c.text(SIGNUP_ROLE) }),
      s.db.get({ table: notification, fieldName: "user_id", fieldValue: ref("admin.id"), as: "told" }),
      s.expect.to_be_defined({ expr: ref("told.id") }),
      s.api.call({ api: acceptLink, input: { token: c.text(INVITE.token), name: c.text("Jo Again"), password: c.text("Joined-in-2") }, as: "again" }),
      s.expect.to_contain({ expr: ref("again.message"), value: c.text("already used") }),
    ],
  }),
  workflowTest({
    name: "base: a reset link works once, and an unknown link does nothing",
    stack: [
      person("admin", ROLES[0]),
      person("forgetful", SIGNUP_ROLE),
      s.db.add({ table: access_link, as: "link", row: {
        kind: c.text("reset"), email: c.text("forgetful@base-test.example"), user_id: ref("forgetful.id"),
        token_hash: c.text(RESET.hash), expires_at: c.int(FAR), revoked: c.bool(false), created_by: ref("admin.id"),
      } }),
      s.api.call({ api: acceptLink, input: { token: c.text(RESET.token), password: c.text("Remembered-9") }, as: "reset" }),
      s.expect.to_be_defined({ expr: ref("reset.authToken") }),
      s.expect.to_equal({ expr: ref("reset.user_id"), value: ref("forgetful.id") }),
      // Signing in with the new password is proven over HTTP (modules/lab test/modules.test.mjs).
      s.db.get({ table: access_link, fieldValue: ref("link.id"), as: "spent" }),
      s.expect.to_not_be_null({ expr: ref("spent.used_at") }),
      s.api.call({ api: acceptLink, input: { token: c.text(RESET.token), password: c.text("Remembered-10") }, as: "twice" }),
      s.expect.to_contain({ expr: ref("twice.message"), value: c.text("already used") }),
      s.api.call({ api: acceptLink, input: { token: c.text("no-such-link"), password: c.text("Whatever-9") }, as: "nope" }),
      s.expect.to_contain({ expr: ref("nope.message"), value: c.text("isn't valid") }),
    ],
  }),
  workflowTest({
    name: "base: a notification reaches its person, never the person who caused it",
    stack: [
      person("actor", ROLES[0]),
      person("other", SIGNUP_ROLE),
      s.function.call({ fn: notifyFn, as: "self", input: { user_id: ref("actor.id"), title: c.text("Self"), actor_id: ref("actor.id"), kind: c.text(""), body: c.text(""), link: c.text("") } }),
      s.db.get({ table: notification, fieldName: "user_id", fieldValue: ref("actor.id"), as: "mine" }),
      s.expect.to_be_null({ expr: ref("mine") }),
      s.function.call({ fn: notifyFn, as: "sent", input: { user_id: ref("other.id"), title: c.text("For you"), actor_id: ref("actor.id"), kind: c.text("test"), body: c.text(""), link: c.text("/") } }),
      s.db.get({ table: notification, fieldName: "user_id", fieldValue: ref("other.id"), as: "theirs" }),
      s.expect.to_equal({ expr: ref("theirs.title"), value: c.text("For you") }),
    ],
  }),
];
