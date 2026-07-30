#!/usr/bin/env node
/**
 * Premium feed redesign — iPhone layout, hero size, story scroll, nav targets, posts, tab bar.
 *
 * Usage:
 *   pnpm build:web
 *   node scripts/verify-feed-redesign-layout.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const MAX_HERO_HEIGHT_PX = 200;
const MIN_TAB_CLEARANCE_PX = 48;

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

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

function startStaticServer() {
  const mime = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split("?")[0] ?? "/";
      const filePath =
        urlPath === "/"
          ? path.join(DIST, "index.html")
          : path.join(DIST, urlPath.replace(/^\//, ""));
      if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function registerMocks(page, env, { userId, profileRow, posts, stories }) {
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
          access_token: "redesign-test-token",
          refresh_token: "redesign-test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: `${profileRow.username}@redesign.test` },
        }),
      });
    }

    if (url.includes("/rest/v1/rpc/get_feed_stories") || url.includes("feed_stories")) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify(stories) });
    }

    if (url.includes("/rest/v1/rpc/get_feed") || url.includes("get_feed")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ posts, next_cursor: null }),
      });
    }

    if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
      const body = accept.includes("object") ? profileRow : [profileRow];
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    }

    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify(posts) });
    }

    if (method === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": `*/${posts.length}` },
        body: "",
      });
    }

    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  return page.addInitScript(
    ({ key, uid, profile }) => {
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "redesign-test-token",
          refresh_token: "redesign-test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: `${profile.username}@redesign.test` },
        })
      );
    },
    { key: storageKey, uid: userId, profile: profileRow }
  );
}

function mockStories(profileRow) {
  const peers = ["lupe", "alex", "jordan", "sam", "taylor"];
  return peers.map((name, index) => ({
    user_id: `story-user-${index}`,
    profile: {
      id: `story-user-${index}`,
      username: name,
      display_name: name.charAt(0).toUpperCase() + name.slice(1),
      avatar_url: null,
    },
    workout_streak: index === 0 ? 7 : 3,
    workout_count: 10,
    has_recent_workout: index % 2 === 0,
    active_stories: [
      {
        id: `story-${index}`,
        created_at: new Date().toISOString(),
        slides: [{ id: `slide-${index}`, kind: "text", text: "Leg day" }],
        workout_tag: "Legs",
      },
    ],
    last_workout: null,
    is_self: false,
    viewer_follows: true,
    viewed: index > 1,
  }));
}

async function waitForFeed(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? "";
      return (
        /Find Your Training Partner/i.test(text) &&
        /Stories/i.test(text) &&
        document.getElementById("feed-scroll-list")
      );
    },
    { timeout: 45_000 }
  );
  await page.waitForTimeout(1500);
}

async function runStaticChecks() {
  const results = [];
  function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  [static] ${name}${detail ? ` — ${detail}` : ""}`);
  }

  const hero = fs.readFileSync(path.join(ROOT, "packages/ui/src/FeedHeroBanner.tsx"), "utf8");
  const header = fs.readFileSync(path.join(ROOT, "components/FeedHeader.tsx"), "utf8");
  const stories = fs.readFileSync(path.join(ROOT, "packages/ui/src/FeedStoriesRow.tsx"), "utf8");
  const quickActions = fs.readFileSync(path.join(ROOT, "packages/ui/src/FeedQuickActionCards.tsx"), "utf8");
  const tokens = fs.readFileSync(path.join(ROOT, "packages/ui/src/feed-layout/tokens.ts"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "app/(tabs)/index.tsx"), "utf8");

  record(
    "Hero banner max height capped",
    /maxHeight:\s*150/.test(hero) && /minHeight:\s*134/.test(hero)
  );
  record(
    "Story row uses horizontal scroll container",
    /horizontal/.test(stories) && /pan-x/.test(stories)
  );
  record(
    "Feed list reserves bottom inset for tab bar",
    /paddingBottom:\s*spacing\.xxl \+ spacing\.lg \+ spacing\.sm/.test(index)
  );
  record("Hero Find Athletes → discover tab", header.includes('switchTab("/(tabs)/discover")'));
  record("Hero Share Workout → create post", header.includes("openCreatePost"));
  record("Quick action Explore Stories route", header.includes('pushScreen("/stories/explore")'));
  record("Quick action Events route", header.includes('switchTab("/(tabs)/events")'));
  record("Stories View All route", header.includes("onViewAllPress={() => pushScreen(\"/stories/explore\")}"));
  record(
    "Feed shortcuts use compact horizontal row",
    /feed-shortcut-row/.test(quickActions) && /flexDirection:\s*"row"/.test(quickActions)
  );
  record(
    "Feed shortcut labels avoid truncation",
    !/numberOfLines/.test(quickActions) &&
      /whiteSpace:\s*"nowrap"/.test(quickActions) &&
      /width:\s*"25%"/.test(quickActions)
  );
  record(
    "Feed chrome section gap tightened",
    /sectionGap:\s*spacing\.sm/.test(tokens) && /storiesPaddingBottom:\s*0/.test(tokens)
  );

  return results;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: pnpm build:web");
  }

  const staticResults = await runStaticChecks();
  const staticFailed = staticResults.filter((r) => !r.ok);
  if (staticFailed.length) {
    console.error("\nStatic checks failed — fix before browser verification.");
    process.exit(1);
  }

  const env = loadEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  }

  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { data: profileRow } = await sb
    .from("profiles")
    .select("*")
    .eq("username", "bfitjourney")
    .maybeSingle();

  if (!profileRow) {
    throw new Error("Missing bfitjourney profile for feed redesign verification");
  }

  const { data: posts } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(*)")
    .eq("author_id", profileRow.id)
    .limit(8);

  const feedPosts = (posts ?? []).map((p) => ({
    ...p,
    liked_by_me: false,
    like_count: p.like_count ?? 2,
    comment_count: p.comment_count ?? 1,
    saved_by_me: false,
    reactions: [],
    preview_comments: [],
  }));

  const stories = mockStories(profileRow);
  const { server, baseUrl } = await startStaticServer();

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium, devices } = pwModule.default ?? pwModule;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchError) {
    console.log("SKIP  Browser layout checks — Playwright browsers unavailable");
    console.log(`       ${launchError instanceof Error ? launchError.message.split("\n")[0] : launchError}`);
    console.log("\nAll static feed redesign checks passed.");
    return;
  }

  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
  const page = await context.newPage();

  const results = [];

  function record(name, ok, detail = "") {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  }

  await registerMocks(page, env, {
    userId: profileRow.id,
    profileRow,
    posts: feedPosts,
    stories,
  });
  await seedSession(page, env, profileRow.id, profileRow);
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await waitForFeed(page);

  const layout = await page.evaluate(
    ({ maxHero, minTabClearance }) => {
      const heroText = Array.from(document.querySelectorAll("*")).find((el) =>
        /Find Your Training Partner/i.test(el.textContent ?? "")
      );
      let heroHeight = 0;
      if (heroText) {
        let node = heroText;
        for (let i = 0; i < 6 && node; i += 1) {
          const rect = node.getBoundingClientRect();
          if (rect.height >= 120 && rect.height <= 260) {
            heroHeight = Math.round(rect.height);
            break;
          }
          node = node.parentElement;
        }
      }

      const scroll = document.getElementById("feed-scroll-list");
      const tabBar = document.querySelector('[role="tablist"]');
      const storyScroll =
        scroll?.querySelector('[style*="overflow-x"]') ??
        scroll?.querySelector("div[style*='touch-action: pan-x']");

      let storyScrollOk = false;
      if (scroll) {
        const horizontal = scroll.querySelector("div");
        const candidates = scroll.querySelectorAll("div");
        for (const el of candidates) {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (
            (style.overflowX === "auto" || style.overflowX === "scroll" ||
              style.touchAction?.includes("pan-x")) &&
            rect.width > 0 &&
            el.scrollWidth > el.clientWidth + 8
          ) {
            storyScrollOk = true;
            break;
          }
        }
      }

      const lastCard = scroll?.querySelector('[aria-label="Post actions"]');
      let tabClearance = 999;
      if (lastCard && tabBar) {
        const cardRect = lastCard.getBoundingClientRect();
        const tabRect = tabBar.getBoundingClientRect();
        tabClearance = Math.round(tabRect.top - cardRect.bottom);
      }

      const postCount = scroll
        ? Array.from(scroll.querySelectorAll('[aria-label="Post actions"]')).length
        : 0;

      const tabFixed =
        tabBar &&
        getComputedStyle(tabBar).position === "fixed" &&
        Math.round(tabBar.getBoundingClientRect().bottom) >= window.innerHeight - 4;

      return {
        heroHeight,
        heroOk: heroHeight > 0 && heroHeight <= maxHero,
        storyScrollOk,
        tabClearance,
        tabClearanceOk: tabClearance >= minTabClearance || postCount === 0,
        tabFixed: Boolean(tabFixed),
        postCount,
        hasHero: /Find Athletes/i.test(document.body.innerText),
        hasQuickActions: /Explore|Athletes/i.test(document.body.innerText),
      };
    },
    { maxHero: MAX_HERO_HEIGHT_PX, minTabClearance: MIN_TAB_CLEARANCE_PX }
  );

  record(
    "iPhone feed renders hero + stories",
    layout.hasHero && layout.hasQuickActions,
    `hero=${layout.heroHeight}px posts=${layout.postCount}`
  );
  record(
    "Hero banner height is compact on iPhone",
    layout.heroOk,
    `${layout.heroHeight}px (max ${MAX_HERO_HEIGHT_PX}px)`
  );
  record(
    "Story row scrolls horizontally",
    layout.storyScrollOk,
    layout.storyScrollOk ? "overflow content detected" : "no horizontal overflow"
  );
  record(
    "Posts load in feed",
    layout.postCount > 0,
    `${layout.postCount} post action bars`
  );
  record(
    "Bottom tab bar stays fixed",
    layout.tabFixed,
    layout.tabFixed ? "position: fixed" : "tab bar not fixed"
  );
  record(
    "Tab bar does not cover last post actions",
    layout.tabClearanceOk,
    `clearance=${layout.tabClearance}px`
  );

  const MOBILE_WIDTHS = [320, 375, 390, 430];
  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);

    const quickActionLayout = await page.evaluate(() => {
      const grid = document.getElementById("feed-shortcut-row");
      if (!grid) {
        return { ok: false, detail: "shortcut row not found" };
      }

      const shortcuts = Array.from(grid.querySelectorAll('[role="button"]'));
      if (shortcuts.length < 4) {
        return { ok: false, detail: `expected 4 shortcuts, found ${shortcuts.length}` };
      }

      const shortcutRects = shortcuts.map((button) => button.getBoundingClientRect());
      for (const rect of shortcutRects) {
        if (Math.round(rect.width) > 120) {
          return { ok: false, detail: `shortcut too wide (${Math.round(rect.width)}px)` };
        }
      }

      const expectedLabels = ["Share", "Explore", "Athletes", "Events"];
      const labelTexts = shortcuts.map((button) => {
        const nodes = Array.from(button.querySelectorAll("*")).filter(
          (el) => el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0
        );
        const labelNode = nodes.find((el) =>
          expectedLabels.some((label) => (el.textContent ?? "").trim() === label)
        );
        return {
          text: labelNode?.textContent?.trim() ?? "",
          style: labelNode ? getComputedStyle(labelNode) : null,
        };
      });

      for (let i = 0; i < expectedLabels.length; i += 1) {
        const { text, style } = labelTexts[i] ?? { text: "", style: null };
        if (text !== expectedLabels[i]) {
          return { ok: false, detail: `label mismatch: "${text}" expected "${expectedLabels[i]}"` };
        }
        if (style?.textOverflow === "ellipsis" || /\.\./.test(text)) {
          return { ok: false, detail: `label truncated: "${text}"` };
        }
      }

      const pageOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
      if (pageOverflow) {
        return { ok: false, detail: "horizontal page overflow" };
      }

      const storiesEl = Array.from(document.querySelectorAll("*")).find((el) =>
        /^Stories$/.test(el.textContent?.trim() ?? "")
      );
      const pymkEl = Array.from(document.querySelectorAll("*")).find((el) =>
        /People You May Know/i.test(el.textContent ?? "")
      );
      let sectionGapOk = true;
      if (storiesEl && pymkEl) {
        let storiesBlock = storiesEl.parentElement;
        for (let i = 0; i < 4 && storiesBlock; i += 1) {
          const rect = storiesBlock.getBoundingClientRect();
          if (rect.height > 80) break;
          storiesBlock = storiesBlock.parentElement;
        }
        const storiesBottom = storiesBlock?.getBoundingClientRect().bottom ?? 0;
        const pymkTop = pymkEl.getBoundingClientRect().top;
        const gap = Math.round(pymkTop - storiesBottom);
        if (gap > 320) {
          sectionGapOk = false;
        }
      }

      return {
        ok: !pageOverflow && sectionGapOk,
        detail: sectionGapOk ? "columns balanced" : "excessive vertical gap before suggestions",
      };
    });

    record(
      `Feed shortcuts layout at ${width}px`,
      quickActionLayout.ok,
      quickActionLayout.detail
    );
  }

  const navChecks = [
    { label: "Find Athletes hero", text: "Find Athletes", expectPath: /discover|matching/i },
    { label: "Share Workout hero", text: "Share Workout", expectPath: /create-post/i },
    { label: "Explore shortcut", text: "Explore", expectPath: /stories\/explore/i },
    { label: "Athletes shortcut", text: "Athletes", expectPath: /discover/i },
    { label: "Events card", text: "Events", expectPath: /events/i },
    { label: "View All stories", text: "View All", expectPath: /stories\/explore/i },
  ];

  for (const check of navChecks) {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await waitForFeed(page);
    const buttons = page.getByRole("button", { name: new RegExp(check.text, "i") });
    const count = await buttons.count();
    if (count === 0) {
      record(`Navigation: ${check.label}`, false, "button not found");
      continue;
    }
    await buttons.first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    const href = page.url();
    const ok = check.expectPath.test(href);
    record(`Navigation: ${check.label}`, ok, href);
  }

  await context.close();
  await browser.close();
  server.close();

  console.log("\n=== Feed redesign layout verification ===");
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll feed redesign checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
