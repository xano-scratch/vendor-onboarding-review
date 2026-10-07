// One-time links (BASELINE.md "Team"): an admin invites someone with a role, or issues a password-reset link,
// and the person opens /join/<token> to set their password and sign in. No email is needed: the admin copies
// the link and sends it however they like. Only a SHA-256 of the token is stored, the token is shown once, and
// every endpoint here is in the Authentication group, where request history is off.
import { auth, c, cmp, col, expr, fl, guard, inp, input, obj, query, ref, s, statements, withFilters } from "@xano/sdk";
import { ROLES } from "../../app.js";
import { user } from "../../table/user.js";
import { rbac } from "../../rbac.js";
import { access_link, DAY } from "../../base/tables.js";
import { changed, notify } from "../../base/functions.js";
import { Authentication } from "../authentication.js";

/** The same rules as signup and the profile page: 8+ characters, a letter and a digit. */
const passwordRules = (name: string) => statements(
  guard.require(expr(withFilters(inp(name), fl.strlen()), ">=", c.int(8)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
  guard.require(expr(withFilters(c.regex(/[A-Za-z]/), fl.regex_test(inp(name))), "=", c.bool(true)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
  guard.require(expr(withFilters(c.regex(/[0-9]/), fl.regex_test(inp(name))), "=", c.bool(true)), { errorType: "badrequest", message: "Use at least 8 characters, with a letter and a number." }),
);

/** A fresh token, its hash, and when it expires. Binds `token`, `token_hash`, `expires_at`. */
const mint = (days: number) => statements(
  s.security.create_uuid({ as: "token" }),
  s.set_var("token_hash", withFilters(ref("token"), fl.sha256())),
  s.set_var("now", c.now()),
  s.set_var("expires_at", withFilters(ref("now"), fl.add(c.int(days * DAY)))),
);

/** Loads a usable link by its token into `link`: 404 when unknown, used, revoked or expired. */
const usableLink = (lock = false) => statements(
  s.db.get({ table: access_link, fieldName: "token_hash", fieldValue: withFilters(inp("token"), fl.sha256()), lock, as: "link" }),
  guard.found("link", { message: "This link isn't valid. Ask for a new one." }),
  guard.require(expr(ref("link.used_at"), "=", c.null()), { errorType: "notfound", message: "This link was already used. Sign in, or ask for a new one." }),
  guard.require(expr(ref("link.revoked"), "!=", c.bool(true)), { errorType: "notfound", message: "This link was withdrawn. Ask for a new one." }),
  guard.require(expr(ref("link.expires_at"), ">", c.now()), { errorType: "notfound", message: "This link has expired. Ask for a new one." }),
);

/** GET auth/invites: invites still waiting to be accepted. team.manage. */
export const listInvites = query({
  name: "auth/invites", verb: "GET", apiGroup: Authentication, auth: user,
  description: "Invites waiting to be accepted.",
  stack: [
    ...rbac.require("team.manage", "Only people who manage the team see invites."),
    s.db.query({ table: access_link,
      where: [expr(col("kind"), "=", c.text("invite")), cmp(col("used_at"), "=", c.null()), expr(col("revoked"), "!=", c.bool(true)), expr(col("expires_at"), ">", c.now())],
      output: ["id", "email", "name", "role", "expires_at", "created_at", "created_by"], sort: [{ sortBy: "created_at", dir: "desc" }],
      paging: { per_page: 100, metadata: false }, as: "rows" }),
  ],
  response: ref("rows"),
  responseShape: [] as { id: number; email: string; name: string; role: (typeof ROLES)[number]; expires_at: number; created_at: number; created_by: number }[],
});

/**
 * POST auth/invites: invite someone by email with a role. Returns the token ONCE (the app turns it into a
 * /join link to copy). Inviting the same email again withdraws the earlier link. team.manage.
 */
export const createInvite = query({
  name: "auth/invites", verb: "POST", apiGroup: Authentication, auth: user,
  description: "Invite someone with a role. The link is shown once; it works for 7 days.",
  input: { email: input.email({ required: true, methods: ["trim", "lower"] }), name: input.text({ methods: ["trim"] }), role: input.enum([...ROLES], { required: true }) },
  stack: [
    ...rbac.require("team.manage", "Only people who manage the team invite people."),
    s.db.get({ table: user, fieldName: "email", fieldValue: inp("email"), output: ["id"], as: "existing" }),
    guard.require(expr(ref("existing"), "=", c.null()), { errorType: "badrequest", message: "That person already has an account." }),
    s.db.query({ table: access_link, where: [expr(col("email"), "=", inp("email")), expr(col("kind"), "=", c.text("invite")), cmp(col("used_at"), "=", c.null())],
      output: ["id"], paging: { per_page: 50, metadata: false }, as: "earlier" }),
    s.foreach({ list: ref("earlier"), as: "old", body: [s.db.patch({ table: access_link, fieldValue: ref("old.id"), data: obj({ revoked: c.bool(true) }) })] }),
    ...mint(7),
    s.db.add({ table: access_link, as: "invite", row: {
      kind: c.text("invite"), email: inp("email"), name: inp("name"), role: inp("role"),
      token_hash: ref("token_hash"), expires_at: ref("expires_at"), revoked: c.bool(false), created_by: auth("id"),
    } }),
    changed({ entity: "invite", id: ref("invite.id"), op: "created", verb: "invited", link: "/team", privateTo: auth("id"),
      title: withFilters(c.text("invited "), fl.concat(inp("email")), fl.concat(c.text(" as ")), fl.concat(inp("role"))) }),
  ],
  response: { id: ref("invite.id"), token: ref("token"), email: inp("email"), role: inp("role"), expires_at: ref("expires_at") },
  responseShape: {} as { id: number; token: string; email: string; role: (typeof ROLES)[number]; expires_at: number },
});

/** POST auth/invites/{id}/revoke: withdraw an invite; its link stops working at once. team.manage. */
export const revokeInvite = query({
  name: "auth/invites/{id}/revoke", verb: "POST", apiGroup: Authentication, auth: user,
  description: "Withdraw an invite.",
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.require("team.manage", "Only people who manage the team withdraw invites."),
    s.db.get({ table: access_link, fieldValue: inp("id"), output: ["id", "kind", "used_at"], as: "link" }),
    guard.found("link", { message: "No such invite." }),
    guard.require(expr(ref("link.kind"), "=", c.text("invite")), { errorType: "notfound", message: "No such invite." }),
    guard.require(expr(ref("link.used_at"), "=", c.null()), { errorType: "badrequest", message: "That invite was already accepted." }),
    s.db.patch({ table: access_link, fieldValue: inp("id"), data: obj({ revoked: c.bool(true) }) }),
  ],
  response: { id: inp("id"), revoked: c.bool(true) },
});

/**
 * POST auth/people/{id}/reset-link: a one-time link for someone who forgot their password (24 hours). Not for
 * yourself: Profile changes your own. team.manage.
 */
export const createResetLink = query({
  name: "auth/people/{id}/reset-link", verb: "POST", apiGroup: Authentication, auth: user,
  description: "A one-time password-reset link for another person, shown once; it works for 24 hours.",
  input: { id: input.int({ required: true }) },
  stack: [
    ...rbac.require("team.manage", "Only people who manage the team issue reset links."),
    guard.require(expr(inp("id"), "!=", auth("id")), { errorType: "badrequest", message: "Change your own password under Profile." }),
    s.db.get({ table: user, fieldValue: inp("id"), output: ["id", "name", "email"], as: "person" }),
    guard.found("person", { message: "No such person." }),
    s.db.query({ table: access_link, where: [expr(col("user_id"), "=", inp("id")), expr(col("kind"), "=", c.text("reset")), cmp(col("used_at"), "=", c.null())],
      output: ["id"], paging: { per_page: 50, metadata: false }, as: "earlier" }),
    s.foreach({ list: ref("earlier"), as: "old", body: [s.db.patch({ table: access_link, fieldValue: ref("old.id"), data: obj({ revoked: c.bool(true) }) })] }),
    ...mint(1),
    s.db.add({ table: access_link, as: "reset", row: {
      kind: c.text("reset"), email: ref("person.email"), name: ref("person.name"), user_id: inp("id"),
      token_hash: ref("token_hash"), expires_at: ref("expires_at"), revoked: c.bool(false), created_by: auth("id"),
    } }),
  ],
  response: { token: ref("token"), name: ref("person.name"), expires_at: ref("expires_at") },
  responseShape: {} as { token: string; name: string; expires_at: number },
});

/** POST auth/link: what a link is for, before the person sets a password. Public; nothing secret in it. */
export const checkLink = query({
  name: "auth/link", verb: "POST", apiGroup: Authentication,
  description: "Public: what an invite or reset link is for (404 when it can't be used).",
  input: { token: input.text({ required: true }) },
  stack: [
    ...usableLink(),
    s.db.get({ table: user, fieldValue: ref("link.created_by"), output: ["name"], as: "from" }),
  ],
  response: { kind: ref("link.kind"), email: ref("link.email"), name: ref("link.name"), role: ref("link.role"), from: ref("from.name", { safe: true }) },
  responseShape: {} as { kind: "invite" | "reset"; email: string; name: string; role: string; from: string | null },
});

/**
 * POST auth/link/accept: use a link. An invite creates the account with its role; a reset sets the
 * password. Either way the link is spent and the person is signed in. Public, and the only public write besides
 * signup: it acts only for the email the link was issued to, once.
 */
export const acceptLink = query({
  name: "auth/link/accept", verb: "POST", apiGroup: Authentication,
  description: "Public: accept an invite or a reset link, set a password, and sign in.",
  input: { token: input.text({ required: true }), name: input.text({ methods: ["trim"] }), password: input.text({ required: true }) },
  stack: [
    ...passwordRules("password"),
    s.db.transaction({ body: [
      ...usableLink(true),
      s.set_var("person_id", c.int(0)),
      s.conditional({
        when: expr(ref("link.kind"), "=", c.text("invite")),
        then: [
          guard.require(expr(withFilters(inp("name"), fl.strlen()), ">=", c.int(1)), { errorType: "badrequest", message: "Add your name." }),
          guard.require(expr(withFilters(inp("name"), fl.strlen()), "<=", c.int(80)), { errorType: "badrequest", message: "Keep your name under 80 characters." }),
          s.db.get({ table: user, fieldName: "email", fieldValue: ref("link.email"), output: ["id"], as: "taken" }),
          guard.require(expr(ref("taken"), "=", c.null()), { errorType: "badrequest", message: "That email already has an account. Sign in instead." }),
          s.db.add({ table: user, as: "joined", row: { name: inp("name"), email: ref("link.email"), password: inp("password"), role: ref("link.role") } }),
          s.update_var("person_id", ref("joined.id")),
          notify({ to: ref("link.created_by"), kind: "invite", actor: ref("joined.id"), link: "/team",
            title: withFilters(inp("name"), fl.concat(c.text(" accepted your invite"))) }),
          changed({ entity: "user", id: ref("joined.id"), op: "created", verb: "joined", actor: ref("joined.id"), link: "/team",
            title: withFilters(c.text("joined as "), fl.concat(ref("link.role"))) }),
        ],
        else: [
          s.db.get({ table: user, fieldValue: ref("link.user_id"), output: ["id"], as: "person" }),
          guard.found("person", { message: "That account no longer exists." }),
          s.db.patch({ table: user, fieldValue: ref("person.id"), data: obj({ password: inp("password") }) }),
          s.update_var("person_id", ref("person.id")),
        ],
      }),
      s.db.patch({ table: access_link, fieldValue: ref("link.id"), data: obj({ used_at: c.now(), user_id: ref("person_id") }) }),
    ] }),
    s.security.create_auth_token({ table: user, id: ref("person_id"), as: "authToken" }),
  ],
  response: { authToken: ref("authToken"), user_id: ref("person_id") },
  responseShape: {} as { authToken: string; user_id: number },
});

export const linkQueries = [listInvites, createInvite, revokeInvite, createResetLink, checkLink, acceptLink];
