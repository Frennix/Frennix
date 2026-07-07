/**
 * Phase 0 verification — notification engine package + contracts.
 * Run: npx tsx scripts/verify-notification-engine-phase0.ts
 */

import {
  assertSafeDeepLink,
  buildDeepLink,
  buildGroupedMessageCopy,
  buildNotificationCopy,
  getNotificationCategory,
  messageDedupeKey,
  preferenceKeyForType,
} from "@frennix/notifications";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string, label: string) {
  assert(haystack.includes(needle), `${label}: expected "${haystack}" to include "${needle}"`);
}

function testDeepLinks() {
  const chat = buildDeepLink({
    type: "message",
    payload: { conversation_id: "abc-123" },
  });
  assert(chat === "/chat/abc-123", `message deep link: ${chat}`);

  const postComment = buildDeepLink({
    type: "comment",
    payload: { post_id: "p1", comment_id: "c1" },
  });
  assertIncludes(postComment, "/post/p1", "comment post path");
  assertIncludes(postComment, "commentId=c1", "comment query");

  const match = buildDeepLink({ type: "match", payload: {} });
  assert(match === "/matching/matches", `match fallback: ${match}`);

  assert(assertSafeDeepLink("/chat/x"), "safe link rejected");
  assert(!assertSafeDeepLink("https://evil.com"), "unsafe link accepted");
  assert(!assertSafeDeepLink("javascript:alert(1)"), "javascript link accepted");
}

function testCopy() {
  const message = buildNotificationCopy({
    type: "message",
    actorName: "Alex",
    payload: { preview: "See you at the gym" },
  });
  assert(message.title === "New message", message.title);
  assertIncludes(message.body, "Alex", "message body actor");

  const grouped = buildGroupedMessageCopy("Alex", 4);
  assertIncludes(grouped.body, "4 new messages", "grouped copy");
}

function testDedupe() {
  const key = messageDedupeKey("msg-1", "user-2");
  assert(key === "message:msg-1:user-2", key);
}

function testCategoriesAndPreferences() {
  assert(getNotificationCategory("message") === "messages", "message category");
  assert(getNotificationCategory("like") === "social", "like category");
  assert(getNotificationCategory("training_session_reminder") === "events", "reminder category");
  assert(getNotificationCategory("weekly_recap") === "system", "future type category");
  assert(preferenceKeyForType("message") === "messages", "message preference");
  assert(preferenceKeyForType("story_reply") === "stories", "story preference");
}

function testMigrationFile() {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20260706000002_notification_engine_phase0.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  assertIncludes(sql, "create_notification", "migration create_notification");
  assertIncludes(sql, "notification_deliveries", "migration deliveries");
  assertIncludes(sql, "notification_subscriptions", "migration subscriptions");
  assertIncludes(sql, "notification_preferences", "migration preferences");
  assertIncludes(sql, "notify_on_message", "migration message trigger");
  assertIncludes(sql, "dedupe_key", "migration dedupe");
}

function main() {
  testDeepLinks();
  testCopy();
  testDedupe();
  testCategoriesAndPreferences();
  testMigrationFile();
  console.log("verify-notification-engine-phase0: all checks passed");
}

main();
