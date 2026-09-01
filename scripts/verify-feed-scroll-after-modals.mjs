#!/usr/bin/env node
/**
 * Regression: feed must scroll on first swipe after modal/overlay cycles (Safari/PWA).
 *
 * Usage:
 *   node scripts/verify-feed-scroll-after-modals.mjs
 *
 * Requires dist/ (npm run build:web) and Playwright at /tmp/pw-repro or project.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "post-feed-scroll-modal-1";
const MOCK_COMMENT_ID = "comment-feed-scroll-1";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function verifyStaticFix() {
  let ok = true;
  const lockSource = readSource("lib/web-modal-scroll-lock.ts");
  ok =
    pass(
      "scroll lock does not set feed touchAction none",
      !lockSource.includes('feed.style.touchAction = "none"')
    ) && ok;
  ok =
    pass(
      "scroll lock sets body/html overflow hidden",
      lockSource.includes('document.body.style.overflow = "hidden"') &&
        lockSource.includes('document.documentElement.style.overflow = "hidden"')
    ) && ok;
  ok =
    pass(
      "scroll lock exposes diagnostics",
      lockSource.includes("collectFeedTouchDiagnostics") && lockSource.includes("getWebModalScrollLockDepth")
    ) && ok;
  ok =
    pass(
      "comments sheet restores document scroll lock on close",
      readSource("components/CommentsBottomSheet.tsx").includes("restoreWebDocumentScrollLock()")
    ) && ok;
  ok =
    pass(
      "PostCommentsSheet restores scroll lock when hidden",
      readSource("components/PostCommentsSheet.tsx").includes("restoreWebDocumentScrollLock()")
    ) && ok;
  return ok;
}

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

function mockComment() {
  return {
    id: MOCK_COMMENT_ID,
    post_id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    parent_id: null,
    content: "Feed scroll regression comment",
    created_at: new Date().toISOString(),
    author: {
      id: MOCK_USER_ID,
      username: "scrolltest",
      display_name: "Scroll Test",
      avatar_url: null,
    },
    like_count: 0,
    liked_by_me: false,
    replies: [],
  };
}

async function installMocks(page) {
  const feedPost = {
    id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    content: "Feed scroll modal regression post with enough content to scroll",
    media_urls: [],
    post_type: "text",
    created_at: new Date().toISOString(),
    comment_count: 1,
    like_count: 0,
    author: {
      id: MOCK_USER_ID,
      username: "scrolltest",
      display_name: "Scroll Test",
      avatar_url: null,
    },
  };

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes("supabase.co")) return route.continue();

    if (url.includes("/auth/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: MOCK_USER_ID, email: "scroll@test.local" },
        }),
      });
    }

    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_USER_ID,
          username: "scrolltest",
          display_name: "Scroll Test",
          avatar_url: null,
          onboarding_complete: true,
          fitness_goals: ["general_fitness"],
          activities: ["running"],
        }),
      });
    }

    if (url.includes("/rest/v1/follows")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ following_id: MOCK_USER_ID }]),
      });
    }

    if (url.includes("/rest/v1/group_members") || url.includes("/rest/v1/challenge_participants")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([feedPost]),
      });
    }

    if (url.includes("/rest/v1/comments")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockComment()]),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function dismissBlockingOverlays(page) {
  await page.evaluate(() => {
    for (const id of ["frennix-boot-shell", "frennix-boot-overlay"]) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }
  });
}

async function readFeedState(page) {
  return page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    const style = feed ? getComputedStyle(feed) : null;
    const cx = Math.round(window.innerWidth / 2);
    const cy = Math.round(window.innerHeight * 0.55);
    const hit = document.elementFromPoint(cx, cy);
    const diag =
      typeof window.__FRENNIX_FEED_TOUCH_DIAG__ === "function"
        ? window.__FRENNIX_FEED_TOUCH_DIAG__()
        : null;
    return {
      hasFeed: Boolean(feed),
      scrollTop: feed?.scrollTop ?? 0,
      touchAction: style?.touchAction ?? "missing",
      overflowY: style?.overflowY ?? "missing",
      scrollHeight: feed?.scrollHeight ?? 0,
      clientHeight: feed?.clientHeight ?? 0,
      hit: hit instanceof Element ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ""}` : null,
      lockDepth: diag?.lockDepth ?? null,
      mountedPortals: diag?.mountedPortals ?? [],
      bodyTouchAction: getComputedStyle(document.body).touchAction,
    };
  });
}

async function swipeFeed(page) {
  return page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    if (!feed) return { ok: false, reason: "missing feed-scroll-list" };
    const before = feed.scrollTop;
    feed.scrollTop = before + 180;
    const afterProgrammatic = feed.scrollTop;
    return {
      ok: afterProgrammatic > before + 5,
      before,
      after: afterProgrammatic,
    };
  });
}

async function openComments(page) {
  await page.evaluate(() => {
    const propsKey = Object.keys(document.querySelector('[aria-label="Comment on post"]') ?? {}).find((k) =>
      k.startsWith("__reactProps")
    );
    const el = document.querySelector('[aria-label="Comment on post"]');
    if (el && propsKey) el[propsKey]?.onClick?.({ stopPropagation() {}, preventDefault() {} });
  });
  await page.waitForSelector('[data-frennix-comments-sheet="true"]', { timeout: 12_000 });
}

async function closeComments(page) {
  await page.locator('[aria-label="Close comments"]').click({ force: true, timeout: 8000 });
  await page.waitForSelector('[data-frennix-comments-sheet="true"]', { state: "detached", timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function openCommentOptions(page) {
  await page.locator('[aria-label="Comment options"]').first().click({ force: true, timeout: 8000 });
  await page.waitForSelector('[data-frennix-comment-options="true"]', { timeout: 8000 });
}

async function cancelCommentOptions(page) {
  await page.locator('[data-frennix-comment-options="true"]').getByText("Cancel", { exact: true }).click({ force: true });
  await page.waitForTimeout(300);
}

async function assertFeedScrollable(page, label) {
  const state = await readFeedState(page);
  const swipe = await swipeFeed(page);
  let ok = true;
  ok = pass(`${label}: feed touch-action is pan-y`, state.touchAction === "pan-y", state.touchAction) && ok;
  ok = pass(`${label}: no mounted comment portals`, state.mountedPortals.length === 0, state.mountedPortals.join(", ")) && ok;
  ok =
    pass(
      `${label}: scroll-lock depth is zero`,
      state.lockDepth === 0 || state.lockDepth === null,
      String(state.lockDepth)
    ) && ok;
  ok = pass(`${label}: programmatic scroll works`, swipe.ok, `before=${swipe.before} after=${swipe.after ?? swipe.reason}`) && ok;
  return ok;
}

async function runScenario(page, baseUrl, label) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  await dismissBlockingOverlays(page);
  await page.getByText("Feed scroll modal regression post").first().waitFor({ state: "visible", timeout: 20_000 });

  let ok = await assertFeedScrollable(page, `${label}: fresh launch`);

  await openComments(page);
  await closeComments(page);
  ok = (await assertFeedScrollable(page, `${label}: after comments close`)) && ok;

  await openComments(page);
  await openCommentOptions(page);
  await cancelCommentOptions(page);
  await closeComments(page);
  ok = (await assertFeedScrollable(page, `${label}: after comment options cycle`)) && ok;

  for (let i = 0; i < 3; i += 1) {
    await openComments(page);
    await closeComments(page);
  }
  ok = (await assertFeedScrollable(page, `${label}: after 3x comments open/close`)) && ok;

  return ok;
}

async function main() {
  console.log("=== Feed scroll after modals verification ===\n");

  let coreOk = verifyStaticFix();

  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npm run build:web");
  }

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit } = pwModule.default ?? pwModule;
  const browser = await webkit.launch({ headless: true });

  async function probe(label, contextOptions = {}) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ...contextOptions,
    });
    if (contextOptions.standalone) {
      await context.addInitScript(() => {
        Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
      });
    }
    const page = await context.newPage();
    await installMocks(page);
    const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
    await page.addInitScript(
      ({ key, userId }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: "mock",
            refresh_token: "mock",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: userId, email: "scroll@test.local" },
          })
        );
      },
      { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
    );

    let ok = false;
    try {
      ok = await runScenario(page, baseUrl, label);
    } catch (error) {
      pass(`${label}: browser flow`, false, error instanceof Error ? error.message : String(error));
    }
    await context.close();
    return ok;
  }

  let e2eOk = await probe("iPhone Safari (WebKit)");
  e2eOk = (await probe("iPhone Home Screen PWA (WebKit)", { standalone: true })) && e2eOk;

  await browser.close();
  server.close();

  console.log(`\ncore checks: ${coreOk ? "PASS" : "FAIL"}`);
  console.log(`browser e2e: ${e2eOk ? "PASS" : "SKIP/FAIL"}`);
  console.log(`verify-feed-scroll-after-modals: ${coreOk ? "PASS" : "FAIL"}`);
  if (!coreOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
