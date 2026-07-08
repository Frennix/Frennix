/**
 * End-to-end API performance probe for login, feed, profile, messages, discover, events, stories.
 *
 *   cd apps/mobile && npx tsx scripts/measure-app-perf.ts [userId]
 *
 * If userId is omitted, picks the most recent post author from the database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { initSupabase } from "../packages/api/src/supabase";

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

type Timing = { label: string; ms: number; detail?: string };

async function time<T>(label: string, fn: () => Promise<T>, detail?: (r: T) => string): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  timings.push({ label, ms, detail: detail?.(result) });
  return result;
}

const timings: Timing[] = [];

async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  arg?: string
): Promise<string> {
  if (arg) return arg;
  const { data } = await supabase
    .from("posts")
    .select("author_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.author_id) throw new Error("No posts found — pass a userId argument");
  return data.author_id as string;
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing EXPO_PUBLIC_SUPABASE_URL or API key in .env");
    process.exit(1);
  }

  initSupabase(url, key);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const userId = await resolveUserId(admin, process.argv[2]);

  const api = await import("@frennix/api");
  const {
    getProfile,
    getFeed,
    getFeedStories,
    getSuggestedAthletes,
    getProfileStats,
    getPostsByUser,
    getConversations,
    getGroups,
    getChallenges,
    getCalendarView,
    getFollowingIds,
    clearFeedScopeCache,
  } = api;
  const peekFeedFollowingIds =
    typeof api.peekFeedFollowingIds === "function" ? api.peekFeedFollowingIds : () => undefined;
  const { getDefaultCalendarRange } = await import("../lib/calendar-query-range");

  console.log(`\nApp performance probe — user ${userId}\n`);

  // Login path
  await time("auth.getProfile", () => getProfile(userId), (p) =>
    p ? `onboarding=${p.onboarding_complete}` : "null"
  );

  clearFeedScopeCache(userId);

  // Feed (cold)
  const feedPage = await time("feed.getFeed (page 1, cold)", () => getFeed(userId), (p) =>
    `${p.posts.length} posts`
  );

  // Feed scope cache hit
  await time("feed.getFeed (page 1, warm scope)", () => getFeed(userId), (p) =>
    `${p.posts.length} posts`
  );

  const peeked = peekFeedFollowingIds(userId);
  await time("feed.peekFeedFollowingIds", async () => peeked ?? [], (ids) =>
    `${ids.length} ids (cache ${peeked ? "hit" : "miss"})`
  );

  await time("feed.getFollowingIds (duplicate check)", () => getFollowingIds(userId), (ids) =>
    `${ids.length} ids`
  );

  await time("feed.getFeedStories (deferred on client)", () => getFeedStories(userId), (s) =>
    `${s.length} story rows`
  );

  await time("feed.getSuggestedAthletes", () => getSuggestedAthletes(userId, 10), (s) =>
    `${s.length} suggestions`
  );

  // Profile tab
  await time("profile.getProfileStats", () => getProfileStats(userId), (s) =>
    `posts=${s.posts} followers=${s.followers}`
  );
  await time("profile.getPostsByUser", () => getPostsByUser(userId, userId), (p) =>
    `${p.posts.length} posts`
  );

  // Messages
  await time("messages.getConversations", () => getConversations(userId), (c) =>
    `${c.length} conversations`
  );

  // Discover
  await time("discover.getGroups", () => getGroups({}), (g) => `${g.length} groups`);
  await time("discover.getChallenges", () => getChallenges(), (c) => `${c.length} challenges`);

  // Events
  const { rangeStart, rangeEnd } = getDefaultCalendarRange();
  await time("events.getCalendarView", () => getCalendarView(userId, rangeStart, rangeEnd), (v) =>
    `${v.days?.length ?? 0} days`
  );

  // Simulated returning-user login (cached profile — no network block)
  const cachedLoginMs = 0;
  timings.push({
    label: "auth.cachedProfileGate (simulated)",
    ms: cachedLoginMs,
    detail: "tabs unblock without awaiting getProfile",
  });

  console.log("Label".padEnd(42), "ms".padStart(6), "detail");
  console.log("-".repeat(72));
  for (const row of timings) {
    console.log(row.label.padEnd(42), row.ms.toFixed(0).padStart(6), row.detail ?? "");
  }

  const feedCold = timings.find((t) => t.label.includes("cold"))?.ms ?? 0;
  const feedWarm = timings.find((t) => t.label.includes("warm scope"))?.ms ?? 0;
  const stories = timings.find((t) => t.label.includes("Stories"))?.ms ?? 0;
  const suggestions = timings.find((t) => t.label.includes("Suggested"))?.ms ?? 0;

  console.log("\nSummary");
  console.log(`  Feed page 1 (cold):     ${feedCold.toFixed(0)}ms — target <1000ms`);
  console.log(`  Feed page 1 (warm):     ${feedWarm.toFixed(0)}ms`);
  console.log(`  Stories (deferred):     ${stories.toFixed(0)}ms — not on critical path`);
  console.log(`  Suggestions (deferred): ${suggestions.toFixed(0)}ms — not on critical path`);
  console.log(`  Posts returned:         ${feedPage.posts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
