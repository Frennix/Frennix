/**
 * Training Partner Journey architecture checks.
 * Run: npx tsx scripts/verify-training-partner-journey.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  PARTNERSHIP_LEVELS,
  PARTNERSHIP_MILESTONE_DEFINITIONS,
  buildPartnershipTimeline,
  formatPartnershipTimelineTimestamp,
  getPartnershipLevel,
} from "../packages/matching/src/partnership";
import { getFrennixMatchLevel } from "../packages/matching/src/frennix-match";

const ROOT = join(__dirname, "..");

function ok(label: string) {
  console.log(`[verify:training-partner-journey] OK  ${label}`);
}

function fail(label: string) {
  console.error(`[verify:training-partner-journey] FAIL ${label}`);
  process.exitCode = 1;
}

function requireFile(rel: string) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    fail(`Missing file: ${rel}`);
    return "";
  }
  ok(`File present: ${rel}`);
  return readFileSync(path, "utf8");
}

requireFile("packages/types/src/training-partnership.ts");
requireFile("packages/matching/src/partnership/levels.ts");
requireFile("packages/matching/src/partnership/milestones.ts");
requireFile("packages/api/src/training-partnership.ts");
const migrationSql = requireFile("supabase/migrations/20260729000001_training_partner_journey.sql");
requireFile("app/matching/journey/[matchId]/intro.tsx");
requireFile("app/matching/journey/[matchId]/index.tsx");
requireFile("components/PartnershipTimeline.tsx");
requireFile("features/training-partnership/README.md");
requireFile("lib/useDeferNotificationOnboarding.ts");

const onboardingTs = readFileSync(join(ROOT, "lib/notification-onboarding.ts"), "utf8");
const matchDisplayTs = readFileSync(join(ROOT, "components/FrennixMatchDisplay.tsx"), "utf8");
const frenixMatchTs = readFileSync(join(ROOT, "packages/matching/src/frennix-match.ts"), "utf8");

const indexTsx = readFileSync(join(ROOT, "app/matching/index.tsx"), "utf8");
if (indexTsx.includes("bootstrapTrainingPartnership") && indexTsx.includes("/matching/journey/")) {
  ok("Connect flow routes to journey intro");
} else {
  fail("Connect flow missing journey intro navigation");
}

if (!indexTsx.includes("<TrainingMatchModal")) {
  ok("Legacy match modal removed from discovery connect flow");
} else {
  fail("Discovery screen still renders TrainingMatchModal");
}

const introTsx = readFileSync(join(ROOT, "app/matching/journey/[matchId]/intro.tsx"), "utf8");
if (
  introTsx.includes("Your Training Partner Journey Begins") &&
  introTsx.includes("completeTrainingPartnershipIntro")
) {
  ok("Intro screen uses per-user journey begins copy");
} else {
  fail("Intro screen missing journey begins handoff");
}

const timelineTsx = readFileSync(join(ROOT, "components/PartnershipTimeline.tsx"), "utf8");
if (
  timelineTsx.includes("Compatibility Timeline") &&
  timelineTsx.includes("Coming up on your journey") &&
  timelineTsx.includes("occurredAtLabel")
) {
  ok("Timeline renders living history with timestamps");
} else {
  fail("Timeline missing history sections");
}

const apiTs = readFileSync(join(ROOT, "packages/api/src/training-partnership.ts"), "utf8");
if (
  apiTs.includes("resolveTrainingPartnerJourneyRoute") &&
  !apiTs.includes("record_training_partnership_milestone") &&
  !apiTs.includes("create_or_get_dm_conversation")
) {
  ok("API uses server-side route resolution without client milestone writes");
} else {
  fail("API still exposes unsafe client milestone or DM side effects");
}

if (
  migrationSql.includes("training_partnership_intro_views") &&
  migrationSql.includes("partnership_has_bidirectional_conversation") &&
  migrationSql.includes("internal_award_partnership_milestone") &&
  migrationSql.includes("validate_partnership_milestone_eligibility") &&
  migrationSql.includes("resolve_training_partner_journey_route") &&
  !migrationSql.includes("intro_completed_at")
) {
  ok("Migration uses per-user intro and server-side milestone validation");
} else {
  fail("Migration missing hardened partnership schema");
}

if (migrationSql.includes("GRANT EXECUTE") && !migrationSql.includes("record_training_partnership_milestone")) {
  ok("Client cannot call raw milestone record RPC");
} else {
  fail("Migration still grants client milestone record access");
}

if (
  migrationSql.includes("partnership_message_is_real") &&
  migrationSql.includes("deleted_for_everyone_at IS NULL") &&
  migrationSql.includes("get_dm_conversation")
) {
  ok("First-conversation requires bidirectional real messages in existing DM");
} else {
  fail("First-conversation milestone validation incomplete");
}

if (
  migrationSql.includes("UNIQUE (match_id, milestone_code)") &&
  migrationSql.includes("ON CONFLICT (match_id, milestone_code) DO NOTHING")
) {
  ok("Duplicate milestone prevention enforced at database level");
} else {
  fail("Duplicate milestone prevention missing");
}

if (
  migrationSql.includes("ENABLE ROW LEVEL SECURITY") &&
  migrationSql.includes("FOR SELECT") &&
  migrationSql.includes("users_are_blocked") &&
  !migrationSql.includes("FOR INSERT") &&
  !migrationSql.includes("FOR UPDATE") &&
  !migrationSql.includes("FOR DELETE")
) {
  ok("RLS is SELECT-only with block-aware access checks");
} else {
  fail("RLS policies incomplete or overly permissive");
}

if (migrationSql.includes("DELETE FROM") || migrationSql.includes("TRUNCATE") || migrationSql.includes("DROP TABLE public.matches")) {
  fail("Migration contains destructive statements");
} else {
  ok("Migration is additive and non-destructive");
}

if (PARTNERSHIP_LEVELS.length === 5 && getPartnershipLevel(0).id === "new_partners") {
  ok("Partnership levels defined with New Partners baseline");
} else {
  fail("Partnership level progression invalid");
}

const timeline = buildPartnershipTimeline([
  {
    id: "m1",
    match_id: "match-1",
    milestone_code: "partnership_started",
    occurred_at: "2026-07-29T19:42:00.000Z",
    metadata: {
      trigger_source: "match_created",
      location_label: "Austin, TX",
      links: { workout_id: null, challenge_id: null, event_id: null, photo_url: null },
    },
  },
]);

if (timeline.some((entry) => entry.status === "achieved") && timeline.some((entry) => entry.status === "upcoming")) {
  ok("Timeline builder mixes achieved and upcoming milestones");
} else {
  fail("Timeline builder did not produce mixed states");
}

const achievedEntry = timeline.find((entry) => entry.code === "partnership_started");
if (
  achievedEntry?.occurredAtLabel &&
  achievedEntry.locationLabel === "Austin, TX" &&
  achievedEntry.triggerSource === "match_created"
) {
  ok("Timeline entries include timestamp, location, and trigger metadata");
} else {
  fail("Timeline entry metadata incomplete");
}

if (formatPartnershipTimelineTimestamp("2026-07-29T19:42:00.000Z").includes("•")) {
  ok("Timeline timestamp formatter uses date • time pattern");
} else {
  fail("Timeline timestamp formatter invalid");
}

const codes = new Set(PARTNERSHIP_MILESTONE_DEFINITIONS.map((item) => item.code));
if (codes.size === PARTNERSHIP_MILESTONE_DEFINITIONS.length) {
  ok("Milestone codes are unique");
} else {
  fail("Duplicate milestone codes detected");
}

if (
  onboardingTs.includes("setNotificationOnboardingBlocked") &&
  onboardingTs.includes("onboardingBlocked") &&
  readFileSync(join(ROOT, "app/matching/journey/[matchId]/intro.tsx"), "utf8").includes(
    "useDeferNotificationOnboarding"
  )
) {
  ok("Notification onboarding deferred during journey flow");
} else {
  fail("Journey notification defer missing");
}

if (matchDisplayTs.includes("scoreRow") && !matchDisplayTs.includes("styles.root")) {
  ok("Frennix Match info icon attached inside badge");
} else {
  fail("Frennix Match info icon layout regression");
}

if (
  frenixMatchTs.includes("Exceptional Frennix Match") &&
  frenixMatchTs.includes("Strong Frennix Match") &&
  getFrennixMatchLevel(85).label === "Strong Frennix Match"
) {
  ok("Shared Frennix Match score labels use centralized thresholds");
} else {
  fail("Frennix Match label mapping incorrect");
}

if (!process.exitCode) {
  console.log("[verify:training-partner-journey] All checks passed");
}
