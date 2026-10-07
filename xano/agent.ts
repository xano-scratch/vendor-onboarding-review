import { defineAgentAccess } from "@xano-sdk/agents";
import { createMcpOauth } from "@xano-sdk/mcp-oauth";
import { APP } from "./app.js";
import { user } from "./table/user.js";

/** The sign-in page ChatGPT and Claude are sent to (AGENT-ACCESS.md §5). Its canonical is pinned: MCP_OAUTH_LOGIN_URL is built from it. */
export const mcpOauthOptions = { authTable: user, canonical: `mcp-oauth-${APP.slug}`, brandName: APP.name };

/** Agent access (AGENT-ACCESS.md §2): agent keys, the MCP server and its sign-in twin. Tools live in domain.ts. */
export const agent = defineAgentAccess({
  user,
  canonical: "agent",
  server: {
    name: `${APP.slug}-mcp`,
    instructions: `${APP.name}. Every tool acts as the person who connected you, within the access they granted. Anything that reaches a customer, spends money or deletes waits for a person to approve it under Approvals.`,
  },
  signIn: { oauth: createMcpOauth(mcpOauthOptions).oauth },
});
