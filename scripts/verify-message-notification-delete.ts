/**
 * Message + notification soft-delete verification.
 * Run: npx tsx scripts/verify-message-notification-delete.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const MIGRATION = join(ROOT, "supabase/migrations/20250709000001_message_notification_soft_delete.sql");

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const results: Check[] = [];

function pass(id: string, detail: string) {
  results.push({ id, status: "PASS", detail });
}
function fail(id: string, detail: string) {
  results.push({ id, status: "FAIL", detail });
}

if (existsSync(MIGRATION)) {
  const sql = readFileSync(MIGRATION, "utf8");
  for (const token of [
    "message_user_deletions",
    "deleted_at",
    "Hide messages for self",
    "deleted_at IS NULL",
  ]) {
    if (sql.includes(token)) pass(`sql:${token}`, "present");
    else fail(`sql:${token}`, "missing");
  }
} else {
  fail("migration", "20250709000001_message_notification_soft_delete.sql missing");
}

const messagingApi = readFileSync(join(ROOT, "packages/api/src/messaging.ts"), "utf8");
for (const token of ["deleteMessageForUser", "message_user_deletions", "getDeletedMessageIds"]) {
  if (messagingApi.includes(token)) pass(`api:messaging:${token}`, "present");
  else fail(`api:messaging:${token}`, "missing");
}

const notificationsApi = readFileSync(join(ROOT, "packages/api/src/notifications.ts"), "utf8");
for (const token of ["dismissNotification", "deleted_at"]) {
  if (notificationsApi.includes(token)) pass(`api:notifications:${token}`, "present");
  else fail(`api:notifications:${token}`, "missing");
}

const types = readFileSync(join(ROOT, "packages/types/src/index.ts"), "utf8");
if (types.includes("deleted_at")) pass("types:notification-deleted_at", "present");
else fail("types:notification-deleted_at", "missing");

for (const [file, token] of [
  ["app/chat/[conversationId].tsx", "deleteMessageForUser"],
  ["app/chat/[conversationId].tsx", "useDismissWithAnimation"],
  ["components/ChatMessageRow.tsx", "SwipeToDeleteRow"],
  ["app/notifications.tsx", "dismissNotification"],
  ["app/notifications.tsx", "useDismissWithAnimation"],
  ["app/notifications.tsx", "SwipeToDeleteRow"],
  ["components/FrennixNotificationRow.tsx", "onDelete"],
  ["components/SwipeToDeleteRow.tsx", "Swipeable"],
  ["components/AnimatedDismissRow.tsx", "useAnimatedStyle"],
  ["lib/useDismissWithAnimation.ts", "confirmDismiss"],
  ["lib/alerts.ts", "confirmDismiss"],
] as const) {
  const content = readFileSync(join(ROOT, file), "utf8");
  if (content.includes(token)) pass(`ui:${file}:${token}`, "wired");
  else fail(`ui:${file}:${token}`, "missing");
}

console.log("\nMessage + notification delete verification\n");
for (const result of results) {
  console.log(`${result.status === "PASS" ? "✅" : "❌"} ${result.id} — ${result.detail}`);
}
const failed = results.filter((result) => result.status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
