#!/usr/bin/env node
/**
 * Isolated Playwright runtime coverage for immersive video playlist overlay behavior.
 *
 * Builds/serves a temporary web export (never repo dist/) with mocked Supabase data.
 *
 * Usage:
 *   node scripts/verify-immersive-video-playlist-runtime.mjs
 *   node scripts/verify-immersive-video-playlist-runtime.mjs --export-dir /tmp/my-export
 *   node scripts/verify-immersive-video-playlist-runtime.mjs --keep-export
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    const fallbacks = [
      "/tmp/pw-repro/node_modules/playwright/index.mjs",
      "/tmp/pw-repro/node_modules/playwright/index.js",
    ];
    return fallbacks.find((file) => fs.existsSync(file)) ?? fallbacks[0];
  }
})();

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const FIXTURE_VIDEO_CANDIDATES = [
  path.join(ROOT, ".video-repair/proof-test/repaired.mp4"),
  path.join(ROOT, "../mobile/.video-repair/proof-test/repaired.mp4"),
  "/tmp/frennix-playlist-fixture/repaired.mp4",
];
const FIXTURE_VIDEO_PATH = FIXTURE_VIDEO_CANDIDATES.find((candidate) =>
  fs.existsSync(candidate)
);

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const exportDirIndex = args.indexOf("--export-dir");
  return {
    exportDir: exportDirIndex >= 0 ? args[exportDirIndex + 1] : null,
    keepExport: args.includes("--keep-export"),
    skipExport: args.includes("--skip-export"),
  };
}

function readSupabaseProjectRef(exportDir) {
  const jsDir = path.join(exportDir, "_expo/static/js/web");
  if (!fs.existsSync(jsDir)) {
    throw new Error(`Missing web bundle in export: ${jsDir}`);
  }
  const bundles = fs
    .readdirSync(jsDir)
    .filter((file) => file.startsWith("index-") && file.endsWith(".js"))
    .map((file) => ({
      file,
      size: fs.statSync(path.join(jsDir, file)).size,
    }))
    .sort((a, b) => b.size - a.size);

  for (const { file } of bundles) {
    const content = fs.readFileSync(path.join(jsDir, file), "utf8");
    const match =
      content.match(/https:\\\/\\\/([a-z0-9]+)\\.supabase\\.co/) ??
      content.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (match?.[1]) return match[1];
  }
  throw new Error("Could not resolve Supabase project ref from export bundle");
}

function patchExportWebHtml(outputDir) {
  const { frennixWebDocumentCss } = require(path.join(ROOT, "lib/web-document-styles.js"));
  const indexPath = path.join(outputDir, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const patchId = "frennix-web-scroll";
  const scrollPatch = `<style id="${patchId}">${frennixWebDocumentCss}\n    </style>`;
  if (html.includes(`id="${patchId}"`)) {
    html = html.replace(
      new RegExp(`<style id="${patchId}">[\\s\\S]*?</style>`),
      scrollPatch
    );
  } else {
    html = html.replace("</head>", `    ${scrollPatch}\n  </head>`);
  }
  fs.writeFileSync(indexPath, html);
}

function exportWebBundle(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Exporting web bundle to ${outputDir} ...`);
  const result = spawnSync(
    "npx",
    ["expo", "export", "-p", "web", "--output-dir", outputDir],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    }
  );
  if (result.status !== 0) {
    throw new Error(`expo export failed with exit code ${result.status ?? "unknown"}`);
  }
  if (!fs.existsSync(path.join(outputDir, "index.html"))) {
    throw new Error("Export completed but index.html is missing");
  }
  patchExportWebHtml(outputDir);
}

function startStaticServer(exportDir, fixtureVideoPath) {
  const mime = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
    ".mp4": "video/mp4",
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split("?")[0] ?? "/";
      if (urlPath === "/fixture-video.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        fs.createReadStream(fixtureVideoPath).pipe(res);
        return;
      }
      let filePath = path.join(exportDir, urlPath.replace(/^\//, ""));
      if (
        !filePath.startsWith(exportDir) ||
        !fs.existsSync(filePath) ||
        fs.statSync(filePath).isDirectory()
      ) {
        filePath = path.join(exportDir, "index.html");
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

function createMockPosts(videoUrl) {
  const labels = [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
  ];
  return labels.map((label, index) =>
    makeVideoPost(
      `video-post-${index + 1}`,
      `Playlist video ${label}`,
      videoUrl,
      4000 - index * 200
    )
  );
}

function makeVideoPost(id, content, videoUrl, ageMs) {
  return {
    id,
    author_id: MOCK_USER_ID,
    content,
    media_urls: [videoUrl],
    post_type: "video",
    created_at: new Date(Date.now() - ageMs).toISOString(),
    like_count: 3,
    comment_count: 2,
    liked_by_me: false,
    saved_by_me: false,
    author: {
      id: MOCK_USER_ID,
      username: "playlistuser",
      display_name: "Playlist Runtime",
      avatar_url: null,
    },
  };
}

function mockProfile() {
  return {
    id: MOCK_USER_ID,
    username: "playlistuser",
    display_name: "Playlist Runtime",
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
  };
}

function installSupabaseMocks(page, mockPosts) {
  return page.route("**/*", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const accept = route.request().headers().accept ?? "";
    const wantsSingleObject = accept.includes("application/vnd.pgrst.object+json");

    if (url.includes("supabase.co")) {
      if (url.includes("/auth/v1/token") || url.includes("/auth/v1/user")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "mock",
            refresh_token: "mock",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: MOCK_USER_ID, email: "playlist@test.local" },
          }),
        });
      }
      if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProfile()),
        });
      }
      if (
        url.includes("/rest/v1/follows") ||
        url.includes("/rest/v1/group_members") ||
        url.includes("/rest/v1/challenge_participants")
      ) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (
        (url.includes("/rest/v1/likes") ||
          url.includes("/rest/v1/comments") ||
          url.includes("/rest/v1/saved_posts")) &&
        (method === "HEAD" || url.includes("head=true"))
      ) {
        return route.fulfill({
          status: 200,
          headers: { "content-range": "0-0/0" },
          body: "",
        });
      }
      if (
        url.includes("/rest/v1/likes") ||
        url.includes("/rest/v1/saved_posts") ||
        url.includes("/rest/v1/post_likes") ||
        url.includes("/rest/v1/post_reactions") ||
        url.includes("/rest/v1/comments")
      ) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: url.includes("maybeSingle") ? "null" : "[]",
        });
      }
      if (url.includes("get_post_interaction_stats")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            mockPosts.map((post) => ({
              post_id: post.id,
              like_count: post.like_count,
              comment_count: post.comment_count,
              liked_by_me: post.liked_by_me,
              saved_by_me: post.saved_by_me,
            }))
          ),
        });
      }
      if (url.includes("get_post_preview_comments") || url.includes("get_post_reactions")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (url.includes("/rest/v1/posts")) {
        const single = mockPosts.find((post) => url.includes(`id=eq.${post.id}`));
        if (single && wantsSingleObject) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(single),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(single ? [single] : mockPosts),
        });
      }
      if (url.includes("get_feed")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: mockPosts, next_cursor: null }),
        });
      }
      if (url.includes("get_feed_stories") || url.includes("feed_stories")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.includes("picsum.photos")) {
      return route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from("fake"),
      });
    }
    return route.continue();
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

