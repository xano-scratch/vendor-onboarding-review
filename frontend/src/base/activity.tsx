// Activity (BASELINE.md): what people and their agents did, from the rows app/changed writes. The overview's feed,
// /activity, and a record's timeline (`<RecordTimeline entity="job" id={12} />`). All three update live.
import { Link } from "react-router";
import { ArrowRight, Bot, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Ago, EmptyState, LoadError, PageHeader, Pager, initialsOf, useLoad, useUrlState } from "@/components/kit";
import { baseApi, type Activity } from "./api";
import { useLive } from "./live";
import { useWorkspace } from "./workspace";

function Item({ a }: { a: Activity }) {
  const { nameOf } = useWorkspace();
  const who = a.actor_name || nameOf(a.actor_id);
  const body = (
    <>
      <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[0.625rem] font-medium">
        {a.via ? <Bot className="size-3.5" /> : initialsOf(who)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem]" title={`${who} ${a.title}`}><span className="font-medium">{who}</span>{a.via && <span className="text-muted-foreground"> via {a.via}</span>} {a.title}</span>
        <Ago value={a.created_at} className="text-xs text-muted-foreground" />
      </span>
    </>
  );
  return (
    <li data-kit="activity-item">
      {a.link ? <Link to={a.link} className="flex min-w-0 items-start gap-3 px-4 py-2 hover:bg-muted/50 active:bg-muted">{body}</Link>
        : <div className="flex min-w-0 items-start gap-3 px-4 py-2">{body}</div>}
    </li>
  );
}

function useActivity(q: { entity?: string; entity_id?: number; page?: number; per_page?: number }, liveOn: string[]) {
  const list = useLoad(() => baseApi.activity(q), [q.entity, q.entity_id, q.page, q.per_page]);
  useLive(liveOn, list.reload);
  return list;
}

function Rows({ list, empty }: { list: ReturnType<typeof useActivity>; empty: string }) {
  if (list.error) return <LoadError error={list.error} onRetry={list.reload} className="m-3" />;
  if (!list.data) return <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={`skeleton-${i}`} className="h-8 w-full" />)}</div>;
  if (list.data.items.length === 0) return <p className="p-4 text-[0.8125rem] text-muted-foreground">{empty}</p>;
  return <ul className="divide-y">{list.data.items.map((a) => <Item key={a.id} a={a} />)}</ul>;
}

/**
 * The overview's "what happened" card: people's and agents' latest actions. `entities` are what it listens to
 * live (the domain's tables); it always listens to the base's own.
 */
export function ActivityFeed({ limit = 6, entities = [], title = "Recent activity" }: { limit?: number; entities?: string[]; title?: string }) {
  const list = useActivity({ per_page: limit }, ["user", "settings", "invite", ...entities, "*"]);
  return (
    <section aria-label={title} className="rounded-lg border bg-card" data-kit="activity-feed">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link to="/activity" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">All activity<ArrowRight className="size-3.5" /></Link>
      </header>
      <Rows list={list} empty="Nothing yet. What people and their agents do shows up here, as it happens." />
    </section>
  );
}

/** A record's history, on its detail page or sheet: `<RecordTimeline entity="job" id={job.id} />`. */
export function RecordTimeline({ entity, id, title = "History" }: { entity: string; id: number; title?: string }) {
  const list = useActivity({ entity, entity_id: id, per_page: 20 }, [entity]);
  return (
    <section aria-label={title} data-kit="record-timeline">
      <h3 className="mb-1 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">{title}</h3>
      <div className="-mx-4"><Rows list={list} empty="No changes recorded yet." /></div>
    </section>
  );
}

/** /activity: everything people and their agents did, newest first, paged. */
export function ActivityPage() {
  const [q, setQ] = useUrlState({ page: "1" });
  const list = useActivity({ page: Number(q.page) || 1, per_page: 30 }, ["*"]);
  return (
    <div className="flex flex-col gap-4" data-testid="activity-page">
      <PageHeader title="Activity" description="What people and their agents did, newest first. It updates as it happens." />
      {list.data && list.data.items.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" description="Changes to records, invites and settings show up here as they happen." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Rows list={list} empty="" />
          {list.data && list.data.pageTotal > 1 && <div className="border-t px-4 py-2"><Pager page={list.data.curPage} pageTotal={list.data.pageTotal} onPage={(p) => setQ({ page: String(p) })} /></div>}
        </div>
      )}
    </div>
  );
}
