import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertIncludes(file: string, needle: string, message: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${message} (missing in ${file})`);
  }
}

const MIGRATION = "supabase/migrations/20260726000001_location_discovery_privacy.sql";

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Migration adds discovery privacy columns",
    run: () => {
      assertIncludes(MIGRATION, "use_location_for_matching", "use_location_for_matching column");
      assertIncludes(MIGRATION, "location_display_mode", "location_display_mode column");
      assertIncludes(MIGRATION, "discovery_explicitly_disabled_at", "explicit opt-out column");
    },
  },
  {
    name: "profile_for_viewer strips coordinates for other viewers",
    run: () => {
      assertIncludes(MIGRATION, "result.latitude := NULL", "strip latitude");
      assertIncludes(MIGRATION, "distance_bucket_label", "distance bucket");
    },
  },
  {
    name: "Profile type includes location discovery fields",
    run: () => {
      assertIncludes("packages/types/src/index.ts", "location_display_mode", "Profile type");
      assertIncludes("packages/types/src/index.ts", "state?:", "state field");
    },
  },
  {
    name: "API exports location discovery helpers",
    run: () => {
      assertIncludes("packages/api/src/location-discovery.ts", "saveUserLocation", "saveUserLocation");
      assertIncludes("packages/api/src/index.ts", "location-discovery", "api export");
    },
  },
  {
    name: "Onboarding location step exists",
    run: () => {
      assertIncludes("app/onboarding.tsx", "LocationOnboardingStep", "onboarding step");
      assertIncludes("components/LocationOnboardingStep.tsx", "Allow Location", "allow location cta");
      assertIncludes("components/LocationOnboardingStep.tsx", "Not Now", "not now option");
    },
  },
  {
    name: "Privacy & Discovery settings screen",
    run: () => {
      assertIncludes("app/privacy-settings.tsx", "Privacy & Discovery", "screen title");
      assertIncludes("app/privacy-settings.tsx", "Appear in Frennix Match", "discovery toggle");
      assertIncludes("app/privacy-settings.tsx", "Remove Saved Location", "remove location");
      assertIncludes("app/settings.tsx", "Privacy & Discovery", "settings link");
      assertIncludes("app/_layout.tsx", 'backScreen("Privacy & Discovery")', "stack title");
    },
  },
  {
    name: "One-time existing user prompt",
    run: () => {
      assertIncludes(
        "components/LocationDiscoveryPrompt.tsx",
        "Find Your Training Partner",
        "prompt title"
      );
      assertIncludes(
        "components/LocationDiscoveryPrompt.tsx",
        "Use Existing City",
        "legacy city action"
      );
      assertIncludes(
        "packages/api/src/location-discovery.ts",
        "legacy city alone does not suppress",
        "prompt eligibility comment"
      );
      assertIncludes("app/(tabs)/_layout.tsx", "LocationDiscoveryPrompt", "tabs mount");
    },
  },
  {
    name: "Feed location banner",
    run: () => {
      assertIncludes("components/LocationFeedBanner.tsx", "Enable Now", "banner cta");
      assertIncludes("app/(tabs)/index.tsx", "LocationFeedBanner", "feed mount");
    },
  },
  {
    name: "Distance bucket helper",
    run: () => {
      assertIncludes("packages/matching/src/utils.ts", "Less than 5 miles away", "distance buckets");
    },
  },
  {
    name: "Location screens use official FrennixLogo",
    run: () => {
      assertIncludes("components/LocationOnboardingStep.tsx", "FrennixLogo", "onboarding logo");
      assertIncludes("components/LocationDiscoveryPrompt.tsx", "FrennixLogo", "prompt logo");
      assertIncludes("components/LocationFeedBanner.tsx", "FrennixLogo", "banner logo");
      assertIncludes("components/FrennixLogo.tsx", "frennix-logo.png", "official master asset");
    },
  },
  {
    name: "Migration enables all existing users for discovery",
    run: () => {
      assertIncludes(MIGRATION, "no existing users have disabled discovery", "migration note");
      assertIncludes(MIGRATION, "SET matching_enabled = true", "enable discovery");
      assertIncludes(MIGRATION, "profile_has_saved_location", "saved location helper");
    },
  },
  {
    name: "Discovery toggle uses shared matching_enabled setting",
    run: () => {
      assertIncludes(
        "lib/training-partner-discovery-toggle.ts",
        "setMatchingEnabledWithOptOut",
        "shared discovery setter"
      );
      assertIncludes(
        "app/matching-settings.tsx",
        "setTrainingPartnerDiscoveryEnabled",
        "matching settings shared setter"
      );
      assertIncludes(
        "app/privacy-settings.tsx",
        "setTrainingPartnerDiscoveryEnabled",
        "privacy settings shared setter"
      );
      assertIncludes(
        "app/matching-settings.tsx",
        "isTrainingPartnerDiscoveryEnabled",
        "matching settings shared reader"
      );
      assertIncludes(
        "packages/api/src/matching.ts",
        "setMatchingEnabledWithOptOut",
        "setMatchingEnabled delegates to shared helper"
      );
    },
  },
  {
    name: "setMatchingEnabled records explicit opt-out",
    run: () => {
      assertIncludes("packages/api/src/location-discovery.ts", "discovery_explicitly_disabled_at", "opt-out timestamp");
    },
  },
];

let passed = 0;
for (const check of checks) {
  check.run();
  passed += 1;
  console.log(`PASS  ${check.name}`);
}

console.log(`\n${passed}/${checks.length} location & discovery checks passed.`);
