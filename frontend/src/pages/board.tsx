import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Bot } from "lucide-react";
import { useCan } from "@xano-sdk/rbac/react";
import { DateLabel, KanbanBoard, PageHeader, optimistic, useLoad } from "@/components/kit";
import { api, type CaseItem } from "@/lib/api";
import { STATUSES, TierBadge, isOverdue, markStep, usePendingDrafts } from "@/lib/onboarding";
import { useLive } from "@/base/live";
import { PresenceAvatars } from "@/base/presence";

/** First-plus-last initial, for the "who filed it" avatar on each card. */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** The governed Review board (the signature view): every case by stage. Dropping a case into Approved
 * attempts completion, and the API-layer gate refuses it (card snaps back, reason toasted) until every
 * required approval is granted. Only an admin sees the drag handle into Approved. */
export function BoardPage() {
  const q = useLoad(() => api.queue({ per_page: "100" }), []);
  useLive("submission", q.reload);
  useEffect(() => markStep("board"), []);
  const navigate = useNavigate();
  const canComplete = useCan("submissions.complete");
  const drafts = usePendingDrafts();
  const rows = q.data?.items ?? null;
  const sla = q.data?.sla_days ?? 5;
  const patchItem = (id: number, patch: Partial<CaseItem>) =>
    q.setData((p) => (p ? { ...p, items: p.items.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : p));

  function completeMove(item: CaseItem) {
    void optimistic({
      apply: () => {
        patchItem(item.id, { status: "approved", outstanding: 0 });
        return () => patchItem(item.id, { status: item.status, outstanding: item.outstanding });
      },
      run: () => api.complete(item.id),
      success: `Completed the ${item.vendor_name} case`,
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="board-page">
      <PageHeader title="Review board"
        description={canComplete ? "Every case by stage. Drop a case into Approved to complete it; the API refuses until every approval is granted." : "Every case by stage. Only an admin completes a case."}
        actions={<PresenceAvatars room="board" />} />
      <KanbanBoard label="Cases by stage" items={rows} error={q.error} onRetry={q.reload}
        columns={STATUSES.map((s) => ({ id: s.value, title: s.label, tone: s.tone, hint: s.hint }))}
        columnOf={(c) => c.status} itemKey={(c) => c.id}
        canMove={(c, to) => to === "approved" && c.status !== "approved" && canComplete}
        onOpen={(c) => navigate(`/cases/${c.id}`)}
        onMove={(c, to) => { if (to === "approved") completeMove(c); }}
        renderCard={(c) => {
          const overdue = isOverdue(c.created_at, c.status, sla);
          return (
            <>
              <span className="font-medium wrap-anywhere" title={c.vendor_name}>{c.vendor_name}</span>
              <span className="flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                <span className="tabular-nums">#{c.id}</span>
                <TierBadge tier={c.risk_tier} />
                {drafts.has(c.id) && <span title="An agent draft is waiting for approval" className="inline-flex items-center gap-1 text-info"><Bot className="size-3.5" />Draft</span>}
                {c.submitted_by_name && <span title={`Filed by ${c.submitted_by_name}`} className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[0.625rem] font-medium text-foreground">{initials(c.submitted_by_name)}</span>}
              </span>
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className={c.outstanding > 0 ? "text-muted-foreground tabular-nums" : "text-success"}>{c.outstanding > 0 ? `${c.outstanding} approval${c.outstanding === 1 ? "" : "s"} left` : "All approved"}</span>
                {overdue && <span className="font-medium whitespace-nowrap text-warning">Overdue · <DateLabel value={c.created_at + sla * 86_400_000} /></span>}
              </span>
            </>
          );
        }} />
    </div>
  );
}
