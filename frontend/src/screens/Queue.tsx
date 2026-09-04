import { useCallback, useEffect, useState } from "react";
import { Inbox, ChevronRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { getQueue, type Submission, type Vendor, type PendingApproval } from "@/lib/api";
import { STATUS_LABEL, TIER_LABEL, CATEGORY_LABEL } from "@/lib/format";

const ALL = "all";

export function Queue({ onOpenCase, reloadKey }: { onOpenCase: (id: number) => void; reloadKey: number }) {
  const [status, setStatus] = useState(ALL);
  const [tier, setTier] = useState(ALL);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getQueue({
        status: status === ALL ? undefined : status,
        risk_tier: tier === ALL ? undefined : tier,
      });
      setSubmissions(res.submissions);
      setVendors(res.vendors);
      setPending(res.pending_approvals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the queue");
    } finally {
      setLoading(false);
    }
  }, [status, tier]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const outstandingFor = (submissionId: number) =>
    pending.filter((p) => p.submission_id === submissionId).length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Inbox className="size-5" />
                <CardTitle>Review queue</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Cases waiting on sign-off. The outstanding count is how many required approvals are still pending.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="w-44">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tiers</SelectItem>
                  {Object.entries(TIER_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label} risk
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="divide-y overflow-hidden rounded-lg border">
            <div className="text-muted-foreground bg-muted/40 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 text-xs font-medium">
              <span>Vendor</span>
              <span className="w-24">Tier</span>
              <span className="w-28">Status</span>
              <span className="w-28 text-right">Outstanding</span>
            </div>
            {submissions.length === 0 && !loading && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">No cases match these filters.</div>
            )}
            {submissions.map((s) => {
              const vendor = vendorById.get(s.vendor_id);
              const outstanding = outstandingFor(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenCase(s.id)}
                  className="hover:bg-accent grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{vendor?.name ?? `Vendor #${s.vendor_id}`}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {vendor ? CATEGORY_LABEL[vendor.category] : ""} {vendor ? `· ${vendor.country}` : ""}
                    </span>
                  </span>
                  <span className="w-24">
                    <RiskBadge tier={s.risk_tier} />
                  </span>
                  <span className="w-28">
                    <StatusBadge status={s.status} />
                  </span>
                  <span className="flex w-28 items-center justify-end gap-2">
                    <span className={outstanding > 0 ? "font-semibold text-amber-300" : "text-muted-foreground"}>
                      {outstanding}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
