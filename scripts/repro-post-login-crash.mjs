/**
 * Reproduce post-login crash against production (or local) web build.
 * Mocks Supabase so feed mounts with posts — triggers AnimatedFeedListItem.
 *
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers node scripts/repro-post-login-crash.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.FRENNIX_ROOT ?? path.join(__dirname, "..");

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
const { webkit, devices } = pwModule.default ?? pwModule;
const baseUrl = process.argv[2] ?? "https://frennix.vercel.app";

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
    content: "Repro feed post with media to exercise CachedImage + AnimatedFeedListItem.",
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

async function setupApiMocks(page, env) {
  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

  await page.route(`**://${supabaseHost}/**`, async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();
    const accept = route.request().headers().accept || "";

    if (reqUrl.includes("/auth/v1/token") && method === "POST") {
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

    if (
      reqUrl.includes("/auth/v1/user") ||
      reqUrl.includes("/auth/v1/session") ||
      reqUrl.includes("/auth/v1/signup")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
        }),
      });
    }

    if (reqUrl.includes("/rest/v1/profiles")) {
      const body = accept.includes("vnd.pgrst.object+json") ? mockProfile() : [mockProfile()];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }

    if (
      reqUrl.includes("/rest/v1/follows") ||
      reqUrl.includes("/rest/v1/group_members") ||
      reqUrl.includes("/rest/v1/challenge_participants") ||
      reqUrl.includes("/rest/v1/post_likes") ||
      reqUrl.includes("/rest/v1/likes") ||
      reqUrl.includes("/rest/v1/saved_posts") ||
      reqUrl.includes("/rest/v1/post_reactions") ||
      reqUrl.includes("/rest/v1/comments") ||
      reqUrl.includes("/rest/v1/blocks") ||
      reqUrl.includes("/rest/v1/notifications") ||
      reqUrl.includes("/rest/v1/product_events")
    ) {
      if (method === "HEAD") {
        return route.fulfill({
          status: 200,
          headers: { "content-range": "*/0" },
          body: "",
        });
      }
      if (accept.includes("object")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "null",
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (reqUrl.includes("/rest/v1/posts")) {
      const body = accept.includes("vnd.pgrst.object+json") ? mockPost() : [mockPost()];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }

    if (reqUrl.includes("/rest/v1/rpc/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function injectSession(page, env) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const sessionPayload = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
  };
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: sessionPayload }
  );
}

async function runSafariRepro(env) {
  console.log(`\n=== iPhone Safari (WebKit) → ${baseUrl} ===`);
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "en-US",
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  const boundaryLogs = [];

  page.on("console", (msg) => {
    const text = msg.text();
    const line = `[${msg.type()}] ${text}`;
    consoleLogs.push(line);
    if (text.includes("[error-boundary:")) {
      boundaryLogs.push(line);
      console.log(`  ${line}`);
    }
    if (msg.type() === "error") {
      console.log(`  console.error: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    const line = `${error.name}: ${error.message}\n${error.stack ?? ""}`;
    pageErrors.push(line);
    console.log(`  pageerror: ${error.message}`);
    if (error.stack) {
      console.log(error.stack.split("\n").slice(0, 15).join("\n"));
    }
  });

  await setupApiMocks(page, env);
  await injectSession(page, env);

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();
  const hitBoundary = /Something went wrong/i.test(bodyText);

  console.log(`  error boundary visible: ${hitBoundary}`);
  if (hitBoundary) {
    console.log(`  boundary snippet: ${bodyText.slice(0, 320).replace(/\s+/g, " ")}`);
  }

  const feedVisible =
    /Repro feed post|Repro Test|Your feed is ready|Could not load feed/i.test(bodyText);
  console.log(`  feed content visible: ${feedVisible}`);

  await browser.close();

  return { hitBoundary, pageErrors, boundaryLogs, consoleLogs, feedVisible };
}

const env = loadEnv();
const result = await runSafariRepro(env);

console.log("\n=== Summary ===");
console.log(`error boundary: ${result.hitBoundary}`);
console.log(`feed visible: ${result.feedVisible}`);
console.log(`page errors: ${result.pageErrors.length}`);
console.log(`boundary logs: ${result.boundaryLogs.length}`);

for (const err of result.pageErrors) {
  console.log("\n--- page error ---");
  console.log(err);
}

for (const log of result.boundaryLogs) {
  console.log("\n--- boundary log ---");
  console.log(log);
}

if (result.hitBoundary || result.pageErrors.length > 0) {
  process.exit(1);
}

console.log("\nNo crash detected in mocked post-login Safari session.");
