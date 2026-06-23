/**
 * Phase 13 — read-only load test for get_match_candidates RPC.
 *
 * Usage:
 *   TEST_USER_JWT=<access_token> npx tsx scripts/load-test-match-candidates.ts
 *   TEST_USER_JWT=... REQUESTS=50 npx tsx scripts/load-test-match-candidates.ts
 *
 * Does NOT modify matches, swipes, messages, or notifications.
 */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
const JWT = process.env.TEST_USER_JWT ?? "";
const REQUESTS = Math.max(1, Number(process.env.REQUESTS ?? "25"));

async function callCandidates(): Promise<number> {
  const started = performance.now();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_match_candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({ p_limit: 20 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`RPC failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as unknown[];
  const elapsed = performance.now() - started;
  return elapsed;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  if (!JWT) {
    console.error("Missing TEST_USER_JWT — use an authenticated user access token with matching_enabled");
    process.exit(1);
  }

  console.log(`\n# Load test: get_match_candidates (${REQUESTS} requests)\n`);

  const durations: number[] = [];
  let failures = 0;

  for (let i = 0; i < REQUESTS; i++) {
    try {
      const ms = await callCandidates();
      durations.push(ms);
      process.stdout.write(`  ${i + 1}/${REQUESTS} ${ms.toFixed(0)}ms\n`);
    } catch (error) {
      failures++;
      console.error(`  ${i + 1}/${REQUESTS} FAIL`, error instanceof Error ? error.message : error);
    }
  }

  if (!durations.length) {
    console.error("\nAll requests failed.");
    process.exit(1);
  }

  durations.sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  const p50 = durations[Math.floor(durations.length * 0.5)]!;
  const p95 = durations[Math.floor(durations.length * 0.95)]!;

  console.log("\n--- Results ---");
  console.log(`Success: ${durations.length}/${REQUESTS}`);
  console.log(`Failures: ${failures}`);
  console.log(`Avg: ${(sum / durations.length).toFixed(0)}ms`);
  console.log(`p50: ${p50.toFixed(0)}ms`);
  console.log(`p95: ${p95.toFixed(0)}ms`);
  console.log(`Max: ${durations[durations.length - 1]!.toFixed(0)}ms`);
}

void main();
