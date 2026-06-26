import { config } from "@/lib/config";
import { copyEntityLink, shareEntityLink } from "@/lib/entity-link";

export function buildChallengeLink(challengeId: string) {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/challenge/${challengeId}`;
}

export async function copyChallengeLink(challengeId: string) {
  await copyEntityLink(buildChallengeLink(challengeId));
}

export async function shareChallengeLink(challengeId: string, title?: string | null) {
  const link = buildChallengeLink(challengeId);
  const headline = title?.trim()
    ? `Join "${title.trim()}" on Frennix`
    : "Join this challenge on Frennix";
  await shareEntityLink({ link, headline });
}
