/**
 * Phase 1 verification — trigger migration + preferences + delivery logging.
 * Run: npx tsx scripts/verify-notification-engine-phase1.ts
 */

import {
  getUserNotificationPreferences,
} from "@frennix/api";
import { preferenceKeyForType, USER_NOTIFICATION_CATEGORIES } from "@frennix/notifications";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert(haystack.includes(needle), `${label}: expected "${haystack}" to include "${needle}"`);
}

function testPhase1Migration() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260706000003_notification_engine_phase1.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const triggers = [
    "notify_on_follow",
    "notify_on_like",
    "notify_on_post_reaction",
    "notify_on_comment",
    "notify_on_match",
    "notify_on_event_join",
    "notify_on_event_invite",
    "notify_on_challenge_join",
    "notify_on_challenge_invite",
    "notify_on_post_share",
    "notify_on_training_session_invite",
    "notify_on_training_session_accepted",
    "create_app_notification",
    "is_valid_notification_type",
  ];
  for (const trigger of triggers) {
    assertIncludes(sql, trigger, `phase1 migration ${trigger}`);
  }
}

function testPreferencesModule() {
  const { USER_NOTIFICATION_CATEGORIES } = require("@frennix/notifications") as typeof import("@frennix/notifications");
  assert(USER_NOTIFICATION_CATEGORIES.length === 12, "12 notification categories");
  assert(
    USER_NOTIFICATION_CATEGORIES.some((item) => item.id === "run_clubs"),
    "run clubs category"
  );
  assert(
    USER_NOTIFICATION_CATEGORIES.some((item) => item.id === "marketing"),
    "marketing category"
  );
  assert(preferenceKeyForType("training_session_reminder") === "events", "events mapping");
  assert(preferenceKeyForType("story_reply") === "stories", "stories mapping");
}

function testSendPushDeliveryLogging() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const fnPath = path.join(__dirname, "..", "supabase", "functions", "send-push", "dispatch.ts");
  const source = fs.readFileSync(fnPath, "utf8");
  assertIncludes(source, "notification_preferences", "send-push preferences table");
  assertIncludes(source, "notification_deliveries", "send-push delivery log");
  assertIncludes(source, "quiet_hours", "send-push quiet hours");
  assertIncludes(source, "deep_link", "send-push deep link payload");
}

function testNotificationSettingsScreen() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const screenPath = path.join(__dirname, "..", "app", "notification-settings.tsx");
  const source = fs.readFileSync(screenPath, "utf8");
  assertIncludes(source, "getUserNotificationPreferences", "settings uses v2 prefs");
  assertIncludes(source, "quiet_hours_enabled", "settings quiet hours");
  assertIncludes(source, "USER_NOTIFICATION_CATEGORIES", "settings uses category toggles");
  assertIncludes(source, "WebPushEnableCard", "settings uses web push enable card");
  assertIncludes(source, "IosPwaInstallGuide", "settings uses ios pwa guide");
}

async function testPreferencesApiShape() {
  // Static import shape — runtime DB not required
  assert(typeof getUserNotificationPreferences === "function", "getUserNotificationPreferences export");
}

async function main() {
  testPhase1Migration();
  testPreferencesModule();
  testSendPushDeliveryLogging();
  testNotificationSettingsScreen();
  await testPreferencesApiShape();
  console.log("verify-notification-engine-phase1: all checks passed");
}

void main();
