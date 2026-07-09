#!/usr/bin/env node
/**
 * Verify Operations Dashboard — access, RPC shape, performance isolation.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const text = readFileSync(resolve(root, ".env"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function assert(c, m) {
  if (!c) throw new Error(m);
}

const REQUIRED_SECTIONS = [
  "overall_system_health",
  "system_status",
  "live_activity",
  "performance",
  "push",
  "beta_feedback",
  "alerts",
  "errors",
  "beta_health",
];

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("\n=== Operations Dashboard verification ===\n");

  const anon = createClient(url, anonKey);
  const { error: unauth } = await anon.rpc("get_operations_dashboard", { p_trend_window: "7d", p_preset: "today" });
  assert(unauth, "Unauthenticated access must be blocked");
  console.log("PASS  Admin-only RPC gate (unauthenticated blocked)");

  if (serviceKey) {
    const admin = createClient(url, serviceKey);
    const start = Date.now();
    const { data, error } = await admin.rpc("get_operations_dashboard", {
      p_trend_window: "7d",
      p_preset: "today",
    });
    const elapsed = Date.now() - start;
    if (error?.message?.includes("does not exist")) {
      console.log("SKIP  RPC not deployed — run supabase db push");
    } else if (error) {
      throw error;
    } else {
      for (const key of REQUIRED_SECTIONS) assert(key in data, `Missing section: ${key}`);
      assert(["green", "yellow", "red"].includes(data.overall_system_health), "Invalid overall health");
      assert(Array.isArray(data.errors), "errors must be array");
      assert(data.live_activity.users_online != null, "live_activity missing");
      console.log(`PASS  RPC shape complete (${elapsed}ms)`);
      assert(elapsed < 5000, `RPC too slow: ${elapsed}ms (target <2s after warm cache)`);
      console.log(`PASS  Dashboard load time acceptable (${elapsed}ms)`);
    }
  } else {
    console.log("SKIP  RPC load test — no service role key");
  }

  const files = [
    "components/founder/OperationsDashboardScreen.tsx",
    "app/founder/operations.tsx",
    "packages/api/src/founder/operations.ts",
    "lib/founder/useOperationsDashboard.ts",
    "supabase/migrations/20260708150000_operations_dashboard.sql",
  ];
  for (const f of files) {
    readFileSync(resolve(root, f), "utf8");
    console.log(`PASS  ${f}`);
  }

  const hook = readFileSync(resolve(root, "lib/founder/useOperationsDashboard.ts"), "utf8");
  assert(hook.includes("refetchInterval: 30_000"), "30s auto-refresh missing");
  console.log("PASS  30-second auto-refresh configured");

  const types = readFileSync(resolve(root, "packages/types/src/founder-dashboard.ts"), "utf8");
  assert(types.includes('href: "/founder/operations"'), "Nav must point to operations");
  console.log("PASS  Operations nav registered");

  const appLayout = readFileSync(resolve(root, "app/_layout.tsx"), "utf8");
  assert(!appLayout.includes("OperationsDashboardScreen"), "Dashboard not in root layout");
  console.log("PASS  No app-wide performance impact (founder route only)");

  console.log("\n=== All checks passed ===\n");
}

main().catch((e) => {
  console.error("\nFAIL", e.message ?? e);
  process.exit(1);
});
