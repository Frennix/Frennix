/**
 * Verify Frennix Polish & Beta Readiness wiring.
 *
 * Usage: node scripts/verify-polish-beta-readiness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function mustInclude(file, ...needles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${file}`);
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${file} must include: ${needle}`);
    }
  }
}

function main() {
  mustInclude("lib/screen-shell.ts", "LIST_BOTTOM_PADDING", "frennixRefreshControlProps");
  mustInclude("components/founder/FounderShell.tsx", "Back to app", "router.back");
  mustInclude("packages/notifications/src/deep-links.ts", "calendar_item_id", "training-calendar");
  mustInclude("lib/notification-navigation.ts", "calendar_item_id", "storyId");
  mustInclude("lib/patch-conversations-cache.ts", "patchConversationOnNewMessage");
  mustInclude("app/chat/[conversationId].tsx", "patchConversationOnNewMessage");
  mustInclude("app/(tabs)/messages.tsx", "tabScreenContainer", "frennixRefreshControlProps");
  mustInclude("components/NotificationBellButton.tsx", "prefetchInfiniteQuery", "60_000");
  mustInclude("components/ChallengeHubSkeleton.tsx", "Skeleton");
  mustInclude("packages/ui/src/DiscoverProfileCard.tsx", "memo(function DiscoverProfileCard");
  mustInclude("app/notifications.tsx", "EmptyState", "Sign in to view notifications");
  mustInclude("app/_layout.tsx", "saved-posts", "edit-group/[id]");
  mustInclude("app/staff/join.tsx", "Sign in", "/(auth)/login");
  mustInclude("docs/BETA_READINESS_REPORT.md", "Beta Readiness", "Top 5 Priorities");

  console.log("verify-polish-beta-readiness: PASS");
}

try {
  main();
} catch (err) {
  console.error("verify-polish-beta-readiness: FAIL");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
