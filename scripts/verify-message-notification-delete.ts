/**
 * Message + notification soft-delete and inbox management verification.
 * Run: npx tsx scripts/verify-message-notification-delete.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const MIGRATION = join(ROOT, "supabase/migrations/20250709000001_message_notification_soft_delete.sql");
const CONVERSATION_HIDE_MIGRATION = join(
  ROOT,
  "supabase/migrations/20250711000001_conversation_user_hide.sql"
);
const CONVERSATION_PREFS_MIGRATION = join(
  ROOT,
  "supabase/migrations/20250712000001_conversation_preferences.sql"
);
const CONVERSATION_FAVORITES_MIGRATION = join(
  ROOT,
  "supabase/migrations/20250713000001_conversation_favorites.sql"
);
const MESSAGING_PHASE1_MIGRATION = join(
  ROOT,
  "supabase/migrations/20260705000001_messaging_phase1_inbox.sql"
);

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

if (existsSync(CONVERSATION_HIDE_MIGRATION)) {
  const sql = readFileSync(CONVERSATION_HIDE_MIGRATION, "utf8");
  for (const token of ["conversation_user_hides", "Hide conversations for self", "hidden_at"]) {
    if (sql.includes(token)) pass(`sql:conversation-hide:${token}`, "present");
    else fail(`sql:conversation-hide:${token}`, "missing");
  }
} else {
  fail("migration", "20250711000001_conversation_user_hide.sql missing");
}

if (existsSync(CONVERSATION_PREFS_MIGRATION)) {
  const sql = readFileSync(CONVERSATION_PREFS_MIGRATION, "utf8");
  for (const token of [
    "conversation_user_preferences",
    "conversation_user_deletions",
    "reply_to_message_id",
    "pinned_at",
    "muted_at",
    "marked_unread_at",
  ]) {
    if (sql.includes(token)) pass(`sql:conversation-prefs:${token}`, "present");
    else fail(`sql:conversation-prefs:${token}`, "missing");
  }
} else {
  fail("migration", "20250712000001_conversation_preferences.sql missing");
}

if (existsSync(CONVERSATION_FAVORITES_MIGRATION)) {
  const sql = readFileSync(CONVERSATION_FAVORITES_MIGRATION, "utf8");
  if (sql.includes("favorited_at")) pass("sql:conversation-favorites:favorited_at", "present");
  else fail("sql:conversation-favorites:favorited_at", "missing");
} else {
  fail("migration", "20250713000001_conversation_favorites.sql missing");
}

if (existsSync(MESSAGING_PHASE1_MIGRATION)) {
  const sql = readFileSync(MESSAGING_PHASE1_MIGRATION, "utf8");
  for (const token of [
    "deleted_for_everyone_at",
    "Delete own messages for everyone",
    "Update own message deletions",
    "Update own conversation deletions",
    "Remove own conversation deletions",
  ]) {
    if (sql.includes(token)) pass(`sql:phase1:${token}`, "present");
    else fail(`sql:phase1:${token}`, "missing");
  }
} else {
  fail("migration", "20260705000001_messaging_phase1_inbox.sql missing");
}

const storiesApi = readFileSync(join(ROOT, "packages/api/src/stories.ts"), "utf8");
if (storiesApi.includes("getFeedStoriesForPartners")) {
  pass("api:stories:getFeedStoriesForPartners", "present");
} else {
  fail("api:stories:getFeedStoriesForPartners", "missing");
}

const messagingApi = readFileSync(join(ROOT, "packages/api/src/messaging.ts"), "utf8");
for (const token of [
  "deleteMessageForUser",
  "deleteMessageForEveryone",
  "DELETED_FOR_EVERYONE_CONTENT",
  "hideConversationForUser",
  "deleteConversationForUser",
  "deleteConversationsForUser",
  "favoriteConversationForUser",
  "favorited_at",
  "MAX_FAVORITE_TRAINING_PARTNERS",
  "muteConversationForUser",
  "markConversationUnreadForUser",
  "message_user_deletions",
  "conversation_user_hides",
  "conversation_user_deletions",
  "conversation_user_preferences",
  "reply_to_message_id",
  "MAX_PINNED_CONVERSATIONS",
  "isConversationSuppressedFromInbox",
  "getDeletedConversationAt",
]) {
  if (messagingApi.includes(token)) pass(`api:messaging:${token}`, "present");
  else fail(`api:messaging:${token}`, "missing");
}

const notificationsApi = readFileSync(join(ROOT, "packages/api/src/notifications.ts"), "utf8");
for (const token of ["dismissNotification", "deleted_at"]) {
  if (notificationsApi.includes(token)) pass(`api:notifications:${token}`, "present");
  else fail(`api:notifications:${token}`, "missing");
}

const pushFn = readFileSync(join(ROOT, "supabase/functions/send-push/index.ts"), "utf8");
if (pushFn.includes("conversation_user_preferences") && pushFn.includes("muted_at")) {
  pass("push:mute-check", "present");
} else {
  fail("push:mute-check", "missing");
}

const types = readFileSync(join(ROOT, "packages/types/src/index.ts"), "utf8");
for (const token of ["is_pinned", "is_favorite", "is_muted", "marked_unread", "reply_to_message_id", "deleted_for_everyone_at"]) {
  if (types.includes(token)) pass(`types:${token}`, "present");
  else fail(`types:${token}`, "missing");
}

for (const [file, token] of [
  ["app/chat/[conversationId].tsx", "buildMessageMenuActions"],
  ["app/chat/[conversationId].tsx", "confirmDeleteMessageForMe"],
  ["app/chat/[conversationId].tsx", "confirmDeleteMessageForEveryone"],
  ["app/chat/[conversationId].tsx", "deleteMessageForEveryone"],
  ["app/chat/[conversationId].tsx", "copyMessageText"],
  ["app/chat/[conversationId].tsx", "replyToMessageId"],
  ["components/ChatMessageRow.tsx", "MessageActionsMenu"],
  ["components/ChatMessageRow.tsx", "onLongPressMenu"],
  ["components/SwipeableActionsRow.tsx", "rightActions"],
  ["components/FavoriteTrainingPartnersSection.tsx", "Favorite Training Partners"],
  ["components/FavoriteTrainingPartnersSection.tsx", "formatStreakBadgeLabel"],
  ["components/FavoriteTrainingPartnersSection.tsx", "avatarRingStory"],
  ["components/FavoritePartnerQuickActions.tsx", "Send Message"],
  ["components/FavoritePartnerQuickActions.tsx", "Invite to Workout"],
  ["app/(tabs)/messages.tsx", "getFeedStoriesForPartners"],
  ["app/(tabs)/messages.tsx", "FeedStoryViewer"],
  ["components/ConversationRow.tsx", "Pin"],
  ["components/ConversationRow.tsx", "onMenuPress"],
  ["lib/conversation-menu-actions.ts", "buildFavoritePartnerConversationMenuActions"],
  ["components/ConversationRow.tsx", "onLongPress"],
  ["app/(tabs)/messages.tsx", "buildConversationInboxMenuActions"],
  ["app/(tabs)/messages.tsx", "confirmDeleteConversation"],
  ["app/(tabs)/messages.tsx", "deleteConversationsForUser"],
  ["app/(tabs)/messages.tsx", "MessagesInboxToolbar"],
  ["app/(tabs)/messages.tsx", "confirmDeleteSelectedConversations"],
  ["components/MessagesInboxToolbar.tsx", "Delete Selected"],
  ["components/ConversationRow.tsx", "selectMode"],
  ["lib/alerts.ts", "confirmDeleteSelectedConversations"],
  ["lib/alerts.ts", "Delete selected conversations?"],
  ["app/(tabs)/messages.tsx", "pinConversationForUser"],
  ["lib/conversation-menu-actions.ts", "Reply"],
  ["lib/conversation-menu-actions.ts", "Pin Conversation"],
  ["lib/conversation-menu-actions.ts", "delete_for_me"],
  ["lib/conversation-menu-actions.ts", "delete_for_everyone"],
  ["components/ChatComposer.tsx", "replyTo"],
  ["packages/ui/src/MessageBubble.tsx", "replyTo"],
  ["components/AnimatedDismissRow.tsx", "useAnimatedStyle"],
  ["lib/useDismissWithAnimation.ts", "confirmDismiss"],
  ["lib/alerts.ts", "confirmDeleteConversation"],
  ["lib/alerts.ts", "confirmDeleteMessageForMe"],
  ["lib/alerts.ts", "confirmDeleteMessageForEveryone"],
  ["lib/alerts.ts", "Delete Conversation?"],
  ["app/notifications.tsx", "dismissNotification"],
  ["components/FrennixNotificationRow.tsx", "onDelete"],
] as const) {
  const content = readFileSync(join(ROOT, file), "utf8");
  if (content.includes(token)) pass(`ui:${file}:${token}`, "wired");
  else fail(`ui:${file}:${token}`, "missing");
}

console.log("\nMessage inbox management verification\n");
for (const result of results) {
  console.log(`${result.status === "PASS" ? "✅" : "❌"} ${result.id} — ${result.detail}`);
}
const failed = results.filter((result) => result.status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
