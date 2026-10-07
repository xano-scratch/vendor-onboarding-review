// The app frame (BASELINE.md): every route, provider and piece of chrome a template has, built from one config
// (frontend/src/app.config.tsx). A template writes its screens and that config; this file wires the rest:
//   - signed out: sign-in (demo people + email), sign-up, /join/<token> (invites and resets);
//   - signed in: the kit's AppShell (left sidebar, user menu with Profile · Settings · Shortcuts · Theme · Sign out),
//     the header (⌘K, who's online, the notification bell, Ask), ⌘K with the nav, actions and record search,
//     "?" and g-shortcuts, the assistant, live updates, and the base screens: /notifications, /activity, /settings,
//     /profile, /team, /agents, /approvals, and a 404 for anything else.
import { Suspense, lazy, useCallback, useMemo, type ReactNode } from "react";
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, useLocation, useMatches, useNavigate, type RouteObject } from "react-router";
import { Bell, Bot, History, Keyboard, MessageCircle, Moon, Settings as SettingsIcon, ShieldCheck, UserPlus, UserRound, Users, type LucideIcon } from "lucide-react";
import { RbacProvider, createRbacClient, useCan } from "@xano-sdk/rbac/react";
import { AgentsProvider, createAgentsClient, decorateApprovalReply, usePendingCount } from "@xano-sdk/agents/react";
import { createChatClient, type ChatTurn } from "@xano-sdk/chatbot/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AppShell, CommandPalette, EmptyState, LoadError, setThemeMode, type NavGroup, type PaletteItem } from "@/components/kit";
import { SignInPage, SignUpPage, JoinPage, type Brand } from "./auth-pages";
import { LiveProvider } from "./live";
import { NotificationBell } from "./notifications";
import { OnlineNow } from "./presence";
import { SessionProvider, useSession } from "./session";
import { Shortcuts, goKeys, openShortcuts } from "./shortcuts";
import { WorkspaceProvider, useWorkspace } from "./workspace";
import { XANO_HOST, token } from "./request";

export type AppConfig = {
  /** The product's name (the workspace's Settings name replaces it once signed in), icon, and sign-in line. */
  name: string;
  icon: LucideIcon;
  tagline: string;
  /**
   * The domain's screens, inside the signed-in shell, each lazy: `{ path: "/jobs", lazy: page(() => import("./pages/jobs"), "JobsPage") }`.
   * "/" is the overview. Add `handle: { wide: true }` to a board or schedule that needs the full width.
   */
  routes: RouteObject[];
  /** The domain's nav groups (a hook, so it can call useCan). The base adds Approvals, Agents and Team after them. */
  useNav: () => NavGroup[];
  /** The domain's ⌘K actions ("New job"), a hook too. Nav items, settings and the base's actions are added. */
  usePaletteActions?: () => PaletteItem[];
  /** Records found as the person types in ⌘K. `go(href)` navigates. */
  search?: (q: string, go: (href: string) => void) => Promise<PaletteItem[]>;
  /** The domain's single-key shortcuts for the "?" sheet: [["N", "New job"]]. Bind them with useHotkey on their screen. */
  shortcuts?: [string, string][];
  /** Each permission in the app's words ("jobs.assign": "assign jobs"), for Team and Profile. */
  permissionLabels: Record<string, string>;
  /** The assistant (CHATBOT.md): always on, opened from the header's Ask. */
  assistant: {
    name: string;
    welcome: string;
    suggestions: string[];
    /** Next questions, from the tools the last reply used. */
    followUps?: (reply: ChatTurn) => string[];
  };
};

/** A lazy route's loader: `lazy: page(() => import("./pages/jobs"), "JobsPage")`. Each screen is its own chunk. */
export const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] });

