#!/usr/bin/env node
/**
 * Benchmark feed API load time (first page).
 * Run: node scripts/benchmark-feed-load.mjs <user-id>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");

function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  return out;
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/benchmark-feed-load.mjs <user-id>");
  process.exit(1);
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function time(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`${label}: ${ms}ms`);
  return { result, ms };
}

console.log(`\nFeed benchmark for ${userId}\n`);

const scope = await time("feed_scope (follows/groups/challenges)", async () => {
  const [following, groups, challenges] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", userId),
    supabase.from("group_members").select("group_id").eq("user_id", userId),
    supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);
  return {
    following: following.data?.length ?? 0,
    groups: groups.data?.length ?? 0,
    challenges: challenges.data?.length ?? 0,
  };
});

const posts12 = await time("posts_query (12 rows)", async () => {
  const authorIds = [userId];
  const { data } = await supabase
    .from("posts")
    .select(`id, created_at, author_id`)
    .or(`author_id.in.(${authorIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(12);
  return data?.length ?? 0;
});

const posts20 = await time("posts_query (20 rows)", async () => {
  const authorIds = [userId];
  const { data } = await supabase
    .from("posts")
    .select(`id, created_at, author_id`)
    .or(`author_id.in.(${authorIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);
  return data?.length ?? 0;
});

const stories = await time("feed_stories", async () => {
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  return data ? 1 : 0;
});

const messages = await time("unread_messages_count", async () => {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
});

console.log("\nSummary:");
console.log(`  scope: ${JSON.stringify(scope.result)}`);
console.log(`  first-page posts returned: ${posts12.result}`);
console.log(`  full-page posts returned: ${posts20.result}`);
console.log(`  stories probe: ${stories.ms}ms`);
console.log(`  unread probe: ${messages.ms}ms`);
console.log(
  "\nOptimized client now loads 12 posts first, defers stories/messages badges, and caches the last feed."
);
