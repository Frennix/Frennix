/**
 * Partnership timeline formatting and metadata checks.
 * Run: npx tsx scripts/verify-partnership-timeline.ts
 */
import {
  buildPartnershipTimeline,
  formatPartnershipTimelineTimestamp,
  getPartnershipTimelineLocationLabel,
  PARTNERSHIP_MILESTONE_DEFINITIONS,
} from "../packages/matching/src/partnership";

function ok(label: string) {
  console.log(`[verify:partnership-timeline] OK  ${label}`);
}

function fail(label: string) {
  console.error(`[verify:partnership-timeline] FAIL ${label}`);
  process.exitCode = 1;
}

const achievedAt = "2026-08-02T23:15:00.000Z";
const timeline = buildPartnershipTimeline([
  {
    id: "m-workout",
    match_id: "match-1",
    milestone_code: "first_workout_together",
    occurred_at: achievedAt,
    metadata: {
      trigger_source: "workout_sync",
      location_label: "Austin, TX",
      links: {
        workout_id: "workout-123",
        challenge_id: null,
        event_id: null,
        photo_url: null,
      },
    },
  },
]);

const workoutEntry = timeline.find((entry) => entry.code === "first_workout_together");
if (workoutEntry?.status === "achieved" && workoutEntry.storyText === "First Workout Together") {
  ok("Achieved milestones use story headline copy");
} else {
  fail("Achieved milestone story copy missing");
}

if (workoutEntry?.metadata?.links?.workout_id === "workout-123") {
  ok("Timeline metadata preserves extensible links object");
} else {
  fail("Timeline metadata links missing");
}

const formatted = formatPartnershipTimelineTimestamp(achievedAt);
if (formatted.includes("2026") && formatted.includes("•")) {
  ok("Timeline timestamp includes calendar date and clock time");
} else {
  fail("Timeline timestamp formatting invalid");
}

if (PARTNERSHIP_MILESTONE_DEFINITIONS.every((item) => item.sortOrder > 0)) {
  ok("All milestone definitions have stable ordering");
} else {
  fail("Milestone ordering invalid");
}

const withLocation = buildPartnershipTimeline([
  {
    id: "m-started",
    match_id: "match-1",
    milestone_code: "partnership_started",
    occurred_at: achievedAt,
    metadata: {
      trigger_source: "match_created",
      location_label: "Austin, TX",
    },
  },
]);

const startedEntry = withLocation.find((entry) => entry.code === "partnership_started");
if (startedEntry && getPartnershipTimelineLocationLabel(startedEntry) === "Austin, TX") {
  ok("Timeline location shown only with server trigger metadata");
} else {
  fail("Timeline location privacy gate failed for consented milestone");
}

const withoutTrigger = buildPartnershipTimeline([
  {
    id: "m-started-2",
    match_id: "match-1",
    milestone_code: "partnership_started",
    occurred_at: achievedAt,
    metadata: { location_label: "Austin, TX" },
  },
]);
const hiddenEntry = withoutTrigger.find((entry) => entry.code === "partnership_started");
if (hiddenEntry && !getPartnershipTimelineLocationLabel(hiddenEntry)) {
  ok("Timeline location hidden without trigger metadata");
} else {
  fail("Timeline location leaked without consent metadata");
}

if (!process.exitCode) {
  console.log("[verify:partnership-timeline] All checks passed");
}
