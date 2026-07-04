#!/usr/bin/env npx tsx
/**
 * v1.0.2 completion gate — production sharing, core surfaces, friendly errors in bundle.
 * Run after: build:web + vercel deploy --prod
 *
 *   npm run build:web
 *   npx vercel deploy --prod --yes
 *   npm run verify:v1.0.2-complete
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(import.meta.dirname, "..");
const PROD_URL = "https://frennix.vercel.app";
const FRIENDLY_MSG =
  "We're currently improving workout sharing. Please try again in a few minutes.";

function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function runTsx(script: string) {
  execSync(`npx tsx ${script}`, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
}

function distBundleIncludesFriendlyMessage(): boolean {
  const dist = join(ROOT, "dist");
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error("dist/index.html missing — run npm run build:web");
  }
  const scan = (dir: string): string => {
    let text = "";
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) text += scan(p);
      else if (/\.(js|html)$/i.test(entry.name)) text += readFileSync(p, "utf8");
    }
    return text;
  };
  const bundle = scan(dist);
  if (!bundle.includes(FRIENDLY_MSG)) {
    throw new Error("friendly share message not found in dist bundle");
  }
  if (bundle.includes("code=42703") || bundle.includes("column 'event_type'")) {
    throw new Error("raw database error strings found in dist bundle");
  }
  return true;
}

async function productionBundleIncludesFriendlyMessage(): Promise<void> {
  const res = await fetch(PROD_URL);
  if (!res.ok) throw new Error(`${PROD_URL} returned ${res.status}`);
  const html = await res.text();
  const scriptMatch = html.match(/src="(\/_expo\/static\/js\/web\/[^"]+\.js)"/);
  if (!scriptMatch) throw new Error("could not find main JS bundle in production HTML");
  const jsRes = await fetch(`${PROD_URL}${scriptMatch[1]}`);
  if (!jsRes.ok) throw new Error(`bundle fetch ${jsRes.status}`);
  const js = await jsRes.text();
  if (!js.includes(FRIENDLY_MSG)) {
    throw new Error("friendly share message not in production JS bundle — redeploy required");
  }
}

type Check = { name: string; run: () => Promise<void> | void };

async function main() {
  loadEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) throw new Error("Missing EXPO_PUBLIC_SUPABASE_* in .env");

  const supabase = createClient(url, anon);

  const checks: Check[] = [
    {
      name: "gate:post-sharing production (workout/photo/video)",
      run: () => execSync("npm run verify:post-sharing", { cwd: ROOT, encoding: "utf8", stdio: "pipe" }),
    },
    {
      name: "gate:schema-sync",
      run: () => execSync("npm run verify:schema-sync", { cwd: ROOT, encoding: "utf8", stdio: "pipe" }),
    },
    {
      name: "gate:training-calendar",
      run: () => execSync("npm run verify:training-calendar", { cwd: ROOT, encoding: "utf8", stdio: "pipe" }),
    },
    {
      name: "gate:stories production API",
      run: () => runTsx("scripts/verify-remote-story-tables.ts"),
    },
    {
      name: "api:feed posts reachable",
      run: async () => {
        const { error } = await supabase.from("posts").select("id").order("created_at", { ascending: false }).limit(5);
        if (error) throw new Error(error.message);
      },
    },
    {
      name: "api:stories reachable",
      run: async () => {
        const { error } = await supabase.from("stories").select("id").limit(5);
        if (error) throw new Error(error.message);
      },
    },
    {
      name: "api:notifications table reachable",
      run: async () => {
        const { error } = await supabase.from("notifications").select("id").limit(1);
        if (error) throw new Error(error.message);
      },
    },
    {
      name: "api:training calendar reachable",
      run: async () => {
        const { error } = await supabase
          .from("training_calendar_items")
          .select("id")
          .limit(5);
        if (error) throw new Error(error.message);
      },
    },
    {
      name: "bundle:local dist has friendly share errors",
      run: () => {
        distBundleIncludesFriendlyMessage();
      },
    },
    {
      name: "bundle:production deploy has friendly share errors",
      run: productionBundleIncludesFriendlyMessage,
    },
    {
      name: "site:production HTTP 200",
      run: async () => {
        const res = await fetch(PROD_URL, { method: "HEAD" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      },
    },
  ];

  let failed = 0;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name}`);
    } catch (e) {
      failed += 1;
      console.error(`FAIL  ${check.name}`);
      console.error(`      ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }

  if (failed) {
    console.error("\nv1.0.2 completion gate FAILED — not marking release complete.");
    process.exit(1);
  }
  console.log(`\n${checks.length}/${checks.length} PASS — v1.0.2 ready to close`);
}

void main();
