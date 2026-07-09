#!/usr/bin/env node
/**
 * Bisect Safari feed black screen by disabling one subsystem at a time.
 *
 * Usage:
 *   node scripts/bisect-feed-black-screen.mjs [baseUrl]
 *
 * Requires: playwright webkit, built dist (or production URL with feed-isolate support).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3456").replace(/\/$/, "");

const USERS = ["bfitjourney", "xochi", "kmsp"];
const FLAGS = [
  "baseline",
  "stories",
  "feed-list",
  "post-cards",
  "fab",
  "bottom-tabs",
  "notification-badge",
  "online-status",
  "image-preload",
  "video",
  "pull-to-refresh",
  "tab-scene-height",
];

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

async function loadProfilesAndPosts(env) {
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { data: profiles } = await sb.from("profiles").select("*").in("username", USERS);
  const byName = Object.fromEntries((profiles ?? []).map((p) => [p.username, p]));

  const postsByUser = {};
  for (const name of USERS) {
    const p = byName[name];
    if (!p) continue;
    const { data: posts } = await sb
      .from("posts")
      .select("*, author:profiles!posts_author_id_fkey(*)")
      .eq("author_id", p.id)
      .order("created_at", { ascending: false })
      .limit(20);
    postsByUser[name] = (posts ?? []).map((post) => ({
      ...post,
      liked_by_me: false,
      like_count: 0,
      comment_count: 0,
      saved_by_me: false,
      reactions: [],
      preview_comments: [],
    }));
  }
  return { byName, postsByUser };
}

function registerRoutes(page, env, { userId, profileRow, posts }) {
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();

    const method = route.request().method();
    const accept = route.request().headers().accept ?? "";
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
    }

    if (url.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: "bisect-mock-token",
          refresh_token: "bisect-mock-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: `${profileRow.username}@bisect.local` },
        }),
      });
    }

    if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
      const body = accept.includes("object") ? profileRow : [profileRow];
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    }

    if (url.includes("/rest/v1/posts")) {
      const body = accept.includes("object") ? (posts[0] ?? null) : posts;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    }

    if (
      url.includes("/rest/v1/follows") ||
      url.includes("/rest/v1/group_members") ||
      url.includes("/rest/v1/challenge_participants") ||
      url.includes("/rest/v1/likes") ||
      url.includes("/rest/v1/saved_posts") ||
      url.includes("/rest/v1/post_reactions") ||
      url.includes("/rest/v1/comments") ||
      url.includes("/rest/v1/blocks") ||
      url.includes("/rest/v1/notifications") ||
      url.includes("/rest/v1/product_events") ||
      url.includes("/rest/v1/beta_feedback") ||
      url.includes("/rest/v1/suggested")
    ) {
      if (method === "HEAD") {
        return route.fulfill({
          status: 200,
          headers: { ...headers, "content-range": "*/0" },
          body: "",
        });
      }
      if (accept.includes("object")) {
        return route.fulfill({ status: 200, headers, body: "null" });
      }
      return route.fulfill({ status: 200, headers, body: "[]" });
    }

    if (url.includes("/rest/v1/rpc/")) {
      return route.fulfill({ status: 200, headers, body: "[]" });
    }

    if (method === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": "*/0" },
        body: "",
      });
    }

    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow, isolateFlag) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const key = `sb-${ref}-auth-token`;
  const isolate = isolateFlag === "baseline" ? "" : isolateFlag;
  return page.addInitScript(
    ({ storageKey, uid, profile, iso }) => {
      if (iso) sessionStorage.setItem("frennix:feed-isolate", iso);
      else sessionStorage.removeItem("frennix:feed-isolate");
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: "bisect-mock-token",
          refresh_token: "bisect-mock-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: `${profile.username}@bisect.local` },
        })
      );
    },
    { storageKey: key, uid: userId, profile: profileRow, iso: isolate }
  );
}

