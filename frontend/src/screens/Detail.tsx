import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Gavel, ShieldAlert, CheckCircle2, XCircle, History, RotateCw, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RiskBadge, StatusBadge, RoleBadge, ApprovalStatusBadge, ActionBadge } from "@/components/badges";
import {
  getSubmission,
  approveStep,
  rejectStep,
  completeSubmission,
  rescoreSubmission,
  ApiError,
  type SubmissionResponse,
  type CurrentUser,
} from "@/lib/api";
import { formatDate, CATEGORY_LABEL, DATA_LEVEL_LABEL, SPEND_LABEL, STATUS_LABEL } from "@/lib/format";

export function Detail({
  submissionId,
  user,
  onBack,
  onChanged,
}: {
  submissionId: number;
  user: CurrentUser;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<SubmissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getSubmission(submissionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the case");
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, fn: () => Promise<unknown>, clearGate = true) {
    setBusy(key);
    if (clearGate) setGateMessage(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setGateMessage(e.message);
      else setGateMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return <div className="text-muted-foreground mx-auto max-w-3xl p-6 text-sm">Loading case...</div>;
  }
  if (error || !data || !data.submission) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back to queue
        </Button>
        <p className="text-destructive text-sm">{error ?? "Case not found"}</p>
      </div>
    );
  }

  const submission = data.submission;
  const vendor = data.vendor;
  const actorById = new Map(data.actors.map((a) => [a.id, a]));
  const approvals = data.required_approvals;
  const allApproved = approvals.length > 0 && approvals.every((a) => a.status === "approved");
  const isAdmin = user.role === "admin";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to queue
      </Button>

      {/* Determination */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="size-5" />
                <CardTitle>{vendor?.name ?? `Vendor #${submission.vendor_id}`}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {vendor
                  ? `${CATEGORY_LABEL[vendor.category]} · ${vendor.country} · ${SPEND_LABEL[vendor.annual_spend_band]} · ${DATA_LEVEL_LABEL[vendor.data_access_level]}`
                  : "Vendor detail unavailable"}
              </CardDescription>
            </div>
            <StatusBadge status={submission.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-3 text-sm">
            <span className="flex items-center gap-2">
              <Gavel className="text-muted-foreground size-4" />
              <RiskBadge tier={submission.risk_tier} />
            </span>
            <span>
              Risk score <span className="font-semibold">{submission.risk_score}</span>
            </span>
            <span className="text-muted-foreground">Decided by rule version {submission.rule_version}</span>
          </div>
        </CardContent>
      </Card>

      {/* Approval checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required approvals</CardTitle>
          <CardDescription>
            Derived from the risk tier. Each step must be granted by someone whose role matches the step. You are
            signed in as {user.name} <RoleBadge role={user.role} />.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.map((a) => {
            const canDecide = a.status === "pending" && user.role === a.role_required;
            return (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Step {a.sequence}</span>
                    <RoleBadge role={a.role_required} />
                  </span>
                  <ApprovalStatusBadge status={a.status} />
                </div>
                {a.reason && <p className="text-muted-foreground mt-2 text-sm">Reason: {a.reason}</p>}
                {a.status === "pending" && (
                  <div className="mt-3">
                    {canDecide ? (
                      rejectingId === a.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Reason for rejecting this step"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={!rejectReason || busy !== null}
                              onClick={() =>
                                void run(`reject-${a.id}`, async () => {
                                  await rejectStep(submission.id, a.id, rejectReason);
                                  setRejectingId(null);
                                  setRejectReason("");
                                })
                              }
                            >
                              Confirm rejection
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void run(`approve-${a.id}`, () => approveStep(submission.id, a.id))}
                          >
                            <CheckCircle2 className="size-4" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectingId(a.id)}>
                            <XCircle className="size-4" /> Reject
                          </Button>
                        </div>
                      )
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Needs a {a.role_required} to sign off. Your role cannot decide this step.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <Separator />

          {/* The API-layer completion gate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4" /> Completion gate
            </div>
            <p className="text-muted-foreground text-sm">
              The backend refuses to complete a case until every required approval is granted, and writes a block
              event when it does. Only an admin can complete.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!isAdmin || busy !== null || submission.status === "approved"}
                onClick={() => void run("complete", () => completeSubmission(submission.id))}
              >
                {submission.status === "approved" ? "Onboarding approved" : "Complete onboarding"}
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void run("rescore", () => rescoreSubmission(submission.id))}
                >
                  <RotateCw className="size-4" /> Rescore
                </Button>
              )}
              {!isAdmin && <span className="text-muted-foreground text-xs">Sign in as an admin to complete.</span>}
              {allApproved && submission.status !== "approved" && (
                <span className="text-xs text-emerald-400">All approvals in.</span>
              )}
            </div>
            {gateMessage && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-300">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{gateMessage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-5" />
            <CardTitle className="text-base">Audit trail</CardTitle>
          </div>
          <CardDescription>Every state change, in order, with the actor and the status transition.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {data.audit_trail.map((e) => {
              const actor = actorById.get(e.actor_id);
              return (
                <li key={e.id} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="bg-border size-2 rounded-full" />
                    <span className="bg-border/60 mt-1 w-px flex-1" />
                  </div>
                  <div className="flex-1 space-y-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionBadge action={e.action} />
                      <span className="text-sm font-medium">{actor?.name ?? `User #${e.actor_id}`}</span>
                      <span className="text-muted-foreground text-xs">{formatDate(e.created_at)}</span>
                    </div>
                    {(e.from_status || e.to_status) && (
                      <p className="text-muted-foreground text-xs">
                        {STATUS_LABEL[e.from_status ?? ""] ?? e.from_status ?? "—"} → {STATUS_LABEL[e.to_status ?? ""] ?? e.to_status ?? "—"}
                      </p>
                    )}
                    {e.note && <p className="text-sm">{e.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
