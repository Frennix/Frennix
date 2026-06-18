/**
 * Measures getFeed() network cost. Run from monorepo root:
 *   cd apps/mobile && npx tsx scripts/measure-feed-perf.ts <userId>
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    // .env optional when vars are already exported
  }
}

loadEnv();

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx tsx scripts/measure-feed-perf.ts <userId>");
    process.exit(1);
  }

  const { getFeed } = await import("@frennix/api");

  const runs = 3;
  const timings: number[] = [];

  console.log(`Measuring getFeed() for user ${userId} (${runs} runs)…\n`);

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const page = await getFeed(userId);
    const elapsed = performance.now() - start;
    timings.push(elapsed);
    console.log(`Run ${i + 1}: ${elapsed.toFixed(0)}ms — ${page.posts.length} posts`);
  }

  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);

  console.log(`\nSummary: avg ${avg.toFixed(0)}ms, min ${min.toFixed(0)}ms, max ${max.toFixed(0)}ms`);
  console.log("\nBottleneck checklist (DevTools Network tab):");
  console.log("  • Before RPC: ~9–10 Supabase requests per page (follows + posts + 4×interaction rows + previews + reactions + shares)");
  console.log("  • After RPC:  ~6–7 requests (follows + posts + stats RPC + previews RPC + reactions + shares)");
  console.log("  • Scroll lag: profile WebVideoFrame / useVideoPoster per visible video row");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
