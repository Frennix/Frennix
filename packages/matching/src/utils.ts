import type { MatchableProfile } from "@frennix/types";

export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function getSharedValues(a: unknown, b: unknown): string[] {
  const left = new Set(coerceStringArray(a));
  return coerceStringArray(b).filter((item) => left.has(item));
}

export function normalizeCity(city: string | null | undefined): string | null {
  const trimmed = city?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function citiesMatch(viewer: MatchableProfile, candidate: MatchableProfile): boolean {
  const viewerCity = normalizeCity(viewer.city);
  const candidateCity = normalizeCity(candidate.city);
  return !!viewerCity && viewerCity === candidateCity;
}

/** Haversine distance in miles when both profiles have coordinates. */
export function distanceMilesBetween(
  viewer: MatchableProfile,
  candidate: MatchableProfile
): number | null {
  const lat1 = viewer.latitude;
  const lon1 = viewer.longitude;
  const lat2 = candidate.latitude;
  const lon2 = candidate.longitude;

  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) {
    return null;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

export function isRecentlyActive(lastSeenAt: string | null | undefined, withinHours = 48): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seen)) return false;
  return Date.now() - seen <= withinHours * 60 * 60 * 1000;
}

export function isSkillCompatible(
  viewer: MatchableProfile,
  candidate: MatchableProfile
): boolean {
  const viewerSkill = viewer.skill_level;
  const candidateSkill = candidate.skill_level;
  if (!viewerSkill || !candidateSkill) return false;
  if (viewerSkill === candidateSkill) return true;
  const order = ["beginner", "intermediate", "advanced"] as const;
  const viewerIndex = order.indexOf(viewerSkill);
  const candidateIndex = order.indexOf(candidateSkill);
  if (viewerIndex < 0 || candidateIndex < 0) return false;
  return Math.abs(viewerIndex - candidateIndex) <= 1;
}

export function environmentsCompatible(
  viewer: MatchableProfile,
  candidate: MatchableProfile
): boolean {
  const a = viewer.training_environment;
  const b = candidate.training_environment;
  if (!a || !b) return false;
  if (a === "both" || b === "both") return true;
  return a === b;
}

export function gymsMatch(viewer: MatchableProfile, candidate: MatchableProfile): boolean {
  const a = viewer.home_gym?.trim().toLowerCase();
  const b = candidate.home_gym?.trim().toLowerCase();
  return !!a && !!b && a === b;
}

export function withinDiscoveryRadius(
  viewer: MatchableProfile,
  candidate: MatchableProfile,
  distanceMiles: number | null
): boolean {
  const radius = viewer.discovery_radius_miles ?? candidate.discovery_radius_miles;
  if (radius == null || distanceMiles == null) return false;
  return distanceMiles <= radius;
}
