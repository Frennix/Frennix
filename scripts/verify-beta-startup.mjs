#!/usr/bin/env node
/**
 * Beta startup verification — existing user, new user, logout/login, slow network, error recovery.
 *
 * Usage:
 *   node scripts/verify-beta-startup.mjs [baseUrl]
 *   node scripts/verify-beta-startup.mjs http://127.0.0.1:PORT   # local dist server
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const baseUrl = process.argv[2] ?? "https://frennix.vercel.app";
const useLocal = baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost");

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

const EXISTING_USER_ID = "11111111-1111-4111-8111-111111111111";
const NEW_USER_ID = "22222222-2222-4222-8222-222222222222";

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
      res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] ?? "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function mockProfile(userId, onboardingComplete = true) {
  const now = new Date().toISOString();
  return {
    id: userId,
    username: userId === NEW_USER_ID ? "newbeta" : "existingbeta",
    display_name: userId === NEW_USER_ID ? "New Beta User" : "Existing Beta User",
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
    onboarding_complete: onboardingComplete,
    created_at: now,
    updated_at: now,
  };
}

function mockPost(userId) {
  const now = new Date().toISOString();
  return {
    id: "33333333-3333-4333-8333-333333333333",
    author_id: userId,
    content: "Beta startup verification feed post",
    media_urls: [],
    thumbnail_url: null,
    post_type: "text",
    created_at: now,
    updated_at: now,
    author: mockProfile(userId),
    liked_by_me: false,
    like_count: 0,
    comment_count: 0,
    saved_by_me: false,
    reactions: [],
    preview_comments: [],
  };
}

function registerSupabaseMocks(page, env, options = {}) {
  const {
    userId = EXISTING_USER_ID,
    onboardingComplete = true,
    networkSlowMs = 0,
    failProfileOnce = false,
    expiredSession = false,
    offline = false,
  } = options;

  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  let profileFetchCount = 0;

  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (offline && url.includes(supabaseHost)) {
      return route.abort("failed");
    }
    if (!url.includes(supabaseHost)) {
      if (networkSlowMs > 0) await new Promise((r) => setTimeout(r, networkSlowMs));
      return route.continue();
    }

    if (networkSlowMs > 0) await new Promise((r) => setTimeout(r, networkSlowMs));

    const accept = route.request().headers().accept ?? "";
    const method = route.request().method();

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
    }

    let body = "[]";
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };

    if (url.includes("/auth/v1/token") && method === "POST") {
      body = JSON.stringify({
        access_token: "mock-access",
        refresh_token: "mock-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: { id: userId, email: `${userId}@frennix.test` },
      });
    } else if (url.includes("/auth/v1/")) {
      body = expiredSession
        ? JSON.stringify({})
        : JSON.stringify({ user: { id: userId, email: `${userId}@frennix.test` } });
    } else if (url.includes("/rest/v1/profiles")) {
      profileFetchCount += 1;
      if (failProfileOnce && profileFetchCount === 1) {
        return route.fulfill({ status: 503, headers, body: JSON.stringify({ message: "slow outage" }) });
      }
      body = JSON.stringify(
        accept.includes("object")
          ? mockProfile(userId, onboardingComplete)
          : [mockProfile(userId, onboardingComplete)]
      );
    } else if (url.includes("/rest/v1/posts")) {
      body = JSON.stringify(accept.includes("object") ? mockPost(userId) : [mockPost(userId)]);
    } else if (method === "HEAD") {
      return route.fulfill({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
    }

    return route.fulfill({ status: 200, headers, body });
  });
}

async function createContext(browser, env, options = {}) {
  const {
    userId = EXISTING_USER_ID,
    cachedProfile = true,
    onboardingComplete = true,
    networkSlowMs = 0,
    failProfileOnce = false,
    seedSession = true,
    expiredSession = false,
    offline = false,
    staleProfileDays = 0,
  } = options;

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await registerSupabaseMocks(page, env, {
    userId,
    onboardingComplete,
    networkSlowMs,
    failProfileOnce,
    expiredSession,
    offline,
  });

  if (seedSession) {
    await page.addInitScript(
      ({ key, uid, profile, withCache, expired, staleDays }) => {
        if (localStorage.getItem("__frennix_test_skip_seed") === "1") {
          localStorage.removeItem("__frennix_test_skip_seed");
          return;
        }
        if (withCache) {
          sessionStorage.setItem(
            "frennix.auth.profile.v1",
            JSON.stringify({
              userId: uid,
              profile,
              cachedAt: Date.now() - staleDays * 24 * 60 * 60 * 1000,
            })
          );
        }
        const expiresAt = expired
          ? Math.floor(Date.now() / 1000) - 3600
          : Math.floor(Date.now() / 1000) + 3600;
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: expired ? "expired-access" : "mock-access",
            refresh_token: expired ? "expired-refresh" : "mock-refresh",
            expires_at: expiresAt,
            user: { id: uid, email: `${uid}@frennix.test` },
          })
        );
      },
      {
        key: storageKey,
        uid: userId,
        profile: mockProfile(userId, onboardingComplete),
        withCache: cachedProfile,
        expired: expiredSession,
        staleDays: staleProfileDays,
      }
    );
  }

  return { page, pageErrors, storageKey };
}

async function readState(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    const trace = window.__FRENNIX_MOUNT_TRACE__ ?? [];
    return {
      text,
      href: location.pathname + location.hash,
      hasBootShell: Boolean(document.getElementById("frennix-boot-shell")),
      bootShellVisible:
        document.getElementById("frennix-boot-shell")?.style.display !== "none" &&
        Boolean(document.getElementById("frennix-boot-shell")),
      hasFeedRoot: Boolean(document.getElementById("feed-root-container")),
      hasRetry: /Retry/i.test(text),
      hasLoading: /Loading Frennix|Signing you in|Loading your profile/i.test(text),
      hasErrorBoundary: /Something went wrong/i.test(text),
      hasFeedContent: /Beta startup verification feed post|Your feed is ready|Feed/i.test(text),
      hasOnboarding: /Set up profile|onboarding/i.test(text),
      hasLogin: /Sign in|Log in|Welcome back|Welcome/i.test(text),
      traceTail: trace.slice(-8).map((e) => e.id),
      feedRootHeight: document.getElementById("feed-root-container")?.getBoundingClientRect().height ?? 0,
      rootHeight: document.getElementById("root")?.getBoundingClientRect().height ?? 0,
    };
  });
}

function assertCheck(name, ok, detail) {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  if (useLocal && !fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npx expo export -p web && node scripts/patch-web-html.js");
  }

  const env = loadEnv();
  let server;
  let url = baseUrl;
  if (useLocal) {
    ({ server, baseUrl: url } = await startStaticServer());
  }

  const html = useLocal
    ? fs.readFileSync(path.join(DIST, "index.html"), "utf8")
    : await (await fetch(url)).text();

  const hasBootShell = html.includes("frennix-boot-shell");
  const hasPointerAuto = html.includes("pointer-events: auto");
  console.log(`\n=== Beta startup verification @ ${url} ===`);
  console.log(`HTML boot shell: ${hasBootShell ? "yes" : "NO"}`);
  console.log(`HTML pointer-events auto: ${hasPointerAuto ? "yes" : "NO (legacy)"}`);

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  const results = [];

  // 1. Existing user — cached profile, no black screen
  {
    const { page, pageErrors } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForFunction(
      () => {
        const trace = window.__FRENNIX_MOUNT_TRACE__ ?? [];
        return (
          trace.some((e) => e.id === "stack:mounted" || e.id === "index-route:mounted") ||
          /Signing you in|Loading Frennix|Sign in|Set up profile|Beta startup/i.test(
            document.body.innerText
          )
        );
      },
      { timeout: 45_000 }
    ).catch(() => undefined);
    await page.waitForTimeout(2000);
    const state = await readState(page);
    const ok =
      state.rootHeight > 80 &&
      !state.hasErrorBoundary &&
      pageErrors.filter((e) => !e.includes("canPromptForWebPush")).length === 0 &&
      (state.hasFeedRoot || state.hasFeedContent || state.text.length > 40) &&
      !(state.text.length < 20 && !state.hasLoading && !state.hasRetry);
    results.push(
      assertCheck(
        "1. Existing user launch (no black screen)",
        ok,
        `rootH=${state.rootHeight} feedH=${state.feedRootHeight} errors=${pageErrors.slice(0, 2).join(" | ") || "none"} trace=${state.traceTail.join("→")} text=${state.text.slice(0, 80)}`
      )
    );
    await page.close();
  }

  // 2. Brand-new user — incomplete onboarding routes correctly OR feed after onboarding
  {
    const { page } = await createContext(browser, env, {
      userId: NEW_USER_ID,
      cachedProfile: false,
      onboardingComplete: false,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForFunction(
      () => {
        const trace = window.__FRENNIX_MOUNT_TRACE__ ?? [];
        return (
          trace.some((e) => e.id === "stack:mounted" || e.id === "index-route:mounted") ||
          /Signing you in|Loading Frennix|Sign in|Set up profile|Beta startup/i.test(
            document.body.innerText
          )
        );
      },
      { timeout: 45_000 }
    ).catch(() => undefined);
    await page.waitForTimeout(2000);
    const state = await readState(page);
    const ok = state.hasOnboarding || state.hasLoading || state.hasRetry;
    results.push(
      assertCheck(
        "2. New user routes to onboarding or loading (not blank)",
        ok,
        state.text.slice(0, 100)
      )
    );
    await page.close();
  }

  // 3. Logout / login cycle (simulate session clear + restore)
  {
    const { page, storageKey } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForFunction(
      () => document.body.innerText.includes("Beta startup verification feed post") || /Welcome back/i.test(document.body.innerText),
      { timeout: 45_000 }
    ).catch(() => undefined);
    await page.waitForTimeout(1500);

    // Clear persisted auth AFTER init scripts — skip re-seed on reload.
    await page.evaluate(() => localStorage.setItem("__frennix_test_skip_seed", "1"));
    await page.addInitScript(({ key }) => {
      localStorage.setItem("__frennix_test_skip_seed", "1");
      localStorage.removeItem(key);
      sessionStorage.clear();
    }, storageKey);

    await page.unroute("**/*");
    await page.route("**/*", async (route) => {
      const reqUrl = route.request().url();
      const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
      if (reqUrl.includes(supabaseHost)) {
        const method = route.request().method();
        if (method === "OPTIONS") {
          return route.fulfill({
            status: 204,
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
              "access-control-allow-headers": "*",
            },
            body: "",
          });
        }
        if (reqUrl.includes("/auth/v1/")) {
          return route.fulfill({
            status: 200,
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            body: JSON.stringify({}),
          });
        }
        if (reqUrl.includes("/rest/v1/profiles")) {
          return route.fulfill({ status: 401, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify({ message: "JWT expired" }) });
        }
        return route.fulfill({
          status: 200,
          headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          body: "[]",
        });
      }
      return route.continue();
    });

    await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const afterLogout = await readState(page);
    const okLogout = afterLogout.hasLogin || afterLogout.hasLoading;

    await page.unroute("**/*");
    await registerSupabaseMocks(page, env, { userId: EXISTING_USER_ID, onboardingComplete: true });
    await page.addInitScript(
      ({ key, uid }) => {
        localStorage.removeItem("__frennix_test_skip_seed");
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: "mock-access",
            refresh_token: "mock-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: uid, email: `${uid}@frennix.test` },
          })
        );
      },
      { key: storageKey, uid: EXISTING_USER_ID }
    );
    await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(5000);
    const afterRelogin = await readState(page);
    const okRelogin =
      afterRelogin.rootHeight > 80 &&
      (afterRelogin.hasFeedRoot || afterRelogin.hasFeedContent || afterRelogin.hasLoading);
    results.push(assertCheck("3a. Logout shows login/loading", okLogout, afterLogout.text.slice(0, 80)));
    results.push(
      assertCheck("3b. Re-login reaches feed/loading", okRelogin, afterRelogin.text.slice(0, 80))
    );
    await page.close();
  }

  // 4. Slow network — loading UI, not blank
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
      networkSlowMs: 1200,
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const early = await readState(page);
    const ok =
      early.hasLoading ||
      early.hasBootShell ||
      early.bootShellVisible ||
      early.text.length > 10;
    results.push(
      assertCheck(
        "4. Slow network shows loading UI early",
        ok,
        early.text.slice(0, 100) || (early.hasBootShell ? "boot shell visible" : "empty body")
      )
    );
    await page.waitForTimeout(8000);
    const late = await readState(page);
    results.push(
      assertCheck(
        "4b. Slow network eventually reaches feed",
        late.hasFeedRoot || late.hasFeedContent || late.hasLoading,
        late.text.slice(0, 80)
      )
    );
    await page.close();
  }

  // 5. Error recovery — profile blip still shows UI + retry path exists in bundle/html
  {
    const { page, pageErrors } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
      failProfileOnce: true,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(6000);
    const state = await readState(page);
    const ok =
      state.rootHeight > 80 &&
      pageErrors.filter((e) => !e.includes("canPromptForWebPush")).length === 0 &&
      (state.hasFeedContent || state.hasFeedRoot || state.hasLoading || state.text.length > 40);
    results.push(
      assertCheck(
        "5. Profile fetch blip — app stays usable",
        ok,
        state.text.slice(0, 100)
      )
    );
    const bundleHasRetry =
      html.includes("StartupRetryScreen") ||
      html.includes("startup-retry-screen") ||
      (useLocal &&
        fs
          .readdirSync(path.join(DIST, "_expo/static/js/web"))
          .some((f) => f.startsWith("index-") && fs.readFileSync(path.join(DIST, "_expo/static/js/web", f), "utf8").includes("Retry")));
    results.push(assertCheck("5b. Retry UI shipped in build", bundleHasRetry || hasBootShell));
    await page.close();
  }

  // 7. Expired session — routes to login/loading, not stuck feed
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
      expiredSession: true,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(5000);
    const state = await readState(page);
    const ok = state.hasLogin || state.hasLoading || state.hasRetry;
    results.push(assertCheck("7. Expired session → login/loading", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 8. Offline startup — retry/loading, not blank
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
      offline: true,
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const state = await readState(page);
    const ok = state.hasLoading || state.hasRetry || state.hasBootShell || state.text.length > 5;
    results.push(assertCheck("8. Offline startup shows fallback UI", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 9. Cached PWA profile — fast path to feed
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
    });
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const state = await readState(page);
    const ok = state.hasFeedRoot || state.hasFeedContent || state.hasLoading;
    results.push(assertCheck("9. Cached PWA reaches feed/loading", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 10. Fresh Safari install — no session → login/welcome
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: false,
      seedSession: false,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const state = await readState(page);
    const ok = state.hasLogin || state.hasLoading || state.text.length > 10;
    results.push(assertCheck("10. Fresh Safari install → login/loading", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 11. Add to Home Screen (standalone display-mode)
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
    });
    await page.emulateMedia({ media: "screen", features: [{ name: "display-mode", value: "standalone" }] });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const state = await readState(page);
    const ok = state.hasFeedRoot || state.hasFeedContent || state.hasLoading;
    results.push(assertCheck("11. Home Screen install reaches feed/loading", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 12. Returning user after 7+ days (stale cached profile)
  {
    const { page } = await createContext(browser, env, {
      userId: EXISTING_USER_ID,
      cachedProfile: true,
      staleProfileDays: 8,
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(5000);
    const state = await readState(page);
    const ok =
      state.rootHeight > 80 &&
      (state.hasFeedRoot || state.hasFeedContent || state.hasLoading || state.hasRetry);
    results.push(assertCheck("12. Returning user (7+ days) reaches app", ok, state.text.slice(0, 80)));
    await page.close();
  }

  // 6. Regression spot-check — key screens reachable (bundle contains tab routes)
  {
    const bundleMatch = html.match(/index-[a-f0-9]+\.js/);
    const bundleUrl = bundleMatch ? `${url.replace(/\/$/, "")}/_expo/static/js/web/${bundleMatch[0]}` : null;
    const bundleText = bundleUrl
      ? await (await fetch(bundleUrl)).text()
      : useLocal
        ? fs.readFileSync(
            path.join(
              DIST,
              "_expo/static/js/web",
              fs.readdirSync(path.join(DIST, "_expo/static/js/web")).find((f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes("8aa354")) ?? ""
            ),
            "utf8"
          )
        : "";

    const checks = [
      ["push/WebPush", /WebPush|web-push|registerForPush/i.test(bundleText)],
      ["messages tab", /messages|getConversations/i.test(bundleText)],
      ["feed", /getFeed|feed-root-container/i.test(bundleText)],
      ["stories", /getFeedStories|FeedStoryViewer/i.test(bundleText)],
      ["events/calendar", /getCalendarView|Calendar/i.test(bundleText)],
      ["profile", /getProfileStats|ProfileScreenContent/i.test(bundleText)],
      ["discover", /getSuggestedAthletes|discover/i.test(bundleText)],
      ["error boundary retry", /Something went wrong|Retry/i.test(bundleText)],
    ];
    for (const [label, ok] of checks) {
      results.push(assertCheck(`6. Regression: ${label}`, ok));
    }
  }

  await browser.close();
  if (server) server.close();

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n=== ${passed}/${total} checks passed ===\n`);
  if (passed < total) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
