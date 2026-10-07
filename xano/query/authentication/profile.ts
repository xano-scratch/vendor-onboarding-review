// The profile endpoints every template ships beside the ejected auth (AUTH.md §7): rename yourself, and
// change your password with the current one. In the Authentication group, so request history stays off.
import { auth, c, expr, fl, guard, inp, input, obj, query, ref, s, withFilters } from "@xano/sdk";
import { user } from "../../table/user.js";
import { Authentication } from "../authentication.js";

/** PATCH auth/me: change your own name. Answers with the same fields as auth/me. */
export const updateMe = query({
  name: "auth/me", verb: "PATCH", apiGroup: Authentication, auth: user,
  description: "Change the signed-in person's name.",
  input: { name: input.text({ required: true, methods: ["trim"] }) },
  stack: [
    guard.require(expr(withFilters(inp("name"), fl.strlen()), ">=", c.int(1)), { errorType: "badrequest", message: "Your name can't be empty." }),
    guard.require(expr(withFilters(inp("name"), fl.strlen()), "<=", c.int(80)), { errorType: "badrequest", message: "Keep your name under 80 characters." }),
    s.db.patch({ table: user, fieldValue: auth("id"), data: obj({ name: inp("name") }) }),
    s.db.get({ table: user, fieldValue: auth("id"), output: ["id", "created_at", "name", "email", "role"], as: "me" }),
  ],
  response: ref("me"),
});

/**
 * POST auth/me/password: change your password, proving the current one first. The same rules as signup
 * (8+ characters, a letter and a digit); the column hashes it on write.
 */
export const changePassword = query({
  name: "auth/me/password", verb: "POST", apiGroup: Authentication, auth: user,
  description: "Change the signed-in person's password; the current one is required.",
  input: { current_password: input.text({ required: true }), new_password: input.text({ required: true }) },
  stack: [
    s.db.get({ table: user, fieldValue: auth("id"), output: ["id", "password"], as: "me" }),
    guard.found("me", { errorType: "unauthorized", message: "Sign in again." }),
    s.security.check_password({ text_password: inp("current_password"), hash_password: ref("me.password"), as: "ok" }),
    guard.require(expr(ref("ok"), "=", c.bool(true)), { errorType: "accessdenied", message: "Your current password isn't right." }),
    guard.require(expr(withFilters(inp("new_password"), fl.strlen()), ">=", c.int(8)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
    guard.require(expr(withFilters(c.regex(/[A-Za-z]/), fl.regex_test(inp("new_password"))), "=", c.bool(true)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
    guard.require(expr(withFilters(c.regex(/[0-9]/), fl.regex_test(inp("new_password"))), "=", c.bool(true)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
    guard.require(expr(inp("new_password"), "!=", inp("current_password")), { errorType: "badrequest", message: "Pick a password you haven't just used." }),
    s.db.patch({ table: user, fieldValue: auth("id"), data: obj({ password: inp("new_password") }) }),
  ],
  response: { changed: c.bool(true) },
});
