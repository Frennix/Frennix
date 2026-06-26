import type { Profile } from "@frennix/types";

const CACHE_KEY = "frennix.auth.profile.v1";

type CachedProfileEntry = {
  userId: string;
  profile: Profile;
  cachedAt: number;
};

/** Best-effort sessionStorage cache so Safari resume can hydrate profile before network fetch. */
export function readCachedProfile(userId: string): Profile | null {
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedProfileEntry;
    if (parsed.userId !== userId || !parsed.profile) return null;
    return parsed.profile;
  } catch {
    return null;
  }
}

export function writeCachedProfile(userId: string, profile: Profile | null) {
  if (typeof sessionStorage === "undefined") return;

  try {
    if (!profile) {
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }

    const entry: CachedProfileEntry = {
      userId,
      profile,
      cachedAt: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearCachedProfile() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore.
  }
}
