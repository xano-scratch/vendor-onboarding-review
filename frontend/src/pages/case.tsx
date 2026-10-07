import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { RecordApprovals } from "@xano-sdk/agents/react";
import { useCan } from "@xano-sdk/rbac/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Ago, DateLabel, Field, Fields, LoadError, PageHeader, StatusBadge, useLoad } from "@/components/kit";
import { api, type CaseStep } from "@/lib/api";
import { CATEGORIES, CaseStatusBadge, DATA_LEVELS, SPEND_BANDS, TierBadge, labelOf } from "@/lib/onboarding";
import { useMe } from "@/base/session";
import { useLive } from "@/base/live";
import { PresenceAvatars } from "@/base/presence";
import { RecordTimeline } from "@/base/activity";

const stepTone = (s: string) => (s === "approved" ? "success" : s === "rejected" ? "danger" : "neutral");
const stepIcon = (s: string) => (s === "approved" ? CheckCircle2 : s === "rejected" ? XCircle : Clock);
const actionLabel: Record<string, string> = { submit: "Submitted", score: "Scored", rescore: "Rescored", approve: "Approved a step", reject: "Rejected a step", complete: "Completed", block: "Completion blocked" };
const stepLabel: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };

export function CasePage() {
  const { id } = useParams();
  const me = useMe();
  const { data, error, reload } = useLoad(() => api.caseDetail(id!), [id]);
  useLive("submission", reload);
  const canDecide = useCan("approvals.decide");
  const canComplete = useCan("submissions.complete");
  const canRules = useCan("rules.manage");
  const canQueue = useCan("submissions.read_all");
  const [rejecting, setRejecting] = useState<CaseStep | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <LoadError title="This case didn't load" error={error} onRetry={reload} />;

  const sub = data?.submission;
  const vendor = data?.vendor;
  const steps = data?.approvals ?? [];
  const outstanding = steps.filter((a) => a.status !== "approved").length;
  const ready = data ? outstanding === 0 : false;
  // A role-MATCH, not a permission: a step names the exact role that must grant it (approver vs admin), so the
  // UI reads me.role to match it. The permission (approvals.decide) is checked with useCan; the backend guard
  // enforces both, so this only hides buttons a wrong-role person would be refused anyway.
  const canDecideStep = (step: CaseStep) => canDecide && step.status === "pending" && me.role === step.role_required;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="case-page">
      <Link to={canQueue ? "/board" : "/mine"} className="inline-flex w-fit items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />{canQueue ? "Review board" : "My submissions"}
      </Link>
      {!data || !sub || !vendor ? (
        <><Skeleton className="h-7 w-2/3" /><Skeleton className="h-48 w-full max-w-2xl" /></>
      ) : (
        <>
          <PageHeader title={vendor.name} description={`Case #${sub.id}`} actions={<PresenceAvatars room={`case-${sub.id}`} />}>
            {canRules && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => api.rescore(sub.id), "Rescored against the active rules")}>Rescore</Button>
            )}
            {canComplete && sub.status !== "approved" && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" disabled={busy}>Complete case</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Complete this case?</AlertDialogTitle>
                    <AlertDialogDescription>This finalizes the case and marks the vendor approved. The API refuses completion if any required approval is still pending.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void run(() => api.complete(sub.id), "Case approved and completed")}>Complete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </PageHeader>

          <RecordApprovals link={`/cases/${sub.id}`} />

          {/* Determination: the governed result a reviewer reads first. */}
          <section className="max-w-2xl rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <TierBadge tier={sub.risk_tier} />
              <span className="text-sm font-medium tabular-nums">{sub.risk_score} points</span>
              <span className="text-xs text-muted-foreground">decided by rule version {sub.rule_version}</span>
              <span className="ml-auto"><CaseStatusBadge status={sub.status} /></span>
            </div>
            <Fields>
              <Field label="Category">{labelOf(CATEGORIES, vendor.category)}</Field>
              <Field label="Country">{vendor.country || "Not given"}</Field>
              <Field label="Annual spend">{labelOf(SPEND_BANDS, vendor.annual_spend_band)}</Field>
              <Field label="Data access">{labelOf(DATA_LEVELS, vendor.data_access_level)}</Field>
              <Field label="Submitted"><Ago value={sub.created_at} /></Field>
            </Fields>
          </section>

          {/* The required-approval checklist and the completion gate. */}
          <section className="max-w-2xl rounded-lg border bg-card">
            <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-sm font-medium">Required approvals</h2>
              <span className={ready ? "inline-flex items-center gap-1 text-xs text-success" : "inline-flex items-center gap-1 text-xs text-warning"}>
                <ShieldAlert className="size-3.5" />{ready ? "All granted — ready to complete" : `${outstanding} still pending — completion is gated`}
              </span>
            </header>
            <ol className="divide-y">
              {steps.map((step) => {
                const Icon = stepIcon(step.status);
                return (
                  <li key={step.id} className="flex items-start gap-3 px-4 py-3">
                    <Icon className={`mt-0.5 size-4 shrink-0 ${step.status === "approved" ? "text-success" : step.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2 text-[0.8125rem]">
                        <span className="font-medium">Step {step.sequence}</span>
                        <span className="text-muted-foreground">needs {step.role_required === "admin" ? "an admin" : "an approver"}</span>
                        <StatusBadge tone={stepTone(step.status)}>{stepLabel[step.status] ?? step.status}</StatusBadge>
                      </span>
                      {step.decided_by_name && <span className="text-xs text-muted-foreground">by {step.decided_by_name}</span>}
                      {step.reason && <span className="text-xs wrap-anywhere text-muted-foreground">“{step.reason}”</span>}
                    </div>
                    {canDecideStep(step) && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api.approve(sub.id, step.id), "Step approved")}>Approve</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(step)}>Reject</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* The append-only governed audit trail. */}
          <section className="max-w-2xl rounded-lg border bg-card">
            <header className="border-b px-4 py-3"><h2 className="text-sm font-medium">Audit trail</h2></header>
            <ol className="divide-y">
              {data.events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 px-4 py-2.5 text-[0.8125rem]">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{actionLabel[ev.action] ?? ev.action}</span>
                    {ev.actor_name && <span className="text-muted-foreground"> · {ev.actor_name}</span>}
                    {ev.from_status && ev.to_status && ev.from_status !== ev.to_status && <span className="text-muted-foreground"> · {ev.from_status || "new"} → {ev.to_status}</span>}
                    {ev.note && <span className="block text-xs wrap-anywhere text-muted-foreground">{ev.note}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums"><DateLabel value={ev.created_at} /></span>
                </li>
              ))}
            </ol>
          </section>

          <section className="max-w-2xl rounded-lg border bg-card p-4"><RecordTimeline entity="submission" id={sub.id} /></section>
        </>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
        <DialogContent className="sm:max-w-md">
          <RejectForm step={rejecting} onCancel={() => setRejecting(null)}
            onReject={(reason) => void run(() => api.reject(Number(id), rejecting!.id, reason).then(() => setRejecting(null)), "Case returned to the requester")} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RejectForm({ step, onReject, onCancel }: { step: CaseStep | null; onReject: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!step) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (reason.trim().length < 3) { setError("Give a short reason."); return; } onReject(reason.trim()); }} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Return this case</DialogTitle>
        <DialogDescription>Rejecting step {step.sequence} blocks the case and tells the requester why.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="reject-reason">Reason</Label>
        <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus aria-invalid={!!error || undefined} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="destructive">Return case</Button>
      </DialogFooter>
    </form>
  );
}
