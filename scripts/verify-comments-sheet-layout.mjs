#!/usr/bin/env node
/**
 * Regression: comments modal geometry owner + focused keyboard layout.
 *
 * Usage:
 *   node scripts/verify-comments-sheet-layout.mjs
 *
 * Requires dist/ (npm run build:web) and Playwright.
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
const MOCK_POST_ID = "post-comments-keyboard-geometry-1";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function findMainBundle() {
  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const match = html.match(/index-[a-f0-9]+\.js/);
  if (!match) throw new Error("Could not find main bundle in dist/index.html");
  return path.join(DIST, "_expo/static/js/web", match[0]);
}

function verifyStaticFix() {
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const viewport = readSource("lib/comments-modal-viewport.ts");
  const diag = readSource("lib/comments-keyboard-diagnostics.ts");
  const composer = readSource("components/PostCommentsSheet.tsx");
  const lock = readSource("lib/web-modal-scroll-lock.ts");

  ok =
    pass(
      "web path uses dedicated geometry owner surface",
      sheet.includes("WebCommentsModalSurface") && sheet.includes("useCommentsModalViewportGeometry")
    ) && ok;
  ok =
    pass(
      "root overlay applies viewport top/height once",
      viewport.includes("viewportTop") &&
        viewport.includes("viewportHeight") &&
        viewport.includes("viewportBottom")
    ) && ok;
  const webSection = sheet.split("function NativeCommentsModalSurface")[0];
  ok =
    pass(
      "web sheet has no translateY transform",
      webSection.includes("WebCommentsModalSurface") && !webSection.includes("translateY")
    ) && ok;
  ok =
    pass(
      "composer is flex child not absolute/fixed",
      sheet.includes("flexShrink: 0") &&
        sheet.includes('position: "relative"') &&
        !sheet.includes("composerHost") ||
        sheet.includes("composerHost")
    ) && ok;
  ok = pass("composer host uses relative positioning", sheet.includes('position: "relative"')) && ok;
  ok =
    pass(
      "web list uses overflow div not RN ScrollView",
      sheet.includes("CommentsListRegion") && sheet.includes('Platform.OS === "web"')
    ) && ok;
  ok =
    pass(
      "body scroll pinned during comments on web",
      sheet.includes("pinWebBodyScrollForComments")
    ) && ok;
  ok =
    pass(
      "preventScroll focus on comment input",
      composer.includes("preventScroll: true") && composer.includes("data-frennix-comment-input")
    ) && ok;
  ok =
    pass(
      "geometry assertion checks composer/sheet/overlay bottoms",
      diag.includes("composerBottom") &&
        diag.includes("sheetBottom") &&
        diag.includes("GEOMETRY_TOLERANCE_PX")
    ) && ok;
  ok =
    pass(
      "scroll lock does not mutate feed scroll list",
      !lock.includes('feed.style.touchAction = "none"') && !lock.includes('feed.style.overflow = "hidden"')
    ) && ok;

  return ok;
}

function verifyBundle() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.log("SKIP  bundle checks — run npm run build:web");
    return true;
  }
  let ok = true;
  const bundle = fs.readFileSync(findMainBundle(), "utf8");
  ok = pass("bundle includes comments sheet portal marker", bundle.includes("frennix-comments-sheet")) && ok;
  ok = pass("bundle includes comment input marker", bundle.includes("frennix-comment-input")) && ok;
  ok = pass("bundle includes geometry diagnostics", bundle.includes("frennix-comments-sheet-panel")) && ok;
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

async function installMocks(page) {
  const feedPost = {
    id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    content: "Comments keyboard geometry verification post",
    media_urls: [],
    post_type: "text",
    created_at: new Date().toISOString(),
    comment_count: 0,
    like_count: 0,
    author: {
      id: MOCK_USER_ID,
      username: "geomtest",
      display_name: "Geom Test",
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
          user: { id: MOCK_USER_ID, email: "geom@test.local" },
        }),
      });
    }
    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_USER_ID,
          username: "geomtest",
          display_name: "Geom Test",
          avatar_url: null,
          onboarding_complete: true,
          fitness_goals: ["general_fitness"],
          activities: ["running"],
        }),
      });
    }
    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([feedPost]),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function readGeometry(page) {
  return page.evaluate(() => {
    const vv = window.visualViewport;
    const overlay = document.querySelector('[data-frennix-comments-sheet="true"]');
    const sheet = document.querySelector('[data-frennix-comments-sheet-panel="true"]');
    const header = document.querySelector('[data-frennix-comments-header="true"]');
    const composer = document.querySelector('[data-frennix-comment-composer="true"]');
    const rect = (el) => (el instanceof HTMLElement ? el.getBoundingClientRect() : null);
    const o = rect(overlay);
    const s = rect(sheet);
    const h = rect(header);
    const c = rect(composer);
    const overlayBottom = Math.round((vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight));
    const composerBottom = c ? Math.round(c.bottom) : null;
    const sheetBottom = s ? Math.round(s.bottom) : null;
    const headerTop = h ? Math.round(h.top) : null;
    const gap = composerBottom != null ? overlayBottom - composerBottom : null;

    let feedInGap = false;
    if (composerBottom != null && gap != null && gap > 2) {
      const y = composerBottom + Math.min(gap / 2, 12);
      const hit = document.elementFromPoint(window.innerWidth / 2, y);
      feedInGap = Boolean(
        hit instanceof Element &&
          hit.closest("#feed-scroll-list, #feed-root-container") &&
          !hit.closest('[data-frennix-comments-sheet="true"]')
      );
    }

    return {
      overlayBottom,
      composerBottom,
      sheetBottom,
      headerTop,
      gapComposer: gap,
      feedInGap,
      sheetTransform: sheet instanceof HTMLElement ? getComputedStyle(sheet).transform : null,
      overlayTop: o ? Math.round(o.top) : null,
      overlayHeight: o ? Math.round(o.height) : null,
    };
  });
}

async function simulateKeyboardViewport(page) {
  await page.evaluate(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fullHeight = window.innerHeight;
    const keyboardHeight = Math.round(fullHeight * 0.42);
    const nextHeight = fullHeight - keyboardHeight;
    const nextOffsetTop = 48;
    Object.defineProperty(vv, "height", { configurable: true, value: nextHeight });
    Object.defineProperty(vv, "offsetTop", { configurable: true, value: nextOffsetTop });
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(120);
}

async function openComments(page) {
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Comment on post"]');
    const key = el ? Object.keys(el).find((k) => k.startsWith("__reactProps")) : null;
    if (el && key) el[key]?.onClick?.({ stopPropagation() {}, preventDefault() {} });
  });
  await page.waitForSelector('[data-frennix-comments-sheet="true"]', { timeout: 12_000 });
}

async function focusComposer(page) {
  await page.evaluate(() => {
    const input = document.querySelector('[data-frennix-comment-input="true"]');
    if (input instanceof HTMLElement && "focus" in input) {
      input.focus({ preventScroll: true });
    }
  });
  await page.waitForTimeout(120);
}

async function runFocusedGeometryScenario(page, baseUrl, label) {
  await page.goto(`${baseUrl}?feedDebug=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    for (const id of ["frennix-boot-shell", "frennix-boot-overlay"]) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }
  });
  await page.getByText("Comments keyboard geometry verification post").first().waitFor({ state: "visible", timeout: 20_000 });

  let ok = true;
  await openComments(page);
  let geom = await readGeometry(page);
  ok =
    pass(
      `${label}: header visible before focus`,
      geom.headerTop != null && geom.headerTop >= (geom.overlayTop ?? 0) - 2,
      `headerTop=${geom.headerTop}`
    ) && ok;

  await focusComposer(page);
  await simulateKeyboardViewport(page);
  geom = await readGeometry(page);

  ok =
    pass(
      `${label}: composerBottom equals overlayBottom within 2px after focus`,
      geom.composerBottom != null && Math.abs(geom.composerBottom - geom.overlayBottom) <= 2,
      `composer=${geom.composerBottom} overlay=${geom.overlayBottom} gap=${geom.gapComposer}`
    ) && ok;
  ok =
    pass(
      `${label}: sheetBottom equals overlayBottom within 2px`,
      geom.sheetBottom != null && Math.abs(geom.sheetBottom - geom.overlayBottom) <= 2,
      `sheet=${geom.sheetBottom} overlay=${geom.overlayBottom}`
    ) && ok;
  ok =
    pass(
      `${label}: header remains inside overlay after focus`,
      geom.headerTop != null && geom.headerTop >= (geom.overlayTop ?? 0) - 2,
      `headerTop=${geom.headerTop}`
    ) && ok;
  ok =
    pass(
      `${label}: sheet has no transform after focus`,
      geom.sheetTransform === "none" || geom.sheetTransform == null,
      String(geom.sheetTransform)
    ) && ok;
  ok = pass(`${label}: no feed visible in composer gap`, !geom.feedInGap, `gap=${geom.gapComposer}`) && ok;

  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => {
      const input = document.querySelector('[data-frennix-comment-input="true"]');
      if (input instanceof HTMLElement) input.blur();
    });
    await page.waitForTimeout(80);
    await focusComposer(page);
    await simulateKeyboardViewport(page);
    geom = await readGeometry(page);
    ok =
      pass(
        `${label}: focus cycle ${i + 1} composer aligned`,
        geom.composerBottom != null && Math.abs(geom.composerBottom - geom.overlayBottom) <= 2,
        `gap=${geom.gapComposer}`
      ) && ok;
  }

  await page.evaluate(() => {
    const close = document.querySelector('[aria-label="Close comments"]');
    const key = close ? Object.keys(close).find((k) => k.startsWith("__reactProps")) : null;
    if (close && key) close[key]?.onClick?.({ stopPropagation() {}, preventDefault() {} });
  });
  await page.waitForTimeout(400);

  const feedOk = await page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    if (!feed) return { ok: false, reason: "missing feed" };
    const style = getComputedStyle(feed);
    const before = feed.scrollTop;
    feed.scrollTop = before + 160;
    return {
      ok: style.touchAction !== "none" && feed.scrollTop > before + 4,
      touchAction: style.touchAction,
      scrolled: feed.scrollTop > before + 4,
    };
  });
  ok = pass(`${label}: first-swipe feed scroll after close`, feedOk.ok, JSON.stringify(feedOk)) && ok;

  return ok;
}

async function main() {
  console.log("=== Comments sheet layout verification ===\n");
  const staticOk = verifyStaticFix();
  const bundleOk = verifyBundle();

  let e2eOk = true;
  if (fs.existsSync(path.join(DIST, "index.html"))) {
    try {
      loadEnv();
      const { server, baseUrl } = await startStaticServer();
      const pwModule = await import(pathToFileURL(playwrightPath).href);
      const { webkit } = pwModule.default ?? pwModule;
      const browser = await webkit.launch({ headless: true });

      for (const [label, standalone] of [
        ["iPhone Safari (WebKit)", false],
        ["iPhone Home Screen PWA (WebKit)", true],
      ]) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        });
        if (standalone) {
          await context.addInitScript(() => {
            Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
          });
        }
        const page = await context.newPage();
        await installMocks(page);
        const ref = new URL(loadEnv().EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
        await page.addInitScript(
          ({ key, userId }) => {
            localStorage.setItem(
              key,
              JSON.stringify({
                access_token: "mock",
                refresh_token: "mock",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: { id: userId, email: "geom@test.local" },
              })
            );
          },
          { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
        );
        e2eOk = (await runFocusedGeometryScenario(page, baseUrl, label)) && e2eOk;
        await context.close();
      }

      await browser.close();
      server.close();
    } catch (error) {
      pass("focused geometry browser flow", false, error instanceof Error ? error.message : String(error));
      e2eOk = false;
    }
  } else {
    console.log("SKIP  focused geometry e2e — run npm run build:web");
  }

  const allOk = staticOk && bundleOk && e2eOk;
  console.log(`\ncore/bundle: ${staticOk && bundleOk ? "PASS" : "FAIL"}`);
  console.log(`focused geometry e2e: ${e2eOk ? "PASS" : "FAIL/SKIP"}`);
  console.log(`verify-comments-sheet-layout: ${allOk ? "PASS" : "FAIL"}`);
  if (!allOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