// One client per module, reading the person's token on every call. Group URLs: backend + /api:<canonical>.
const getToken = () => token.get();
const rbacClient = createRbacClient({ apiBaseUrl: `${XANO_HOST}/api:rbac`, getToken });
const agentsClient = createAgentsClient({ agentApiBaseUrl: `${XANO_HOST}/api:agent`, approvalsApiBaseUrl: `${XANO_HOST}/api:approvals`, getToken });
const chatClient = createChatClient({ apiBaseUrl: `${XANO_HOST}/api:chat`, getToken });
const ChatWidget = lazy(() => import("@xano-sdk/chatbot/react").then((m) => ({ default: m.ChatWidget })));
const openAssistant = () => void import("@xano-sdk/chatbot/react").then((m) => m.openChatWidget());

/** The approval card replaces a link to Approvals: drop that line when a reply shows one (CHATBOT.md §3). */
const decorateReply = (reply: ChatTurn) => {
  const d = decorateApprovalReply(reply);
  return d && { ...d, content: d.content.replace(/^.*\]\(\/approvals\).*$/gm, "").trim() };
};
const baseFollowUps = (reply: ChatTurn) => (reply.tools ?? []).includes("recent_activity")
  ? ["What's waiting for me?", "What's waiting for approval?"] : ["What changed today?", "What's waiting for me?"];

function Frame({ config }: { config: AppConfig }) {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const { settings } = useWorkspace();
  const pending = usePendingCount();
  const canManage = useCan("team.manage");
  const domainNav = config.useNav();
  const domainActions = config.usePaletteActions?.() ?? [];
  const wide = useMatches().some((m) => (m.handle as { wide?: boolean } | undefined)?.wide);
  const name = settings?.name || config.name;
  if (typeof document !== "undefined" && document.title !== name) document.title = name;

  const nav: NavGroup[] = [
    ...domainNav,
    { label: "Workspace", items: [
      { href: "/approvals", label: "Approvals", icon: ShieldCheck, badge: pending, primary: true },
      { href: "/agents", label: "Agents", icon: Bot },
      ...(canManage ? [{ href: "/team", label: "Team", icon: Users }] : []),
    ] },
  ];
  const extraScreens = [
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/activity", label: "Activity", icon: History },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
    { href: "/profile", label: "Profile", icon: UserRound },
  ];
  const go = useMemo(() => goKeys(nav, extraScreens), [JSON.stringify(nav.map((g) => g.items.map((i) => i.href)))]); // eslint-disable-line react-hooks/exhaustive-deps
  const items: PaletteItem[] = [
    ...[...nav.flatMap((g) => g.items), ...extraScreens].map((i) => ({ id: i.href, label: i.label, group: "Go to", icon: i.icon, run: () => navigate(i.href) })),
    ...domainActions,
    ...(canManage ? [{ id: "invite", label: "Invite someone", group: "Actions", icon: UserPlus, run: () => navigate("/team?invite=1") }] : []),
    { id: "ask", label: `Ask ${config.assistant.name}`, group: "Actions", icon: MessageCircle, run: openAssistant },
    { id: "theme", label: "Switch light / dark", group: "Actions", icon: Moon, run: () => setThemeMode(document.documentElement.classList.contains("dark") ? "light" : "dark") },
    { id: "shortcuts", label: "Keyboard shortcuts", group: "Actions", icon: Keyboard, run: openShortcuts },
  ];
  const search = useCallback((q: string) => (config.search ? config.search(q, (href) => navigate(href)) : Promise.resolve([])), [config, navigate]);
  if (!me) return null;
  return (
    <AppShell brand={{ name, icon: config.icon }} nav={nav} wide={wide}
      user={{ name: me.name, email: me.email, detail: me.role.charAt(0).toUpperCase() + me.role.slice(1) }} onSignOut={signOut}
      menu={[
        { label: "Settings", icon: SettingsIcon, onSelect: () => navigate("/settings"), kit: "user-menu-settings" },
        { label: "Keyboard shortcuts", icon: Keyboard, onSelect: openShortcuts, kit: "user-menu-shortcuts" },
      ]}
      headerEnd={<>
        <OnlineNow />
        <NotificationBell />
        <Button variant="ghost" size="sm" data-testid="ask-assistant" aria-label={`Ask ${config.assistant.name}`} onClick={openAssistant}><MessageCircle /><span className="max-sm:sr-only">Ask</span></Button>
      </>}>
      <Outlet />
      <CommandPalette items={items} search={config.search ? search : undefined} />
      <Shortcuts go={go} actions={config.shortcuts} />
      <Suspense fallback={null}>
        <ChatWidget client={chatClient} assistantName={config.assistant.name} launcher="none" decorateReply={decorateReply}
          followUps={config.assistant.followUps ?? baseFollowUps} onNavigate={(href) => navigate(href)}
          welcome={config.assistant.welcome} suggestions={config.assistant.suggestions} onUnauthorized={signOut} />
      </Suspense>
    </AppShell>
  );
}

