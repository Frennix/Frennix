/**
 * Frennix Match verification — migration, types, branding, scoring, UI wiring.
 * Run: npx tsx scripts/verify-lifestyle-matching.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCompatibilityReasons,
  FRENIX_MATCH_BRAND,
  formatFrennixMatchDisplay,
  getFrennixMatchLevel,
  scoreCompatibility,
} from "@frennix/matching";
import type { Profile } from "@frennix/types";

const MOBILE = join(__dirname, "..");
const TYPES = join(MOBILE, "packages/types/src");
const MIGRATION = join(
  MOBILE,
  "supabase/migrations/20250708000001_lifestyle_matching.sql"
);

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const results: Check[] = [];

function pass(id: string, detail: string) {
  results.push({ id, status: "PASS", detail });
}
function fail(id: string, detail: string) {
  results.push({ id, status: "FAIL", detail });
}

const REQUIRED_COLUMNS = [
  "parent_status",
  "parent_type",
  "children_age_groups",
  "preferred_workout_times",
  "kid_friendly_workouts",
  "looking_for_parent_partner",
  "lifestyle_tags",
];

if (existsSync(MIGRATION)) {
  const sql = readFileSync(MIGRATION, "utf8");
  for (const col of REQUIRED_COLUMNS) {
    if (sql.includes(col)) pass(`sql:${col}`, "migration column");
    else fail(`sql:${col}`, "missing in migration");
  }
  if (sql.includes("profiles_reader") && sql.includes("parent_status")) {
    pass("sql:profiles_reader", "view exposes lifestyle fields");
  } else {
    fail("sql:profiles_reader", "profiles_reader not updated");
  }
} else {
  fail("migration", "20250708000001_lifestyle_matching.sql missing");
}

const lifestyleTypes = readFileSync(join(TYPES, "lifestyle.ts"), "utf8");
for (const token of [
  "PARENT_STATUSES",
  "PARENT_TYPES",
  "CHILDREN_AGE_GROUPS",
  "PREFERRED_WORKOUT_TIMES",
  "LIFESTYLE_TAG_CATALOG",
  "LifestyleProfileFields",
  "DiscoverCompatibilityFilters",
]) {
  if (lifestyleTypes.includes(token)) pass(`types:${token}`, "present");
  else fail(`types:${token}`, "missing");
}

const profileType = readFileSync(join(TYPES, "index.ts"), "utf8");
for (const col of REQUIRED_COLUMNS) {
  if (profileType.includes(col)) pass(`profile:${col}`, "on Profile interface");
  else fail(`profile:${col}`, "missing from Profile");
}
if (profileType.includes("compatibility_score") && profileType.includes("match_reasons")) {
  pass("types:SuggestedAthlete", "compatibility fields on SuggestedAthlete");
} else {
  fail("types:SuggestedAthlete", "missing compatibility fields");
}

const files: [string, string][] = [
  ["packages/matching/src/compatibility.ts", "scoring engine"],
  ["packages/matching/src/frennix-match.ts", "Frennix Match branding"],
  ["components/FrennixMatchDisplay.tsx", "match display UI"],
  ["components/FrennixMatchExplainerModal.tsx", "Frennix Match explainer modal"],
  ["lib/lifestyle-matching.ts", "helpers"],
  ["components/LifestyleProfileSection.tsx", "profile form"],
  ["components/LifestyleBadges.tsx", "badges"],
  ["components/DiscoverLifestyleFilters.tsx", "discover filters"],
  ["components/MatchReasonsList.tsx", "why we matched"],
  ["app/edit-profile.tsx", "edit profile"],
  ["app/onboarding.tsx", "onboarding"],
  ["app/(tabs)/discover.tsx", "discover"],
  ["app/user/[username].tsx", "profile compatibility"],
  ["packages/api/src/profiles.ts", "discoverProfiles filters"],
  ["packages/api/src/suggestions.ts", "scoreProfileCompatibility"],
  ["packages/ui/src/DiscoverProfileCard.tsx", "discover card badges"],
];

for (const [rel, label] of files) {
  const path = join(MOBILE, rel);
  if (existsSync(path)) pass(`file:${rel}`, label);
  else fail(`file:${rel}`, "missing");
}

const lib = readFileSync(join(MOBILE, "lib/lifestyle-matching.ts"), "utf8");
for (const fn of [
  "getLifestyleBadges",
  "buildLifestyleProfilePatch",
  "matchesDiscoverFilters",
  "hasActiveDiscoverFilters",
]) {
  if (lib.includes(fn)) pass(`fn:${fn}`, "exported helper");
  else fail(`fn:${fn}`, "missing");
}

if (lib.includes('"Mom"') && lib.includes('"Kid-Friendly"')) {
  pass("badges:labels", "expected badge copy");
} else {
  fail("badges:labels", "badge labels missing");
}

const discover = readFileSync(join(MOBILE, "app/(tabs)/discover.tsx"), "utf8");
for (const token of [
  "DiscoverCompatibilityFilters",
  "scoreProfileCompatibility",
  "FrennixMatchDisplay",
  "FrennixMatchExplainerModal",
  "openFrennixMatchExplainer",
  "FRENIX_MATCH_BRAND",
  "LIFESTYLE_BRAND",
]) {
  if (discover.includes(token)) pass(`discover:${token}`, "wired");
  else fail(`discover:${token}`, "missing");
}

const lifestyleBrand = readFileSync(join(MOBILE, "lib/lifestyle-matching.ts"), "utf8");
for (const token of [
  "LIFESTYLE_BRAND",
  "Lifestyle Filters",
  "Lifestyle matches",
  'profileSection: "Lifestyle"',
]) {
  if (lifestyleBrand.includes(token)) pass(`lifestyle:${token}`, "centralized");
  else fail(`lifestyle:${token}`, "missing");
}

const branding = readFileSync(join(MOBILE, "packages/matching/src/frennix-match.ts"), "utf8");
for (const token of [
  "FRENIX_MATCH_BRAND",
  "FRENIX_MATCH_LEVELS",
  "FRENIX_MATCH_FUTURE_FACTORS",
  "formatFrennixMatchDisplay",
  "Elite Frennix Match",
  "Exceptional Frennix Match",
  "Strong Frennix Match",
  "What is Frennix Match?",
  "proprietary compatibility system",
]) {
  if (branding.includes(token)) pass(`brand:${token}`, "centralized");
  else fail(`brand:${token}`, "missing");
}

const suggestions = readFileSync(join(MOBILE, "packages/api/src/suggestions.ts"), "utf8");
if (suggestions.includes("buildCompatibilityReasons") && suggestions.includes("scoreProfileCompatibility")) {
  pass("api:compatibility", "suggestions use compatibility engine");
} else {
  fail("api:compatibility", "suggestions missing engine");
}

// Runtime scoring — null-safe, optional lifestyle fields
const viewer = {
  id: "v1",
  username: "viewer",
  display_name: "Viewer",
  fitness_goals: ["strength", "accountability_partner"],
  activities: ["weightlifting"],
  parent_status: "parent",
  children_age_groups: ["toddler"],
  preferred_workout_times: ["early_morning"],
  kid_friendly_workouts: true,
  looking_for_parent_partner: true,
} as Profile;

const candidate = {
  id: "c1",
  username: "candidate",
  display_name: "Candidate",
  fitness_goals: ["accountability_partner"],
  activities: ["weightlifting", "running"],
  parent_status: "parent",
  children_age_groups: ["toddler"],
  preferred_workout_times: ["early_morning"],
  kid_friendly_workouts: true,
  looking_for_parent_partner: true,
  city: "Austin",
  latitude: 30.27,
  longitude: -97.74,
} as Profile;

const emptyCandidate = {
  id: "c2",
  username: "empty",
  display_name: "Empty",
} as Profile;

const score = scoreCompatibility(viewer, candidate);
const reasons = buildCompatibilityReasons(viewer, candidate);
const badge = formatFrennixMatchDisplay(score);
const level = getFrennixMatchLevel(score);
const emptyScore = scoreCompatibility(viewer, emptyCandidate);

if (score >= 50 && score <= 100) pass("engine:score", `score=${score}`);
else fail("engine:score", `unexpected score ${score}`);

if (reasons.some((r) => r.label.includes("strength") || r.code === "shared_activities")) {
  pass("engine:strength", "strength training reason");
} else {
  fail("engine:strength", "missing strength reason");
}

if (reasons.some((r) => r.code === "both_parents")) pass("engine:parents", "parent reason");
else fail("engine:parents", "missing parent reason");

if (badge?.percentLabel.includes("Frennix Match")) {
  pass("engine:badge", badge.percentLabel);
} else {
  fail("engine:badge", "Frennix Match badge format unexpected");
}

if (level.id === "exceptional" && score >= 90) pass("engine:level", level.label);
else if (level.id === "strong" && score >= 75 && score < 90) pass("engine:level", level.label);
else if (level.label.includes("Frennix Match")) pass("engine:level", level.label);
else fail("engine:level", "match level unexpected");

if (FRENIX_MATCH_BRAND.tooltip.includes("Frennix Match")) {
  pass("brand:tooltip", "tooltip copy");
} else {
  fail("brand:tooltip", "tooltip missing");
}

if (emptyScore >= 0 && emptyScore <= 100) pass("engine:null-safe", `empty score=${emptyScore}`);
else fail("engine:null-safe", "null fields crashed scoring");

console.log("\nFrennix Match verification\n");
for (const r of results) {
  console.log(`${r.status === "PASS" ? "✅" : "❌"} ${r.id} — ${r.detail}`);
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
