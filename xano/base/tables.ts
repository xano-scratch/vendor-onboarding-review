// The base app's own tables: what every template has besides its domain (BASELINE.md).
import { f, table } from "@xano/sdk";
import { APP, DEMO_PEOPLE, ROLES, SEED_ACTIVITY } from "../app.js";
import { user } from "../table/user.js";

const DAY = 86_400_000;

/** One-click demo sign-in. Delete these rows to turn demo sign-in off. */
export const demo_persona = table({
  name: "demo_persona",
  description: "One-click demo sign-in. Delete these rows to turn demo sign-in off.",
  schema: { key: f.text({ required: true }), label: f.text({ required: true }), description: f.text(), email: f.email({ required: true }) },
  index: [{ type: "btree|unique", fields: [{ name: "key", op: "asc" }] }],
  seed: DEMO_PEOPLE.map((p) => ({ key: p.key, label: p.name, description: p.description, email: p.email })),
});

/** Something a person should know about: an approval waiting, a job assigned to them, an invite accepted. */
export const notification = table({
  name: "notification",
  description: "A person's notifications, newest first. The bell counts the unread ones.",
  schema: {
    user_id: f.tableRef(user, { required: true }),
    /** A short key the app chooses ("approval", "assigned", "invite"), for the icon. */
    kind: f.text(),
    title: f.text({ required: true }),
    body: f.text(),
    /** Where it opens in the app ("/jobs/12"). */
    link: f.text(),
    /** Who caused it, when it was a person. */
    actor_id: f.tableRef(user),
    read_at: f.timestamp({ nullable: true }),
  },
  index: [{ type: "btree", fields: [{ name: "user_id", op: "asc" }, { name: "created_at", op: "desc" }] }],
  seed: DEMO_PEOPLE.map((p, i) => ({
    user_id: i + 1, kind: "welcome", title: `Welcome to ${APP.name}`,
    body: "Your overview shows what needs you. Press ⌘K to jump anywhere.", link: "/", read_at: null,
  })),
});

/** What happened, by people and their agents: the overview's feed and each record's timeline. */
export const activity = table({
  name: "activity",
  description: "What people and their agents did. Written by app/changed; read by the activity feed and record timelines.",
  schema: {
    actor_id: f.tableRef(user),
    /** Their name when it happened, so the feed and the assistant can say who without a lookup. */
    actor_name: f.text(),
    /** The agent that acted for the person ("Claude Code"), or empty when the person did it themselves. */
    via: f.text(),
    /** A past-tense phrase: "moved", "created", "approved". */
    verb: f.text(),
    /** The kind of record ("job") and its id: a record's timeline filters on both. */
    entity: f.text(),
    entity_id: f.int(),
    /** What they did, as the rest of a sentence after their name: "moved Fix the boiler to In progress". */
    title: f.text({ required: true }),
    link: f.text(),
    /** Only this person (plus the actor and team managers) sees the row. Empty: everyone signed in. */
    private_to: f.tableRef(user),
  },
  index: [
    { type: "btree", fields: [{ name: "created_at", op: "desc" }] },
    { type: "btree", fields: [{ name: "entity", op: "asc" }, { name: "entity_id", op: "asc" }] },
  ],
  // Dated from the deploy, so "25 minutes ago" is true on every fresh deploy.
  seed: SEED_ACTIVITY.map((a) => ({
    created_at: Date.now() - a.minutesAgo * 60_000, actor_id: a.actor, actor_name: DEMO_PEOPLE[a.actor - 1]?.name ?? "", via: a.via ?? "",
    verb: a.verb, entity: a.entity, entity_id: a.entity_id, title: a.title, link: a.link ?? "", private_to: 0,
  })),
});

/** Invite links (a new person joins with a role) and password-reset links (an admin issues one). */
export const access_link = table({
  name: "access_link",
  description: "One-time links: invites to join with a role, and password resets. Only a hash of the token is stored.",
  schema: {
    kind: f.enum(["invite", "reset"], { required: true }),
    email: f.email({ required: true }),
    name: f.text(),
    role: f.enum([...ROLES]),
    /** The reset's person; the new person, once an invite is accepted. */
    user_id: f.tableRef(user),
    token_hash: f.text({ required: true, access: "private" }),
    expires_at: f.timestamp({ required: true }),
    used_at: f.timestamp({ nullable: true }),
    revoked: f.bool(),
    created_by: f.tableRef(user, { required: true }),
  },
  index: [
    { type: "btree|unique", fields: [{ name: "token_hash", op: "asc" }] },
    { type: "btree", fields: [{ name: "email", op: "asc" }] },
  ],
});

/** The workspace's own settings: one row. Add the domain's settings here as columns (BASELINE.md). */
export const workspace_setting = table({
  name: "workspace_setting",
  description: "The workspace's settings: one row, edited by people who manage the team.",
  schema: {
    name: f.text({ required: true }),
    /** An IANA zone ("Europe/London"): how the app reads "today". */
    timezone: f.text(),
    week_start: f.enum(["monday", "sunday"]),
    /** Domain setting (BASELINE.md): a still-pending case older than this many days shows overdue on the board. */
    review_sla_days: f.int(),
  },
  seed: [{ name: APP.name, timezone: "UTC", week_start: "monday", review_sla_days: 5 }],
});

export { DAY };
