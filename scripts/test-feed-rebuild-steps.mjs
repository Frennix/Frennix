/**
 * Test each FEED_REBUILD_STEP against local Expo web (or deployed URL).
 *
 * Usage:
 *   node scripts/test-feed-rebuild-steps.mjs [baseUrl]
 *
 * Requires: expo web running at baseUrl (default http://localhost:8081)
 *           .env with EXPO_PUBLIC_SUPABASE_URL
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PROBE_PATH = path.join(ROOT, "components/FeedRebuildProbe.tsx");
const baseUrl = process.argv[2] ?? "http://localhost:8081";

const require = createRequire(import.meta.url);
const playwrightPath =
  process.env.PLAYWRIGHT_MODULE ??
  (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();

const pwModule = await import(pathToFileURL(playwrightPath).href);
const { chromium, devices } = pwModule.default ?? pwModule;

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "22222222-2222-4222-8222-222222222222";
const PORTRAIT_URL = "https://picsum.photos/seed/frennix-repro/900/1200";

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) throw new Error("Missing .env");
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      })
  );
}

function setFeedRebuildStep(step) {
  const source = fs.readFileSync(PROBE_PATH, "utf8");
  const next = source.replace(
    /export const FEED_REBUILD_STEP = \d+;/,
    `export const FEED_REBUILD_STEP = ${step};`
  );
  if (!next.includes(`export const FEED_REBUILD_STEP = ${step};`)) {
    throw new Error(`Could not set FEED_REBUILD_STEP to ${step} in ${PROBE_PATH}`);
  }
  fs.writeFileSync(PROBE_PATH, next);
}

function mockProfile() {
  const now = new Date().toISOString();
  return {
    id: MOCK_USER_ID,
    username: "reprotest",
    display_name: "Repro Test",
    avatar_url: null,
    bio: null,
    fitness_goals: ["strength"],
    activities: ["weightlifting"],
    city: "Test City",
    visibility: "public",
    matching_enabled: false,
    gender: "male",
    match_preference: "any",
    is_premium: false,
    onboarding_complete: true,
    created_at: now,
    updated_at: now,
  };
}

function mockPost() {
  const now = new Date().toISOString();
  return {
    id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    content: "Rebuild probe post card content for step 3.",
    media_urls: [PORTRAIT_URL],
    thumbnail_url: null,
    post_type: "photo",
    workout_type: null,
    workout_types: [],
    group_id: null,
    challenge_id: null,
    event_id: null,
    shared_post_id: null,
    created_at: now,
    updated_at: now,
    author: mockProfile(),
    liked_by_me: false,
    like_count: 0,
    comment_count: 0,
    saved_by_me: false,
    reactions: [],
    preview_comments: [],
  };
}

function mockWorkoutPostRow() {
  const now = new Date().toISOString();
  return {
    author_id: MOCK_USER_ID,
    created_at: now,
    post_type: "photo",
  };
}

async function setupApiMocks(page, env) {
  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

  await page.route(`**://${supabaseHost}/**`, async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();
    const accept = route.request().headers().accept || "";

    if (reqUrl.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
        }),
      });
    }

    if (reqUrl.includes("/rest/v1/profiles") || reqUrl.includes("/rest/v1/profiles_reader")) {
      const body = accept.includes("vnd.pgrst.object+json") ? mockProfile() : [mockProfile()];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }

    if (reqUrl.includes("/rest/v1/follows")) {
      if (method === "HEAD") {
        return route.fulfill({ status: 200, headers: { "content-range": "*/0" }, body: "" });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (
      reqUrl.includes("/rest/v1/group_members") ||
      reqUrl.includes("/rest/v1/challenge_participants") ||
      reqUrl.includes("/rest/v1/post_likes") ||
      reqUrl.includes("/rest/v1/likes") ||
      reqUrl.includes("/rest/v1/saved_posts") ||
      reqUrl.includes("/rest/v1/post_reactions") ||
      reqUrl.includes("/rest/v1/comments") ||
      reqUrl.includes("/rest/v1/blocks") ||
      reqUrl.includes("/rest/v1/notifications") ||
      reqUrl.includes("/rest/v1/product_events") ||
      reqUrl.includes("/rest/v1/rpc/")
    ) {
      if (method === "HEAD") {
        return route.fulfill({ status: 200, headers: { "content-range": "*/0" }, body: "" });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (reqUrl.includes("/rest/v1/posts")) {
      const post = mockPost();
      const workoutRow = mockWorkoutPostRow();
      if (accept.includes("vnd.pgrst.object+json")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(post),
        });
      }
      if (reqUrl.includes("select=author_id")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([workoutRow]),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([post]),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function injectSession(page, env) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: storageKey,
      value: {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        expires_at: expiresAt,
        token_type: "bearer",
        user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
      },
    }
  );
}

