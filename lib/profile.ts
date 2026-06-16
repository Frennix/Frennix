import type { Profile } from "@frennix/types";

export const FOUNDER_USERNAME = "frennix";

export const FOUNDER_DEFAULT_BIO =
  "Founder of Frennix. Fitness changed my life. Building a community where people can connect, motivate each other, and achieve their goals together.";

export function getProfileBio(profile: Profile): string | null {
  const bio = profile.bio?.trim();
  if (bio) return bio;
  if (profile.username.toLowerCase() === FOUNDER_USERNAME) return FOUNDER_DEFAULT_BIO;
  return null;
}

export function getDefaultBioForEdit(profile: Profile | null | undefined): string {
  if (profile?.bio?.trim()) return profile.bio.trim();
  if (profile?.username?.toLowerCase() === FOUNDER_USERNAME) return FOUNDER_DEFAULT_BIO;
  return "";
}
