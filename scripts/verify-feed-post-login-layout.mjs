#!/usr/bin/env node
/**
 * Regression: Feed tab must render with non-zero height after login.
 * Covers WebKit (iPhone Safari), Desktop Safari, Chrome, and PWA standalone.
 *
 * Usage:
 *   pnpm build:web
 *   node scripts/verify-feed-post-login-layout.mjs [baseUrl]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const baseUrlArg = process.argv[2];

const USERS = ["bfitjourney", "xochi", "kmsp"];
const MIN_SCENE_HEIGHT = 80;

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
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

async function loadProfiles(env) {
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { data: profiles } = await sb.from("profiles").select("*").in("username", USERS);
  return Object.fromEntries((profiles ?? []).map((p) => [p.username, p]));
}

function registerMocks(page, env, { userId, profileRow, posts }) {
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();

    const method = route.request().method();
    const accept = route.request().headers().accept ?? "";
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
    }

    if (url.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: "layout-test-token",
          refresh_token: "layout-test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: `${profileRow.username}@layout.test` },
        }),
      });
    }

    if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
      const body = accept.includes("object") ? profileRow : [profileRow];
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    }

    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify(posts) });
    }

    if (method === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": `*/${posts.length}` },
        body: "",
      });
    }

    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow, { pwa = false } = {}) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  return page.addInitScript(
    ({ key, uid, profile, standalone }) => {
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "layout-test-token",
          refresh_token: "layout-test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: `${profile.username}@layout.test` },
        })
      );
      if (standalone) {
        Object.defineProperty(window.navigator, "standalone", {
          configurable: true,
          get: () => true,
        });
      }
    },
    { key: storageKey, uid: userId, profile: profileRow, standalone: pwa }
  );
}

async function evaluateLayout(page) {
  return page.evaluate((minH) => {
    const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    const scene = document.getElementById("feed-tab-scene");
    const feedRoot = document.getElementById("feed-root-container");
    const sceneH = scene ? Math.round(scene.getBoundingClientRect().height) : 0;
    const feedRootH = feedRoot ? Math.round(feedRoot.getBoundingClientRect().height) : 0;
    const sceneMinH = scene ? getComputedStyle(scene).minHeight : "missing";
    const hasFeedContent =
      /STORIES|Share workout|Your feed is ready|Could not load feed|section could not load/i.test(
        text
      );
    const onLogin = /Welcome back|Sign in/i.test(text);
    const layout = window.__FRENNIX_FEED_LAYOUT__ ?? null;

    return {
      sceneH,
      feedRootH,
      sceneMinH,
      hasFeedContent,
      onLogin,
      layoutIssue: layout?.issue ?? null,
      text: text.slice(0, 120),
      feedTabMounted: Boolean(document.getElementById("feed-tab-scene")),
      traceTail: (window.__FRENNIX_MOUNT_TRACE__ ?? []).slice(-6).map((e) => e.id),
    };
  }, MIN_SCENE_HEIGHT);
}

const CONTEXTS = [
  {
    id: "webkit-iphone-safari",
    label: "iPhone Safari (WebKit)",
    async context(browser) {
      const pw = await import(pathToFileURL(playwrightPath).href);
      const { devices } = pw.default ?? pw;
      return browser.newContext({ ...devices["iPhone 13"], locale: "en-US" });
    },
  },
  {
    id: "webkit-desktop-safari",
    label: "Desktop Safari (WebKit)",
    async context(browser) {
      return browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      });
    },
  },
  {
    id: "chrome",
    label: "Chrome",
    async context(browser) {
      const pw = await import(pathToFileURL(playwrightPath).href);
      const { devices } = pw.default ?? pw;
      return browser.newContext({ ...devices["Pixel 5"], locale: "en-US" });
    },
  },
  {
    id: "pwa-iphone",
    label: "iPhone PWA standalone (WebKit)",
    async context(browser) {
      const pw = await import(pathToFileURL(playwrightPath).href);
      const { devices } = pw.default ?? pw;
      return browser.newContext({
        ...devices["iPhone 13"],
        locale: "en-US",
      });
    },
    pwa: true,
  },
];

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: pnpm build:web");
  }

  const env = loadEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  }

  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  if (!html.includes("#feed-tab-scene")) {
    throw new Error("dist/index.html missing resilient #feed-tab-scene CSS");
  }

  const profiles = await loadProfiles(env);
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  let baseUrl = baseUrlArg;
  let server;
  if (!baseUrl) {
    ({ server, baseUrl } = await startStaticServer());
  }

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit, chromium } = pwModule.default ?? pwModule;

  console.log(`\n=== Feed post-login layout regression ===`);
  console.log(`URL: ${baseUrl}\n`);

  const failures = [];

  for (const ctxDef of CONTEXTS) {
    const browser =
      ctxDef.id === "chrome" ? await chromium.launch({ headless: true }) : await webkit.launch({ headless: true });

    for (const username of USERS) {
      const profileRow = profiles[username];
      if (!profileRow) {
        console.log(`SKIP ${ctxDef.id} @${username} — no profile`);
        continue;
      }

      const { data: posts } = await sb
        .from("posts")
        .select("*, author:profiles!posts_author_id_fkey(*)")
        .eq("author_id", profileRow.id)
        .limit(20);

      const context = await ctxDef.context(browser);
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await registerMocks(page, env, {
        userId: profileRow.id,
        profileRow,
        posts: (posts ?? []).map((p) => ({
          ...p,
          liked_by_me: false,
          like_count: 0,
          comment_count: 0,
          saved_by_me: false,
          reactions: [],
          preview_comments: [],
        })),
      });
      await seedSession(page, env, profileRow.id, profileRow, { pwa: Boolean(ctxDef.pwa) });

      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForTimeout(14_000);

      const state = await evaluateLayout(page);
      const ok =
        !state.onLogin &&
        state.feedTabMounted &&
        state.sceneH > MIN_SCENE_HEIGHT &&
        state.hasFeedContent &&
        pageErrors.length === 0;

      const status = ok ? "PASS" : "FAIL";
      console.log(
        `${status}  ${ctxDef.label}  @${username}  sceneH=${state.sceneH} feedRootH=${state.feedRootH} minH=${state.sceneMinH}`
      );
      if (!ok) {
        console.log(`       text="${state.text}" errors=${pageErrors.slice(0, 1).join("; ")}`);
        failures.push({ ctx: ctxDef.id, username, state, pageErrors });
      }

      await context.close();
    }

    await browser.close();
  }

  if (server) server.close();

  console.log(`\n=== Summary ===`);
  if (failures.length) {
    console.error(`FAILED ${failures.length} scenario(s)`);
    process.exit(1);
  }
  console.log("All feed post-login layout checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
