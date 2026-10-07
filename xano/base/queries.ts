// The base app's endpoints, in the `app` group: settings, notifications, the activity feed and the people list.
// Everything that mints or carries a token (demo sign-in, invites, reset links) is in the Authentication group
// instead, where request history is off: see query/authentication/links.ts.
import { apiGroup, auth, c, cmp, col, expr, fl, guard, inp, input, obj, or, query, ref, s, withFilters } from "@xano/sdk";
import type { InferRow } from "@xano/sdk";
import { user } from "../table/user.js";
import { rbac } from "../rbac.js";
import { activity, notification, workspace_setting } from "./tables.js";
import { changed } from "./functions.js";

export const appGroup = apiGroup({ name: "app", canonical: "app", description: "What every template has besides its domain: settings, notifications, activity, people." });

type Settings = { id: number; name: string; timezone: string; week_start: "monday" | "sunday" };

/** GET app/settings: the workspace's name, time zone and week start. Anyone signed in. */
export const getSettings = query({
  apiGroup: appGroup, auth: user,
  name: "app/settings", verb: "GET",
  description: "The workspace's settings.",
  stack: [
    ...rbac.signedIn(),
    s.db.get({ table: workspace_setting, fieldValue: c.int(1), output: ["id", "name", "timezone", "week_start"], as: "row" }),
    guard.found("row", { message: "The workspace has no settings row." }),
  ],
  response: ref("row"),
  responseShape: {} as Settings,
});

/** PATCH app/settings: rename the workspace, set its time zone and week start. team.manage. */
export const updateSettings = query({
  apiGroup: appGroup, auth: user,
  name: "app/settings", verb: "PATCH",
  description: "Change the workspace's settings. Only people who manage the team.",
  input: {
    name: input.text({ required: true, methods: ["trim"] }),
    timezone: input.text({ methods: ["trim"] }),
    week_start: input.enum(["monday", "sunday"]),
  },
  stack: [
    ...rbac.require("team.manage", "Only people who manage the team change the settings."),
    guard.require(expr(withFilters(inp("name"), fl.strlen()), ">=", c.int(1)), { errorType: "badrequest", message: "The workspace needs a name." }),
    guard.require(expr(withFilters(inp("name"), fl.strlen()), "<=", c.int(60)), { errorType: "badrequest", message: "Keep the name under 60 characters." }),
    s.db.patch({ table: workspace_setting, fieldValue: c.int(1), data: obj({ name: inp("name"), timezone: inp("timezone"), week_start: inp("week_start") }) }),
    changed({ entity: "settings", id: c.int(1), title: "updated the workspace settings", verb: "updated", link: "/settings" }),
    s.db.get({ table: workspace_setting, fieldValue: c.int(1), output: ["id", "name", "timezone", "week_start"], as: "row" }),
  ],
  response: ref("row"),
  responseShape: {} as Settings,
});

/** GET app/notifications: mine, newest first, paged; `unread=true` for only the unread ones. */
export const listNotifications = query({
  apiGroup: appGroup, auth: user,
  name: "app/notifications", verb: "GET",
  description: "The signed-in person's notifications, newest first.",
  input: { unread: input.bool(), page: input.int() },
  stack: [
    s.conditional({
      when: expr(inp("unread"), "=", c.bool(true)),
      then: [s.db.query({ table: notification, where: [expr(col("user_id"), "=", auth("id")), cmp(col("read_at"), "=", c.null())],
        sort: [{ sortBy: "created_at", dir: "desc" }], paging: { page: inp("page"), per_page: 30, metadata: true, totals: true }, as: "rows" })],
      else: [s.db.query({ table: notification, where: expr(col("user_id"), "=", auth("id")),
        sort: [{ sortBy: "created_at", dir: "desc" }], paging: { page: inp("page"), per_page: 30, metadata: true, totals: true }, as: "rows" })],
    }),
  ],
  response: ref("rows"),
  responseShape: {} as { items: InferRow<typeof notification>[]; curPage: number; nextPage: number | null; prevPage: number | null; itemsTotal: number; pageTotal: number },
});

/** GET app/notifications/unread: the bell's number. */
export const unreadNotifications = query({
  apiGroup: appGroup, auth: user,
  name: "app/notifications/unread", verb: "GET",
  description: "How many unread notifications the signed-in person has.",
  stack: [s.db.query({ table: notification, where: [expr(col("user_id"), "=", auth("id")), cmp(col("read_at"), "=", c.null())], returnType: "count", as: "n" })],
  response: { count: ref("n") },
  responseShape: {} as { count: number },
});

