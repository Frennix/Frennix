#!/usr/bin/env node
/**
 * Verify Beta Metrics dashboard RPC, survey RPCs, and access control.
 * Usage: node scripts/verify-beta-metrics.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const envPath = resolve(root, ".env");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const REQUIRED_SUMMARY_KEYS = [
  "total_registered_users",
  "new_users_this_week",
  "weekly_active_users",
  "multi_day_active_users",
  "total_matches",
  "users_matched",
  "match_rate_pct",
  "users_messaged_match",
  "conversation_rate_pct",
  "conversations_started",
  "survey_response_count",
  "survey_positive_pct",
];

const REQUIRED_TOP_KEYS = ["summary", "week_over_week", "survey_breakdown", "computed_at"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  assert(url && anonKey, "Missing Supabase env vars in .env");

  console.log("\n=== Beta Metrics verification ===\n");

  const migration = readFileSync(
    resolve(root, "supabase/migrations/20260831000001_beta_metrics.sql"),
    "utf8"
  );
  assert(migration.includes("beta_motivation_surveys"), "Migration missing survey table");
  assert(migration.includes("get_beta_metrics_dashboard"), "Migration missing dashboard RPC");
  assert(migration.includes("get_beta_motivation_survey_prompt"), "Migration missing prompt RPC");

  if (serviceKey) {
    const admin = createClient(url, serviceKey);
    const { data, error } = await admin.rpc("get_beta_metrics_dashboard");
    assert(!error, `get_beta_metrics_dashboard failed: ${error?.message}`);
    assert(data && typeof data === "object", "Dashboard returned no data");

    for (const key of REQUIRED_TOP_KEYS) {
      assert(key in data, `Missing top-level key: ${key}`);
    }
    for (const key of REQUIRED_SUMMARY_KEYS) {
      assert(key in data.summary, `Missing summary key: ${key}`);
    }

    console.log("✓ Dashboard RPC shape OK (service role)");
    console.log(`  Registered users: ${data.summary.total_registered_users}`);
    console.log(`  WAU: ${data.summary.weekly_active_users}`);
    console.log(`  Match rate: ${data.summary.match_rate_pct ?? "—"}%`);
  } else {
    console.log("⚠ Skipping live RPC test (no SUPABASE_SERVICE_ROLE_KEY)");
  }

  const anon = createClient(url, anonKey);
  const { error: anonErr } = await anon.rpc("get_beta_metrics_dashboard");
  assert(anonErr, "Unauthenticated dashboard access should be denied");
  console.log("✓ Unauthenticated dashboard access blocked");

  const { data: prompt, error: promptErr } = await anon.rpc("get_beta_motivation_survey_prompt");
  assert(!promptErr, `Survey prompt RPC failed: ${promptErr?.message}`);
  assert(prompt && prompt.show === false, "Anonymous user should not see survey");
  console.log("✓ Survey prompt RPC reachable");

  console.log("\nAll beta metrics checks passed.\n");
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
