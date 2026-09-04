import { cn } from "@/lib/utils";
import { TIER_LABEL, STATUS_LABEL, APPROVAL_STATUS_LABEL, ACTION_LABEL, titleCaseRole } from "@/lib/format";

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

const TIER_STYLES: Record<string, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  high: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function RiskBadge({ tier }: { tier: string }) {
  return <Pill className={TIER_STYLES[tier] ?? "border-border bg-muted text-muted-foreground"}>{TIER_LABEL[tier] ?? tier} risk</Pill>;
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "border-border bg-muted text-muted-foreground",
  in_review: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  blocked: "border-red-500/30 bg-red-500/10 text-red-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function StatusBadge({ status }: { status: string }) {
  return <Pill className={STATUS_STYLES[status] ?? "border-border bg-muted text-muted-foreground"}>{STATUS_LABEL[status] ?? status}</Pill>;
}

const APPROVAL_STYLES: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function ApprovalStatusBadge({ status }: { status: string }) {
  return <Pill className={APPROVAL_STYLES[status] ?? "border-border bg-muted text-muted-foreground"}>{APPROVAL_STATUS_LABEL[status] ?? status}</Pill>;
}

export function RoleBadge({ role }: { role: string }) {
  return <Pill className="border-border bg-secondary text-secondary-foreground">{titleCaseRole(role)}</Pill>;
}

const ACTION_STYLES: Record<string, string> = {
  submit: "border-border bg-muted text-muted-foreground",
  score: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  approve: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  reject: "border-red-500/30 bg-red-500/10 text-red-300",
  complete: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  block: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function ActionBadge({ action }: { action: string }) {
  return <Pill className={ACTION_STYLES[action] ?? "border-border bg-muted text-muted-foreground"}>{ACTION_LABEL[action] ?? action}</Pill>;
}
