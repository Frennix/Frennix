/**
 * Phase 3 verification — unified dispatch platform (all types, web push, tracking, retry).
 * Run: npm run verify:notification-engine-phase3
 */

import { ALL_NOTIFICATION_TYPES, preferenceKeyForType } from "@frennix/notifications";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert(haystack.includes(needle), `${label}: expected source to include "${needle}"`);
}

function read(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  const nodePath = require("node:path") as typeof import("node:path");
  return fs.readFileSync(nodePath.join(__dirname, "..", path), "utf8");
}

function testPhase3Migration() {
  const sql = read("supabase/migrations/20260706000004_notification_engine_phase3.sql");
  assertIncludes(sql, "upsert_web_push_subscription", "phase3 web push rpc");
  assertIncludes(sql, "record_notification_engagement", "phase3 engagement rpc");
  assertIncludes(sql, "web_push_notifications", "phase3 feature flag");
  assertIncludes(sql, "group_message", "phase3 group_message type");
  assertIncludes(sql, "referral_reward", "phase3 referral_reward type");
  assertIncludes(sql, "run_club_announcement", "phase3 run_club type");
  assertIncludes(sql, "coach_notification", "phase3 coach type");
  assertIncludes(sql, "schedule_notification_delivery_retry", "phase3 retry rpc");
}

function testDispatchPlatform() {
  const dispatch = read("supabase/functions/send-push/dispatch.ts");
  const platform = read("supabase/functions/send-push/platform.ts");

  assertIncludes(dispatch, "dispatchWebPush", "dispatch web push");
  assertIncludes(dispatch, "dispatchExpo", "dispatch expo");
  assertIncludes(dispatch, "web_push_notifications", "dispatch feature flag");
  assertIncludes(dispatch, "preference_off", "dispatch preferences");
  assertIncludes(dispatch, "quiet_hours", "dispatch quiet hours");
  assertIncludes(dispatch, "grouped", "dispatch grouping");
  assertIncludes(platform, "DISPATCH_TYPES", "platform type catalog");

  for (const type of ["like", "match", "event_invite", "story_reaction", "achievement_badge"]) {
    assertIncludes(platform, `"${type}"`, `platform includes ${type}`);
  }
}

function testCatalogSync() {
  const platform = read("supabase/functions/send-push/platform.ts");
  const sql = [
    read("supabase/migrations/20260706000004_notification_engine_phase3.sql"),
    read("supabase/migrations/20260706000005_notification_engine_categories.sql"),
  ].join("\n");

  for (const type of ALL_NOTIFICATION_TYPES) {
    assertIncludes(sql, `'${type}'`, `migration validates ${type}`);
    const pref = preferenceKeyForType(type);
    if (pref) {
      assert(
        preferenceKeyForType(type) === pref,
        `preference mapping stable for ${type}`
      );
    }
  }

  assert(ALL_NOTIFICATION_TYPES.length >= 30, "catalog has comprehensive types");
  assertIncludes(platform, "group_message", "dispatch supports group_message");
}

function testClientWebPush() {
  assertIncludes(read("lib/web-push.ts"), "web_push_notifications", "client feature flag");
  assertIncludes(read("lib/web-push.ts"), "upsertWebPushSubscription", "client subscription save");
  assertIncludes(read("lib/badge-sync.ts"), "setAppBadge", "web badge sync");
  assertIncludes(read("packages/api/src/web-push-subscriptions.ts"), "recordNotificationEngagement", "api engagement");
  assertIncludes(read("public/sw.js"), "push", "sw push handler");
  assertIncludes(read("public/sw.js"), "notificationclick", "sw click handler");
  assertIncludes(read("public/sw.js"), "PUSH_RECEIVED", "sw push received broadcast");
  assertIncludes(read("components/WebPushListener.tsx"), "NOTIFICATION_CLICK", "web push click listener");
  assertIncludes(read("components/WebPushListener.tsx"), "PUSH_RECEIVED", "web push received listener");
  assertIncludes(read("components/NotificationOnboardingPrompt.tsx"), "Stay Connected", "notification onboarding");
  assertIncludes(read("components/NotificationOnboardingPrompt.tsx"), "Enable Notifications", "notification onboarding cta");
  assertIncludes(read("lib/notification-onboarding.ts"), "maybeRequestNotificationOnboardingFromActivity", "activity onboarding trigger");
  assertIncludes(read("lib/notification-onboarding.ts"), "comment", "comment activity trigger");
  assertIncludes(read("lib/notification-onboarding.ts"), "story_mention", "story mention activity trigger");
  assertIncludes(read("lib/notification-onboarding.ts"), "markNotificationOnboardingSnoozed", "maybe later snooze");
  assertIncludes(read("components/NotificationOnboardingPrompt.tsx"), "instantly know when someone", "smart onboarding copy");
  assertIncludes(read("components/WebPushEnableCard.tsx"), "Push Notifications: Enabled", "enable card");
  assertIncludes(read("lib/web-push-auto-register.ts"), "runAutoWebPushRegistration", "auto registration");
  assertIncludes(read("lib/web-push-auto-register.ts"), "sw_needs_reopen", "auto registration sw reopen");
  assertIncludes(read("components/PwaReopenNotice.tsx"), "Frennix has been updated", "pwa reopen notice");
  assertIncludes(read("components/WebPushAutoRegistration.tsx"), "resumeWebPushRegistrationIfNeeded", "auto registration bootstrap");
  assertIncludes(read("lib/web-push.ts"), "pushLog", "web push step logging");
  assertIncludes(read("components/WebPushNativeButton.web.tsx"), "<button", "native html button");
  assertIncludes(read("lib/notification-navigation.ts"), "recordNotificationEngagement", "open tracking");
  assertIncludes(read("lib/notification-navigation.ts"), "deep_link", "push deep link fast path");
  assertIncludes(read("supabase/functions/send-push/dispatch.ts"), "badge_count", "push payload badge");
}

function testRetryWorker() {
  assertIncludes(read("supabase/migrations/20260706000005_notification_engine_categories.sql"), "run_clubs", "categories migration");
  assertIncludes(read("features/notifications/NOTIFICATION-ENGINE-ARCHITECTURE.md"), "UI independent", "architecture doc");
  assertIncludes(read("packages/notifications/src/user-categories.ts"), "USER_NOTIFICATION_CATEGORIES", "user categories");
  assertIncludes(read("packages/api/src/notifications.ts"), "dismissAllNotifications", "clear all api");
  assertIncludes(read("lib/useNotificationSubscription.ts"), "unread-notifications", "cross-device read sync");
  assertIncludes(read("app/notifications.tsx"), "Clear all", "clear all ui");
  const retry = read("supabase/functions/retry-notification-deliveries/index.ts");
  assertIncludes(retry, "dispatchNotificationRecord", "retry uses dispatch");
  assertIncludes(retry, "next_retry_at", "retry queue query");
}

function main() {
  testPhase3Migration();
  testDispatchPlatform();
  testCatalogSync();
  testClientWebPush();
  testRetryWorker();
  console.log("verify-notification-engine-phase3: all checks passed");
}

main();
