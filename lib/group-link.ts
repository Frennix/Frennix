import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildGroupLink(groupId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/group/${groupId}`;
}

export async function copyGroupLink(groupId: string) {
  await copyEntityLink(buildGroupLink(groupId));
}

export async function shareGroupLink(groupId: string, name?: string | null) {
  const link = buildGroupLink(groupId);
  const headline = name?.trim()
    ? `Join "${name.trim()}" on Frennix`
    : "Join this group on Frennix";
  await shareEntityLink({ link, headline });
}
