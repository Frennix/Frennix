/**
 * Static + optional live checks for Messages realtime subscription safety.
 * Run: node scripts/verify-messaging-realtime.mjs
 * Live checks require .env with Supabase credentials (same as verify:supabase).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "packages/api/src");

function read(rel) {
  return readFileSync(join(api, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkStatic() {
  const realtimeUtils = read("realtime-utils.ts");
  const presence = read("presence.ts");
  const messaging = read("messaging.ts");
  const reactions = read("reactions.ts");
  const hook = readFileSync(join(root, "lib/useProfilesPresence.ts"), "utf8");
  const chat = readFileSync(join(root, "app/chat/[conversationId].tsx"), "utf8");
  const messages = readFileSync(join(root, "app/(tabs)/messages.tsx"), "utf8");

  assert(
    realtimeUtils.includes("allocRealtimeTopic"),
    "realtime-utils must allocate unique topics"
  );
  assert(
    realtimeUtils.includes("channel.subscribe()") &&
      realtimeUtils.indexOf("channel.subscribe()") >
        realtimeUtils.lastIndexOf('.on("postgres_changes"'),
    "postgres_changes handlers must register before subscribe()"
  );
  assert(
    presence.includes("subscribePostgresChanges"),
    "presence must use subscribePostgresChanges helper"
  );
  assert(
    !presence.match(/channelName\s*=\s*`presence:\$\{/),
    "presence must not use stable-only channel names"
  );
  assert(
    messaging.includes("subscribePostgresChanges"),
    "messages must use subscribePostgresChanges helper"
  );
  assert(
    messaging.includes("resetMessagingRealtimeState"),
    "messaging must expose resetMessagingRealtimeState for logout"
  );
  assert(
    messaging.includes("teardownTypingChannel"),
    "messaging must teardown typing channels on chat exit"
  );
  assert(
    reactions.includes("subscribePostgresChanges"),
    "message reactions must use unique postgres channel topics"
  );
  assert(
    hook.includes("try {") && hook.includes("realtimeUnavailable"),
    "useProfilesPresence must catch failures and expose fallback state"
  );
  assert(
    chat.includes("subscribeToMessages") && chat.includes("messagesSub?.unsubscribe()"),
    "chat must subscribe and unsubscribe message realtime"
  );
  assert(
    chat.includes("teardownTypingChannel"),
    "chat must teardown typing channel on cleanup"
  );
  assert(
    chat.includes("reactionsSub?.unsubscribe()"),
    "chat must unsubscribe reaction realtime"
  );
  assert(
    chat.includes("getMessages") || chat.includes('queryFn: () => getMessages'),
    "chat loads historical messages via REST query"
  );
  assert(
    messages.includes("realtimeUnavailable"),
    "messages list must show fallback when presence realtime fails"
  );

  console.log("✓ Static messaging realtime checks passed");
  console.log("  Run: pnpm run verify:supabase  (live duplicate-subscription + getMessages checks)");
}

checkStatic();
console.log("\nMessaging realtime verification complete.");
