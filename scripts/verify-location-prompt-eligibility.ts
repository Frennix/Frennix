import {
  profileHasLegacyCityOnly,
  shouldShowLocationFeedBanner,
  shouldShowLocationOnboardingPrompt,
} from "@frennix/api";
import type { Profile } from "@frennix/types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "user-1",
    username: "testuser",
    display_name: "Test User",
    onboarding_complete: true,
    matching_enabled: true,
    ...overrides,
  } as Profile;
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Legacy city does not suppress onboarding prompt",
    run: () => {
      const profile = baseProfile({ city: "Austin", state: "TX" });
      assert(shouldShowLocationOnboardingPrompt(profile), "expected prompt for legacy city");
    },
  },
  {
    name: "Completed prompt suppresses repeat modal",
    run: () => {
      const profile = baseProfile({
        city: "Austin",
        location_prompt_completed_at: "2026-07-27T00:00:00.000Z",
      });
      assert(!shouldShowLocationOnboardingPrompt(profile), "expected no prompt after completion");
    },
  },
  {
    name: "User without city sees prompt",
    run: () => {
      const profile = baseProfile({ city: null, state: null });
      assert(shouldShowLocationOnboardingPrompt(profile), "expected prompt without city");
    },
  },
  {
    name: "Legacy city-only profile detected",
    run: () => {
      const profile = baseProfile({ city: "Denver", state: "CO" });
      assert(profileHasLegacyCityOnly(profile), "expected legacy city-only");
    },
  },
  {
    name: "Not Now keeps feed banner available (no device coords, prompt done)",
    run: () => {
      const profile = baseProfile({
        city: "Austin",
        location_prompt_completed_at: "2026-07-27T00:00:00.000Z",
        location_prompt_dismissed_at: "2026-07-27T00:00:00.000Z",
      });
      assert(shouldShowLocationFeedBanner(profile), "expected feed banner after Not Now");
    },
  },
  {
    name: "Device coordinates hide feed banner",
    run: () => {
      const profile = baseProfile({
        city: "Austin",
        latitude: 30.27,
        longitude: -97.74,
        location_prompt_completed_at: "2026-07-27T00:00:00.000Z",
      });
      assert(!shouldShowLocationFeedBanner(profile), "expected no banner with GPS");
    },
  },
  {
    name: "Feed banner hidden until prompt completed",
    run: () => {
      const profile = baseProfile({ city: null });
      assert(!shouldShowLocationFeedBanner(profile), "expected no banner before prompt");
    },
  },
];

let passed = 0;
for (const check of checks) {
  check.run();
  passed += 1;
  console.log(`PASS  ${check.name}`);
}

console.log(`\n${passed}/${checks.length} location prompt eligibility checks passed.`);
