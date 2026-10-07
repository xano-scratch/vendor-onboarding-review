// The app's name, roles and demo people: the first backend file a template edits (BASELINE.md).
// `xano/table/user.ts` reads ROLES and DEMO_PEOPLE from here (modules/base/install.mjs wired it), so the role
// enum, the seeded people, the demo sign-in and the invite form all follow this one file.

export const APP = {
  /** Shown in the sidebar, the sign-in screen and the MCP sign-in page. Admins can rename it in Settings. */
  name: "Vendor Onboarding Review",
  /** The repo slug. It names the workspace and the ChatGPT/Claude sign-in page's API group. */
  slug: "vendor-onboarding-review",
} as const;

/** user.role's values, most trusted first. Every permission in xano/rbac.ts names some of these. */
export const ROLES = ["admin", "approver", "requester"] as const;
export type Role = (typeof ROLES)[number];

/** What a sign-up gets, and the invite form's default: the least-privileged role. */
export const SIGNUP_ROLE: Role = "requester";

/**
 * One demo person per role a visitor should try, in seed order: rows in other tables refer to them by
 * position (`user_id: 1` is the first). They sign in with one click through auth/demo, never a password.
 * Morgan (admin) is first, so the cold demo lands on the person who can work every screen.
 */
export const DEMO_PEOPLE: readonly { key: string; name: string; email: string; role: Role; description: string }[] = [
  { key: "admin", name: "Morgan Lee", email: "morgan@demo.example", role: "admin", description: "Platform lead: completes cases and governs the rule set" },
  { key: "approver", name: "Avery Chen", email: "avery@demo.example", role: "approver", description: "Risk reviewer: clears the review steps that match their role" },
  { key: "requester", name: "Riley Novak", email: "riley@demo.example", role: "requester", description: "Procurement coordinator: files vendors and tracks their own cases" },
];

/**
 * What the activity feed shows on a fresh deploy: a few believable lines by the demo people and their agents,
 * so the overview isn't empty (BASELINE.md). `actor` is a DEMO_PEOPLE position (1 = the first); `via` names the
 * agent that did it for them; `title` is the rest of a sentence after their name.
 */
export type SeedActivity = { actor: number; via?: string; verb: string; entity: string; entity_id: number; title: string; link?: string; minutesAgo: number };
export const SEED_ACTIVITY: SeedActivity[] = [
  { actor: 2, via: "Claude Code", verb: "asked", entity: "submission", entity_id: 5, title: "asked to complete the Dataflow Analytics case", link: "/cases/5", minutesAgo: 20 },
  { actor: 2, verb: "approved", entity: "submission", entity_id: 5, title: "approved the first review step on Dataflow Analytics", link: "/cases/5", minutesAgo: 95 },
  { actor: 3, verb: "submitted", entity: "submission", entity_id: 5, title: "submitted Dataflow Analytics for review", link: "/cases/5", minutesAgo: 190 },
  { actor: 1, verb: "completed", entity: "submission", entity_id: 8, title: "completed the Meridian Software case", link: "/cases/8", minutesAgo: 320 },
  { actor: 2, verb: "blocked", entity: "submission", entity_id: 3, title: "blocked Granite Peak Logistics for more detail", link: "/cases/3", minutesAgo: 60 * 26 },
];

/** The seeded people's shared, deliberately public password (AUTH.md §4). Never used to sign in. */
export const DEMO_PASSWORD = "DemoPass123";
