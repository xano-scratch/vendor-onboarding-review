import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@xano-sdk/rbac/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadError, PageHeader, StatCard, useLoad } from "@/components/kit";
import { api } from "@/lib/api";
import { CATEGORIES, DATA_LEVELS, SPEND_BANDS, labelOf } from "@/lib/onboarding";
import { useLive } from "@/base/live";

const ATTR: Record<string, string> = { category: "Category", country: "Country", annual_spend_band: "Annual spend", data_access_level: "Data access" };
const matchLabel = (attr: string, val: string) =>
  attr === "category" ? labelOf(CATEGORIES, val) : attr === "annual_spend_band" ? labelOf(SPEND_BANDS, val) : attr === "data_access_level" ? labelOf(DATA_LEVELS, val) : val;

/** The governed rule set: the one place the tier is decided. Admins publish a new version and set the
 * review SLA; everyone who can read the queue can see how a score is built. */
export function RulesPage() {
  const { data, error, reload } = useLoad(() => api.rules(), []);
  useLive("rule", reload);
  const canManage = useCan("rules.manage");
  const [sla, setSla] = useState("");
  const [busy, setBusy] = useState(false);

  if (error) return <LoadError title="The rules didn't load" error={error} onRetry={reload} />;
  const rules = data?.rules ?? [];

  async function publish() {
    setBusy(true);
    try { const r = await api.activateRules(); toast.success(`Published rule version ${r.version}`); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(false); }
  }
  async function saveSla() {
    const n = Number(sla);
    if (!(n >= 1 && n <= 90)) { toast.error("The review SLA is 1 to 90 days."); return; }
    setBusy(true);
    try { await api.updateSettings(n); toast.success("Review SLA updated"); setSla(""); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="rules-page">
      <PageHeader title="Risk rules" description="The active scoring set. A rule adds points when a vendor attribute matches; the total maps to a tier."
        actions={canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" disabled={busy}>Publish new version</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish a new rule version?</AlertDialogTitle>
                <AlertDialogDescription>This snapshots the current rules into the next version and retires the one before it, so the version that decided each past case stays on the record.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void publish()}>Publish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active version" value={data ? data.version : "—"} hint="Decides every new case" loading={!data} />
        <StatCard label="Active rules" value={rules.length} hint="In this version" loading={!data} />
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">Review SLA</p>
          <p className="mt-1 text-sm">A case open longer than <span className="font-medium tabular-nums">{data?.sla_days ?? "—"}</span> days is flagged overdue.</p>
          {canManage && (
            <div className="mt-3 flex items-center gap-2">
              <Input className="h-8 w-20" type="number" min={1} max={90} value={sla} placeholder={String(data?.sla_days ?? 5)} onChange={(e) => setSla(e.target.value)} aria-label="Review SLA in days" />
              <Button size="sm" variant="outline" disabled={busy || !sla} onClick={() => void saveSla()}>Save</Button>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-medium">Scoring rules</h2>
          <p className="text-xs text-muted-foreground tabular-nums">Thresholds: under 20 low · 20–59 medium · 60+ high</p>
        </header>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attribute</TableHead>
                <TableHead>Matches</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{ATTR[r.attribute] ?? r.attribute}</TableCell>
                  <TableCell className="font-medium">{matchLabel(r.attribute, r.match_value)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
