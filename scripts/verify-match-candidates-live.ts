/**
 * Production smoke test: get_match_candidates must not return 42804.
 * Requires TEST_USER_JWT (authenticated user with matching_enabled).
 * Run: npx tsx scripts/verify-match-candidates-live.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // optional
  }
}

loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const JWT = process.env.TEST_USER_JWT ?? "";

async function main() {
  if (!SUPABASE_URL || !ANON) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  if (!JWT) {
    console.log("SKIP  live RPC (set TEST_USER_JWT for authenticated smoke test)");
    process.exit(0);
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_match_candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${JWT}`,
    },
    body: JSON.stringify({ p_limit: 3 }),
  });

  const body = await res.text();
  if (!res.ok) {
    if (body.includes("42804") || body.includes("does not match expected")) {
      console.error("FAIL  get_match_candidates still has profiles type mismatch");
      console.error(body);
      process.exit(1);
    }
    console.error(`FAIL  RPC ${res.status}: ${body}`);
    process.exit(1);
  }

  const rows = JSON.parse(body) as unknown[];
  if (!Array.isArray(rows)) {
    console.error("FAIL  expected array response");
    process.exit(1);
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const profile = row as Record<string, unknown>;
    if (typeof profile.id !== "string" || typeof profile.username !== "string") {
      console.error("FAIL  candidate missing id/username", profile);
      process.exit(1);
    }
  }

  console.log(`PASS  get_match_candidates returned ${rows.length} profile row(s)`);
}

void main();
