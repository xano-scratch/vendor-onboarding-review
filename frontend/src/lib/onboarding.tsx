// What the onboarding screens share: the status and tier vocabularies, the attribute labels, the overdue
// rule, the first-run flags, and the agent-draft markers.
import { useEffect, useState } from "react";
import { useAgents } from "@xano-sdk/agents/react";
import { StatusBadge, type Tone } from "@/components/kit";
import type { Category, DataLevel, SpendBand, Status, Tier } from "@/lib/api";

const DAY = 86_400_000;

/** The case status vocabulary: the board's columns, left to right, and the badge tones everywhere. */
export const STATUSES: { value: Status; label: string; tone: Tone; hint: string }[] = [
  { value: "submitted", label: "Submitted", tone: "neutral", hint: "Filed, not yet reviewed" },
  { value: "in_review", label: "In review", tone: "info", hint: "Approvals in progress" },
  { value: "blocked", label: "Blocked", tone: "warning", hint: "A step was returned" },
  { value: "approved", label: "Approved", tone: "success", hint: "Completed by an admin" },
  { value: "rejected", label: "Rejected", tone: "danger", hint: "Declined" },
];
export const statusOf = (s: string | null | undefined) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];

export const TIERS: { value: Tier; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "services", label: "Services" },
  { value: "data_processor", label: "Data processor" },
];
export const SPEND_BANDS: { value: SpendBand; label: string }[] = [
  { value: "low", label: "Low spend" },
  { value: "mid", label: "Mid spend" },
  { value: "high", label: "High spend" },
];
export const DATA_LEVELS: { value: DataLevel; label: string }[] = [
  { value: "none", label: "No data access" },
  { value: "internal", label: "Internal data" },
  { value: "pii", label: "Handles PII" },
];
export const labelOf = (list: { value: string; label: string }[], v: string | null | undefined) => list.find((x) => x.value === v)?.label ?? String(v ?? "");

/** The risk tier is the app's own scale, so it gets its own mark: high is the one that says "look at this". */
export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (tier === "high") return <StatusBadge tone="danger">High risk</StatusBadge>;
  if (tier === "medium") return <StatusBadge tone="neutral">Medium</StatusBadge>;
  return <StatusBadge tone="neutral">Low</StatusBadge>;
}

export function CaseStatusBadge({ status }: { status: string | null | undefined }) {
  const s = statusOf(status);
  return <StatusBadge tone={s.tone} dot>{s.label}</StatusBadge>;
}

/** A case open past the review SLA is overdue (still submitted / in review / blocked). */
export const isOverdue = (createdAt: number, status: string, slaDays: number) =>
  (status === "submitted" || status === "in_review" || status === "blocked") && Date.now() - createdAt > slaDays * DAY;

/** UI-only first-run steps (pressing ⌘K) remember they happened, per browser. */
export const markStep = (id: string) => { try { localStorage.setItem(`vor.step.${id}`, "1"); } catch { /* storage off */ } };
export const stepDone = (id: string) => { try { return localStorage.getItem(`vor.step.${id}`) === "1"; } catch { return false; } };

/** The cases an agent draft is waiting on (each pending approval's link names its case), for a marker. */
export function usePendingDrafts() {
  const { client } = useAgents();
  const [ids, setIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    client.approvals("pending").then((p) => setIds(new Set(p.items
      .filter((a) => !a.expires_at || a.expires_at > Date.now())
      .map((a) => Number(/^\/cases\/(\d+)/.exec(a.link ?? "")?.[1])).filter(Boolean))), () => {});
  }, [client]);
  return ids;
}
