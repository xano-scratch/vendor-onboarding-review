# vendor-onboarding-review

<!-- BEGIN:xanosdk-agent-rules -->
<!-- xanosdk 1.0.7 — generated; edits inside this block are overwritten -->

## Working in this Xano SDK project

This is a [Xano SDK](https://www.npmjs.com/package/@xano/sdk) project whose
Xano backend under `xano/` was **pulled from a live workspace** and written as
TypeScript by `xanosdk init --from`. The React + Vite frontend under `frontend/`
is a starter. Xano SDK is Xano's official TypeScript SDK — the supported way to
drive a Xano workspace from code.

### Two rules before you edit anything

- **`xano/` is your source now — edit it and commit it.** `npx xanosdk pull` (and
  re-running `init --from`) refreshes it from a backend: it lists what will change
  and asks first, keeps files you added, and overwrites the files it decodes. Commit
  before refreshing, so an overwritten edit is still in git.
- **`npx xanosdk deploy` is a full replace** of a Xano Engine or a disposable
  **ephemeral** environment (`npm run xano:deploy:ephemeral`), unless `--keep-data`
  merges into the one an earlier deploy filled (`npm run xano:deploy` passes it). A
  real workspace is reached with `npx xanosdk promote <release>` or
  `deploy --to workspace`, which merge and leave table rows alone.

Read `xano/README.md` first: it is the generated record of what did and did not
round-trip on the pull, and it is the only place a decode gap is written down.

### Xano backend

Xano is this project's backend. Everything server-side lives in `xano/` as `@xano/sdk`
TypeScript, compiles to a Xano workspace bundle, and runs on Xano: the **Xano Engine** on
this machine while developing, Xano's cloud for ephemeral previews and production
releases. There is no Node server in this repo and none is expected.

Xano owns the database tables (`table()`), the HTTP endpoints (`apiGroup()` + `query()`),
authentication (a table with `auth: true`, `auth:` on a query, optionally `@xano-sdk/auth`),
server-side logic (`defineFunction()` and statement stacks), scheduled tasks (`task()`),
triggers and webhooks, realtime channels, file storage, and AI agents and MCP servers. Only
the kinds registered in `xano/index.ts` exist in this project — check before assuming. The
frontend calls the deployed backend over HTTP and holds no business logic.

### Source of truth

Inspect these before adding or changing anything backend-related:

- `xano/index.ts` — default-exports the `workspace()` with everything registered on it:
  the inventory of the backend starts here. Pin each API group's canonical slug so public
  paths are stable and `xano:routes` resolves without a lock file.
- `xano/<kind>/<name>.ts` — one file per object (tables in `xano/table/`); `xano/_shared.ts` —
  anything else referenced from more than one file.
- `xano/README.md` — the decode report for this pull, and the only place a decode gap is written down.
- `xano/lambdas/` — JavaScript lambda bodies, type-checked apart (`tsc -p xano/lambdas`).
- `xano/routes.gen.ts` — generated: every endpoint's verb, path, and request type
  (`npx xanosdk routes ./xano/index.ts` prints the same list).
- `xano/xano.lock` — object identities and API group slugs: committed, generated, never
  hand-edited (see below).
- `xano/.env.example` — the backend env var NAMES, committed; the values live in the
  gitignored `xano/.env` (see "Backend env values").
- `README.md` — for a visitor to the repository: what the app does, how to run it, and
  what it is built on. Its `## Built with` footer is a managed block this SDK refreshes.
- `frontend/src/` — the React app. Tailwind v4 + shadcn/ui.
  - `frontend/src/components/ui/` — shadcn components, **copied in and owned by
    this project**. Edit them directly; there is no library to configure around.
  - Need one that isn't there? `npx shadcn@latest add <name>` — do not hand-roll
    it, and do not add a different component library.
  - Icons are [Lucide](https://lucide.dev/icons), installed as `lucide-react` and
    imported by name from the package root —
    `import { ArrowRight } from "lucide-react";`.
    `frontend/src/App.tsx` already uses one. Do not add another icon library and
    do not paste raw inline `<svg>` markup — search the set before concluding an
    icon is missing.
  - Import via the `@/` alias (`@/components/ui/button`), declared in both
    `tsconfig.json` and `vite.config.ts`. `cn()` is `import { cn } from "cn"`
    (shadcn's own package, which the CLI writes into every component it adds);
    `@/lib/utils` re-exports it. Leave a generated component's imports as the
    CLI wrote them.
  - `npx shadcn@latest add sonner` writes a `Toaster` that reads the mode from
    `next-themes`, which this project does not use. Drop that import and
    uninstall `next-themes`, then pass `theme` from the project's own mode:
    `getMode()` + `watchMode()` from `@/lib/theme` when that module exists,
    otherwise `"system"` (or `"light"` if nothing applies the `dark` class).
  - Theme: **Zinc Indigo**, defined as CSS custom properties at the top of
    `frontend/src/index.css`. That file is the entire theme — Tailwind v4 has no
    `tailwind.config.js`.
  - Use the semantic token classes only: `bg-background`, `text-foreground`,
    `bg-primary`, `text-muted-foreground`, `border-input`, `bg-card`,
    `bg-destructive`, and the `chart-1..5` / `sidebar-*` sets.
    NEVER raw palette classes (`bg-gray-100`, `text-slate-500`) — they ignore the
    theme and are unreadable in dark mode, and nothing will report it.
  - Rebranding means editing token VALUES in that stylesheet, never editing
    components to hard-code a color.
  - Dark mode follows the OS: an inline script in the HTML entry sets the
    `dark` class before first paint. There is no in-app switcher — if you are
    asked for one, add a control that toggles that class on
    `document.documentElement` and persists the choice; do not install a theming
    library for it.
- `frontend/src/lib/api.ts` — how the frontend reaches the backend (see "Xano SDK").
- `package.json` — the `xano:*` scripts, and the `"xanosdk"` block: the pinned Xano
  Engine version and toolchain-module config.
- `.xano/` (gitignored) — `auth.json` credentials, and `ephemeral.json`, the environment
  this project last deployed to; `npx xanosdk status` reads it for you.

**Learn the library from the library.** You have almost certainly not seen this SDK.
What you know about driving Xano comes from interfaces with different shapes, and
carrying it over produces code that reads well, type-checks, and is wrong. Read before
writing:

1. `node_modules/@xano/sdk/llms.txt` — the router, and the whole always-read
   surface: the mental model, the deploy contract, every cross-cutting gotcha, and control
   flow. It ends with a list of topic files and the condition for opening each.
   Read it in full; it is small on purpose.
2. The one or two topic files whose condition matches this task
   (`node_modules/@xano/sdk/llms/…`). Skip the rest — that is what the
   conditions are for.
3. `node_modules/@xano/sdk/manifest.json` — only for per-entry detail neither
   carries: a statement's full field schema with engine defaults, a filter's
   complete argument list. Grep or `jq` the one entry you need; it is ~70k
   tokens, so never read it whole.

The published types and JSDoc (`node_modules/@xano/sdk/**/*.d.ts`) are that
same surface with the compiler attached. Author against those signatures. Do
**not** invent an API that isn't there — if the types don't offer something,
make your best typed guess from the exported signatures and note the gap.

### Development workflow

```bash
npm install            # Node >= 20.19
npm run xano:deploy    # typecheck, then deploy the backend to the Xano Engine on this machine
npm run dev            # the frontend, pointed at the engine through .env.local
```

- `npm run xano:deploy` is the backend loop: no Xano account and no network. The first run
  downloads the engine and pins its version in `package.json` — commit that. It passes
  `--keep-data`, so rows survive redeploys (`npm run xano:deploy -- --reset` re-seeds). It
  prints the backend URL and a link to Xano's visual builder on the engine, and writes
  `VITE_XANO_HOST` to `.env.local` (restart `npm run dev` if it was already running). Run
  it after every backend change.
- `npm run typecheck` / `npm run build` — both halves of the project; must stay green.
- `npm run xano:routes` — regenerate `xano/routes.gen.ts` after adding or renaming an
  endpoint (`dev`, `build` and `typecheck` run it too). Commit the file.
- `npm run xano:export` — compile the backend to `workspace.json` (never commit it).
- `npm run xano:test` — run the DEPLOYED environment's unit + workflow tests (exits 5 on a
  failure). Deploy first. See "Testing" below.
- `npm run xano:check` — the CI gate: a strict export, a stale `routes.gen.ts`, lock drift.
  It writes nothing and needs no secrets. Run it before calling the work done.
- `npx xanosdk login` then `npm run xano:deploy:ephemeral` — ship the backend + static
  frontend to a disposable **ephemeral** environment on Xano's cloud;
  `npm run xano:deploy:frontend` republishes only the frontend.
- `npx xanosdk pull [source]` — refresh `xano/` from a live backend; it REPLACES the
  files it decodes, so commit first.
- `npx xanosdk status` says who you are, which workspace, and the environment this project
  last deployed to; `npx xanosdk routes ./xano/index.ts`, `npx xanosdk tables`,
  `npx xanosdk test list` and `npx xanosdk local list` inspect without changing anything.
- A bare command (`npm run xano:test`, `npx xanosdk env set`, `npx xanosdk tables`,
  `npx xanosdk impersonate`) reaches the ephemeral or Xano Engine this project last
  deployed to, never the workspace, and needs no Xano account; the grammar that names
  another is **Backends** in `node_modules/@xano/sdk/llms.txt`. `npx xanosdk impersonate`
  prints a session URL: treat it as a credential (`--guest` opens a read-only look).
- The **`xano-local` MCP server** (`.mcp.json`, `.cursor/mcp.json`) reaches the Xano Engine
  this project deployed to. Use it to look at the deployed backend (objects, table schemas,
  rows, run history), to seed and edit rows, and to run functions, tasks, triggers, endpoints
  and tests, each answering its result and logs. It never changes a primitive: tables,
  endpoints, functions and every other object change in `xano/` and ship with
  `npm run xano:deploy`. Until a deploy it lists no tools; `npx xanosdk local mcp` prints
  its details. It is not an `mcpServer()`, which is an MCP server the workspace defines.

**Shipping for real.** A deploy targets a throwaway environment; a real one is reached
through a **release**. A Xano Engine cannot be released from, so stand the code up with
`npm run xano:deploy:ephemeral`, cut with `npx xanosdk release create <name> --from ephemeral`,
then land it with `npx xanosdk promote <name>` (`npx xanosdk tenant deploy <tenant> <name>`
for a customer tenant). A promote lands on a branch that serves nothing until it is live
(`--set-live`, or `npx xanosdk workspace branch set-live <label>` later).
`npx xanosdk deploy --to workspace` skips the release and merges the local build straight
in, leaving nothing to roll back to. Run any of these only when asked.

### Xano SDK

**Backend.** Defs are plain objects passed to factories and registered on one
`workspace()`, default-exported from `xano/index.ts`. Def modules run at BUILD time:
`s.*` statements return data the engine executes per request, and every dynamic operand
is a tagged value (`ref()`, `inp()`, `auth()`, `c.*`), so JS operators over them do not
compute. Requests share no memory; state lives in tables.

```ts
import { workspace, table, apiGroup, query, f, input, s, ref, inp, auth } from "@xano/sdk";

const users = table({ name: "users", auth: true, schema: { email: f.email({ required: true }) } });
const posts = table({ name: "posts", schema: { author: f.tableRef(users), body: f.text({ required: true }) } });
const api = apiGroup({ name: "blog", canonical: "blog" }); // always pin canonical
const createPost = query({
  name: "create_post", verb: "POST", apiGroup: api, auth: users,
  input: { body: input.text({ required: true }) },
  stack: [s.db.add({ table: posts, row: { author: auth("id"), body: inp("body") }, as: "post" })],
  response: ref("post"),
});
export default workspace("app").registerTables([users, posts]).registerApiGroups([api]).registerQueries([createPost]);
```

That is the shape, not the API: verify every builder and option against the installed
`.d.ts` and `node_modules/@xano/sdk/llms/` files.

**The one contract.** `frontend/src/lib/api.ts` takes request paths from `xano/routes.gen.ts`
(`routePath("GET notes/{id}", { id })`), generated from the query defs by `npm run xano:routes`
and regenerated by dev, build and typecheck; request types from the same file
(`RouteInputs["POST create_post"]`, `MessageInputs` for realtime); response types from the
defs with `import type` (`InferResponse`). Never hand-type a URL or a request body, and
never import a def as a value in the frontend: its `getPath()` drags the backend into the
bundle. There is no client object to construct: `api.ts` exports `XANO_HOST`
(`window.XANO_HOST` injected by a deploy, `VITE_XANO_HOST` in dev) and holds the request
functions. Add new calls there — not a second base URL or fetch wrapper.

### Backend changes

- Match the naming already in `xano/`: snake_case object names, uppercase verbs, the
  existing file layout, and a pinned `canonical` on every API group.
- Reuse the existing auth table and `auth:` on protected queries. If `@xano-sdk/auth` is
  registered, build on it; enforce roles off the caller's row with `guard.role(...)`.
- Keep table relationships (`f.tableRef`) and column types. On the engine's keep-data
  loop, rows survive only in tables and columns that keep their names.
- Put logic in stacks, or in `defineFunction()` called with `s.function.run` — not in
  the frontend.
- Add `tests: [...]` to new queries and functions (a `workflowTest()` where the behavior
  spans objects), then `npm run xano:deploy` and `npm run xano:test`.
- Finish with `npm run xano:routes`, `npm run typecheck` and `npm run xano:check`, and
  commit `xano/routes.gen.ts` and `xano/xano.lock` with the change.

### AI agent guidance

- Treat Xano as this project's backend unless the user explicitly asks for another.
- Before introducing Express, Fastify, Hono, Next.js API routes, Supabase, Firebase, Prisma,
  Drizzle, an ORM, a separate database, or any other backend service, inspect `xano/` and
  determine whether the requirement can be implemented there. If it cannot, say so and ask
  rather than adding a second backend silently.
- Prefer modifying an existing Xano resource over creating a duplicate.
- Do not invent Xano APIs, statements, or SDK methods; when unsure, read the installed
  docs and types named under "Source of truth".
- Do not rewrite the frontend's data layer; extend `frontend/src/lib/api.ts`.
- Do not run `npx xanosdk pull`, `promote`, `deploy --to workspace`, `tenant deploy`, or
  `local update` unless asked: `pull` overwrites `xano/`, and the others change shared
  environments or the pinned engine.
- Never commit `xano/.env`, `xano/.secrets.json`, `workspace.json`, `.env.local`, or
  `.xano/`. Never ignore `xano/` wholesale, and never ignore `xano/xano.lock`.

### Backend env values

`workspaceConfig({ env })`, passed to `registerWorkspace()`, declares the NAMES the
backend reads with `env("NAME")`; the VALUES live in `xano/.env`, which is gitignored and survives a
`npx xanosdk pull`. `xano/.env.example` lists the declared names and is committed.

- Fill it in by hand (`cp xano/.env.example xano/.env`), or run `npx xanosdk env pull`
  to fetch the values from a backend that is running. That is the ONLY command that
  writes `xano/.env`, and it confirms before replacing one. A compiled bundle also carries the
  resolved values in cleartext, so keep an `export --out` artifact out of git.
- Every command that compiles a bundle reads `xano/.env` with no flag. In CI, which
  does not have it, mount a file and pass `--backend-env-file <path>`, or supply names with
  `--env-var KEY=VALUE`.
- A deploy REPLACES the backend's env set, so a declared name with no value anywhere
  REFUSES the deploy rather than clearing the live value. Fill the name in — do not
  put the value back into `xano/index.ts`, and do not reach for
  `--allow-empty-env=NAME` unless clearing that name is what you actually want.
- `xano/` is committed in full except its two secret files, `xano/.env` and
  `xano/.secrets.json` (both gitignored). Never ignore `xano/` wholesale — the
  source is the review surface.
- On Windows there is no ACL equivalent to the 0600 the file is created with, the
  same exposure `.xano/auth.json` already carries.

### Testing

Two kinds, both authored in `xano/`, both run against a DEPLOYED environment:

- **Unit test** — a `tests: [...]` entry on a `query`, `defineFunction`, or
  `middleware`: named inputs run against that object, with `expect.*` assertions
  on its response. A statement's `mock` (keyed by test NAME) substitutes a value
  for one step while that test runs.
- **Workflow test** — `workflowTest({ name, stack })`: a standalone object whose
  stack calls other objects (`s.function.call`, `s.api.call`) and asserts with
  `s.expect.*`. Reach for it when the behavior spans objects.

`expect.*` (an assertion record on a unit test) and `s.expect.*` (a statement in a
workflow-test stack) are different builders and are not interchangeable.

Run them with `npm run xano:test` after a deploy — it compiles nothing and reports
what is deployed, so deploy first. A failing suite exits 5.
`npx xanosdk deploy ./xano/index.ts --test` does both in one step. Read
`node_modules/@xano/sdk/llms/tests.md` before authoring either.

### `xano/xano.lock` — commit it, never hand-edit it

Object identity derives from `(type, name)`, so a rename
changes an object's guid and the engine DELETES and recreates it rather than
renaming in place. `xano/xano.lock` freezes each guid and each API group's
canonical slug. Every build writes it — `npm run xano:export`, `xano:deploy`
(`xano:check`, `routes` and `--dry-run` only read it) — and it is **committed**.
Treat it as generated state, and never edit it by hand.

To rename an object: rename it in code and run `npm run xano:export`. Only if it
warns of an orphaned entry, run the `lock rename` it prints (`npx xanosdk lock rename
<kind> <old> <new>`), then export again — a pulled tree's explicit
`guid:` carries the identity, and export says so. Every `lock` subcommand finds
`xano/xano.lock` from the project entry, as `export` does — `--entry=<file>` names
another entry, `--lock=<path>` the lock itself.
`npm run xano:check` (`npx xanosdk export ./xano/index.ts --check --strict`: writes nothing, needs no secrets, fails on any build warning) fails if
`xano/routes.gen.ts` is missing or stale (after adding or renaming an endpoint, run `npm run xano:routes`
and commit the file), if an export would change the lock, or if the lock still carries an entry no object matches (finish the rename with `lock rename`, or drop it
with `lock prune` when the object really was deleted) — run it before you call the work
done, and again after any merge: two branches that change different objects merge with no
conflict while one side's derived state still predates the other's source change.

### Add-ons

Other `@xano-sdk/*` packages register onto the same workspace — but a
`.register*()` call added to `xano/index.ts` is lost on the next pull, so prefer
composing them from a module outside `xano/`.

### Troubleshooting

`XANOSDK_DEBUG=1` appends the raw underlying error to any CLI failure. The error index is
`node_modules/@xano/sdk/llms/errors.md`, exit codes included (2 = ran but disagreed, 5 = a
test failed, 8 = the named backend is gone, stopped, or unreachable).

- **The Xano Engine fails to start.** `npx xanosdk local list` shows the engines on this
  machine; `npx xanosdk local stop --all` then `npm run xano:deploy` restarts cleanly. Each
  start writes a log under `~/.xanosdk/local-engine/engine/` (`Library/Caches` on macOS,
  `.cache` on Linux) and a failed start names its file. A damaged cache: clear it with
  `npx xanosdk local cache clear` and redeploy. `XANOSDK_ENGINE_OVERRIDE` in the shell
  means a non-pinned engine is running.
- **The frontend cannot reach the backend.** `npx xanosdk status` prints the URL this
  project last deployed to. In dev the host is `VITE_XANO_HOST` from `.env.local` at the
  project root, written by `npm run xano:deploy`; restart `npm run dev` after it changes. A
  deployed site gets it injected as `window["XANO_HOST"]` (grep the bare `XANO_HOST` token).
  An empty `XANO_HOST` sends every call to the dev server, which 404s.
- **An API call fails.** Confirm the verb and path with `npx xanosdk routes ./xano/index.ts`,
  and redeploy — the backend has only what was last deployed. Look the message up in
  `node_modules/@xano/sdk/llms/errors.md`: `Unable to locate request` is a lowercase verb,
  a `.` in a name, or a CORS config that dropped the group; `Unable to locate var` is a
  dotted `ref` into null.
  Reproduce it with a `tests:` entry and `npm run xano:test`.
- **The schema appears out of sync.** `npx xanosdk tables` lists what the deployed backend
  has; `npm run xano:deploy` merges your defs in, `npm run xano:deploy -- --reset` replaces
  and re-seeds, and an engine restart or update starts empty (the next deploy seeds).
  `npm run xano:check` reports lock drift: finish a rename with
  `npx xanosdk lock rename <kind> <old> <new>`, or drop a deleted object's entry with
  `npx xanosdk lock prune`. Against the real workspace,
  `npx xanosdk workspace diff ./xano/index.ts` exits 2 when anything differs.
- **Generated files are missing.** `xano/routes.gen.ts`: `npm run xano:routes` (it writes
  nothing until the workspace has an endpoint). `xano/xano.lock`: any export or deploy
  writes it. `.env.local`: `npm run xano:deploy` writes it. `xano/.env` is never generated:
  `cp xano/.env.example xano/.env`, or `npx xanosdk env pull` from a running backend.
  `node_modules/@xano/sdk/llms.txt` missing: `npm install`.
<!-- END:xanosdk-agent-rules -->
