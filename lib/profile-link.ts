import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildProfileLink(username: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/user/${username}`;
}

export async function copyProfileLink(username: string) {
  await copyEntityLink(buildProfileLink(username));
}

export async function shareProfileLink(username: string, displayName?: string | null) {
  const link = buildProfileLink(username);
  const headline = displayName?.trim()
    ? `Follow ${displayName.trim()} on Frennix`
    : `@${username} on Frennix`;
  await shareEntityLink({ link, headline });
}