/** POST app/notifications/{id}/read: mark one of mine read. 404 for anyone else's. */
export const readNotification = query({
  apiGroup: appGroup, auth: user,
  name: "app/notifications/{id}/read", verb: "POST",
  description: "Mark one of your notifications read.",
  input: { id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: notification, fieldValue: inp("id"), as: "n" }),
    ...guard.owner("n", "user_id", { message: "No such notification." }),
    s.db.patch({ table: notification, fieldValue: inp("id"), data: obj({ read_at: c.now() }) }),
  ],
  response: { id: inp("id"), read: c.bool(true) },
});

/** POST app/notifications/read-all: mark all of mine read. */
export const readAllNotifications = query({
  apiGroup: appGroup, auth: user,
  name: "app/notifications/read-all", verb: "POST",
  description: "Mark all of your notifications read.",
  stack: [
    s.db.query({ table: notification, where: [expr(col("user_id"), "=", auth("id")), cmp(col("read_at"), "=", c.null())],
      output: ["id"], paging: { per_page: 500, metadata: false }, as: "unread" }),
    s.foreach({ list: ref("unread"), as: "n", body: [s.db.patch({ table: notification, fieldValue: ref("n.id"), data: obj({ read_at: c.now() }) })] }),
  ],
  response: { read: c.bool(true) },
});

/**
 * GET app/activity: what people and their agents did, newest first. `entity` + `entity_id` for one record's
 * timeline. A private row shows only to its person, its actor and team managers.
 */
export const listActivity = query({
  apiGroup: appGroup, auth: user,
  name: "app/activity", verb: "GET",
  description: "The activity feed, or one record's timeline (entity + entity_id).",
  input: { entity: input.text(), entity_id: input.int(), page: input.int(), per_page: input.int() },
  stack: [
    ...rbac.signedIn(),
    s.set_var("size", c.int(20)),
    s.conditional({ when: expr(inp("per_page"), ">", c.int(0)), then: [s.update_var("size", inp("per_page"))] }),
    s.conditional({ when: expr(ref("size"), ">", c.int(100)), then: [s.update_var("size", c.int(100))] }),
    s.conditional({
      when: rbac.has(ref("me.role"), "team.manage"),
      then: [s.db.query({ table: activity,
        where: [cmp(col("entity"), "=", inp("entity"), { ignoreEmpty: true }), cmp(col("entity_id"), "=", inp("entity_id"), { ignoreEmpty: true })],
        sort: [{ sortBy: "created_at", dir: "desc" }], paging: { page: inp("page"), per_page: ref("size"), metadata: true, totals: true }, as: "rows" })],
      else: [s.db.query({ table: activity,
        where: [
          cmp(col("entity"), "=", inp("entity"), { ignoreEmpty: true }), cmp(col("entity_id"), "=", inp("entity_id"), { ignoreEmpty: true }),
          or(cmp(col("private_to"), "=", c.null()), expr(col("private_to"), "=", c.int(0)), expr(col("private_to"), "=", auth("id")), expr(col("actor_id"), "=", auth("id"))),
        ],
        sort: [{ sortBy: "created_at", dir: "desc" }], paging: { page: inp("page"), per_page: ref("size"), metadata: true, totals: true }, as: "rows" })],
    }),
  ],
  response: ref("rows"),
  responseShape: {} as { items: InferRow<typeof activity>[]; curPage: number; nextPage: number | null; prevPage: number | null; itemsTotal: number; pageTotal: number },
});

/** GET app/people: everyone's id, name and role, for pickers, avatars and "who's here". Anyone signed in. */
export const listPeople = query({
  apiGroup: appGroup, auth: user,
  name: "app/people", verb: "GET",
  description: "Everyone who can sign in: id, name and role.",
  stack: [
    ...rbac.signedIn(),
    s.db.query({ table: user, sort: [{ sortBy: "name", dir: "asc" }], output: ["id", "name", "role"], paging: { per_page: 500, metadata: false }, as: "rows" }),
  ],
  response: ref("rows"),
  responseShape: [] as { id: number; name: string; role: string }[],
});


export const baseQueries = [getSettings, updateSettings, listNotifications, unreadNotifications, readNotification, readAllNotifications, listActivity, listPeople];
