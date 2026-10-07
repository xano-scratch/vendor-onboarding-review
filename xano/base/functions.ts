// The three calls a template's own code makes (BASELINE.md): `changed` after every write, `notify` when a person
// should know, `notifyRoles` when whoever holds a permission should. Each is one statement in a stack.
import { auth, c, cmp, col, defineFunction, expr, fl, inp, input, obj, ref, s, withFilters, type Value } from "@xano/sdk";
import { user } from "../table/user.js";
import { activity, notification } from "./tables.js";
import { live } from "./live.js";

/** Log what happened (when there's a title) and tell every open screen that the record changed. */
export const changedFn = defineFunction({
  name: "app/changed",
  description: "After a write: add an activity row (when titled) and push {entity, id, op} to every open screen.",
  input: {
    entity: input.text({ required: true }), id: input.int(), op: input.text(),
    actor_id: input.int(), via: input.text(), verb: input.text(), title: input.text(), link: input.text(), private_to: input.int(),
  },
  stack: [
    s.conditional({
      when: expr(inp("title"), "!=", c.text("")),
      then: [
        s.db.get({ table: user, fieldValue: inp("actor_id"), output: ["name"], as: "actor" }),
        s.db.add({ table: activity, row: {
        actor_id: inp("actor_id"), actor_name: ref("actor.name", { safe: true }), via: inp("via"), verb: inp("verb"), entity: inp("entity"), entity_id: inp("id"),
        title: inp("title"), link: inp("link"), private_to: inp("private_to"),
      } }),
      ],
    }),
    s.realtime.publish({ server: live, channel: c.text("app"), message: c.text("changed"),
      data: obj({ entity: inp("entity"), id: inp("id"), op: inp("op"), actor_id: inp("actor_id") }) }),
  ],
  response: { ok: c.bool(true) },
});

/** Notify one person (never the person who caused it), and ring their bell at once. */
export const notifyFn = defineFunction({
  name: "app/notify",
  description: "Add a notification for one person and push it to their open screens. Skipped when they caused it.",
  input: {
    user_id: input.int({ required: true }), kind: input.text(), title: input.text({ required: true }),
    body: input.text(), link: input.text(), actor_id: input.int(),
  },
  stack: [
    s.conditional({
      when: expr(inp("user_id"), "!=", inp("actor_id")),
      then: [
        s.db.add({ table: notification, row: {
          user_id: inp("user_id"), kind: inp("kind"), title: inp("title"), body: inp("body"), link: inp("link"), actor_id: inp("actor_id"),
        }, as: "n" }),
        s.realtime.publish({ server: live, channel: withFilters(c.text("users/"), fl.concat(inp("user_id"))), message: c.text("notification"),
          data: obj({ id: ref("n.id"), kind: inp("kind"), title: inp("title"), link: inp("link") }) }),
      ],
    }),
  ],
  response: { ok: c.bool(true) },
});

/** Notify everyone whose role is in `roles` (e.g. `rbac.rolesWith("jobs.approve")`), except the actor. */
export const notifyRolesFn = defineFunction({
  name: "app/notify_roles",
  description: "Notify every person holding one of these roles (an approver queue), except whoever caused it.",
  input: {
    roles: input.list(input.text()), kind: input.text(), title: input.text({ required: true }),
    body: input.text(), link: input.text(), actor_id: input.int(),
  },
  stack: [
    s.db.query({ table: user, where: cmp(col("role"), "in", inp("roles")), output: ["id"], paging: { per_page: 200, metadata: false }, as: "people" }),
    s.foreach({ list: ref("people"), as: "person", body: [
      s.function.run({ fn: notifyFn, as: "sent", input: {
        user_id: ref("person.id"), kind: inp("kind"), title: inp("title"), body: inp("body"), link: inp("link"), actor_id: inp("actor_id"),
      } }),
    ] }),
  ],
  response: { ok: c.bool(true) },
});

type Text = string | Value;
const v = (x: Text | undefined, fallback = ""): Value => (x === undefined ? c.text(fallback) : typeof x === "string" ? c.text(x) : x);

/**
 * After a write, in the same stack: `changed({ entity: "job", id: ref("row.id"), op: "updated", title: … })`.
 * - `title` also logs it to the activity feed and the record's timeline: the rest of a sentence after the
 *   person's name ("moved Fix the boiler to In progress"). Leave it out for small edits.
 * - `actor` defaults to `auth("id")`. In an agent tool, pass `actor: ref("conn.user_id"), via: ref("conn.name")`
 *   (auth("id") there is the agent key, not the person).
 */
export const changed = (o: {
  entity: string; id: Value; op?: "created" | "updated" | "deleted" | "moved";
  title?: Text; verb?: Text; link?: Text; actor?: Value; via?: Text; privateTo?: Value;
}) => s.function.run({ fn: changedFn, as: "_changed", input: {
  entity: c.text(o.entity), id: o.id, op: c.text(o.op ?? "updated"), actor_id: o.actor ?? auth("id"), via: v(o.via),
  verb: v(o.verb, o.op ?? "updated"), title: v(o.title), link: v(o.link), private_to: o.privateTo ?? c.int(0),
} });

/** Tell one person: `notify({ to: ref("job.assignee_id"), kind: "assigned", title: …, link: … })`. */
export const notify = (o: { to: Value; kind?: string; title: Text; body?: Text; link?: Text; actor?: Value }) =>
  s.function.run({ fn: notifyFn, as: "_notified", input: {
    user_id: o.to, kind: c.text(o.kind ?? ""), title: v(o.title), body: v(o.body), link: v(o.link), actor_id: o.actor ?? auth("id"),
  } });

/** Tell everyone with one of these roles: `notifyRoles({ roles: rbac.rolesWith("jobs.approve"), … })`. */
export const notifyRoles = (o: { roles: readonly string[]; kind?: string; title: Text; body?: Text; link?: Text; actor?: Value }) =>
  s.function.run({ fn: notifyRolesFn, as: "_notified", input: {
    roles: c.array([...o.roles]), kind: c.text(o.kind ?? ""), title: v(o.title), body: v(o.body), link: v(o.link), actor_id: o.actor ?? auth("id"),
  } });

export const baseFunctions = [changedFn, notifyFn, notifyRolesFn];
