// The workspace: the base app and every module, wired around the template's own domain (xano/domain.ts).
// Owned by the base app (modules/base). A template edits app.ts, domain.ts, rbac.ts, agent.ts and approvals.ts;
// it doesn't need to touch this file.
import { workspace } from "@xano/sdk";
import { APPROVALS_PROMPT_RULE, registerAgents } from "@xano-sdk/agents";
import { registerChatbot } from "@xano-sdk/chatbot";
import { registerMcpOauth } from "@xano-sdk/mcp-oauth";
import { Getting_Started_Template_create_event_log } from "./_shared.js";
import { Authentication } from "./query/authentication.js";
import { auth_login } from "./query/authentication/auth_login_POST.js";
import { auth_me } from "./query/authentication/auth_me_GET.js";
import { auth_signup } from "./query/authentication/auth_signup_POST.js";
import { account } from "./table/account.js";
import { event_log } from "./table/event_log.js";
import { user } from "./table/user.js";
import { workspaceSettings } from "./workspace.js";
import { APP } from "./app.js";
import { BASE_ASSISTANT_RULES, baseAssistantTools, registerBase } from "./base/index.js";
import { baseAgentTools } from "./base/agent-tools.js";
import { agent, mcpOauthOptions } from "./agent.js";
import { approvals } from "./approvals.js";
import { rbac } from "./rbac.js";
import * as domain from "./domain.js";

const app = workspace(APP.slug)
  .registerWorkspace(workspaceSettings)
  .registerTables([user, account, event_log, ...domain.tables])
  .registerFunctions([Getting_Started_Template_create_event_log, ...domain.functions])
  .registerApiGroups([Authentication, ...domain.apiGroups])
  .registerQueries([auth_signup, auth_login, auth_me, ...domain.queries]);

registerBase(app);

// Agents (AGENT-ACCESS.md): the MCP server with the base and domain tools, its ChatGPT/Claude sign-in twin, approvals.
agent.serve({ tools: [...baseAgentTools, ...domain.agentTools, approvals.checkTool("mcp")], prompts: domain.agentPrompts, resources: domain.agentResources });
registerMcpOauth(app, mcpOauthOptions);
registerAgents(app, { access: agent, approvals });
rbac.register(app);

// The assistant (CHATBOT.md), always: the base tools, the domain's, and checking on approvals.
const assistantTools = [...baseAssistantTools, ...domain.assistantTools, approvals.checkTool("assistant")];
export const bot = registerChatbot(app, {
  authTable: user, canonical: "chat", tools: assistantTools,
  llm: { type: "xano-free", systemPrompt: [domain.assistantPrompt, BASE_ASSISTANT_RULES, APPROVALS_PROMPT_RULE].join(" ") },
});
bot.xano.registerTools(assistantTools);   // the package only references tools: register them on the workspace too
export default bot.xano;                  // the default export must be the workspace

export { Authentication, account, auth_login, auth_me, auth_signup, event_log, user, workspaceSettings };
