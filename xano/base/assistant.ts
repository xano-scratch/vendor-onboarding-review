// The assistant's base tools (CHATBOT.md): it can always say what changed and what's waiting for the person,
// before the template adds its domain tools. auth("id") here is the person chatting.
import { auth, c, cmp, col, expr, fl, or, ref, s, tool, withFilters } from "@xano/sdk";
import { activity, notification } from "./tables.js";

const when = (field: string) => withFilters(ref(`$this.${field}`), fl.epochms_date(c.text("D j M, H:i"), c.text("UTC")));

export const recentActivityTool = tool({
  name: "recent_activity", title: "What changed lately",
  description: "The latest things people and their agents did in the app, newest first: what happened, when, and a link. Use it for 'what's new' or 'what happened today'.",
  annotations: { readOnlyHint: true },
  stack: [
    s.db.query({ table: activity,
      where: or(cmp(col("private_to"), "=", c.null()), expr(col("private_to"), "=", c.int(0)), expr(col("private_to"), "=", auth("id")), expr(col("actor_id"), "=", auth("id"))),
      sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 15, metadata: false }, output: ["actor_name", "title", "via", "link", "created_at"], as: "rows" }),
    s.array.map({ source: ref("rows"), as: "out", transform: { who: ref("$this.actor_name"), did: ref("$this.title"), via_agent: ref("$this.via"), when: when("created_at"), link: ref("$this.link") } }),
  ],
  response: ref("out"),
});

export const myNotificationsTool = tool({
  name: "unread_notifications", title: "My unread notifications",
  description: "This person's unread notifications, newest first: what it's about, when, and a link.",
  annotations: { readOnlyHint: true },
  stack: [
    s.db.query({ table: notification, where: [expr(col("user_id"), "=", auth("id")), cmp(col("read_at"), "=", c.null())],
      sort: [{ sortBy: "created_at", dir: "desc" }], paging: { per_page: 15, metadata: false }, output: ["title", "body", "link", "created_at"], as: "rows" }),
    s.array.map({ source: ref("rows"), as: "out", transform: { title: ref("$this.title"), detail: ref("$this.body"), when: when("created_at"), link: ref("$this.link") } }),
  ],
  response: ref("out"),
});

export const baseAssistantTools = [recentActivityTool, myNotificationsTool];

/** The base half of the assistant's system prompt: how to answer in this app, whatever its domain. */
export const BASE_ASSISTANT_RULES = [
  "Only state facts a tool returned; never invent records, people or numbers. If a tool refuses, say plainly what this person can do instead.",
  "Answer briefly with light Markdown (short lists, bold for names). Never output HTML. Never show internal ids or raw timestamps; dates like 'Fri 9 Oct'.",
  "Link each record you mention by its title, using its link: [Title](link). End with one next step as a link into the app.",
  "Use recent_activity for what changed lately and unread_notifications for what's waiting for this person.",
  "In recent_activity, `who` did it and `via_agent` (when set) is the agent that did it for them: write 'Eli Editor, via Claude Code, asked to publish …', never that the person asked the agent.",
].join(" ");
