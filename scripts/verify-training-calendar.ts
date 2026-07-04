/**
 * Training Calendar Phase 1 verification.
 * Run: npx tsx scripts/verify-training-calendar.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function mustInclude(file: string, token: string, label: string) {
  const src = read(file);
  if (!src.includes(token)) {
    throw new Error(`${label}: missing "${token}" in ${file}`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "sql:training_calendar_items table",
    run: () =>
      mustInclude(
        "supabase/migrations/20250716000001_training_calendar.sql",
        "CREATE TABLE IF NOT EXISTS public.training_calendar_items",
        "migration"
      ),
  },
  {
    name: "sql:training_session_invites table",
    run: () =>
      mustInclude(
        "supabase/migrations/20250716000001_training_calendar.sql",
        "training_session_invites",
        "migration"
      ),
  },
  {
    name: "sql:training_session_participants table",
    run: () =>
      mustInclude(
        "supabase/migrations/20250716000001_training_calendar.sql",
        "training_session_participants",
        "migration"
      ),
  },
  {
    name: "sql:calendar item status check",
    run: () =>
      mustInclude(
        "supabase/migrations/20250716000001_training_calendar.sql",
        "'scheduled', 'completed', 'missed', 'rescheduled'",
        "migration"
      ),
  },
  {
    name: "sql:RLS enabled",
    run: () =>
      mustInclude(
        "supabase/migrations/20250716000001_training_calendar.sql",
        "ENABLE ROW LEVEL SECURITY",
        "migration"
      ),
  },
  {
    name: "types:TrainingCalendarItem",
    run: () =>
      mustInclude("packages/types/src/training-calendar.ts", "export type TrainingCalendarItem", "types"),
  },
  {
    name: "api:createTrainingCalendarItem",
    run: () =>
      mustInclude(
        "packages/api/src/training-calendar.ts",
        "export async function createTrainingCalendarItem",
        "api"
      ),
  },
  {
    name: "api:updateTrainingCalendarItemStatus",
    run: () =>
      mustInclude(
        "packages/api/src/training-calendar.ts",
        "export async function updateTrainingCalendarItemStatus",
        "api"
      ),
  },
  {
    name: "api:deleteTrainingCalendarItem",
    run: () =>
      mustInclude(
        "packages/api/src/training-calendar.ts",
        "export async function deleteTrainingCalendarItem",
        "api"
      ),
  },
  {
    name: "api:exported from index",
    run: () => mustInclude("packages/api/src/index.ts", "./training-calendar", "api index"),
  },
  {
    name: "ui:calendar tab month/week",
    run: () =>
      mustInclude("app/(tabs)/events.tsx", "TrainingCalendarMonthGrid", "calendar tab"),
  },
  {
    name: "ui:calendar responsive layout (no horizontal overflow)",
    run: () => {
      mustInclude("app/(tabs)/events.tsx", "useCalendarWideLayout", "calendar tab");
      mustInclude("app/(tabs)/events.tsx", "communityCard", "calendar tab");
      mustInclude("app/(tabs)/events.tsx", "TrainingCalendarViewControls", "calendar tab");
      mustInclude("app/(tabs)/events.tsx", "TrainingCalendarCreateFab", "calendar tab");
      mustInclude("app/(tabs)/events.tsx", "TrainingCalendarTodaysFocus", "calendar tab");
      mustInclude("app/(tabs)/events.tsx", "getPartnersTrainingToday", "calendar tab");
      mustInclude("components/training-calendar/TrainingTogetherTodaySection.tsx", "Training Together Today", "ui");
      mustInclude("lib/training-calendar-focus.ts", "buildTodaysFocus", "focus helper");
      mustInclude("packages/types/src/training-calendar.ts", "PartnerTrainingTodayEntry", "types");
      mustInclude("components/training-calendar/TrainingCalendarMonthGrid.tsx", "weekRow", "month grid");
      mustInclude("lib/flex-layout.ts", "overflowX", "web scroll surface");
    },
  },
  {
    name: "docs:calendar roadmap defers Training Together Today",
    run: () => {
      mustInclude("features/training-calendar/ROADMAP.md", "Training Together Today", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Need a Training Partner Today", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Smart Partner Recommendations", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Fitness Circles", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Fitness Seasons", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Frennix Journey", "roadmap");
      mustInclude("features/training-calendar/ROADMAP.md", "Not in scope for v1", "roadmap");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "daily fitness dashboard", "dashboard spec");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "Need a Training Partner Today", "dashboard spec");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "Smart Partner Recommendations", "dashboard spec");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "Fitness Circles", "dashboard spec");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "Fitness Seasons", "dashboard spec");
      mustInclude("features/training-calendar/DAILY-FITNESS-DASHBOARD.md", "Frennix Journey", "dashboard spec");
    },
  },
  {
    name: "ui:create screen",
    run: () =>
      mustInclude("app/training-calendar/create.tsx", "createTrainingCalendarItem", "create screen"),
  },
  {
    name: "ui:edit screen",
    run: () =>
      mustInclude(
        "app/training-calendar/edit/[id].tsx",
        "updateTrainingCalendarItem",
        "edit screen"
      ),
  },
  {
    name: "ui:detail completion status",
    run: () =>
      mustInclude(
        "app/training-calendar/[id].tsx",
        "updateTrainingCalendarItemStatus",
        "detail screen"
      ),
  },
  {
    name: "ui:WorkoutSavedSheet on complete",
    run: () =>
      mustInclude("app/training-calendar/[id].tsx", "WorkoutSavedSheet", "detail screen"),
  },
  {
    name: "nav:stack routes registered",
    run: () =>
      mustInclude("app/_layout.tsx", "training-calendar/create", "layout"),
  },
  {
    name: "nav:tab label Calendar",
    run: () =>
      mustInclude("app/(tabs)/_layout.tsx", 'tabBarLabel: "Calendar"', "tabs layout"),
  },
  {
    name: "nav:community events browse",
    run: () => mustInclude("app/events/browse.tsx", "getWorkoutEvents", "events browse"),
  },
  {
    name: "story:invite routes to training calendar",
    run: () =>
      mustInclude("lib/story-calendar-invite.ts", "openTrainingCalendarCreate", "story invite"),
  },
  {
    name: "nav:training calendar helpers",
    run: () =>
      mustInclude(
        "lib/training-calendar-navigation.ts",
        "openTrainingCalendarCreate",
        "navigation"
      ),
  },
  {
    name: "prefetch:calendar view",
    run: () => mustInclude("lib/tab-prefetch.ts", "getCalendarView", "tab prefetch"),
  },
  {
    name: "api:getCalendarView",
    run: () =>
      mustInclude("packages/api/src/calendar-view.ts", "export async function getCalendarView", "api"),
  },
  {
    name: "api:getWorkoutActivityDates",
    run: () =>
      mustInclude(
        "packages/api/src/workout-activity.ts",
        "export async function getWorkoutActivityDates",
        "api"
      ),
  },
  {
    name: "api:respondTrainingSessionInvite",
    run: () =>
      mustInclude(
        "packages/api/src/training-session-invites.ts",
        "export async function respondTrainingSessionInvite",
        "api"
      ),
  },
  {
    name: "sql:phase2 provenance columns",
    run: () =>
      mustInclude(
        "supabase/migrations/20250717000001_training_calendar_phase2.sql",
        "source_type",
        "migration"
      ),
  },
  {
    name: "sql:external links table",
    run: () =>
      mustInclude(
        "supabase/migrations/20250717000001_training_calendar_phase2.sql",
        "training_calendar_external_links",
        "migration"
      ),
  },
  {
    name: "sql:training session invite notifications",
    run: () =>
      mustInclude(
        "supabase/migrations/20250717000001_training_calendar_phase2.sql",
        "training_session_invite",
        "migration"
      ),
  },
  {
    name: "ui:calendar uses getCalendarView",
    run: () => mustInclude("app/(tabs)/events.tsx", "getCalendarView", "calendar tab"),
  },
  {
    name: "ui:invites rail",
    run: () =>
      mustInclude("components/training-calendar/TrainingCalendarInvitesRail.tsx", "Training invites", "ui"),
  },
  {
    name: "nav:notification calendar deep link",
    run: () =>
      mustInclude("lib/notification-navigation.ts", "training_session_invite", "notifications"),
  },
  {
    name: "profile:unified workout streak",
    run: () => mustInclude("packages/api/src/profiles.ts", "getWorkoutStreak", "profiles"),
  },
  {
    name: "sql:platform_activity_events",
    run: () =>
      mustInclude(
        "supabase/migrations/20250718000001_achievements_reputation.sql",
        "platform_activity_events",
        "migration"
      ),
  },
  {
    name: "sql:achievement_definitions",
    run: () =>
      mustInclude(
        "supabase/migrations/20250718000001_achievements_reputation.sql",
        "achievement_definitions",
        "migration"
      ),
  },
  {
    name: "sql:user_reputation_scores",
    run: () =>
      mustInclude(
        "supabase/migrations/20250718000001_achievements_reputation.sql",
        "user_reputation_scores",
        "migration"
      ),
  },
  {
    name: "api:evaluateUserAchievements",
    run: () =>
      mustInclude(
        "packages/api/src/achievement-engine.ts",
        "export async function evaluateUserAchievements",
        "api"
      ),
  },
  {
    name: "api:getProfileAchievementDisplays",
    run: () =>
      mustInclude(
        "packages/api/src/achievement-engine.ts",
        "export async function getProfileAchievementDisplays",
        "api"
      ),
  },
  {
    name: "docs:system architecture",
    run: () =>
      mustInclude("docs/SYSTEM_ARCHITECTURE.md", "Training Calendar", "architecture doc"),
  },
  {
    name: "profile:achievement engine wired",
    run: () =>
      mustInclude("components/ProfileScreenContent.tsx", "getProfileAchievementDisplays", "profile ui"),
  },
  {
    name: "api:publishPlatformActivity",
    run: () =>
      mustInclude(
        "packages/api/src/platform-activity-engine.ts",
        "export async function publishPlatformActivity",
        "api"
      ),
  },
  {
    name: "api:getPlatformActivityStream",
    run: () =>
      mustInclude(
        "packages/api/src/platform-activity-engine.ts",
        "export async function getPlatformActivityStream",
        "api"
      ),
  },
  {
    name: "sql:publish_platform_activity RPC",
    run: () =>
      mustInclude(
        "supabase/migrations/20250719000001_platform_activity_engine.sql",
        "publish_platform_activity",
        "migration"
      ),
  },
  {
    name: "sql:activity_type column",
    run: () =>
      mustInclude(
        "supabase/migrations/20250719000001_platform_activity_engine.sql",
        "activity_type",
        "migration"
      ),
  },
  {
    name: "types:PlatformActivityType",
    run: () =>
      mustInclude("packages/types/src/platform-activity.ts", "workout_invite_accepted", "types"),
  },
  {
    name: "docs:platform activity engine",
    run: () =>
      mustInclude("docs/SYSTEM_ARCHITECTURE.md", "Platform Activity Engine", "architecture doc"),
  },
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
}

console.log(`\n${passed}/${checks.length} PASS${failed ? `, ${failed} FAIL` : ""}`);

if (failed > 0) {
  process.exit(1);
}
