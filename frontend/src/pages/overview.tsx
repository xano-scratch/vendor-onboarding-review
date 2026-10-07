// The overview (CRAFT.md §18): "what needs me now?" Keeps the base's first-run steps that show the base app
// off (⌘K, the live second window, connecting an agent) and adds the domain's (the board, submitting).
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { AgentActivityFeed, ApprovalsWaiting, useAgents } from "@xano-sdk/agents/react";
import { useCan } from "@xano-sdk/rbac/react";
import { Skeleton } from "@/components/ui/skeleton";
import { FirstRun, LoadError, PageHeader, StatCard, openCommandPalette, perDay, useLoad } from "@/components/kit";
import { api } from "@/lib/api";
import { CaseStatusBadge, TierBadge, isOverdue, markStep, stepDone } from "@/lib/onboarding";
import { useMe } from "@/base/session";
import { useLive } from "@/base/live";
import { ActivityFeed } from "@/base/activity";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

/** What needs this person now, how the queue is trending, and what agents have done. */
export function OverviewPage() {
  const me = useMe();
  const canQueue = useCan("submissions.read_all");
  const { client } = useAgents();
  const ov = useLoad(() => api.overview(), []);
  const cases = useLoad(() => (canQueue ? api.queue({ per_page: "100" }) : api.mine({ per_page: "100" })), [canQueue]);
  useLive("submission", () => { ov.reload(); cases.reload(); });
  const agentsUsed = useLoad(() => client.connections().then((c) => c.some((x) => !!x.last_used_at)), [client]);

  const o = ov.data;
  const sla = cases.data?.sla_days ?? 5;
  const attention = (cases.data?.items ?? [])
    .filter((c) => c.status === "blocked" || isOverdue(c.created_at, c.status, sla))
    .sort((a, b) => a.created_at - b.created_at).slice(0, 6);
  const trend = perDay(o?.recent_approved ?? [], (r) => r.created_at, 14);
  const lastWeek = trend.slice(7).reduce((a, b) => a + b, 0), prevWeek = trend.slice(0, 7).reduce((a, b) => a + b, 0);
  const loading = !o;
  const base = canQueue ? "/board" : "/mine";

  return (
    <div className="flex flex-col gap-6" data-testid="overview-page">
      <PageHeader title={`${greeting()}, ${me.name.split(" ")[0]}`} description="What needs you now, how the review queue is trending, and what your agents have done." />
      <ApprovalsWaiting />
      <FirstRun storageKey={`first-run:${me.id}`} title="Get to know Vendor Onboarding Review" steps={[
        { id: "board", title: canQueue ? "Open the Review board" : "Track your submissions", description: canQueue ? "Cases by stage. Drop one into Approved to complete it; the API gates an incomplete case." : "Follow your filed cases through review.", href: base, done: stepDone("board") },
        { id: "submit", title: "Submit a vendor", description: "File a vendor; it is scored and routed for the approvals its risk tier needs.", href: "/submit", done: stepDone("submit") },
        { id: "palette", title: "Find any case with ⌘K", description: "Jump to a case by vendor name or id from the keyboard.", onClick: () => { markStep("palette"); openCommandPalette(); }, done: stepDone("palette") },
        { id: "live", title: "Watch it update live", description: "Open this app in a second window as another person, decide a step there, and see it here.", onClick: () => { markStep("live"); window.open(location.origin, "_blank", "noopener"); }, done: stepDone("live") },
        { id: "agent", title: "Connect an agent", description: "Give Claude Code a key, or sign in from ChatGPT or Claude, to work the queue.", href: "/agents", done: agentsUsed.data === true },
      ]} />
      {ov.error ? <LoadError error={ov.error} onRetry={ov.reload} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Open cases" value={o?.open_cases ?? 0} hint="In the pipeline" href={base} loading={loading} />
          <StatCard label="Blocked" value={o?.blocked ?? 0} href={`${base}?status=blocked`} loading={loading}
            hint={(o?.blocked ?? 0) > 0 ? <span className="font-medium text-warning">Needs rework</span> : "Nothing blocked"} />
          <StatCard label="High-risk awaiting" value={o?.high_awaiting ?? 0} hint="Open high-risk cases" href={base} loading={loading} />
          <StatCard label="Approved this week" value={o?.approved_7d ?? 0} hint="Last 7 days" trend={trend} delta={{ value: lastWeek - prevWeek, label: "Against the 7 days before" }} loading={loading} />
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Needs attention" className="rounded-lg border bg-card">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-medium">Needs attention</h2>
            <Link to={base} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{canQueue ? "Review board" : "My submissions"}<ArrowRight className="size-3.5" /></Link>
          </header>
          {!cases.data ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={`skeleton-${i}`} className="h-4 w-full" />)}</div>
            : attention.length === 0 ? <p className="p-4 text-[0.8125rem] text-muted-foreground">Nothing blocked or overdue. The queue is healthy.</p> : (
              <ul className="divide-y">
                {attention.map((c) => {
                  const overdue = isOverdue(c.created_at, c.status, sla);
                  return (
                    <li key={c.id}>
                      <Link to={`/cases/${c.id}`} className="flex min-w-0 items-center gap-3 px-4 py-2 text-[0.8125rem] hover:bg-muted/50 active:bg-muted">
                        <span className="min-w-0 flex-1 truncate font-medium" title={c.vendor_name}>{c.vendor_name}</span>
                        <TierBadge tier={c.risk_tier} />
                        <CaseStatusBadge status={c.status} />
                        {overdue && <span className="w-16 shrink-0 text-right text-xs font-medium text-warning">Overdue</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
        </section>
        <AgentActivityFeed limit={6} />
      </div>
      <ActivityFeed entities={["submission"]} />
    </div>
  );
}
