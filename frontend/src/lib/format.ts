// Small display helpers shared across screens.

export const TIER_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  blocked: "Blocked",
  approved: "Approved",
  rejected: "Rejected",
};

export const ACTION_LABEL: Record<string, string> = {
  submit: "Submitted",
  score: "Rescored",
  approve: "Approved",
  reject: "Rejected",
  complete: "Completed",
  block: "Blocked at gate",
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const CATEGORY_LABEL: Record<string, string> = {
  software: "Software",
  hardware: "Hardware",
  services: "Services",
  data_processor: "Data processor",
};

export const DATA_LEVEL_LABEL: Record<string, string> = {
  none: "No data access",
  internal: "Internal data",
  pii: "Handles PII",
};

export const SPEND_LABEL: Record<string, string> = { low: "Low spend", mid: "Mid spend", high: "High spend" };

export function formatDate(epochms: number): string {
  const d = new Date(epochms);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCaseRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
