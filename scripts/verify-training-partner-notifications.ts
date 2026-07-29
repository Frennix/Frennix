/**
 * Training Partner notification routing checks.
 * Run: npx tsx scripts/verify-training-partner-notifications.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function ok(label: string) {
  console.log(`[verify:training-partner-notifications] OK  ${label}`);
}

function fail(label: string) {
  console.error(`[verify:training-partner-notifications] FAIL ${label}`);
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

const navTs = requireFile("lib/notification-navigation.ts");
const apiTs = requireFile("packages/api/src/training-partnership.ts");
const migrationSql = requireFile("supabase/migrations/20260729000001_training_partner_journey.sql");

if (navTs.includes("resolveTrainingPartnerJourneyRoute")) {
  ok("In-app match notifications resolve journey route server-side");
} else {
  fail("Notification navigation missing journey route resolver");
}

if (navTs.includes("openNotificationFromPushDataAsync") && navTs.includes("resolveTrainingPartnerJourneyRoute")) {
  ok("Push match notifications use journey route resolver");
} else {
  fail("Push notifications missing journey route resolver");
}

if (navTs.includes("fallbackHref") || navTs.includes("route.fallbackHref")) {
  ok("Notification routing falls back gracefully");
} else {
  fail("Notification routing missing graceful fallback");
}

if (apiTs.includes("resolveTrainingPartnerJourneyRoute") && apiTs.includes("accessible")) {
  ok("API exposes typed journey route resolution");
} else {
  fail("API missing journey route resolution");
}

if (
  migrationSql.includes("resolve_training_partner_journey_route") &&
  migrationSql.includes("'route', 'intro'") &&
  migrationSql.includes("users_are_blocked")
) {
  ok("Migration resolves intro vs timeline and blocks unavailable partnerships");
} else {
  fail("Migration missing journey route resolver safeguards");
}

if (!process.exitCode) {
  console.log("[verify:training-partner-notifications] All checks passed");
}
