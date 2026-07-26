import type { Profile } from "@frennix/types";
import { formatCityState } from "@/lib/location-geocode";

/** Public location line for profiles — never shows raw coordinates. */
export function formatPublicLocationLabel(profile: Profile | null | undefined): string | null {
  if (!profile) return null;

  if (profile.location_display_mode === "hidden") return null;

  if (profile.distance_bucket_label?.trim()) {
    if (profile.location_display_mode === "distance_only" || !profile.show_city_state) {
      return profile.distance_bucket_label;
    }
  }

  const cityState = formatCityState(profile.city, profile.state);
  if (cityState && profile.location_display_mode !== "distance_only" && profile.show_city_state !== false) {
    return cityState;
  }

  if (profile.distance_bucket_label?.trim() && profile.show_approximate_distance) {
    return profile.distance_bucket_label;
  }

  return null;
}

export function profileNeedsLocationReminder(profile: Profile | null | undefined): boolean {
  if (!profile?.onboarding_complete) return false;
  if (!profile.matching_enabled) return false;
  const hasCity = !!profile.city?.trim();
  const hasCoords = profile.latitude != null && profile.longitude != null;
  return !hasCity && !hasCoords;
}
