// The base app: everything a template has besides its domain (BASELINE.md). `registerBase(app)` adds it all.
import type { Xano } from "@xano/sdk";
import { demoLogin, demoPersonas } from "../query/authentication/demo.js";
import { changePassword, updateMe } from "../query/authentication/profile.js";
import { linkQueries } from "../query/authentication/links.js";
import { access_link, activity, demo_persona, notification, workspace_setting } from "./tables.js";
import { baseFunctions } from "./functions.js";
import { appGroup, baseQueries } from "./queries.js";
import { liveChannels, liveServers, liveTriggers } from "./live.js";
import { baseTests } from "./tests.js";

export function registerBase<X extends Xano>(app: X): X {
  app
    .registerTables([demo_persona, notification, activity, access_link, workspace_setting])
    .registerFunctions(baseFunctions)
    .registerApiGroups([appGroup])
    .registerQueries([demoPersonas, demoLogin, updateMe, changePassword, ...linkQueries, ...baseQueries])
    .registerRealtimeServers(liveServers)
    .registerRealtimeChannels(liveChannels)
    .registerTriggers(liveTriggers)
    .registerWorkflowTests(baseTests);
  return app;
}

export { changed, notify, notifyRoles } from "./functions.js";
export { baseAssistantTools, BASE_ASSISTANT_RULES } from "./assistant.js";
export { live, appChannel, userChannel, roomChannel } from "./live.js";
export { activity, notification, workspace_setting, access_link, demo_persona } from "./tables.js";
