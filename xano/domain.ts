// The template's own backend: its tables, functions, endpoints, agent tools and assistant tools (BASELINE.md).
// xano/index.ts registers everything listed here, beside the base app and the modules. Put each def in its own
// file (table/<name>.ts, query/<group>.ts, query/<group>/<name>.ts, function/<name>.ts) and list it below.
//
// Every endpoint or tool that writes one of these tables calls `changed(...)` from ./base/index.js in the same
// stack, so open screens update live and the activity feed records it (audit-bundle.mjs checks).

import { vendors } from "./table/vendors.js";
import { risk_rules } from "./table/risk_rules.js";
import { submissions } from "./table/submissions.js";
import { required_approvals } from "./table/required_approvals.js";
import { approval_events } from "./table/approval_events.js";
import { onboarding } from "./query/onboarding.js";
import { scoreVendor } from "./function/score_vendor.js";
import { approveStep, completeCase } from "./function/case_actions.js";
import { overview, queue, mine, caseDetail, vendorList, rulesList } from "./query/onboarding/reads.js";
import { submit, approve, reject, complete, rescore, activateRules, updateSettings } from "./query/onboarding/writes.js";
import { onboardingAgentTools, onboardingAgentPrompts, onboardingAgentResources } from "./query/onboarding/agent-tools.js";
import { onboardingAssistantTools } from "./query/onboarding/assistant-tools.js";

export const tables = [vendors, risk_rules, submissions, required_approvals, approval_events];
export const functions = [scoreVendor, approveStep, completeCase];
export const apiGroups = [onboarding];
export const queries = [overview, queue, mine, caseDetail, vendorList, rulesList, submit, approve, reject, complete, rescore, activateRules, updateSettings];

/** MCP tools (AGENT-ACCESS.md §2): `agent.tool({...})` defs. index.ts adds `approvals.checkTool("mcp")`. */
export const agentTools = onboardingAgentTools;
export const agentPrompts = onboardingAgentPrompts;
export const agentResources = onboardingAgentResources;

/** The assistant's domain tools (CHATBOT.md §1): `tool({...})` defs. The base adds what-changed and notifications. */
export const assistantTools = onboardingAssistantTools;

/** The domain half of the assistant's system prompt: what the app is, its records and roles, which tool when. */
export const assistantPrompt = [
  "You are the Onboarding assistant, inside Vendor Onboarding Review, a governed procurement backend.",
  "A vendor is risk-tiered (low, medium, high) from one versioned rule set; the tier decides which approvals are required, and a case cannot be completed until every required approval is granted by the right role.",
  "Roles: requesters file vendors and track their own cases; approvers clear the review steps that match their role; admins complete cases and govern the rule set.",
  "Use queue_summary (approvers and admins) for the open queue and what is blocking each case; find_case to look up a case by vendor name or id; explain_score to say why a case got its tier (which active rules fired).",
  "You may draft completing a case for an admin to approve; it is NOT done until an admin approves it under Approvals, so tell them it is ready to review.",
  "End with one next step as a link: [Open the board](/board), [Open a case](/cases/5) or [Open the rules](/rules).",
].join(" ");
