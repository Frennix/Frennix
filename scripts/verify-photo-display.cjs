#!/usr/bin/env node
/**
 * Verifies feed/post photo display + lightbox on local web build.
 * Uses mocked Supabase responses — no live database writes.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SCREENSHOTS = path.join(ROOT, "screenshots/photo-verify");
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}`;

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "22222222-2222-4222-8222-222222222222";
const PORTRAIT_URL = "https://picsum.photos/seed/frennix-portrait/900/1400";

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

function startSpaServer() {
  const indexHtml = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const mime = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(200, { "Content-Type": "text/html" }).end(indexHtml);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.listen(PORT, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

function mockProfile() {
  const now = new Date().toISOString();
  return {
    id: MOCK_USER_ID,
    username: "photoverify",
    display_name: "Photo Verify",
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
    content: "Verification portrait photo — full image should be visible.",
    media_urls: [PORTRAIT_URL],
    thumbnail_url: null,
    post_type: "photo",
    workout_type: null,
    group_id: null,
    challenge_id: null,
    event_id: null,
    shared_post_id: null,
    created_at: now,
    updated_at: now,
    author: mockProfile(),
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
          user: { id: MOCK_USER_ID, email: "verify@frennix.test" },
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
          user: { id: MOCK_USER_ID, email: "verify@frennix.test" },
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
    user: { id: MOCK_USER_ID, email: "verify@frennix.test" },
  };
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: sessionPayload }
  );
}

async function getImageMetrics(page, label) {
  return page.evaluate((accessibilityLabel) => {
    const el = [...document.querySelectorAll("*")].find(
      (node) => node.getAttribute("aria-label") === accessibilityLabel
    );
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const bg = style.backgroundImage || "";
    const urlMatch = bg.match(/url\("([^"]+)"\)/);
    return {
      width: rect.width,
      height: rect.height,
      backgroundSize: style.backgroundSize,
      backgroundImageUrl: urlMatch?.[1] ?? null,
    };
  }, label);
}

async function getNaturalSize(page, imageUrl) {
  return page.evaluate((url) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }, imageUrl);
}

const PORTRAIT_ASPECT = 1400 / 900;

function expectedPhotoHeight(containerWidth) {
  return containerWidth * PORTRAIT_ASPECT;
}

function assertHeightMatchesAspect(containerW, containerH, tolerance = 8) {
  if (!containerW || !containerH) return false;
  return Math.abs(containerH - expectedPhotoHeight(containerW)) <= tolerance;
}

function readScale(page) {
  return page.evaluate(() => {
    const img = document.querySelector('[aria-label="Full size image"]');
    if (!img) return 1;
    const inline = img.getAttribute("style") || "";
    const inlineScale = inline.match(/scale\(([\d.]+)\)/);
    if (inlineScale) return Number(inlineScale[1]) || 1;
    const transform = getComputedStyle(img).transform;
    if (!transform || transform === "none") return 1;
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) return Number(matrix[1].split(",")[0]) || 1;
    const scale = transform.match(/scale\(([^)]+)\)/);
    if (scale) return Number(scale[1]) || 1;
    return 1;
  });
}

async function waitForPhotoVisible(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[aria-label="Post photo"]');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 50 && rect.height > 200;
  }, { timeout: 45000 });
}

async function runViewportTest(browser, viewportName, contextOptions, env) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await injectSession(page, env);
  await setupApiMocks(page, env);

  const results = [];

  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4000);

  if (page.url().includes("login") || page.url().includes("onboarding")) {
    throw new Error(`${viewportName}: blocked by auth gate (${page.url()})`);
  }

  const feedPhoto = page.locator('[aria-label="Post photo"]').first();
  await waitForPhotoVisible(page);

  const feedMetrics = await getImageMetrics(page, "Post photo");
  const feedAspectOk = feedMetrics && assertHeightMatchesAspect(feedMetrics.width, feedMetrics.height);

  results.push({
    name: `${viewportName}: feed shows full photo (aspect preserved)`,
    pass: feedAspectOk && feedMetrics.height >= 280,
    detail: { feedMetrics, expectedHeight: expectedPhotoHeight(feedMetrics?.width ?? 0) },
  });

  await page.screenshot({ path: path.join(SCREENSHOTS, `${viewportName}-feed.png`) });

  await feedPhoto.click();
  await page.waitForSelector('[aria-label="Full size image"]', { timeout: 10000 });
  results.push({
    name: `${viewportName}: tap photo opens lightbox on feed`,
    pass: (await page.locator('[aria-label="Full size image"]').count()) === 1,
  });

  if (viewportName === "mobile") {
    const cdp = await page.context().newCDPSession(page);
    const box = await page.locator('[aria-label="Full size image"]').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: cx - 40, y: cy, radiusX: 1, radiusY: 1, force: 1, id: 0 },
          { x: cx + 40, y: cy, radiusX: 1, radiusY: 1, force: 1, id: 1 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 90, y: cy, radiusX: 1, radiusY: 1, force: 1, id: 0 },
          { x: cx + 90, y: cy, radiusX: 1, radiusY: 1, force: 1, id: 1 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(500);
    }
    let scaleAfterPinch = await readScale(page);
    if (scaleAfterPinch <= 1.05) {
      await page.locator('[aria-label="Full size image"]').hover();
      await page.mouse.wheel(0, -300, { modifiers: ["Control"] });
      await page.waitForTimeout(300);
      scaleAfterPinch = await readScale(page);
    }
    results.push({
      name: `${viewportName}: pinch-to-zoom increases scale`,
      pass: scaleAfterPinch > 1.05,
      detail: { scale: scaleAfterPinch },
    });
  } else {
    await page.evaluate(() => {
      window.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -300, ctrlKey: true, bubbles: true, cancelable: true })
      );
    });
    await page.waitForTimeout(300);
    results.push({
      name: `${viewportName}: pinch-to-zoom works (ctrl+wheel)`,
      pass: (await readScale(page)) > 1.05,
      detail: { scale: await readScale(page) },
    });
  }

  await page.getByRole("button", { name: "Close", exact: true }).click({ force: true });
  await page.waitForSelector('[aria-label="Full size image"]', { state: "detached", timeout: 5000 });
  results.push({
    name: `${viewportName}: close lightbox returns to feed`,
    pass: (await page.locator('[aria-label="Post photo"]').count()) > 0,
  });

  await page.goto(`${BASE}/post/${MOCK_POST_ID}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  await waitForPhotoVisible(page);

  const detailPhoto = page.locator('[aria-label="Post photo"]').first();
  const detailMetrics = await getImageMetrics(page, "Post photo");
  results.push({
    name: `${viewportName}: post detail shows full photo (aspect preserved)`,
    pass:
      detailMetrics &&
      assertHeightMatchesAspect(detailMetrics.width, detailMetrics.height) &&
      detailMetrics.height >= 280,
    detail: {
      detailMetrics,
      expectedHeight: expectedPhotoHeight(detailMetrics?.width ?? 0),
    },
  });

  await detailPhoto.click();
  await page.waitForSelector('[aria-label="Full size image"]', { timeout: 10000 });
  await page.getByRole("button", { name: "Close", exact: true }).click({ force: true });
  results.push({
    name: `${viewportName}: close lightbox stays on same post`,
    pass: page.url().includes(MOCK_POST_ID),
  });

  await page.screenshot({ path: path.join(SCREENSHOTS, `${viewportName}-post-detail.png`) });
  await context.close();
  return results;
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error("Missing dist/ — run pnpm run build:web first");
  const env = loadEnv();
  console.log("Starting SPA server…");
  const server = await startSpaServer();

  let browser;
  const allResults = [];
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    allResults.push(
      ...(await runViewportTest(browser, "mobile", devices["iPhone 14"], env).catch((error) => [
        { name: "mobile: suite", pass: false, detail: { error: String(error) } },
      ]))
    );
    allResults.push(
      ...(await runViewportTest(browser, "desktop", { viewport: { width: 1280, height: 800 } }, env).catch(
        (error) => [{ name: "desktop: suite", pass: false, detail: { error: String(error) } }]
      ))
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log("\n=== Photo display verification ===");
  let failed = 0;
  for (const result of allResults) {
    const mark = result.pass ? "PASS" : "FAIL";
    console.log(`${mark}  ${result.name}`);
    if (!result.pass) {
      failed += 1;
      if (result.detail) console.log("      ", JSON.stringify(result.detail));
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed. Screenshots: ${SCREENSHOTS}`);
    process.exit(1);
  }
  console.log(`\nAll ${allResults.length} checks passed. Screenshots: ${SCREENSHOTS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
