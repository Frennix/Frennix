import type { WhatsNewKnownIssue, WhatsNewRelease } from "@/features/releases/whats-new";
import {
  WHATS_NEW_COMING_SOON,
  WHATS_NEW_KNOWN_ISSUES,
  WHATS_NEW_LAUNCH_PROMPT_VERSION,
  WHATS_NEW_LATEST_VERSION,
  WHATS_NEW_RELEASES,
} from "@/features/releases/whats-new";
import {
  getSeenWhatsNewLaunchPromptVersion,
  setSeenWhatsNewLaunchPromptVersion,
} from "@/lib/whats-new-seen";

export function getWhatsNewReleases(): WhatsNewRelease[] {
  return WHATS_NEW_RELEASES;
}

export function getLatestWhatsNewRelease(): WhatsNewRelease | null {
  return WHATS_NEW_RELEASES[0] ?? null;
}

export function getWhatsNewComingSoon(): string[] {
  return WHATS_NEW_COMING_SOON;
}

export function getWhatsNewKnownIssues(): WhatsNewKnownIssue[] {
  return WHATS_NEW_KNOWN_ISSUES;
}

export function getLatestWhatsNewVersion(): string {
  return WHATS_NEW_LATEST_VERSION;
}

export function getWhatsNewLaunchPromptVersion(): string | null {
  return WHATS_NEW_LAUNCH_PROMPT_VERSION;
}

export async function shouldShowWhatsNewLaunchPrompt(): Promise<boolean> {
  const promptVersion = WHATS_NEW_LAUNCH_PROMPT_VERSION;
  if (!promptVersion) return false;
  const seen = await getSeenWhatsNewLaunchPromptVersion();
  return seen !== promptVersion;
}

export async function markWhatsNewLaunchPromptSeen(version?: string): Promise<void> {
  const target = version ?? WHATS_NEW_LAUNCH_PROMPT_VERSION;
  if (!target) return;
  await setSeenWhatsNewLaunchPromptVersion(target);
}

export function formatWhatsNewDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isLatestRelease(version: string): boolean {
  return version === WHATS_NEW_LATEST_VERSION;
}
