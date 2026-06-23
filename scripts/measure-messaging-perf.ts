/**
 * Measures messaging load (getMessages). Run from apps/mobile:
 *   npx tsx scripts/measure-messaging-perf.ts <userId> <conversationId>
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
  const userId = process.argv[2];
  const conversationId = process.argv[3];
  if (!userId || !conversationId) {
    console.error("Usage: npx tsx scripts/measure-messaging-perf.ts <userId> <conversationId>");
    process.exit(1);
  }

  const { getMessages } = await import("@frennix/api");
  const runs = 5;
  const timings: number[] = [];

  console.log(`Measuring getMessages(${conversationId}) (${runs} runs)…\n`);

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const messages = await getMessages(conversationId, userId);
    timings.push(performance.now() - start);
    console.log(`Run ${i + 1}: ${timings[i]!.toFixed(0)}ms — ${messages.length} messages`);
  }

  console.log("\nSummary:");
  console.log(`  p50: ${percentile(timings, 50).toFixed(0)}ms`);
  console.log(`  p95: ${percentile(timings, 95).toFixed(0)}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