async function readPlaylistState(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".frennix-immersive-video-playlist-scroll");
    const slides = [...document.querySelectorAll("[data-frennix-video-playlist-slide]")].map(
      (slide) => {
        const video = slide.querySelector("video");
        return {
          state: slide.getAttribute("data-frennix-video-playlist-slide"),
          paused: video ? video.paused : null,
          muted: video ? video.muted : null,
        };
      }
    );
    const muteButton = document.querySelector('[aria-label="Mute video"], [aria-label="Unmute video"]');
    const hasPlaylist = Boolean(
      document.querySelector('[data-frennix-immersive-video-playlist="true"]') ??
        document.getElementById("frennix-immersive-video-playlist") ??
        scroller
    );
    const hasImmersive = Boolean(
      document.querySelector('[data-frennix-immersive-video-viewer="true"]') ??
        document.getElementById("frennix-immersive-video-viewer") ??
        document.querySelector('[aria-label="Close video"]')
    );
    return {
      hasPlaylist,
      hasImmersive,
      scrollTop: 0,
      activeIndex: Number(scroller?.getAttribute("data-frennix-playlist-active-index") ?? 0),
      stageHeight: scroller?.clientHeight ?? 0,
      slides,
      muteLabel: muteButton?.getAttribute("aria-label") ?? null,
      bodyText: document.body.innerText,
    };
  });
}

async function waitForFeedVideoReady(page) {
  await page.waitForFunction(
    () => {
      if (document.body.innerText.includes("Video unavailable")) return false;
      const video = document.querySelector("video");
      return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    },
    { timeout: 45_000 }
  );
}

async function waitForPlaylistViewer(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('[data-frennix-immersive-video-playlist="true"]') ??
          document.getElementById("frennix-immersive-video-playlist") ??
          document.querySelector(".frennix-immersive-video-playlist-scroll") ??
          document.querySelector('[aria-label="Close video"]')
      ),
    { timeout: 30_000 }
  );
  await page.waitForTimeout(800);
}

