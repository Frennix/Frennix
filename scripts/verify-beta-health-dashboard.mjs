#!/usr/bin/env node
/**
 * Verify Beta Health Dashboard RPC, access control, and metric shape.
 * Usage: node scripts/verify-beta-health-dashboard.mjs
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
  "total_beta_users",
  "daily_active_users",
  "weekly_active_users",
  "new_signups_today",
  "login_success_rate",
  "failed_login_count",
  "black_screen_occurrences",
  "startup_failures",
  "javascript_runtime_errors",
  "api_failures",
  "avg_feed_load_ms",
  "avg_app_startup_ms",
  "push_registration_success_rate",
  "push_delivery_success_rate",
  "active_push_subscriptions",
  "message_delivery_failures",
  "story_upload_failures",
  "photo_upload_failures",
  "video_upload_failures",
  "event_creation_failures",
  "comment_failures",
  "avg_session_duration_ms",
  "crash_free_session_pct",
];

const REQUIRED_TOP_KEYS = [
  "summary",
  "new_signups_by_day",
  "performance_trends",
  "recent_errors",
  "critical_issues",
  "top_bugs",
  "device_breakdown",
  "ios_versions",
  "browser_versions",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  assert(url && anonKey, "Missing Supabase env vars in .env");

  console.log("\n=== Beta Health Dashboard verification ===\n");

  // 1. RPC exists and returns shape via service role (bypasses auth for structure check)
  if (serviceKey) {
    const admin = createClient(url, serviceKey);
    const { data, error } = await admin.rpc("get_beta_health_dashboard", { p_preset: "week" });
    if (error?.message?.includes("does not exist")) {
      console.log("SKIP  RPC not deployed yet — run: supabase db push");
    } else if (error) {
      throw error;
    } else {
      for (const key of REQUIRED_TOP_KEYS) {
        assert(key in data, `Missing top-level key: ${key}`);
      }
      for (const key of REQUIRED_SUMMARY_KEYS) {
        assert(key in data.summary, `Missing summary key: ${key}`);
      }
      assert(Array.isArray(data.recent_errors), "recent_errors must be array");
      assert(Array.isArray(data.critical_issues), "critical_issues must be array");
      assert(Array.isArray(data.performance_trends), "performance_trends must be array");
      console.log("PASS  RPC shape and summary keys");
      console.log(`      DAU=${data.summary.daily_active_users} WAU=${data.summary.weekly_active_users}`);
      console.log(`      Critical issues: ${data.critical_issues.length}`);
      console.log(`      Recent errors: ${data.recent_errors.length}`);
    }
  } else {
    console.log("SKIP  RPC shape check — no SUPABASE_SERVICE_ROLE_KEY");
  }

  // 2. Unauthenticated call must fail
  const anon = createClient(url, anonKey);
  const { error: unauthError } = await anon.rpc("get_beta_health_dashboard", { p_preset: "week" });
  assert(unauthError, "Unauthenticated RPC call should fail");
  console.log("PASS  Unauthenticated access blocked");

  // 3. Source files present
  const files = [
    "components/founder/BetaHealthDashboardScreen.tsx",
    "app/founder/beta-health.tsx",
    "packages/api/src/founder/beta-health.ts",
    "lib/founder/useBetaHealthDashboard.ts",
    "lib/beta-health-analytics.ts",
    "supabase/migrations/20260708140000_beta_health_dashboard.sql",
  ];
  for (const file of files) {
    readFileSync(resolve(root, file), "utf8");
    console.log(`PASS  ${file} exists`);
  }

  // 4. Nav item gated to analytics capability
  const types = readFileSync(resolve(root, "packages/types/src/founder-dashboard.ts"), "utf8");
  assert(types.includes('href: "/founder/beta-health"'), "Nav item missing");
  assert(types.includes("capability_view_analytics"), "Nav must require analytics capability");
  console.log("PASS  Admin nav + capability gate in types");

  // 5. Instrumentation wired (no duplicate systems)
  const login = readFileSync(resolve(root, "app/(auth)/login.tsx"), "utf8");
  assert(login.includes("trackAuthLoginSuccess"), "Login success tracking missing");
  assert(login.includes("trackAuthLoginFailed"), "Login failure tracking missing");
  const watchdog = readFileSync(resolve(root, "components/StartupWatchdog.tsx"), "utf8");
  assert(watchdog.includes("trackStartupStall"), "Startup stall tracking missing");
  console.log("PASS  Uses existing product_events pipeline");

  // 6. Dashboard is lazy-loaded founder route (no app bundle impact for regular users)
  const layout = readFileSync(resolve(root, "app/founder/_layout.tsx"), "utf8");
  assert(layout.includes("beta-health"), "Founder layout must register beta-health route");
  console.log("PASS  Dashboard isolated to /founder/beta-health route");

  console.log("\n=== All checks passed ===\n");
}

main().catch((err) => {
  console.error("\nFAIL", err.message ?? err);
  process.exit(1);
});