function Shell({ config }: { config: AppConfig }) {
  const { me } = useSession();
  const location = useLocation();
  const renderLink = useMemo(() => (href: string, children: ReactNode) => <Link to={href}>{children}</Link>, []);
  if (!me) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return (
    <RbacProvider client={rbacClient} userKey={me.id}>
      <AgentsProvider client={agentsClient} currentUserId={me.id} backendUrl={XANO_HOST} renderLink={renderLink}>
        <LiveProvider userId={me.id}>
          <WorkspaceProvider>
            <Frame config={config} />
          </WorkspaceProvider>
        </LiveProvider>
      </AgentsProvider>
    </RbacProvider>
  );
}

function NotFound() {
  return (
    <div className="py-12" data-testid="not-found">
      <EmptyState title="This page doesn't exist" description="The link may be old, or the address has a typo."
        action={<Button asChild size="sm"><Link to="/">Go to the overview</Link></Button>} />
    </div>
  );
}

function RouteError() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <LoadError title="This page broke" error="Something on this screen failed. Reload, or go back to the overview." onRetry={() => location.assign("/")} />
    </main>
  );
}

/** The whole app from its config: `export default createApp(config)` in App.tsx. */
export function createApp(config: AppConfig) {
  const brand: Brand = { name: config.name, icon: config.icon, tagline: config.tagline };
  const base = (load: () => Promise<Record<string, unknown>>, pick: (m: Record<string, unknown>) => React.ComponentType) =>
    async () => ({ Component: pick(await load()) });
  const router = createBrowserRouter([
    { path: "/sign-in", element: <SignInPage brand={brand} /> },
    { path: "/sign-up", element: <SignUpPage brand={brand} /> },
    { path: "/join/:token", element: <JoinPage brand={brand} /> },
    {
      element: <Shell config={config} />,
      errorElement: <RouteError />,
      children: [
        ...config.routes,
        { path: "/notifications", lazy: base(() => import("./notifications"), (m) => m.NotificationsPage as React.ComponentType) },
        { path: "/activity", lazy: base(() => import("./activity"), (m) => m.ActivityPage as React.ComponentType) },
        { path: "/settings", lazy: base(() => import("./settings"), (m) => m.SettingsPage as React.ComponentType) },
        { path: "/profile", lazy: async () => { const { ProfileRoute } = await import("./profile"); return { Component: () => <ProfileRoute labels={config.permissionLabels} /> }; } },
        { path: "/team", lazy: async () => { const { TeamRoute } = await import("./team"); return { Component: () => <TeamRoute labels={config.permissionLabels} /> }; } },
        { path: "/approvals", lazy: async () => ({ Component: (await import("@xano-sdk/agents/react")).ApprovalsPage }) },
        { path: "/agents", lazy: async () => { const { AgentsPage } = await import("@xano-sdk/agents/react"); return { Component: () => <AgentsPage appName={config.name} /> }; } },
        { path: "*", element: <NotFound /> },
      ],
    },
  ]);
  return function App() {
    return (
      <TooltipProvider>
        <SessionProvider><RouterProvider router={router} /></SessionProvider>
        <Toaster />
      </TooltipProvider>
    );
  };
}