async function evaluate(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    const boot = document.getElementById("frennix-boot-shell");
    const bootVisible = Boolean(boot && getComputedStyle(boot).display !== "none");
    const feedScene = document.getElementById("feed-tab-scene");
    const onboarding = document.getElementById("onboarding-screen");
    const feedRoot = document.getElementById("feed-root-container");
    const feedScroll = document.getElementById("feed-scroll-list");
    const root = document.getElementById("root");

    const rect = (el) => {
      if (!el) return { h: 0, w: 0 };
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width) };
    };

    const feedRootRect = rect(feedRoot);
    const feedScrollRect = rect(feedScroll);
    const rootRect = rect(root);

    const layout = window.__FRENNIX_FEED_LAYOUT__ ?? null;

    const hasMeaningful =
      /STORIES|Share workout|Your feed is ready|Could not load|isolated \(bisection\)|section could not load|Discover|Calendar|Messages|Bianca|@bfitjourney/i.test(
        text
      );

    const zeroHeightBlack =
      Boolean(feedScene) &&
      !onboarding &&
      !bootVisible &&
      (feedRootRect.h <= 1 || feedScrollRect.h <= 1 || rootRect.h <= 1);

    const layoutIssueBlack = Boolean(layout?.issue);

    const textBlack = !bootVisible && !onboarding && text.length < 30 && !hasMeaningful;

    const blackScreen = textBlack || zeroHeightBlack || layoutIssueBlack;

    return {
      text: text.slice(0, 160),
      blackScreen,
      blackReason: textBlack
        ? "empty-text"
        : zeroHeightBlack
          ? "zero-height"
          : layoutIssueBlack
            ? `layout:${layout.issue}`
            : null,
      bootVisible,
      hasMeaningful,
      markers: {
        feedRoot: Boolean(feedRoot),
        feedTab: Boolean(feedScene),
        onboarding: Boolean(onboarding),
      },
      heights: {
        root: rootRect.h,
        feedRoot: feedRootRect.h,
        feedScroll: feedScrollRect.h,
      },
      layoutIssue: layout?.issue ?? null,
      layoutSummary: layout?.summary ?? null,
    };
  });
}

async function main() {
  const env = loadEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const { byName, postsByUser } = await loadProfilesAndPosts(env);
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit, devices } = pwModule.default ?? pwModule;
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
  });

  console.log(`\n=== FEED BLACK SCREEN BISECT (WebKit / iPhone 13) ===`);
  console.log(`URL: ${baseUrl}\n`);

  const results = [];

  for (const flag of FLAGS) {
    console.log(`\n--- isolate: ${flag} ---`);
    for (const username of USERS) {
      const profileRow = byName[username];
      if (!profileRow) {
        console.log(`  @${username}: SKIP (no profile)`);
        continue;
      }
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await registerRoutes(page, env, {
        userId: profileRow.id,
        profileRow,
        posts: postsByUser[username] ?? [],
      });
      await seedSession(page, env, profileRow.id, profileRow, flag);
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(12_000);

      const state = await evaluate(page);
      const status = state.blackScreen ? "BLACK" : state.hasMeaningful ? "VISIBLE" : "UNCLEAR";
      results.push({
        flag,
        username,
        status,
        state,
        postCount: (postsByUser[username] ?? []).length,
        pageErrors: pageErrors.slice(0, 3),
      });

      console.log(
        `  @${username}: ${status} posts=${(postsByUser[username] ?? []).length} feedH=${state.heights.feedRoot}/${state.heights.feedScroll} reason=${state.blackReason ?? "—"} text="${state.text.slice(0, 60)}"`
      );
      if (state.layoutIssue) console.log(`    layout: ${state.layoutIssue}`);
      if (pageErrors.length) console.log(`    pageerror: ${pageErrors[0].slice(0, 120)}`);
      await page.close();
    }
  }

  await browser.close();

  console.log(`\n=== SUMMARY ===\n`);
  const baseline = results.filter((r) => r.flag === "baseline");
  const baselineBlack = baseline.filter((r) => r.status === "BLACK");

  for (const flag of FLAGS.filter((f) => f !== "baseline")) {
    const fixed = USERS.filter((u) => {
      const base = baseline.find((r) => r.username === u);
      const iso = results.find((r) => r.flag === flag && r.username === u);
      return base?.status === "BLACK" && iso?.status === "VISIBLE";
    });
    if (fixed.length) {
      console.log(`FIXED when disabling "${flag}": ${fixed.join(", ")}`);
    }
  }

  if (!baselineBlack.length) {
    console.log("Baseline did not reproduce BLACK in WebKit harness.");
    console.log("Per-user baseline heights:");
    for (const u of USERS) {
      const r = baseline.find((x) => x.username === u);
      if (r) {
        console.log(
          `  @${u}: ${r.status} feedH=${r.state.heights.feedRoot}/${r.state.heights.feedScroll} layout=${r.state.layoutIssue ?? "ok"}`
        );
      }
    }
  } else {
    console.log(`Baseline BLACK users: ${baselineBlack.map((r) => r.username).join(", ")}`);
  }

  const candidates = FLAGS.filter((f) => f !== "baseline").filter((flag) => {
    const baselineStatuses = USERS.map((u) => baseline.find((r) => r.username === u)?.status);
    const hasBlackOrUnclear = baselineStatuses.some((s) => s === "BLACK" || s === "UNCLEAR");
    if (!hasBlackOrUnclear) return false;
    return USERS.every((u) => {
      const r = results.find((x) => x.flag === flag && x.username === u);
      return r?.status === "VISIBLE";
    });
  });
  if (candidates.length) {
    console.log(`\nCandidate failing components: ${candidates.join(", ")}`);
  }

  fs.writeFileSync(
    path.join(ROOT, "scripts", ".bisect-feed-results.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\nWrote scripts/.bisect-feed-results.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
