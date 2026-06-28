/**
 * Verifies the modular matching scoring engine and Phase A architecture.
 * Run: pnpm verify:matching-scoring
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMatchReasons,
  scoreFromReasons,
  scoreMatch,
} from "../packages/matching/src";
import { DEFAULT_MATCHING_WEIGHTS } from "../packages/types/src/matching";
import type { MatchableProfile } from "../packages/types/src";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function profile(overrides: Partial<MatchableProfile>): MatchableProfile {
  return {
    id: "user-a",
    username: "athlete_a",
    display_name: "Athlete A",
    avatar_url: null,
    bio: null,
    fitness_goals: [],
    activities: [],
    city: null,
    visibility: "public",
    matching_enabled: true,
    gender: "female",
    match_preference: "any",
    is_premium: false,
    onboarding_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const viewer = profile({
  id: "viewer",
  fitness_goals: ["accountability_partner", "build_muscle"],
  activities: ["running", "weightlifting"],
  city: "Austin",
  training_schedules: ["morning"],
  skill_level: "intermediate",
  home_gym: "Iron Temple",
  training_environment: "indoor",
});

const candidate = profile({
  id: "candidate",
  display_name: "Jordan",
  fitness_goals: ["accountability_partner", "stay_active"],
  activities: ["running", "yoga"],
  city: "Austin",
  training_schedules: ["morning", "evening"],
  skill_level: "intermediate",
  home_gym: "Iron Temple",
  training_environment: "indoor",
  is_online: true,
  last_seen_at: new Date().toISOString(),
});

const reasons = buildMatchReasons(viewer, candidate, DEFAULT_MATCHING_WEIGHTS, {
  viewerStreak: 24,
  candidateStreak: 21,
});

const checks: Array<{ name: string; test: () => boolean }> = [
  {
    name: "Every match has explainability reasons",
    test: () => reasons.length >= 3,
  },
  {
    name: "Accountability partner reason copy",
    test: () => reasons.some((r) => r.label.includes("accountability partner")),
  },
  {
    name: "Shared activity reason copy",
    test: () => reasons.some((r) => r.code === "shared_activities" && r.label.includes("running")),
  },
  {
    name: "Same city reason",
    test: () => reasons.some((r) => r.code === "same_city"),
  },
  {
    name: "Shared schedule reason",
    test: () => reasons.some((r) => r.code === "shared_schedule" && r.label.includes("morning")),
  },
  {
    name: "Same gym reason",
    test: () => reasons.some((r) => r.code === "same_gym"),
  },
  {
    name: "Workout streak reason for 20+ days",
    test: () => reasons.some((r) => r.code === "workout_streak" && r.label.includes("20+")),
  },
  {
    name: "Score is bounded 0-100",
    test: () => {
      const score = scoreMatch(viewer, candidate, DEFAULT_MATCHING_WEIGHTS, {
        viewerStreak: 24,
        candidateStreak: 21,
      });
      return score > 0 && score <= 100;
    },
  },
  {
    name: "Score equals sum of reason weights (capped)",
    test: () => scoreFromReasons(reasons) === scoreMatch(viewer, candidate, DEFAULT_MATCHING_WEIGHTS, {
      viewerStreak: 24,
      candidateStreak: 21,
    }),
  },
  {
    name: "Phase A migration exists",
    test: () => {
      const sql = readFileSync(
        join(ROOT, "supabase/migrations/20250630000014_matching_scoring_phase_a.sql"),
        "utf8"
      );
      return (
        sql.includes("skill_level") &&
        sql.includes("training_schedules") &&
        sql.includes("profile_workout_streak")
      );
    },
  },
  {
    name: "API enriches candidates with match_reasons",
    test: () => {
      const api = readFileSync(join(ROOT, "packages/api/src/matching.ts"), "utf8");
      return api.includes("buildMatchReasons") && api.includes("match_reasons");
    },
  },
  {
    name: "MatchReasonsList component exists",
    test: () => {
      const ui = readFileSync(join(ROOT, "components/MatchReasonsList.tsx"), "utf8");
      return ui.includes("Why we matched you");
    },
  },
];

let failed = 0;
for (const check of checks) {
  if (check.test()) {
    console.log(`[verify:matching-scoring] OK  ${check.name}`);
  } else {
    failed += 1;
    console.error(`[verify:matching-scoring] FAIL ${check.name}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`[verify:matching-scoring] ${checks.length} checks passed`);
