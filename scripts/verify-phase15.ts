/**
 * Phase 15 verification — analytics migration, feedback types, scripts.
 * Run: npx tsx scripts/verify-phase15.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../../..");
const MOBILE = join(ROOT, "apps/mobile");
const SUPABASE = join(ROOT, "supabase/migrations");

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const results: Check[] = [];

function pass(id: string, detail: string) {
  results.push({ id, status: "PASS", detail });
}
function fail(id: string, detail: string) {
  results.push({ id, status: "FAIL", detail });
}

const REQUIRED = [
  "20250629000001_phase15_analytics_and_feedback.sql",
  "20250627000001_trainer_matching.sql",
  "20250628000001_trainer_categories.sql",
];

for (const file of REQUIRED) {
  const path = join(SUPABASE, file);
  if (existsSync(path)) pass(`migration:${file}`, "present");
  else fail(`migration:${file}`, "missing");
}

const phase15 = readFileSync(join(SUPABASE, "20250629000001_phase15_analytics_and_feedback.sql"), "utf8");
for (const token of [
  "product_events",
  "track_daily_active_user",
  "get_product_analytics_summary",
  "trainer_connection_requested",
  "general",
]) {
  if (phase15.includes(token)) pass(`sql:${token}`, "found");
  else fail(`sql:${token}`, "missing");
}

for (const file of [
  "lib/product-analytics.ts",
  "lib/feedback-context.ts",
  "components/ProductAnalyticsBootstrap.tsx",
  "app/admin-analytics.tsx",
  "features/validation/REAL-USER-TESTING.md",
]) {
  if (existsSync(join(MOBILE, file))) pass(`file:${file}`, "present");
  else fail(`file:${file}`, "missing");
}

for (const script of [
  "scripts/measure-feed-perf.ts",
  "scripts/measure-messaging-perf.ts",
  "scripts/measure-trainer-search-perf.ts",
]) {
  if (existsSync(join(MOBILE, script))) pass(`script:${script}`, "present");
  else fail(`script:${script}`, "missing");
}

const betaFeedback = readFileSync(join(MOBILE, "app/beta-feedback.tsx"), "utf8");
if (betaFeedback.includes("general") && betaFeedback.includes("Report a bug")) {
  pass("ui:beta-feedback", "bug/feature/general tabs");
} else {
  fail("ui:beta-feedback", "expected three feedback tabs");
}

console.log("\nPhase 15 verification\n");
for (const r of results) {
  console.log(`${r.status === "PASS" ? "✅" : "❌"} ${r.id} — ${r.detail}`);
}
const failed = results.filter((r) => r.status === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