async function openFeedVideoOverlay(page) {
  await page.getByText("Playlist video alpha").first().waitFor({ state: "visible", timeout: 45_000 });
  await waitForFeedVideoReady(page);
  const openButton = page.getByRole("button", { name: "Open video full screen" }).first();
  await openButton.dispatchEvent("pointerdown", { clientX: 195, clientY: 420 });
  await openButton.dispatchEvent("pointerup", { clientX: 195, clientY: 420 });
  await waitForPlaylistViewer(page);
}

async function readVideoPlaybackState(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".frennix-immersive-video-playlist-scroll");
    if (!scroller) {
      return { activeIndex: 0, visiblePageCount: 0, videos: [] };
    }
    const activeIndex = Number(scroller.getAttribute("data-frennix-playlist-active-index") ?? 0);
    const pages = [...scroller.querySelectorAll("[data-frennix-video-playlist-page]")];
    const visiblePageCount = pages.filter((page) => {
      const style = getComputedStyle(page);
      return style.visibility !== "hidden" && style.display !== "none";
    }).length;
    const videos = pages.map((page) => {
      const video = page.querySelector("video");
      return {
        page: page.getAttribute("data-frennix-video-playlist-page"),
        paused: video ? video.paused : null,
        muted: video ? video.muted : null,
      };
    });
    return { activeIndex, visiblePageCount, videos };
  });
}

async function readVisiblePlaylistGeometry(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".frennix-immersive-video-playlist-scroll");
    const stageRect = stage?.getBoundingClientRect();
    const pages = [...document.querySelectorAll("[data-frennix-video-playlist-page]")].map(
      (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible =
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity || "1") > 0.01;
        return {
          page: el.getAttribute("data-frennix-video-playlist-page"),
          visibility: style.visibility,
          transform: style.transform,
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          offsetFromStage: stageRect ? Math.round(rect.top - stageRect.top) : null,
          visible,
        };
      }
    );
    const visiblePages = pages.filter((item) => item.visible);
    const stackedPartialPages =
      visiblePages.length > 1 ||
      visiblePages.some(
        (item) =>
          item.offsetFromStage != null &&
          Math.abs(item.offsetFromStage) > 2 &&
          item.height > 0 &&
          item.height < (stageRect?.height ?? item.height) - 2
      );
    return {
      visibleCount: visiblePages.length,
      stackedPartialPages,
      pages: visiblePages,
    };
  });
}

async function swipePlaylist(page, direction, distance = 120, { watchStacked = false } = {}) {
  const target = page.locator(".frennix-immersive-video-playlist-scroll");
  const box = await target.boundingBox();
  if (!box) throw new Error("missing playlist scroller");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const dy = direction === "up" ? -distance : distance;
  const belowThreshold = distance < 72;
  const steps = belowThreshold ? 20 : 8;
  const samples = [];
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (belowThreshold) await page.waitForTimeout(80);
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(x, y + (dy * step) / steps);
    if (watchStacked) {
      samples.push(await readVisiblePlaylistGeometry(page));
    }
  }
  if (belowThreshold) await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(400);
  return samples;
}

async function swipeElement(page, locator, direction, distance = 120) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("missing swipe target");
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 24);
  const dy = direction === "up" ? -distance : distance;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

async function tapPlaylistCenter(page) {
  const box = await page.locator(".frennix-immersive-video-playlist-scroll").boundingBox();
  if (!box) throw new Error("missing playlist scroller");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
}

async function closeVideoViewer(page) {
  await page.getByRole("button", { name: "Close video" }).first().click({ timeout: 8000 });
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-frennix-immersive-video-playlist="true"]') &&
      !document.getElementById("frennix-immersive-video-playlist") &&
      !document.querySelector(".frennix-immersive-video-playlist-scroll") &&
      !document.querySelector('[aria-label="Close video"]'),
    { timeout: 12_000 }
  ).catch(() => undefined);
  await page.waitForTimeout(800);
}

async function getActivePlaylistSlideIndex(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(".frennix-immersive-video-playlist-scroll");
    if (!scroller) return 0;
    return Number(scroller.getAttribute("data-frennix-playlist-active-index") ?? 0);
  });
}

async function readActivePageText(page) {
  return page.evaluate(() => {
    const active = document.querySelector('[data-frennix-video-playlist-page="active"]');
    return active?.innerText ?? "";
  });
}

async function readActiveViewerMuteState(page) {
  return page.evaluate(() => {
    const slide =
      document.querySelector('[data-frennix-video-playlist-page="active"]') ??
      document.querySelector('[data-frennix-video-playlist-slide="active"]');
    const button = slide?.querySelector('[aria-label="Mute video"], [aria-label="Unmute video"]');
    const video = slide?.querySelector("video");
    return {
      label: button?.getAttribute("aria-label") ?? null,
      videoMuted: video?.muted ?? null,
    };
  });
}

