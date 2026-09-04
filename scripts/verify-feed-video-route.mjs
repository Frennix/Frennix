#!/usr/bin/env node
/**
 * Runtime regression: mobile web feed videos open fullscreen overlay (not /video route).
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
  console.log("verify-feed-video-overlay (runtime)\n");
  let ok = true;

  const feedIndex = fs.readFileSync(path.join(ROOT, "app/(tabs)/index.tsx"), "utf8");
  ok =
    pass(
      "Source: feed opens gallery overlay for video taps",
      feedIndex.includes("openGallery(") &&
        feedIndex.includes("immersiveVideoPlaylist") &&
        !feedIndex.includes("navigateFromFeedVideoLink")
    ) && ok;
  ok =
    pass(
      "Source: feed does not wire videoRouteHrefForMedia",
      !feedIndex.includes("videoRouteHrefForMedia")
    ) && ok;

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
  }));

  ok =
    pass(
      "Inline feed video present",
      diagnostics.inlineVideos > 0 || diagnostics.videos > 0
    ) && ok;

  const scrollBefore = await page.evaluate(() => {
    const el = document.getElementById("feed-scroll-list");
    return el?.scrollTop ?? 0;
  });

  const pathBefore = await page.evaluate(() => window.location.pathname);

  await page.evaluate(() => {
    const mount = document.querySelector(".feed-video-mute-button")?.closest("[role='button']")?.parentElement;
    const target =
      document.querySelector("[data-feed-video-mount]") ??
      document.querySelector("video.feed-inline-video")?.parentElement ??
      mount;
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

  await page.waitForTimeout(1500);

  const afterTap = await page.evaluate(() => ({
    pathname: window.location.pathname,
    hasLightbox: Boolean(document.querySelector("[data-frennix-lightbox='true']")),
    hasPlaylist: Boolean(
      document.querySelector("[data-frennix-immersive-video-playlist='true']")
    ),
    hasImmersive: Boolean(
      document.querySelector("[data-frennix-immersive-video-viewer='true']")
    ),
    hasCommentUi: /Add a comment/i.test(document.body.innerText),
  }));

  ok =
    pass(
      "C: feed video tap opens overlay without /video navigation",
      afterTap.pathname === pathBefore &&
        (afterTap.hasLightbox || afterTap.hasPlaylist || afterTap.hasImmersive || afterTap.hasCommentUi)
    ) && ok;

  await page.getByRole("button", { name: /^Comment$/i }).first().click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(2000);

  const afterComment = await page.evaluate(() => ({
    pathname: window.location.pathname,
    hasCommentsSheet: Boolean(
      document.querySelector("[data-frennix-comments-video-overlay='true']")
    ),
    hasImmersive: Boolean(
      document.querySelector("[data-frennix-immersive-video-viewer='true']")
    ),
  }));

  ok =
    pass(
      "D: Comment opens overlay sheet — video stays mounted",
      afterComment.pathname === pathBefore &&
        afterComment.hasCommentsSheet &&
        afterComment.hasImmersive
    ) && ok;

  await page.evaluate(() => {
    document.querySelector("[data-frennix-comments-sheet='true'] button")?.click();
  }).catch(() => undefined);
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    document.querySelector("[data-frennix-immersive-video-viewer='true'] button")?.click();
  }).catch(() => undefined);
  await page.waitForTimeout(1000);

  const scrollAfter = await page.evaluate(() => {
    const el = document.getElementById("feed-scroll-list");
    return el?.scrollTop ?? 0;
  });
  ok =
    pass(
      "E: closing overlay returns to feed with scroll preserved",
      Math.abs(scrollAfter - scrollBefore) <= 4
    ) && ok;

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector("#feed-scroll-list", { timeout: 30_000 });
  await page.waitForTimeout(3500);

  const muteResult = await page.evaluate(() => {
    const mute = document.querySelector(".feed-video-mute-button");
    if (!mute) return { clicked: false, stayedOnFeed: true };
    mute.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return {
      clicked: true,
      stayedOnFeed: !window.location.pathname.includes("/video/"),
      pathname: window.location.pathname,
    };
  }, MOCK_POST_ID);
  ok =
    pass(
      "F: mute does not navigate",
      !muteResult.clicked || muteResult.stayedOnFeed
    ) && ok;

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
