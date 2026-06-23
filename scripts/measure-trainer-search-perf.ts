/**
 * Measures trainer search RPC. Run from apps/mobile:
 *   npx tsx scripts/measure-trainer-search-perf.ts
 *
 * Requires authenticated TEST_USER_JWT in env (or .env).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnv();

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const jwt = process.env.TEST_USER_JWT;

  if (!url || !anon || !jwt) {
    console.error("Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_JWT");
    process.exit(1);
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const runs = 5;
  const timings: number[] = [];

  console.log("Measuring search_trainers RPC…\n");

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const { error } = await supabase.rpc("search_trainers", { p_limit: 20 });
    const elapsed = performance.now() - start;
    if (error) throw error;
    timings.push(elapsed);
    console.log(`Run ${i + 1}: ${elapsed.toFixed(0)}ms`);
  }

  console.log("\nSummary:");
  console.log(`  p50: ${percentile(timings, 50).toFixed(0)}ms`);
  console.log(`  p95: ${percentile(timings, 95).toFixed(0)}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