async function toggleActiveViewerMute(page) {
  const toggledViaHook = await page.evaluate(() => {
    const toggle = window.__FRENNIX_PLAYLIST_TOGGLE_MUTE__;
    if (typeof toggle !== "function") return false;
    toggle();
    return true;
  });
  if (toggledViaHook) {
    await page.waitForTimeout(400);
    return;
  }

  const runtimeSelector = '[aria-label="Toggle mute runtime test"]';
  await page.waitForSelector(runtimeSelector, { timeout: 8000 }).catch(() => undefined);
  const runtimeToggle = page.locator(runtimeSelector).first();
  if (await runtimeToggle.count()) {
    await invokeReactPress(page, runtimeSelector);
    const box = await runtimeToggle.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await runtimeToggle.click({ force: true, timeout: 4000 }).catch(() => undefined);
    }
    await page.waitForTimeout(400);
    return;
  }

  const selector = `[data-frennix-video-playlist-page="active"] [aria-label="Mute video"], [data-frennix-video-playlist-page="active"] [aria-label="Unmute video"]`;

  let toggled = (await invokeReactPress(page, selector)).ok;
  if (!toggled) {
    const buttons = page.getByRole("button", { name: /^(Mute|Unmute) video$/ });
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (!(await button.isVisible())) continue;
      await button.dispatchEvent("pointerdown");
      await button.dispatchEvent("pointerup");
      await button.click({ force: true, timeout: 4000 }).catch(() => undefined);
      toggled = true;
      break;
    }
  }
  if (!toggled) {
    const control = page.locator(selector).first();
    const box = await control.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
}

async function invokeReactPress(page, selector) {
  return page.evaluate((query) => {
    let element = document.querySelector(query);
    for (let depth = 0; depth < 8 && element; depth += 1) {
      const propsKey = Object.keys(element).find(
        (key) => key.startsWith("__reactProps") || key.startsWith("__reactEvents")
      );
      const props = propsKey ? element[propsKey] : null;
      if (props?.onClick) {
        props.onClick({ stopPropagation() {}, preventDefault() {} });
        return { ok: true, via: "onClick", depth };
      }
      if (props?.onPress) {
        props.onPress({ stopPropagation() {}, preventDefault() {} });
        return { ok: true, via: "onPress", depth };
      }
      element = element.parentElement;
    }
    return { ok: false, reason: "no-handler" };
  }, selector);
}

async function openOverlayComments(page) {
  await page.waitForSelector(".frennix-immersive-video-playlist-scroll", { timeout: 8000 });

  const runtimeTrigger = page.getByRole("button", { name: "Open comments runtime test" });
  const runtimeTriggerCount = await runtimeTrigger.count();
  const addSelector = `[data-frennix-video-playlist-page="active"] [aria-label="Add a comment"]`;
  const commentSelector = `[data-frennix-video-playlist-page="active"] [aria-label="Comment"]`;

  let invoked = await invokeReactPress(page, addSelector);
  if (!invoked.ok) {
    invoked = await invokeReactPress(page, commentSelector);
  }

  const addComment = page.locator(addSelector).first();
  if (await addComment.count()) {
    const box = await addComment.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await addComment.click({ force: true, timeout: 8000 });
    }
  } else if (runtimeTriggerCount > 0) {
    await runtimeTrigger.click({ force: true, timeout: 8000 });
  }

  if (!invoked.ok && !(await addComment.count())) {
    throw new Error(`could not invoke comment control: ${JSON.stringify({ activeIndex, invoked })}`);
  }

  await page.waitForTimeout(800);

  try {
    await page.waitForSelector(
      '[data-frennix-comments-video-overlay="true"], [data-frennix-comments-sheet="true"], [aria-label="Close comments"]',
      { timeout: 12_000 }
    );
  } catch (error) {
    const diag = await page.evaluate(() => ({
      pathname: window.location.pathname,
      hasCommentsOverlay: Boolean(
        document.querySelector('[data-frennix-comments-video-overlay="true"]')
      ),
      hasCommentsSheet: Boolean(document.querySelector('[data-frennix-comments-sheet="true"]')),
      hasCloseComments: Boolean(document.querySelector('[aria-label="Close comments"]')),
      hasCloseVideo: Boolean(document.querySelector('[aria-label="Close video"]')),
    }));
    throw new Error(
      `comments overlay did not open (runtimeTriggerCount=${runtimeTriggerCount}): ${JSON.stringify(diag)} (${error instanceof Error ? error.message : error})`
    );
  }
  await page.waitForTimeout(500);
}

