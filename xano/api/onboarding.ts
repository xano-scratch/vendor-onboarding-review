import { apiGroup } from "@xanots/sdk";

// The one API group. Pinning `canonical` keeps the public path (/api:onboarding/…)
// stable and lets the frontend resolve getPath() from the def with no lock file.
export const onboarding = apiGroup({ name: "onboarding", canonical: "onboarding" });
