// The MCP server's base tools (AGENT-ACCESS.md): an agent can always read what changed and what's waiting for its
// person, and ask a team manager to change someone's role. Inside agent.tool, `conn` (the key) and `person`
// (who connected it) are bound; act on ref("conn.user_id"), never auth("id").
import { c, cmp, col, expr, fl, guard, inp, input, obj, or, ref, s, withFilters } from "@xano/sdk";
import { ROLES } from "../app.js";
import { user } from "../table/user.js";
import { agent } from "../agent.js";
import { approvals } from "../approvals.js";
import { rbac } from "../rbac.js";
import { activity, notification } from "./tables.js";
import { notifyRoles } from "./functions.js";

const when = (field: string) => withFilters(ref(`$this.${field}`), fl.epochms_date(c.text("D j M, H:i"), c.text("UTC")));

export const whatsNewTool = agent.tool({
  name: "whats_new", title: "What changed lately", access: "read",
  description: "The latest things people and their agents did in the app, newest first, as the connecting person sees them: what happened, when, and a link.",
  stack: [
    s.db.query({ table: activity,
      where: or(cmp(col("private_to"), "=", c.null()), expr(col("private_to"), "=", c.int(0)), expr(col("private_to"), "=", ref("conn.user_id")), expr(col("actor_id"), "=", ref("conn.user_id"))),
      sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 20, metadata: false }, output: ["actor_name", "title", "via", "link", "created_at"], as: "rows" }),
    s.array.map({ source: ref("rows"), as: "out", transform: { who: ref("$this.actor_name"), did: ref("$this.title"), via_agent: ref("$this.via"), when: when("created_at"), link: ref("$this.link") } }),
  ],
  response: ref("out"),
});

export const myNotificationsAgentTool = agent.tool({
  name: "my_notifications", title: "My notifications", access: "read",
  description: "The connecting person's unread notifications, newest first.",
  stack: [
    s.db.query({ table: notification, where: [expr(col("user_id"), "=", ref("conn.user_id")), cmp(col("read_at"), "=", c.null())],
      sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 20, metadata: false }, output: ["title", "body", "link", "created_at"], as: "rows" }),
    s.array.map({ source: ref("rows"), as: "out", transform: { title: ref("$this.title"), detail: ref("$this.body"), when: when("created_at"), link: ref("$this.link") } }),
  ],
  response: ref("out"),
});

export const requestRoleChangeTool = agent.tool({
  name: "request_role_change", title: "Ask to change someone's role", access: "write", asksApproval: true,
  description: `Ask a team manager to change one person's role (${ROLES.join(", ")}). It is NOT done: a manager approves it under Approvals. Tell the person it is ready to review.`,
  input: { email: input.email({ required: true }), role: input.enum([...ROLES], { required: true }), reason: input.text({ required: true }) },
  logDetail: withFilters(c.text("asked to make "), fl.concat(inp("email")), fl.concat(c.text(" ")), fl.concat(inp("role"))),
  stack: [
    s.db.get({ table: user, fieldName: "email", fieldValue: inp("email"), output: ["id", "name", "role"], as: "target" }),
    guard.found("target", { message: "No one with that email can sign in here." }),
    guard.require(expr(ref("target.role"), "!=", inp("role")), { errorType: "badrequest", message: "They already have that role." }),
    approvals.request({
      ...agent.asker, action: "change_role",
      title: withFilters(c.text("Make "), fl.concat(ref("target.name")), fl.concat(c.text(" ")), fl.concat(inp("role"))),
      preview: inp("reason"), link: c.text("/team"),
      payload: obj({ id: ref("target.id"), role: inp("role") }),
    }),
    notifyRoles({ roles: rbac.rolesWith("team.manage"), kind: "approval", link: "/approvals", actor: ref("conn.user_id"),
      title: withFilters(ref("conn.name"), fl.concat(c.text(" asks to change ")), fl.concat(ref("target.name")), fl.concat(c.text("'s role"))) }),
  ],
  response: ref("approval"),
});

export const baseAgentTools = [whatsNewTool, myNotificationsAgentTool, requestRoleChangeTool];
