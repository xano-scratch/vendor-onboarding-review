// The app's frontend config (BASELINE.md): its name and icon, its screens, its nav, its ⌘K actions and record
// search, its permissions in plain words, and its assistant. The base app (src/base) builds everything else.
import { ClipboardList, KanbanSquare, LayoutDashboard, Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router";
import { useCan } from "@xano-sdk/rbac/react";
import type { ChatTurn } from "@xano-sdk/chatbot/react";
import { page, type AppConfig } from "@/base/app";
import { api } from "@/lib/api";
import { markStep } from "@/lib/onboarding";

export const config: AppConfig = {
  name: "Vendor Onboarding Review",
  icon: ShieldCheck,
  tagline: "A governed procurement backend: risk-tier a vendor, derive the approvals it needs, and gate completion. Pick a person to sign in as.",

  routes: [
    { path: "/", lazy: page(() => import("./pages/overview"), "OverviewPage") },
    { path: "/board", lazy: page(() => import("./pages/board"), "BoardPage"), handle: { wide: true } },
    { path: "/submit", lazy: page(() => import("./pages/submit"), "SubmitPage") },
    { path: "/cases/:id", lazy: page(() => import("./pages/case"), "CasePage") },
    { path: "/mine", lazy: page(() => import("./pages/mine"), "MinePage") },
    { path: "/rules", lazy: page(() => import("./pages/rules"), "RulesPage") },
  ],

  useNav: () => {
    const canQueue = useCan("submissions.read_all");
    const canRules = useCan("rules.manage");
    return [{
      items: [
        // Short labels so the phone's bottom tab bar never truncates; at most 3 primary here (+ the base's
        // Approvals) keeps the bar to 4 tabs on every role.
        { href: "/", label: "Overview", icon: LayoutDashboard, primary: true, exact: true },
        ...(canQueue ? [{ href: "/board", label: "Board", icon: KanbanSquare, primary: true }] : []),
        { href: "/submit", label: "Submit", icon: Plus, primary: true },
        { href: "/mine", label: "My cases", icon: ClipboardList, primary: !canQueue },
        ...(canRules ? [{ href: "/rules", label: "Risk rules", icon: SlidersHorizontal }] : []),
      ],
    }];
  },

  usePaletteActions: () => {
    const navigate = useNavigate();
    const canQueue = useCan("submissions.read_all");
    return [
      { id: "submit", label: "Submit a vendor", group: "Actions", icon: Plus, shortcut: "S", run: () => navigate("/submit") },
      ...(canQueue ? [{ id: "board", label: "Open the review board", group: "Actions", icon: KanbanSquare, run: () => navigate("/board") }] : []),
    ];
  },
  search: (q, go) => {
    markStep("palette");
    const load = api.queue({ per_page: "100" }).catch(() => api.mine({ per_page: "100" }));
    return load.then((p) => p.items
      .filter((c) => (c.vendor_name ?? "").toLowerCase().includes(q.toLowerCase()) || String(c.id) === q.trim())
      .slice(0, 8)
      .map((c) => ({ id: String(c.id), label: c.vendor_name || `Case #${c.id}`, hint: `#${c.id} · ${c.risk_tier} risk`, group: "Cases", icon: ClipboardList, run: () => go(`/cases/${c.id}`) })));
  },
  shortcuts: [["S", "Submit a vendor"]],

  permissionLabels: {
    "submissions.create": "file vendor cases",
    "submissions.read_all": "see the whole review queue",
    "approvals.decide": "clear review steps",
    "submissions.complete": "complete cases (the final gate)",
    "rules.manage": "publish the rule set and rescore",
    "team.manage": "manage the team",
  },

  assistant: {
    name: "Onboarding assistant",
    welcome: "Ask about the review queue, why a case is blocked, or a vendor's risk.",
    suggestions: ["Summarise the review queue", "Why is the high-risk case blocked?", "What is the oldest pending case?"],
    followUps: (reply: ChatTurn) => {
      const used = reply.tools ?? [];
      if (used.includes("queue_summary")) return ["Why is the high-risk case blocked?", "What is the oldest pending case?"];
      if (used.includes("explain_score")) return ["Summarise the review queue", "Which cases are high risk?"];
      return ["Summarise the review queue", "Why is the high-risk case blocked?", "Which cases need an admin?"];
    },
  },
};
