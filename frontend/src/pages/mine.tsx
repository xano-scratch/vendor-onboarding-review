import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ago, DataList, EmptyState, PageHeader, Pager, StatusTabs, useLoad, useUrlState, type Column } from "@/components/kit";
import { api, type CaseItem } from "@/lib/api";
import { CaseStatusBadge, STATUSES, TierBadge, markStep } from "@/lib/onboarding";
import { useLive } from "@/base/live";

const PAGE = 20;

/** The cases the signed-in person filed. A requester's own view, since they can't see the full queue. */
export function MinePage() {
  const navigate = useNavigate();
  const [q, setQ] = useUrlState({ status: "", page: "1" });
  const list = useLoad(() => api.mine({ status: q.status, page: q.page, per_page: String(PAGE) }), [q.status, q.page]);
  const counts = useLoad(() => api.mine({ per_page: "200" }), []);
  useLive("submission", () => { list.reload(); counts.reload(); });
  useEffect(() => markStep("board"), []);
  const rows = list.data?.items ?? null;

  const tabs = useMemo(() => {
    const all = counts.data?.items ?? [];
    return [{ value: "", label: "All", count: counts.data ? all.length : undefined },
      ...STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts.data ? all.filter((c) => c.status === s.value).length : undefined }))];
  }, [counts.data]);

  const columns: Column<CaseItem>[] = [
    { id: "vendor", header: "Vendor", cell: (c) => <span className="truncate font-medium" title={c.vendor_name}><span className="text-muted-foreground tabular-nums">#{c.id}</span> {c.vendor_name}</span> },
    { id: "tier", header: "Risk", className: "w-28", cell: (c) => <TierBadge tier={c.risk_tier} /> },
    { id: "status", header: "Status", className: "w-32", cell: (c) => <CaseStatusBadge status={c.status} /> },
    { id: "outstanding", header: "Approvals left", className: "w-32 tabular-nums", cell: (c) => (c.outstanding > 0 ? String(c.outstanding) : <span className="text-success">Done</span>) },
    { id: "created", header: "Filed", className: "w-32 whitespace-nowrap text-muted-foreground", cell: (c) => <Ago value={c.created_at} /> },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="mine-page">
      <PageHeader title="My submissions" description="The vendor cases you filed, newest first. Open one to follow its review."
        actions={<Button size="sm" asChild><Link to="/submit">Submit a vendor</Link></Button>}>
        <StatusTabs value={q.status} onChange={(v) => setQ({ status: v })} options={tabs} label="Filter by status" />
      </PageHeader>
      <DataList label="My submissions" rows={rows} error={list.error} onRetry={list.reload} columns={columns} rowKey={(c) => c.id}
        pageSize={PAGE} onOpen={(c) => navigate(`/cases/${c.id}`)}
        mobileRow={(c) => (
          <>
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{c.vendor_name}</span>
              <CaseStatusBadge status={c.status} />
            </span>
            <span className="truncate text-xs text-muted-foreground">#{c.id} · {c.risk_tier} risk · {c.outstanding} left</span>
          </>
        )}
        empty={q.status
          ? <EmptyState icon={ClipboardList} title="Nothing here" description="No cases in this status. Clear the filter to see them all."
              action={<Button variant="outline" size="sm" onClick={() => setQ({ status: "" })}>Clear filter</Button>} />
          : <EmptyState icon={ClipboardList} title="No submissions yet" description="File a vendor and it shows up here, with its risk tier and review progress."
              action={<Button size="sm" asChild><Link to="/submit">Submit a vendor</Link></Button>} />}
        footer={list.data && <Pager page={list.data.curPage} pageTotal={list.data.pageTotal} itemsTotal={list.data.itemsTotal} noun="cases" onPage={(p) => setQ({ page: String(p) })} />} />
    </div>
  );
}
