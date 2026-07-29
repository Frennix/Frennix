import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import {
  canPromptForWebPush,
  getWebPushPermissionStatus,
  hasActiveWebPushSubscription,
  isWebPushFeatureEnabled,
} from "@/lib/web-push";
import { runAutoWebPushRegistration } from "@/lib/web-push-auto-register";
import { wasWebPushPermissionDenied } from "@/lib/web-push-prompt";

const SNOOZE_KEY = "@frennix/notification_onboarding_snoozed";
const LAST_PROMPT_AT_KEY = "@frennix/notification_onboarding_last_prompt_at";

/** Minimum gap between activity prompts when the user has not tapped Maybe Later. */
const PROMPT_COOLDOWN_MS = 30_000;

/** Notification types that can trigger the smart onboarding card. */
export const NOTIFICATION_ONBOARDING_ACTIVITY_TYPES = new Set([
  "message",
  "follow",
  "like",
  "comment",
  "comment_reply",
  "match",
  "event_invite",
  "story_mention",
  "challenge_join",
  "challenge_invite",
  "challenge_reminder",
  "challenge_progress",
  "story_challenge_join",
]);

export const NOTIFICATION_ONBOARDING_BENEFITS = [
  { icon: "💬", label: "Sends you a message" },
  { icon: "❤️", label: "Likes or comments on your posts" },
  { icon: "👤", label: "Follows you" },
  { icon: "🤝", label: "Matches with you" },
  { icon: "📅", label: "Invites you to an event" },
  { icon: "📖", label: "Mentions you in a story" },
  { icon: "🔥", label: "Updates a challenge you're participating in" },
] as const;

let showHandler: (() => void) | null = null;
let pendingShow = false;
let onboardingBlocked = false;

export function registerNotificationOnboardingHandler(handler: (() => void) | null) {
  showHandler = handler;
  if (handler && pendingShow && !onboardingBlocked) {
    void flushPendingNotificationOnboarding();
  }
}

/** Block prompts during flows such as Training Partner Journey intro/timeline. */
export function setNotificationOnboardingBlocked(blocked: boolean): void {
  onboardingBlocked = blocked;
  if (!blocked && pendingShow) {
    void flushPendingNotificationOnboarding();
  }
}

export async function arePushNotificationsEnabled(): Promise<boolean> {
  if (!canPromptForWebPush()) return true;

  const permission = await getWebPushPermissionStatus();
  if (permission !== "granted") return false;
  return hasActiveWebPushSubscription();
}

export async function wasNotificationOnboardingSnoozed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SNOOZE_KEY);
  return value === "1";
}

export async function markNotificationOnboardingSnoozed(): Promise<void> {
  await AsyncStorage.setItem(SNOOZE_KEY, "1");
}

export async function clearNotificationOnboardingSnooze(): Promise<void> {
  await AsyncStorage.removeItem(SNOOZE_KEY);
}

async function getLastPromptAt(): Promise<number> {
  const value = await AsyncStorage.getItem(LAST_PROMPT_AT_KEY);
  return value ? Number(value) : 0;
}

async function markPromptShown(): Promise<void> {
  await AsyncStorage.setItem(LAST_PROMPT_AT_KEY, String(Date.now()));
}

async function canPromptAfterActivity(): Promise<boolean> {
  if (await wasNotificationOnboardingSnoozed()) return false;

  const lastPromptAt = await getLastPromptAt();
  return Date.now() - lastPromptAt >= PROMPT_COOLDOWN_MS;
}

async function flushPendingNotificationOnboarding(): Promise<void> {
  if (onboardingBlocked || !pendingShow) return;
  if (!(await isEligibleForOnboarding())) {
    pendingShow = false;
    return;
  }

  const permission = await getWebPushPermissionStatus();
  if (permission !== "default") {
    pendingShow = false;
    return;
  }

  if (await wasNotificationOnboardingSnoozed()) {
    pendingShow = false;
    return;
  }

  if (!(await canPromptAfterActivity())) return;

  pendingShow = false;
  await markPromptShown();

  if (showHandler) {
    showHandler();
    return;
  }

  pendingShow = true;
}

async function isEligibleForOnboarding(): Promise<boolean> {
  if (!canPromptForWebPush()) return false;
  if (!(await isWebPushFeatureEnabled())) return false;
  if (await arePushNotificationsEnabled()) return false;

  const permission = await getWebPushPermissionStatus();
  if (permission === "denied" || (await wasWebPushPermissionDenied())) return false;

  return true;
}

/** Queue the onboarding card when a meaningful activity occurs. */
export async function requestNotificationOnboarding(): Promise<void> {
  if (!(await isEligibleForOnboarding())) return;

  const permission = await getWebPushPermissionStatus();
  if (permission !== "default") return;

  if (await wasNotificationOnboardingSnoozed()) return;

  if (!(await canPromptAfterActivity())) return;

  if (onboardingBlocked) {
    pendingShow = true;
    return;
  }

  await markPromptShown();

  if (showHandler) {
    showHandler();
    pendingShow = false;
    return;
  }

  pendingShow = true;
}

/** Called when a qualifying in-app notification arrives. */
export async function maybeRequestNotificationOnboardingFromActivity(
  type: string,
  context?: { userId: string; queryClient: QueryClient }
): Promise<void> {
  if (!NOTIFICATION_ONBOARDING_ACTIVITY_TYPES.has(type)) return;
  if (!(await isEligibleForOnboarding())) return;

  const permission = await getWebPushPermissionStatus();
  if (permission === "granted" && context?.userId && context.queryClient) {
    void runAutoWebPushRegistration(context.userId, context.queryClient, { source: "activity" });
    return;
  }

  if (permission !== "default") return;

  await requestNotificationOnboarding();
}