async function closeOverlayComments(page) {
  await page.getByRole("button", { name: "Close comments" }).first().click({ force: true, timeout: 8000 });
  await page.waitForSelector('[data-frennix-comments-video-overlay="true"]', {
    state: "detached",
    timeout: 12_000,
  }).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function readComposerLayout(page) {
  return page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const composer =
      document.querySelector('[data-video-overlay-composer="true"]') ??
      document.querySelector(
        '[data-frennix-comments-video-overlay="true"] [data-frennix-comment-composer-host="true"]'
      );
    const input = document.querySelector('[data-frennix-comment-input="true"], textarea');
    const composerRect = composer?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    const active = document.activeElement;
    const inputFocused =
      active === input ||
      Boolean(input?.contains(active)) ||
      Boolean(
        input instanceof HTMLElement &&
          document.activeElement instanceof HTMLElement &&
          input.contains(document.activeElement)
      );
    return {
      viewport,
      hasComposer: Boolean(composer),
      composerBottom: composerRect?.bottom ?? null,
      composerTop: composerRect?.top ?? null,
      inputFocused,
      overflowBottom: composerRect ? composerRect.bottom > viewport.height + 1 : true,
      overflowHorizontal:
        composerRect != null &&
        (composerRect.left < -1 || composerRect.right > viewport.width + 1),
    };
  });
}

async function readFeedState(page) {
  return page.evaluate(() => {
    function resolveFeedScrollPort() {
      const start = document.getElementById("feed-scroll-list");
      if (!start) return null;
      const queue = [start];
      while (queue.length > 0) {
        const el = queue.shift();
        const style = getComputedStyle(el);
        const canScroll =
          el.scrollHeight > el.clientHeight + 4 &&
          (style.overflowY === "auto" ||
            style.overflowY === "scroll" ||
            style.overflowY === "overlay" ||
            style.overflow === "auto" ||
            style.overflow === "scroll" ||
            style.overflow === "overlay");
        if (canScroll) return el;
        for (let i = 0; i < el.children.length; i += 1) {
          const child = el.children.item(i);
          if (child instanceof HTMLElement) queue.push(child);
        }
      }
      return start;
    }

    const feed = resolveFeedScrollPort();
    const style = feed ? getComputedStyle(feed) : null;
    const diag =
      typeof window.__FRENNIX_FEED_TOUCH_DIAG__ === "function"
        ? window.__FRENNIX_FEED_TOUCH_DIAG__()
        : null;
    return {
      scrollTop: feed?.scrollTop ?? 0,
      touchAction: style?.touchAction ?? diag?.feedTouchAction ?? "missing",
      scrollHeight: feed?.scrollHeight ?? 0,
      clientHeight: feed?.clientHeight ?? 0,
      lockDepth: diag?.lockDepth ?? null,
      mountedPortals: diag?.mountedPortals ?? [],
    };
  });
}

async function swipeFeed(page) {
  return page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    if (!feed) return { ok: false, reason: "missing feed-scroll-list" };
    const before = feed.scrollTop;
    feed.scrollTop = before + 180;
    return { ok: feed.scrollTop > before + 5, before, after: feed.scrollTop };
  });
}

async function assertFeedScrollable(page, label) {
  const state = await readFeedState(page);
  const swipe = await page.evaluate(() => {
    const feed = document.getElementById("feed-scroll-list");
    if (!feed) return { ok: false, reason: "missing feed-scroll-list" };
    const canScroll = feed.scrollHeight > feed.clientHeight + 8;
    const before = feed.scrollTop;
    feed.scrollTop = before + 180;
    return {
      ok: canScroll ? feed.scrollTop > before + 5 : true,
      before,
      after: feed.scrollTop,
      canScroll,
    };
  });
  let ok = true;
  ok =
    pass(
      `${label}: feed touch-action is pan-y`,
      state.touchAction === "pan-y" || state.touchAction === "manipulation",
      state.touchAction
    ) && ok;
  ok =
    pass(
      `${label}: no mounted comment portals`,
      state.mountedPortals.length === 0,
      state.mountedPortals.join(", ")
    ) && ok;
  ok =
    pass(
      `${label}: scroll-lock depth is zero`,
      state.lockDepth === 0 || state.lockDepth === null,
      String(state.lockDepth)
    ) && ok;
  ok =
    pass(
      `${label}: programmatic feed scroll works`,
      swipe.ok,
      `before=${swipe.before} after=${swipe.after ?? swipe.reason}`
    ) && ok;
  return ok;
}

