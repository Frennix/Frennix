/**
 * Verify world-class Notifications Center wiring.
 *
 * Usage: node scripts/verify-notifications-center.mjs
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
  mustInclude(
    "lib/notification-groups.ts",
    "Earlier This Week",
    "Today",
    "Yesterday",
    "Earlier"
  );

  mustInclude(
    "packages/notifications/src/categories.ts",
    "training_partners",
    "TRAINING_PARTNER_TYPES"
  );

  mustInclude(
    "components/NotificationFilterBar.tsx",
    "Training Partners",
    "training_partners"
  );

  mustInclude(
    "components/FrennixNotificationRow.tsx",
    "onMarkRead",
    "Mark read",
    "@${actor.username}"
  );

  mustInclude(
    "lib/useNotificationDeleteUndo.ts",
    "NOTIFICATION_DELETE_UNDO_MS",
    "undoDelete",
    "requestBulkDelete"
  );

  mustInclude(
    "lib/notifications-inbox-cache.ts",
    "readNotificationsInboxCache",
    "hydrateNotificationsInboxCache"
  );

  mustInclude(
    "packages/api/src/notifications.ts",
    "restoreNotification",
    "getNotificationsPage",
    "achievement_badge",
    "system_announcement"
  );

  mustInclude(
    "app/notifications.tsx",
    "UndoSnackbar",
    "useNotificationDeleteUndo",
    "You're all caught up.",
    "notification-settings",
    "useInfiniteQuery",
    "groupNotificationsByDate"
  );

  mustInclude(
    "components/NotificationBellButton.tsx",
    "prefetchInfiniteQuery",
    "notificationsQueryKey"
  );

  mustInclude(
    "lib/notification-navigation.ts",
    "openNotificationTargetAsync",
    "handlePushNotificationOpen"
  );

  console.log("PASS  Notifications Center wiring verified");
}

main();
