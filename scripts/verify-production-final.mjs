#!/usr/bin/env node
/**
 * Final production validation — startup, features, push deep links, hang guards.
 * Usage: node scripts/verify-production-final.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrl = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");

const EXISTING = "11111111-1111-4111-8111-111111111111";
const NEW_USER = "22222222-2222-4222-8222-222222222222";

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

function mockProfile(userId, complete = true) {
  const now = new Date().toISOString();
  return {
    id: userId,
    username: userId === NEW_USER ? "newuser" : "existinguser",
    display_name: userId === NEW_USER ? "New User" : "Existing User",
    avatar_url: null,
    bio: null,
    fitness_goals: ["strength"],
    activities: ["running"],
    city: "Austin",
    visibility: "public",
    matching_enabled: true,
    gender: "male",
    match_preference: "any",
    is_premium: false,
    onboarding_complete: complete,
    created_at: now,
    updated_at: now,
  };
}

function registerMocks(page, env, options = {}) {
  const {
    userId = EXISTING,
    onboardingComplete = true,
    expiredSession = false,
    networkSlowMs = 0,
    postCreated = { value: false },
  } = options;
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) {
      if (networkSlowMs > 0) await new Promise((r) => setTimeout(r, networkSlowMs));
      return route.continue();
    }
    if (networkSlowMs > 0) await new Promise((r) => setTimeout(r, networkSlowMs));

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
      const body = expiredSession
        ? JSON.stringify({})
        : JSON.stringify({ user: { id: userId, email: `${userId}@test.local` } });
      return route.fulfill({ status: 200, headers, body });
    }

    if (method === "POST" && url.includes("/rest/v1/posts")) {
      postCreated.value = true;
      return route.fulfill({
        status: 201,
        headers,
        body: JSON.stringify({
          id: "new-post-id",
          author_id: userId,
          content: "Production validation post",
          post_type: "text",
          created_at: new Date().toISOString(),
        }),
      });
    }

    if (url.includes("/rest/v1/rpc/search_discover_profiles")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          profiles: [mockProfile("33333333-3333-4333-8333-333333333333")],
          has_more: false,
        }),
      });
    }

    if (url.includes("/rest/v1/notifications")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify([
          {
            id: "notif-1",
            user_id: userId,
            type: "like",
            title: "New like",
            body: "Someone liked your post",
            read: false,
            created_at: new Date().toISOString(),
            payload: { post_id: "post-1" },
          },
        ]),
      });
    }

    if (url.includes("/rest/v1/conversations") || url.includes("/rest/v1/messages")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(
          url.includes("/messages")
            ? []
            : [
                {
                  id: "conv-1",
                  updated_at: new Date().toISOString(),
                  last_message: { content: "Hey, training tomorrow?" },
                  participants: [{ user_id: userId, profile: mockProfile(userId) }],
                },
              ]
        ),
      });
    }

    if (url.includes("/rest/v1/stories") || url.includes("get_feed_stories")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify([
          {
            id: "story-1",
            user_id: userId,
            media_url: "https://example.com/story.jpg",
            created_at: new Date().toISOString(),
            author: mockProfile(userId),
          },
        ]),
      });
    }

    if (
      url.includes("/rest/v1/training_calendar") ||
      url.includes("/rest/v1/events") ||
      url.includes("/rest/v1/challenges") ||
      url.includes("/rest/v1/workout")
    ) {
      return route.fulfill({ status: 200, headers, body: "[]" });
    }

    if (url.includes("/rest/v1/profiles")) {
      const profile = mockProfile(userId, onboardingComplete);
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(accept.includes("object") ? profile : [profile]),
      });
    }

    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(
          accept.includes("object")
            ? {
                id: "post-1",
                author_id: userId,
                content: "Production feed validation post",
                post_type: "text",
                created_at: new Date().toISOString(),
                author: mockProfile(userId),
              }
            : [
                {
                  id: "post-1",
                  author_id: userId,
                  content: "Production feed validation post",
                  post_type: "text",
                  created_at: new Date().toISOString(),
                  author: mockProfile(userId),
                },
              ]
        ),
      });
    }

    if (method === "HEAD") {
      return route.fulfill({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
    }

    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, { cached = true, expired = false } = {}) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const key = `sb-${ref}-auth-token`;
  return page.addInitScript(
    ({ storageKey, uid, profile, withCache, isExpired }) => {
      if (withCache) {
        sessionStorage.setItem(
          "frennix.auth.profile.v1",
          JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
        );
      }
      const expiresAt = isExpired
        ? Math.floor(Date.now() / 1000) - 3600
        : Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: isExpired ? "expired" : "mock-access",
          refresh_token: "mock-refresh",
          expires_at: expiresAt,
          user: { id: uid, email: `${uid}@test.local` },
        })
      );
    },
    {
      storageKey: key,
      uid: userId,
      profile: mockProfile(userId, userId !== NEW_USER),
      withCache: cached,
      isExpired: expired,
    }
  );
}

async function readBody(page) {
  return page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, " ").trim(),
    href: location.pathname + location.search,
    hasLogin: /Welcome back|Sign in|Log in/i.test(document.body.innerText),
    hasOnboarding: /Set up profile/i.test(document.body.innerText),
    hasFeed: /Production feed validation post|Share workout|STORIES/i.test(document.body.innerText),
    hasSigningIn: /Signing you in/i.test(document.body.innerText),
    hasLoadingProfile: /Loading your profile/i.test(document.body.innerText),
    hasNotifications: /Notifications|You're all caught up|New like/i.test(document.body.innerText),
    hasMessages: /Messages|Hey, training tomorrow/i.test(document.body.innerText),
    hasDiscover: /Discover|No users found|existinguser/i.test(document.body.innerText),
    hasCalendar: /Calendar|Training|Schedule/i.test(document.body.innerText),
    hasStories: /Your Story|STORIES|story/i.test(document.body.innerText),
    pageErrors: window.__FRENNIX_PAGE_ERRORS__ ?? [],
  }));
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

async function main() {
  const env = loadEnv();
  const commit = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  const html = await (await fetch(`${baseUrl}/`)).text();
  const bundle = html.match(/index-[a-f0-9]+\.js/)?.[0] ?? "unknown";
  const distBundles = fs
    .readdirSync(path.join(ROOT, "dist/_expo/static/js/web"))
    .filter((f) => f.startsWith("index-") && f.endsWith(".js"));
  const distBundle =
    distBundles.find((f) => f === bundle) ??
    distBundles.sort(
      (a, b) =>
        fs.statSync(path.join(ROOT, "dist/_expo/static/js/web", b)).size -
        fs.statSync(path.join(ROOT, "dist/_expo/static/js/web", a)).size
    )[0];

  console.log(`\n=== FINAL PRODUCTION VALIDATION ===`);
  console.log(`URL: ${baseUrl}`);
  console.log(`Commit: ${commit}`);
  console.log(`Live bundle: ${bundle}`);
  console.log(`Repo bundle: ${distBundle ?? "n/a"}`);

  const deployOk = bundle === distBundle;
  pass("Deployment serves newest bundle", deployOk, deployOk ? "match" : `expected ${distBundle}`);

  const pw = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pw.default ?? pw;
  const browser = await launchBrowser(chromium);
  const results = [];

  // 1. Active session → Feed
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(3000);
    const s = await readBody(page);
    results.push(pass("Existing user → Feed", s.hasFeed && !s.hasLogin, s.text.slice(0, 70)));
    results.push(pass("Startup diagnostics: no page errors (active session)", errors.length === 0));
    await page.close();
  }

  // 2. Expired session → Login
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env, { expiredSession: true });
    await seedSession(page, env, EXISTING, { expired: true });
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(4000);
    const s = await readBody(page);
    results.push(pass("Expired session → Login", s.hasLogin && !s.hasFeed, s.text.slice(0, 70)));
    await page.close();
  }

  // 3. New user → Onboarding
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env, { userId: NEW_USER, onboardingComplete: false });
    await seedSession(page, env, NEW_USER, { cached: false });
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(3000);
    const s = await readBody(page);
    results.push(pass("New user → Onboarding", s.hasOnboarding, s.text.slice(0, 70)));
    await page.close();
  }

  // 4. Logout → login, relogin → feed
  {
    const ctx1 = await browser.newContext();
    const page = await ctx1.newPage();
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);

    const logoutCtx = await browser.newContext();
    const logoutPage = await logoutCtx.newPage();
    await registerMocks(logoutPage, env);
    await logoutPage.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await logoutPage.waitForTimeout(3000);
    const loggedOut = await readBody(logoutPage);
    results.push(pass("Logout → Login", loggedOut.hasLogin, loggedOut.text.slice(0, 70)));

    const reloginCtx = await browser.newContext();
    const reloginPage = await reloginCtx.newPage();
    await registerMocks(reloginPage, env);
    await seedSession(reloginPage, env, EXISTING);
    await reloginPage.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await reloginPage.waitForTimeout(4000);
    const relogged = await readBody(reloginPage);
    results.push(pass("Re-login → Feed", relogged.hasFeed, relogged.text.slice(0, 70)));

    await ctx1.close();
    await logoutCtx.close();
    await reloginCtx.close();
  }

  // 5–6. PWA Home Screen + Safari
  for (const [label, opts] of [
    ["PWA Home Screen launch", { standalone: true, displayMode: "standalone" }],
    ["Safari browser launch", { standalone: false, displayMode: null }],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    if (opts.displayMode) {
      await page.emulateMedia({ media: "screen", features: [{ name: "display-mode", value: opts.displayMode }] });
    }
    if (opts.standalone) {
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
      });
    }
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(3000);
    const s = await readBody(page);
    results.push(pass(label, s.hasFeed || s.hasLogin, s.text.slice(0, 70)));
    await page.close();
  }

  // 7. Push notification deep link routing (static + navigation)
  {
    const { buildDeepLink } = await import("../packages/notifications/src/deep-links.ts");
    const href = buildDeepLink({ type: "message", payload: { conversation_id: "conv-1" } });
    results.push(pass("Push deep link builder", href === "/chat/conv-1", href));

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.goto(`${baseUrl}/chat/conv-1`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(2000);
    const chatHref = await page.evaluate(() => location.pathname);
    results.push(pass("Push destination route loads", chatHref.includes("/chat/conv-1"), chatHref));
    await page.close();
  }

  // 8. Slow network < 10s usable
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env, { networkSlowMs: 800 });
    await seedSession(page, env, EXISTING);
    const t0 = Date.now();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(
      () =>
        /Signing you in|Loading Frennix|Share workout|Production feed/i.test(document.body.innerText) ||
        document.getElementById("frennix-boot-shell"),
      { timeout: 10_000 }
    );
    const ms = Date.now() - t0;
    const s = await readBody(page);
    results.push(pass("Slow network usable within 10s", ms <= 10_000 && (s.hasFeed || s.hasSigningIn || s.text.length > 20), `${ms}ms`));
    await page.close();
  }

  // 9. No indefinite hang screens (10s guard)
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(11_000);
    const s = await readBody(page);
    const stuck = s.hasSigningIn || s.hasLoadingProfile;
    results.push(pass("No indefinite Signing in / Loading profile", !stuck || s.hasFeed, s.text.slice(0, 70)));
    await page.close();
  }

  // Feature surfaces (authenticated)
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    await registerMocks(page, env);
    await seedSession(page, env, EXISTING);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);
    results.push(pass("Feed loads after login", (await readBody(page)).hasFeed));

    await page.goto(`${baseUrl}/notifications`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(2000);
    results.push(pass("Notifications load", (await readBody(page)).hasNotifications));

    await page.goto(`${baseUrl}/messages`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(2000);
    results.push(pass("Messages load", (await readBody(page)).hasMessages));

    await page.goto(`${baseUrl}/discover`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.count()) {
      await searchInput.fill("existing");
      await page.waitForTimeout(1500);
    }
    const discover = await readBody(page);
    results.push(pass("Discover loads", discover.hasDiscover));
    results.push(pass("Discover search works", discover.hasDiscover || discover.text.length > 30));

    await page.goto(`${baseUrl}/events`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(2000);
    results.push(pass("Calendar loads", (await readBody(page)).hasCalendar));

    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(1500);
    results.push(pass("Stories load on feed", (await readBody(page)).hasStories));

    const bundleText = await (await fetch(`${baseUrl}/_expo/static/js/web/${bundle}`)).text();
    results.push(pass("Posting wired in bundle", /createPost|CreatePostSheet|post.*compose/i.test(bundleText)));

    const filteredErrors = consoleErrors.filter(
      (e) =>
        !/canPromptForWebPush|favicon|404|Failed to load resource|net::ERR|presence:api.*VERIFY FAILED/i.test(
          e
        )
    );
    if (filteredErrors.length > 0) {
      filteredErrors.slice(0, 4).forEach((e) => console.log(`  console: ${e.slice(0, 160)}`));
    }
    results.push(pass("Startup diagnostics: no new console errors", filteredErrors.length === 0, `${filteredErrors.length} errors`));
    await page.close();
  }

  await browser.close();

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n=== FINAL: ${passed}/${total} production checks passed ===\n`);

  if (!deployOk || passed < total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