async function main() {
  console.log("verify-immersive-video-playlist-runtime\n");
  let ok = true;
  const { exportDir: exportDirArg, keepExport, skipExport } = parseArgs();

  let exportDir = exportDirArg;
  let createdExportDir = false;
  if (!exportDir) {
    exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "frennix-playlist-runtime-"));
    createdExportDir = true;
    if (!skipExport) {
      exportWebBundle(exportDir);
    }
  }

  if (!fs.existsSync(path.join(exportDir, "index.html"))) {
    throw new Error(`Missing index.html in export dir: ${exportDir}`);
  }
  if (!FIXTURE_VIDEO_PATH || !fs.existsSync(FIXTURE_VIDEO_PATH)) {
    throw new Error(`Missing fixture video. Looked in: ${FIXTURE_VIDEO_CANDIDATES.join(", ")}`);
  }

  const supabaseRef = readSupabaseProjectRef(exportDir);
  const authStorageKey = `sb-${supabaseRef}-auth-token`;

  const { server, baseUrl } = await startStaticServer(exportDir, FIXTURE_VIDEO_PATH);
  const mockPosts = createMockPosts(`${baseUrl}/fixture-video.mp4`);
  console.log(`Serving temporary export at ${baseUrl}\n`);

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;
  const browser = await chromium
    .launch({ channel: "chrome", headless: true })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
  });

  await installSupabaseMocks(page, mockPosts);
  await page.addInitScript(() => {
    window.__FRENNIX_PLAYLIST_RUNTIME_TEST__ = true;
  });
  await page.addInitScript(
    ({ key, userId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: userId, email: "playlist@test.local" },
        })
      );
    },
    { key: authStorageKey, userId: MOCK_USER_ID }
  );

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector("#feed-scroll-list", { timeout: 45_000 });
  await dismissBlockingOverlays(page);
  await page.waitForTimeout(3500);

  await page.evaluate(() => {
    function resolveFeedScrollPort() {
      const start = document.getElementById("feed-scroll-list");
      if (!start) return null;
      const queue = [start];
      while (queue.length > 0) {
        const el = queue.shift();
        const style = getComputedStyle(el);
        const canScroll =
          el.scrollHeight > el.clientHeight + 4 &&
          (style.overflowY === "auto" ||
            style.overflowY === "scroll" ||
            style.overflowY === "overlay" ||
            style.overflow === "auto" ||
            style.overflow === "scroll" ||
            style.overflow === "overlay");
        if (canScroll) return el;
        for (let i = 0; i < el.children.length; i += 1) {
          const child = el.children.item(i);
          if (child instanceof HTMLElement) queue.push(child);
        }
      }
      return start;
    }
    const feed = resolveFeedScrollPort();
    if (feed) feed.scrollTop = 120;
  });
  await page.waitForTimeout(600);
  const scrollBeforeOpen = (await readFeedState(page)).scrollTop;

  await openFeedVideoOverlay(page);

  let playlist = await readPlaylistState(page);
  ok =
    pass(
      "Setup: playlist overlay opens from feed video tap",
      playlist.hasPlaylist && playlist.hasImmersive
    ) && ok;
  ok =
    pass(
      "Setup: initial active video is alpha",
      /Playlist video alpha/i.test(playlist.bodyText)
    ) && ok;

  await openOverlayComments(page);
  let withComments = await page.evaluate(() => ({
    hasCommentsOverlay: Boolean(
      document.querySelector('[data-frennix-comments-video-overlay="true"]')
    ),
    hasCommentsSheet: Boolean(document.querySelector('[data-frennix-comments-sheet="true"]')),
    hasCloseComments: Boolean(document.querySelector('[aria-label="Close comments"]')),
    hasImmersive: Boolean(
      document.querySelector('[data-frennix-immersive-video-viewer="true"]') ??
        document.getElementById("frennix-immersive-video-viewer") ??
        document.querySelector('[aria-label="Close video"]')
    ),
    hasPlaylist: Boolean(
      document.querySelector('[data-frennix-immersive-video-playlist="true"]') ??
        document.getElementById("frennix-immersive-video-playlist") ??
        document.querySelector(".frennix-immersive-video-playlist-scroll")
    ),
    pathname: window.location.pathname,
    activeText: document.body.innerText,
  }));
  ok =
    pass(
      "4. Comments keep immersive viewer mounted and visible (alpha)",
      (withComments.hasCommentsOverlay || withComments.hasCommentsSheet || withComments.hasCloseComments) &&
        withComments.hasImmersive &&
        withComments.hasPlaylist &&
        !withComments.pathname.includes("/comments") &&
        /Playlist video alpha/i.test(withComments.activeText)
    ) && ok;

  let composer = await readComposerLayout(page);
  ok =
    pass(
      "5. Comment composer is present in iPhone viewport",
      composer.hasComposer && !composer.overflowHorizontal,
      `top=${composer.composerTop} bottom=${composer.composerBottom}`
    ) && ok;

  await page.evaluate(() => {
    const input = document.querySelector('[data-frennix-comment-input="true"], textarea');
    if (input instanceof HTMLElement) {
      input.focus();
    }
  });
  await page.waitForTimeout(400);
  composer = await readComposerLayout(page);
  ok =
    pass(
      "5. Comment composer stays within viewport when focused",
      composer.inputFocused &&
        composer.composerBottom != null &&
        composer.composerBottom <= composer.viewport.height + 24 &&
        !composer.overflowHorizontal,
      `bottom=${composer.composerBottom} viewport=${composer.viewport.height} focused=${composer.inputFocused}`
    ) && ok;

  const commentField = page
    .locator('[data-frennix-comment-input="true"], [data-video-comment-field="true"] textarea, textarea')
    .first();
  if (await commentField.count()) {
    await swipeElement(page, commentField, "up", 140);
  } else {
    await swipePlaylist(page, "up");
  }
  playlist = await readPlaylistState(page);
  ok =
    pass(
      "Controls: swipe on the comment field does not change videos",
      playlist.activeIndex === 0 && /Playlist video alpha/i.test(playlist.bodyText)
    ) && ok;

  await closeOverlayComments(page);
  playlist = await readPlaylistState(page);
  let commentsClosed = await page.evaluate(() => ({
    hasCommentsOverlay: Boolean(
      document.querySelector('[data-frennix-comments-video-overlay="true"]')
    ),
    activeText: document.body.innerText,
  }));
  ok =
    pass(
      "6. Closing comments returns to the same active video",
      !commentsClosed.hasCommentsOverlay && /Playlist video alpha/i.test(commentsClosed.activeText)
    ) && ok;

  await tapPlaylistCenter(page);
  playlist = await readPlaylistState(page);
  ok =
    pass(
      "Controls: a normal tap does not change videos",
      playlist.activeIndex === 0 && /Playlist video alpha/i.test(playlist.bodyText)
    ) && ok;

  const muteControl = page
    .locator(
      '[data-frennix-video-playlist-page="active"] [aria-label="Mute video"], [data-frennix-video-playlist-page="active"] [aria-label="Unmute video"]'
    )
    .first();
  if (await muteControl.count()) {
    await muteControl.click({ force: true, timeout: 4000 }).catch(() => undefined);
  }
  playlist = await readPlaylistState(page);
  ok =
    pass(
      "Controls: tapping mute does not change videos",
      playlist.activeIndex === 0 && /Playlist video alpha/i.test(playlist.bodyText)
    ) && ok;

  await swipePlaylist(page, "up", 36);
  playlist = await readPlaylistState(page);
  let activeText = await readActivePageText(page);
  ok =
    pass(
      "1. Sub-threshold swipe stays on the current video",
      playlist.activeIndex === 0 && /Playlist video alpha/i.test(activeText)
    ) && ok;

  const upSamples = await swipePlaylist(page, "up", 120, { watchStacked: true });
  playlist = await readPlaylistState(page);
  activeText = await readActivePageText(page);
  const playback = await readVideoPlaybackState(page);
  ok =
    pass(
      "1. Swipe up advances exactly one video",
      playlist.activeIndex === 1 && /Playlist video beta/i.test(activeText)
    ) && ok;
  ok =
    pass(
      "1. Only one playlist page is visible after the change",
      playback.visiblePageCount === 1,
      `visiblePageCount=${playback.visiblePageCount}`
    ) && ok;
  ok =
    pass(
      "1. No stacked partial pages during the upward swipe",
      upSamples.length > 0 && upSamples.every((sample) => !sample.stackedPartialPages && sample.visibleCount === 1),
      JSON.stringify(upSamples.map((sample) => ({ visibleCount: sample.visibleCount, stacked: sample.stackedPartialPages })))
    ) && ok;

  const inactivePaused = playback.videos
    .filter((video) => video.page !== "active")
    .every((video) => video.paused === true);
  const activeVideo = playback.videos.find((video) => video.page === "active");
  ok =
    pass(
      "2. Previous videos pause when advancing",
      inactivePaused,
      JSON.stringify(playback)
    ) && ok;
  ok =
    pass(
      "2. Only the active slide is marked active",
      playback.activeIndex === 1,
      `activeIndex=${playback.activeIndex}`
    ) && ok;
  ok =
    pass(
      "2. Active slide video is playing (not paused)",
      activeVideo?.paused === false,
      `activePaused=${activeVideo?.paused}`
    ) && ok;

  const downSamples = await swipePlaylist(page, "down", 120, { watchStacked: true });
  playlist = await readPlaylistState(page);
  activeText = await readActivePageText(page);
  ok =
    pass(
      "3. Swipe down returns exactly one video",
      playlist.activeIndex === 0 && /Playlist video alpha/i.test(activeText)
    ) && ok;
  ok =
    pass(
      "3. No stacked partial pages during the downward swipe",
      downSamples.length > 0 &&
        downSamples.every((sample) => !sample.stackedPartialPages && sample.visibleCount === 1),
      JSON.stringify(
        downSamples.map((sample) => ({
          visibleCount: sample.visibleCount,
          stacked: sample.stackedPartialPages,
        }))
      )
    ) && ok;

  await swipePlaylist(page, "up");
  await page.waitForTimeout(400);
  playlist = await readPlaylistState(page);
  activeText = await readActivePageText(page);
  ok =
    pass(
      "Setup: back on beta for mute coverage",
      playlist.activeIndex === 1 && /Playlist video beta/i.test(activeText)
    ) && ok;

  let muteBefore = await readActiveViewerMuteState(page);
  await toggleActiveViewerMute(page);
  await page.waitForTimeout(400);
  let muteAfter = await readActiveViewerMuteState(page);
  ok =
    pass(
      "9. Mute toggles active viewer mute control",
      muteBefore.label != null &&
        muteAfter.label != null &&
        muteBefore.label !== muteAfter.label &&
        muteBefore.videoMuted !== muteAfter.videoMuted,
      `${muteBefore.label} -> ${muteAfter.label ?? "missing"} muted=${muteAfter.videoMuted}`
    ) && ok;

  await swipePlaylist(page, "up");
  await page.waitForTimeout(400);
  const muteOnGamma = await readActiveViewerMuteState(page);
  ok =
    pass(
      "9. Mute state stays consistent after changing videos",
      muteOnGamma.label === muteAfter.label && muteOnGamma.videoMuted === muteAfter.videoMuted,
      `${muteOnGamma.label ?? "missing"} muted=${muteOnGamma.videoMuted}`
    ) && ok;

  await closeVideoViewer(page);
  await page.waitForTimeout(1000);
  await page.waitForFunction(
    (before) => {
      function resolveFeedScrollPort() {
        const start = document.getElementById("feed-scroll-list");
        if (!start) return null;
        const queue = [start];
        while (queue.length > 0) {
          const el = queue.shift();
          const style = getComputedStyle(el);
          const canScroll =
            el.scrollHeight > el.clientHeight + 4 &&
            (style.overflowY === "auto" ||
              style.overflowY === "scroll" ||
              style.overflowY === "overlay" ||
              style.overflow === "auto" ||
              style.overflow === "scroll" ||
              style.overflow === "overlay");
          if (canScroll) return el;
          for (let i = 0; i < el.children.length; i += 1) {
            const child = el.children.item(i);
            if (child instanceof HTMLElement) queue.push(child);
          }
        }
        return start;
      }
      const feed = resolveFeedScrollPort();
      return Boolean(feed && feed.clientHeight > 60);
    },
    scrollBeforeOpen,
    { timeout: 12_000 }
  );
  await page
    .waitForFunction(
      (before) => {
        function resolveFeedScrollPort() {
          const start = document.getElementById("feed-scroll-list");
          if (!start) return null;
          const queue = [start];
          while (queue.length > 0) {
            const el = queue.shift();
            const style = getComputedStyle(el);
            const canScroll =
              el.scrollHeight > el.clientHeight + 4 &&
              (style.overflowY === "auto" ||
                style.overflowY === "scroll" ||
                style.overflowY === "overlay" ||
                style.overflow === "auto" ||
                style.overflow === "scroll" ||
                style.overflow === "overlay");
            if (canScroll) return el;
            for (let i = 0; i < el.children.length; i += 1) {
              const child = el.children.item(i);
              if (child instanceof HTMLElement) queue.push(child);
            }
          }
          return start;
        }
        const feed = resolveFeedScrollPort();
        if (!feed) return false;
        return Math.abs(feed.scrollTop - before) <= 4;
      },
      scrollBeforeOpen,
      { timeout: 8000 }
    )
    .catch(() => undefined);
  const scrollAfterClose = (await readFeedState(page)).scrollTop;
  ok =
    pass(
      "7. Closing viewer restores prior feed scroll position",
      Math.abs(scrollAfterClose - scrollBeforeOpen) <= 4,
      `before=${scrollBeforeOpen} after=${scrollAfterClose}`
    ) && ok;
  ok = (await assertFeedScrollable(page, "8. After overlay cycle")) && ok;

  await browser.close();
  server.close();

  if (createdExportDir && !keepExport) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  } else if (createdExportDir && keepExport) {
    console.log(`\nKept temporary export at ${exportDir}`);
  }

  console.log("");
  console.log(ok ? "All runtime checks passed." : "Some runtime checks failed.");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
