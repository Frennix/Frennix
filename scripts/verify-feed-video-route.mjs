#!/usr/bin/env node
/**
 * Runtime regression: mobile web feed videos use real /video/[postId] route links.
 *
 * Usage:
 *   node scripts/verify-feed-video-route.mjs
 *   node scripts/verify-feed-video-route.mjs --url https://frennix.vercel.app
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const productionUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : null;

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "video-post-1";
const MOCK_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

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
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split("?")[0] ?? "/";
      let filePath = path.join(DIST, urlPath.replace(/^\//, ""));
      if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST, "index.html");
      }
      const ext = path.extname(filePath);
      const mime = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
      };
      res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

const MOCK_VIDEO_POST = {
  id: MOCK_POST_ID,
  author_id: MOCK_USER_ID,
  content: "Feed video route verification post",
  media_urls: [MOCK_VIDEO_URL],
  post_type: "video",
  created_at: new Date().toISOString(),
  like_count: 3,
  comment_count: 2,
  liked_by_me: false,
  saved_by_me: false,
  author: {
    id: MOCK_USER_ID,
    username: "feedvideo",
    display_name: "Feed Video Test",
    avatar_url: null,
  },
};

async function main() {
  console.log("verify-feed-video-route (runtime)\n");
  const env = loadEnv();
  let server = null;
  let baseUrl = productionUrl;

  if (!baseUrl) {
    if (!fs.existsSync(path.join(DIST, "index.html"))) {
      throw new Error("Missing dist/ — run: npm run build:web");
    }
    ({ server, baseUrl } = await startStaticServer());
  }

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  let ok = true;

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("supabase.co")) {
      if (url.includes("/auth/v1/token")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "mock",
            refresh_token: "mock",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: MOCK_USER_ID, email: "video@test.local" },
          }),
        });
      }
      if (url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: MOCK_USER_ID,
            username: "feedvideo",
            display_name: "Feed Video Test",
            avatar_url: null,
            onboarding_complete: true,
            fitness_goals: ["strength"],
            activities: ["running"],
            visibility: "public",
            matching_enabled: true,
            location_prompt_completed_at: new Date().toISOString(),
            location_prompt_dismissed_at: new Date().toISOString(),
            city: "Test City",
            state: "CA",
          }),
        });
      }
      if (url.includes("/rest/v1/profiles_reader")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (
        url.includes("/rest/v1/follows") ||
        url.includes("/rest/v1/group_members") ||
        url.includes("/rest/v1/challenge_participants")
      ) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (url.includes("/rest/v1/post_likes") || url.includes("/rest/v1/post_reactions") || url.includes("/rest/v1/comments")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (url.includes("/rest/v1/posts")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            url.includes(`id=eq.${MOCK_POST_ID}`) || url.includes(`.in.(${MOCK_POST_ID}`)
              ? MOCK_VIDEO_POST
              : [MOCK_VIDEO_POST]
          ),
        });
      }
      if (url.includes("get_feed")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [MOCK_VIDEO_POST], next_cursor: null }),
        });
      }
      if (url.includes("get_feed_stories") || url.includes("feed_stories")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.includes("commondatastorage.googleapis.com") || url.includes("picsum.photos")) {
      return route.fulfill({
        status: 200,
        contentType: url.includes(".mp4") ? "video/mp4" : "image/jpeg",
        body: Buffer.from("fake"),
      });
    }
    return route.continue();
  });

  const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  await page.addInitScript(
    ({ key, userId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: userId, email: "video@test.local" },
        })
      );
    },
    { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
  );

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  try {
    await page.waitForSelector("#feed-scroll-list", { timeout: 45_000 });
  } catch (error) {
    const snippet = await page.locator("body").innerText().catch(() => "");
    console.log("body snippet:", snippet.slice(0, 500));
    throw error;
  }
  await page.waitForTimeout(4000);

  await page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    if (feed) feed.scrollTop = 0;
  });
  await page.waitForTimeout(2000);

  const diagnostics = await page.evaluate(() => ({
    body: document.body.innerText.slice(0, 800),
    videos: document.querySelectorAll("video").length,
    inlineVideos: document.querySelectorAll("video.feed-inline-video").length,
    routeLinks: [...document.querySelectorAll("a.feed-video-route-link")].map((a) => a.getAttribute("href")),
    expandLinks: [...document.querySelectorAll("a.feed-video-expand-button")].map((a) => a.getAttribute("href")),
  }));
  if (!diagnostics.routeLinks.length) {
    console.log("diagnostics:", JSON.stringify(diagnostics, null, 2));
  }

  const linkInfo = await page.evaluate((postId) => {
    const expected = `/video/${postId}`;
    const routeLink = document.querySelector(`a.feed-video-route-link[href="${expected}"]`);
    const expandLink = document.querySelector(`a.feed-video-expand-button[href="${expected}"]`);
    const muteButton = document.querySelector(".feed-video-mute-button");
    return {
      routeHref: routeLink?.getAttribute("href") ?? null,
      expandHref: expandLink?.getAttribute("href") ?? null,
      hasInlineVideo: Boolean(document.querySelector("video.feed-inline-video")),
      hasMute: Boolean(muteButton),
    };
  }, MOCK_POST_ID);

  ok = pass("A: feed video has route link href=/video/[postId]", linkInfo.routeHref === `/video/${MOCK_POST_ID}`) && ok;
  ok =
    pass("B: expand icon has same route href", linkInfo.expandHref === `/video/${MOCK_POST_ID}`) && ok;
  ok =
    pass(
      "Inline video or route link present in feed",
      linkInfo.hasInlineVideo || linkInfo.routeHref === `/video/${MOCK_POST_ID}`
    ) && ok;

  const scrollBefore = await page.evaluate(() => {
    const el = document.getElementById("feed-scroll-list");
    return el?.scrollTop ?? 0;
  });

  await page.evaluate((postId) => {
    const link = document.querySelector(`a.feed-video-route-link[href="/video/${postId}"]`);
    link?.click();
  }, MOCK_POST_ID);

  await page.waitForFunction(
    (postId) =>
      window.location.pathname.includes(`/video/${postId}`) &&
      (Boolean(document.querySelector("#frennix-video-route,[data-frennix-video-route='true']")) ||
        /Add a comment/i.test(document.body.innerText)),
    MOCK_POST_ID,
    { timeout: 15_000 }
  );

  const afterNav = await page.evaluate(() => ({
    pathname: window.location.pathname,
    hasVideoRoute: Boolean(
      document.querySelector("#frennix-video-route,[data-frennix-video-route='true']")
    ),
    hasImmersive: Boolean(
      document.querySelector("[data-frennix-immersive-video-viewer='true']")
    ),
    hasCommentUi: /Add a comment/i.test(document.body.innerText),
  }));

  ok =
    pass(
      "C: tap navigates to /video/[postId]",
      afterNav.pathname.includes(`/video/${MOCK_POST_ID}`)
    ) && ok;
  ok =
    pass(
      "D: video route screen mounted",
      afterNav.hasVideoRoute || afterNav.hasImmersive || afterNav.hasCommentUi
    ) && ok;

  await page.getByRole("button", { name: /^Comment$/i }).first().click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(2000);

  const commentsPath = await page.evaluate(() => window.location.pathname);
  ok =
    pass("E: Comment navigates to /comments/[postId]", commentsPath.includes(`/comments/${MOCK_POST_ID}`)) &&
    ok;

  await page.goBack({ waitUntil: "networkidle" }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const backOnVideo = await page.evaluate(
    (postId) => window.location.pathname.includes(`/video/${postId}`),
    MOCK_POST_ID
  );
  ok = pass("Back from comments returns to video route", backOnVideo) && ok;

  await page.goBack({ waitUntil: "networkidle" }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const scrollAfter = await page.evaluate(() => {
    const el = document.getElementById("feed-scroll-list");
    return el?.scrollTop ?? 0;
  });
  ok = pass("F: back to feed restores scroll position", scrollAfter === scrollBefore) && ok;

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("#feed-scroll-list", { timeout: 30_000 });
  await page.waitForTimeout(3500);

  const muteResult = await page.evaluate((postId) => {
    const mute = document.querySelector(".feed-video-mute-button");
    if (!mute) return { clicked: false, stayedOnFeed: true };
    mute.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return {
      clicked: true,
      stayedOnFeed: window.location.pathname === "/" || window.location.pathname.includes("(tabs)"),
      pathname: window.location.pathname,
    };
  }, MOCK_POST_ID);
  ok =
    pass(
      "G: mute does not navigate",
      !muteResult.clicked || muteResult.stayedOnFeed
    ) && ok;

  const swipeResult = await page.evaluate((postId) => {
    const link = document.querySelector(`a.feed-video-route-link[href="/video/${postId}"]`);
    if (!link) return { ok: false };
    const startPath = window.location.pathname;
    link.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 200, bubbles: true }));
    link.dispatchEvent(new PointerEvent("pointerup", { clientX: 100, clientY: 240, bubbles: true }));
    link.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 240, bubbles: true, cancelable: true }));
    return { ok: window.location.pathname === startPath };
  }, MOCK_POST_ID);
  ok = pass("H: vertical swipe gesture does not navigate", swipeResult.ok) && ok;

  await browser.close();
  server?.close();

  console.log("");
  console.log(ok ? "All runtime checks passed." : "Some runtime checks failed.");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
