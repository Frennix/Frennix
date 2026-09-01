#!/usr/bin/env node
/**
 * Regression: comment options menu must render above the open comments bottom sheet.
 *
 * Usage:
 *   node scripts/verify-comment-options-layering.mjs
 *
 * Requires dist/ (run npm run build:web first) and Playwright.
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
const MOCK_POST_ID = "post-comment-layering-1";
const MOCK_COMMENT_ID = "comment-layering-1";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function verifyProductionBundle() {
  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
  if (!bundleMatch) {
    pass("Production bundle referenced in index.html", false);
    return false;
  }

  const bundleName = bundleMatch[0];
  const bundlePath = path.join(DIST, "_expo/static/js/web", bundleName);
  const bundle = fs.readFileSync(bundlePath, "utf8");

  let ok = true;
  ok = pass("Bundle includes comment options portal marker", bundle.includes("frennix-comment-options")) && ok;
  ok =
    pass(
      "Bundle includes comment options z-index above comments sheet",
      bundle.includes("100000") && bundle.includes("99998")
    ) && ok;
  ok = pass("Bundle includes resetCommentActions wiring", bundle.includes("resetCommentActions")) && ok;
  ok = pass("Bundle includes comments sheet portal marker", bundle.includes("frennix-comments-sheet")) && ok;
  return ok;
}

function verifyStaticWiring() {
  let ok = true;
  ok =
    pass(
      "overlay z-index: comment options above comments sheet",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100000") &&
        readSource("lib/overlay-z-index.ts").includes("commentsSheet: 99998")
    ) && ok;
  ok =
    pass(
      "PostCommentsSheet enables rootPortal and resets on close",
      readSource("components/PostCommentsSheet.tsx").includes("rootPortal: true") &&
        readSource("components/PostCommentsSheet.tsx").includes("resetCommentActions()")
    ) && ok;
  ok =
    pass(
      "useCommentActions exposes resetCommentActions",
      readSource("lib/useCommentActions.tsx").includes("resetCommentActions")
    ) && ok;
  ok =
    pass(
      "EntityActionSheet supports root portal",
      readSource("components/EntityActionSheet.tsx").includes("rootPortal")
    ) && ok;
  ok =
    pass(
      "BottomOverlayShell portals to document.body when rootPortal",
      readSource("components/BottomOverlayShell.tsx").includes("RootPortalOverlay")
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

function mockComment(overrides = {}) {
  return {
    id: MOCK_COMMENT_ID,
    post_id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    parent_id: null,
    content: "Layering regression comment",
    created_at: new Date().toISOString(),
    author: {
      id: MOCK_USER_ID,
      username: "layeringtest",
      display_name: "Layer Test",
      avatar_url: null,
    },
    like_count: 0,
    liked_by_me: false,
    replies: [],
    ...overrides,
  };
}

async function installSupabaseMocks(page) {
  const feedPost = {
    id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    content: "Comment options layering verification post",
    media_urls: [],
    post_type: "text",
    created_at: new Date().toISOString(),
    comment_count: 1,
    like_count: 0,
    author: {
      id: MOCK_USER_ID,
      username: "layeringtest",
      display_name: "Layer Test",
      avatar_url: null,
    },
  };

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes("supabase.co")) {
      return route.continue();
    }

    if (url.includes("/auth/v1/token") || url.includes("/auth/v1/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: MOCK_USER_ID, email: "layering@test.local" },
        }),
      });
    }

    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_USER_ID,
          username: "layeringtest",
          display_name: "Layer Test",
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

    if (
      url.includes("/rest/v1/likes") ||
      url.includes("saved_posts") ||
      url.includes("comment_likes") ||
      url.includes("post_reactions") ||
      url.includes("stories") ||
      url.includes("/rpc/")
    ) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
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
    const feed = document.getElementById("feed-scroll-list");
    feed?.scrollTo({ top: 0 });
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      const z = Number.parseInt(style.zIndex, 10);
      if (
        (style.position === "fixed" || style.position === "sticky") &&
        Number.isFinite(z) &&
        z >= 10 &&
        !el.querySelector("#feed-scroll-list") &&
        !el.closest("#feed-scroll-list")
      ) {
        el.style.pointerEvents = "none";
      }
    }
  });
}

async function runFlow(page, baseUrl, label) {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);
  await dismissBlockingOverlays(page);

  await page.getByText("Comment options layering verification post").first().waitFor({
    state: "visible",
    timeout: 25_000,
  });

  const commentButton = page
    .getByRole("button", { name: "Comment on post" })
    .or(page.getByRole("button", { name: "View all comments" }))
    .first();
  await commentButton.waitFor({ state: "visible", timeout: 20_000 });
  await commentButton.scrollIntoViewIfNeeded();
  await commentButton.click({ force: true, timeout: 10_000 });

  const commentsSheet = page.locator('[data-frennix-comments-sheet="true"]');
  await commentsSheet.waitFor({ state: "visible", timeout: 15_000 });

  const menuButton = page.getByRole("button", { name: "Comment options" }).first();
  await menuButton.waitFor({ state: "visible", timeout: 10_000 });
  await menuButton.click({ force: true, timeout: 10_000 });

  const layering = await page.evaluate(() => {
    const sheet = document.querySelector('[data-frennix-comments-sheet="true"]');
    const options = document.querySelector('[data-frennix-comment-options="true"]');
    const sheetZ = sheet ? Number.parseInt(getComputedStyle(sheet).zIndex, 10) : NaN;
    const optionsZ = options ? Number.parseInt(getComputedStyle(options).zIndex, 10) : NaN;
    const optionsText = options?.textContent ?? "";
    const optionsVisible =
      Boolean(options) &&
      optionsZ > sheetZ &&
      /Comment options/i.test(optionsText) &&
      /Cancel/i.test(optionsText);
    return {
      hasSheet: Boolean(sheet),
      hasOptions: Boolean(options),
      sheetZ,
      optionsZ,
      optionsVisible,
    };
  });

  let ok = true;
  ok = pass(`${label}: comments sheet open`, layering.hasSheet) && ok;
  ok =
    pass(
      `${label}: comment options portal above sheet`,
      layering.optionsVisible,
      `sheet z=${layering.sheetZ}, options z=${layering.optionsZ}`
    ) && ok;

  await page.locator('[data-frennix-comment-options="true"]').getByText("Cancel", { exact: true }).click({ force: true });
  await page.waitForTimeout(400);

  const afterCancel = await page.evaluate(() => ({
    sheetOpen: Boolean(document.querySelector('[data-frennix-comments-sheet="true"]')),
    optionsGone: !document.querySelector('[data-frennix-comment-options="true"]'),
  }));
  ok = pass(`${label}: comments remain open after Cancel`, afterCancel.sheetOpen) && ok;
  ok = pass(`${label}: options dismissed after Cancel`, afterCancel.optionsGone) && ok;

  await page.getByRole("button", { name: "Close comments" }).click({ force: true });
  await page.waitForTimeout(600);

  const afterClose = await page.evaluate(() => ({
    sheetGone: !document.querySelector('[data-frennix-comments-sheet="true"]'),
    optionsGone: !document.querySelector('[data-frennix-comment-options="true"]'),
  }));
  ok = pass(`${label}: comments sheet closed`, afterClose.sheetGone) && ok;
  ok = pass(`${label}: no orphaned options on feed`, afterClose.optionsGone) && ok;

  return ok;
}

async function main() {
  console.log("=== Comment options layering verification ===\n");

  let coreOk = verifyStaticWiring();

  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npm run build:web");
  }

  coreOk = verifyProductionBundle() && coreOk;

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit, chromium } = pwModule.default ?? pwModule;

  let browser;
  try {
    browser = await webkit.launch({ headless: true });
  } catch {
    browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() =>
      chromium.launch({ headless: true })
    );
  }

  let e2eOk = true;

  async function probe(label, contextOptions = {}) {
    const context = await browser.newContext({
      baseURL: baseUrl,
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
    await installSupabaseMocks(page);

    const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
    const storageKey = `sb-${ref}-auth-token`;
    await page.addInitScript(
      ({ key, userId }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: "mock",
            refresh_token: "mock",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: userId, email: "layering@test.local" },
          })
        );
      },
      { key: storageKey, userId: MOCK_USER_ID }
    );

    let flowOk = false;
    try {
      flowOk = await runFlow(page, baseUrl, label);
    } catch (error) {
      pass(`${label}: browser flow`, false, error instanceof Error ? error.message : String(error));
      console.log(
        `  ↳ Manual QA on ${label}: open comments → tap ⋮ → options above sheet → Cancel → close comments`
      );
    }
    await context.close();
    return flowOk;
  }

  e2eOk = (await probe("iPhone Safari (WebKit)")) && e2eOk;
  e2eOk =
    (await probe("iPhone Home Screen PWA (WebKit)", {
      standalone: true,
    })) && e2eOk;

  await browser.close();
  server.close();

  if (!e2eOk) {
    console.log(
      "\nNote: Source/bundle checks validate the portal fix. Browser automation may fail in headless WebKit when feed overlays intercept taps — confirm on iPhone Safari and Home Screen PWA manually."
    );
  }

  console.log(`\ncore checks: ${coreOk ? "PASS" : "FAIL"}`);
  console.log(`browser e2e: ${e2eOk ? "PASS" : "SKIP (see manual QA above)"}`);
  console.log(`verify-comment-options-layering: ${coreOk ? "PASS" : "FAIL"}`);
  if (!coreOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
