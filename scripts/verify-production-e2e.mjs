#!/usr/bin/env node
/**
 * Production E2E smoke — JS errors, startup trace, bundle markers, feed timing.
 * Usage: node scripts/verify-production-e2e.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const baseUrl = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const require = createRequire(import.meta.url);

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const MOCK = "11111111-1111-4111-8111-111111111111";

async function main() {
  const html = await (await fetch(`${baseUrl}/`)).text();
  const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
  const bundleName = bundleMatch?.[0] ?? "unknown";
  const bundleUrl = `${baseUrl}/_expo/static/js/web/${bundleName}`;
  const bundle = await (await fetch(bundleUrl)).text();

  console.log(`\n=== Production E2E @ ${baseUrl} ===`);
  console.log(`Bundle: ${bundleName} (${(bundle.length / 1e6).toFixed(2)} MB)`);
  console.log(`Boot shell: ${html.includes("frennix-boot-shell") ? "yes" : "NO"}`);
  console.log(`Pointer events: ${html.includes("pointer-events: auto") ? "auto" : "legacy"}`);

  const markers = [
    ["comments", /getComments|CommentRow|post\/\[id\]/i],
    ["notifications", /notifications|NotificationBell/i],
    ["messages", /getConversations|ConversationRow/i],
    ["discover", /getSuggestedAthletes|DiscoverProfileCard/i],
    ["events", /getCalendarView|Calendar/i],
    ["profile", /getProfileStats|ProfileScreenContent/i],
    ["stories", /getFeedStories|FeedStoryViewer/i],
    ["push", /completeWebPushSubscription|WebPushEnableCard/i],
    ["skeleton", /FeedPostCardSkeleton|showFeedSkeleton/i],
    ["retry", /StartupRetryScreen|Something went wrong/i],
    ["canPromptForWebPush", /canPromptForWebPush/],
  ];
  console.log("\nBundle markers:");
  for (const [name, re] of markers) {
    console.log(`  ${re.test(bundle) ? "✓" : "✗"} ${name}`);
  }

  const playwrightPath = (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();
  const pw = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pw.default ?? pw;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();
    const accept = route.request().headers().accept ?? "";
    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        body: JSON.stringify({
          id: MOCK,
          username: "prodbeta",
          display_name: "Prod Beta",
          onboarding_complete: true,
          fitness_goals: [],
          activities: [],
        }),
      });
    }
    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        body: JSON.stringify(
          accept.includes("object")
            ? {
                id: "post-prod-1",
                author_id: MOCK,
                content: "Production E2E feed post",
                post_type: "text",
                created_at: new Date().toISOString(),
                author: { id: MOCK, username: "prodbeta", display_name: "Prod Beta" },
              }
            : [
                {
                  id: "post-prod-1",
                  author_id: MOCK,
                  content: "Production E2E feed post",
                  post_type: "text",
                  created_at: new Date().toISOString(),
                  author: { id: MOCK, username: "prodbeta", display_name: "Prod Beta" },
                },
              ]
        ),
      });
    }
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: "[]",
    });
  });

  await page.addInitScript(
    ({ key, uid }) => {
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({
          userId: uid,
          profile: {
            id: uid,
            username: "prodbeta",
            display_name: "Prod Beta",
            onboarding_complete: true,
            fitness_goals: [],
            activities: [],
            visibility: "public",
          },
          cachedAt: Date.now(),
        })
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: "prod@test.local" },
        })
      );
    },
    { key: storageKey, uid: MOCK }
  );

  const t0 = Date.now();
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(
    () =>
      /Production E2E feed post|STORIES|Share workout/i.test(document.body.innerText) ||
      (window.__FRENNIX_MOUNT_TRACE__ ?? []).some((e) => e.id === "feed-route:mounted"),
    { timeout: 45_000 }
  ).catch(() => undefined);
  const loadMs = Date.now() - t0;

  const state = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 400),
    trace: (window.__FRENNIX_MOUNT_TRACE__ ?? []).map((e) => e.id),
    hasSkeleton: document.body.innerHTML.includes("Skeleton") || /skeleton/i.test(document.body.innerHTML),
    feedMounted: (window.__FRENNIX_MOUNT_TRACE__ ?? []).some((e) => e.id === "feed-route:mounted"),
    bootShell: Boolean(document.getElementById("frennix-boot-shell")),
  }));

  console.log(`\nStartup timing: ${loadMs}ms to feed content`);
  console.log(`Feed route mounted: ${state.feedMounted ? "yes" : "NO"}`);
  console.log(`Page errors: ${pageErrors.length}`);
  if (pageErrors.length) pageErrors.forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`));
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 5).forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`));
  console.log(`Body preview: ${state.text.replace(/\s+/g, " ").slice(0, 120)}`);
  console.log(`Trace tail: ${state.trace.slice(-6).join(" → ")}`);

  const ok =
    pageErrors.length === 0 &&
    state.feedMounted &&
    /Production E2E feed post|STORIES|Share workout/i.test(state.text);

  await browser.close();
  console.log(`\n${ok ? "PASS" : "FAIL"} production browser smoke`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
