import { apiGroup } from "@xano/sdk";

/** Every domain endpoint lives here, served at /api:onboarding/*. */
export const onboarding = apiGroup({ name: "onboarding", canonical: "onboarding" });