async function evaluateStep(page, step) {
  await page.waitForTimeout(9000);

  const bodyText = await page.locator("body").innerText();

  const hasHeading = /Feed is rendering/i.test(bodyText);
  const hasRow1 = /Row 1/i.test(bodyText);
  const hasStories = /Workout stories/i.test(bodyText);
  const hasHeader = /Workouts, progress, and wins from your network/i.test(bodyText);
  const hasQuickActions = /Share workout/i.test(bodyText);
  const hasPostCard = /Rebuild probe post card content/i.test(bodyText);
  const hasBoundary = /Something went wrong|Post-login shell error/i.test(bodyText);

  const visibleChars = bodyText.replace(/\s+/g, " ").trim().length;
  const blank = !hasHeading && !hasBoundary && visibleChars < 120;

  let pass = false;
  let detail = "";

  switch (step) {
    case 0:
      pass = hasHeading && hasRow1;
      detail = `heading=${hasHeading} row1=${hasRow1}`;
      break;
    case 1:
      pass = hasHeading && hasHeader && hasQuickActions && !hasStories && !hasRow1;
      detail = `header=${hasHeader} quickActions=${hasQuickActions} noStories=${!hasStories}`;
      break;
    case 2:
      pass = hasHeading && hasHeader && hasStories && !hasRow1;
      detail = `header=${hasHeader} stories=${hasStories}`;
      break;
    case 3:
      pass = hasHeading && hasPostCard && !hasRow1;
      detail = `postCard=${hasPostCard} noRows=${!hasRow1}`;
      break;
    case 4:
      pass = hasHeading && hasPostCard;
      detail = `heading=${hasHeading} postCard=${hasPostCard} overlaysMounted`;
      break;
    case 5:
      pass = hasHeading && hasPostCard;
      detail = `heading=${hasHeading} postCard=${hasPostCard} advancedHooks`;
      break;
    default:
      pass = false;
      detail = "invalid step";
  }

  return {
    step,
    pass,
    blank,
    hasBoundary,
    detail,
    visibleChars,
    snippet: bodyText.slice(0, 280).replace(/\s+/g, " "),
  };
}

async function main() {
  const env = loadEnv();
  const originalProbe = fs.readFileSync(PROBE_PATH, "utf8");
  const originalIndexWeb = fs.readFileSync(path.join(ROOT, "app/(tabs)/index.web.tsx"), "utf8");
  const results = [];

  console.log(`Testing FEED_REBUILD_STEP 0–5 at ${baseUrl} (iPhone viewport / Chrome)\n`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
  const page = await context.newPage();

  const allPageErrors = [];
  page.on("pageerror", (error) => {
    allPageErrors.push(error.message);
    console.log(`  pageerror: ${error.message}`);
  });

  await setupApiMocks(page, env);
  await injectSession(page, env);

  let firstBlankStep = null;

  for (const step of [0, 1, 2, 3, 4, 5]) {
    console.log(`--- FEED_REBUILD_STEP=${step} ---`);
    fs.writeFileSync(
      path.join(ROOT, "app/(tabs)/index.web.tsx"),
      'export { default } from "@/components/FeedRebuildProbe";\n'
    );
    setFeedRebuildStep(step);

    // Cache-bust so Metro serves fresh bundle after file change
    await page.goto(`${baseUrl}/?feedRebuildStep=${step}&t=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const result = await evaluateStep(page, step);
    results.push(result);

    console.log(`  pass: ${result.pass}`);
    console.log(`  blank: ${result.blank}`);
    console.log(`  ${result.detail}`);
    console.log(`  visible chars: ${result.visibleChars}`);
    console.log(`  snippet: ${result.snippet}`);

    if (result.blank && firstBlankStep == null) {
      firstBlankStep = step;
    }

    if (!result.pass && firstBlankStep == null && step > 0) {
      const prev = results[step - 1];
      if (prev?.pass) firstBlankStep = step;
    }
  }

  await browser.close();
  fs.writeFileSync(PROBE_PATH, originalProbe);
  fs.writeFileSync(path.join(ROOT, "app/(tabs)/index.web.tsx"), originalIndexWeb);

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`step ${r.step}: ${r.pass ? "PASS" : r.blank ? "BLANK" : "FAIL"} — ${r.detail}`);
  }

  if (firstBlankStep != null) {
    console.log(`\nFirst blank/failing step: ${firstBlankStep}`);
    process.exit(1);
  }

  const firstFail = results.find((r) => !r.pass);
  if (firstFail) {
    console.log(`\nFirst failing step (content missing): ${firstFail.step}`);
    process.exit(1);
  }

  console.log("\nAll steps passed locally.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
