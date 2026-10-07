import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The status vocabulary (CRAFT.md §9): neutral, info, success (good), warning (needs a human), danger. */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/12 text-destructive",
};

/** One status, as a small tinted pill. A status never paints a row or a card. */
export function StatusBadge({ tone = "neutral", dot = false, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span data-slot="status-badge" data-tone={tone}
      className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
