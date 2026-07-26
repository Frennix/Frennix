import type { LocationDisplayMode, Profile } from "@frennix/types";
import { updateProfile } from "./profiles";

export type SavedLocation = {
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
};

export type DiscoveryPrivacyPatch = {
  matching_enabled?: boolean;
  use_location_for_matching?: boolean;
  show_city_state?: boolean;
  show_approximate_distance?: boolean;
  location_display_mode?: LocationDisplayMode;
  discovery_explicitly_disabled_at?: string | null;
};

export function profileHasSavedLocation(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  const hasCoords = profile.latitude != null && profile.longitude != null;
  const hasCity = !!profile.city?.trim();
  return hasCoords || hasCity;
}

export function shouldShowLocationFeedBanner(profile: Profile | null | undefined): boolean {
  if (!profile?.onboarding_complete) return false;
  if (!profile.matching_enabled) return false;
  if (profileHasSavedLocation(profile)) return false;
  return true;
}

export function shouldShowLocationOnboardingPrompt(profile: Profile | null | undefined): boolean {
  if (!profile?.onboarding_complete) return false;
  if (profile.location_prompt_completed_at) return false;
  if (profileHasSavedLocation(profile)) return false;
  return true;
}

export function deriveLocationDisplayMode(
  showCityState: boolean,
  showApproximateDistance: boolean,
  hideLocation: boolean
): LocationDisplayMode {
  if (hideLocation) return "hidden";
  if (showApproximateDistance && !showCityState) return "distance_only";
  return "city_state";
}

export function locationDisplayToToggles(mode: LocationDisplayMode | null | undefined): {
  showCityState: boolean;
  showApproximateDistance: boolean;
  hideLocation: boolean;
} {
  if (mode === "hidden") {
    return { showCityState: false, showApproximateDistance: false, hideLocation: true };
  }
  if (mode === "distance_only") {
    return { showCityState: false, showApproximateDistance: true, hideLocation: false };
  }
  return { showCityState: true, showApproximateDistance: false, hideLocation: false };
}

export function buildDefaultDiscoverySettings(hasLocation: boolean): DiscoveryPrivacyPatch & {
  matching_enabled: boolean;
} {
  return {
    matching_enabled: true,
    use_location_for_matching: hasLocation,
    show_city_state: true,
    show_approximate_distance: false,
    location_display_mode: "city_state",
    discovery_explicitly_disabled_at: null,
  };
}

export async function saveUserLocation(userId: string, location: SavedLocation): Promise<Profile> {
  return updateProfile(userId, {
    city: location.city.trim(),
    state: location.state?.trim() || null,
    latitude: location.latitude,
    longitude: location.longitude,
    use_location_for_matching: true,
  });
}

export async function removeUserLocation(userId: string): Promise<Profile> {
  return updateProfile(userId, {
    city: null,
    state: null,
    latitude: null,
    longitude: null,
    use_location_for_matching: false,
  });
}

export async function markLocationPromptCompleted(userId: string): Promise<Profile> {
  return updateProfile(userId, {
    location_prompt_completed_at: new Date().toISOString(),
  });
}

export async function markLocationPromptDismissed(userId: string): Promise<Profile> {
  return updateProfile(userId, {
    location_prompt_dismissed_at: new Date().toISOString(),
    location_prompt_completed_at: new Date().toISOString(),
  });
}

export async function updateDiscoveryPrivacy(
  userId: string,
  patch: DiscoveryPrivacyPatch
): Promise<Profile> {
  return updateProfile(userId, patch);
}

export async function setMatchingEnabledWithOptOut(
  userId: string,
  enabled: boolean
): Promise<Profile> {
  return updateProfile(userId, {
    matching_enabled: enabled,
    discovery_explicitly_disabled_at: enabled ? null : new Date().toISOString(),
  });
}
