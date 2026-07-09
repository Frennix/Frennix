/**
 * Verify Trust & Safety + Founder Command Center wiring.
 *
 * Usage: node scripts/verify-trust-safety-founder.mjs
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
    "supabase/migrations/20260708190000_trust_safety_founder.sql",
    "user_mutes",
    "moderation_actions",
    "automated_moderation_logs",
    "submit_user_report",
    "apply_moderation_action",
    "get_moderation_reports_page",
    "get_moderation_overview",
    "check_post_abuse",
    "get_growth_dashboard_metrics"
  );

  mustInclude(
    "packages/types/src/index.ts",
    "Fake Account",
    "Copyright",
    "UserMute",
    "ModerationOverview"
  );

  mustInclude(
    "packages/api/src/moderation.ts",
    "reportStory",
    "reportMessage",
    "muteUser",
    "unmuteUser",
    "getMutedUserIds",
    "applyModerationAction",
    "getModerationOverview",
    "filterMutedAuthors"
  );

  mustInclude(
    "components/founder/FounderModerationDashboardScreen.tsx",
    "getModerationReportsPage",
    "applyModerationAction",
    "capability_moderate"
  );

  mustInclude(
    "components/founder/FounderCommandCenterScreen.tsx",
    "Command Center",
    "getModerationOverview",
    "getGrowthDashboardMetrics",
    "useOperationsDashboard"
  );

  mustInclude("app/founder/moderation.tsx", "FounderModerationDashboardScreen");
  mustInclude("app/founder/command-center.tsx", "FounderCommandCenterScreen");
  mustInclude("app/muted-users.tsx", "getMutedUsers", "unmuteUser");
  mustInclude("app/admin-moderation.tsx", "/founder/moderation");

  mustInclude(
    "components/ContentModerationSheet.tsx",
    "onMute",
    "Mute user"
  );

  mustInclude("lib/useMessageModeration.ts", "reportMessage", "muteUser");
  mustInclude("packages/api/src/posts.ts", "check_post_abuse", "filterMutedAuthors");
  mustInclude("packages/api/src/story-discovery.ts", "getMutedUserIds");

  console.log("verify-trust-safety-founder: PASS");
}

try {
  main();
} catch (err) {
  console.error("verify-trust-safety-founder: FAIL");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
