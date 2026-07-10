#!/usr/bin/env node
/**
 * Verify local dist eliminates silent black screen after login.
 * Tests Chrome + WebKit (Safari simulation) against a running static server.
 *
 * Usage: node scripts/verify-local-startup-fix.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrl = (process.argv[2] ?? "http://127.0.0.1:4173").replace(/\/$/, "");

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

function mockProfile(userId, row) {
  const now = new Date().toISOString();
  return {
    id: userId,
    username: row.username ?? "testuser",
    display_name: row.display_name ?? row.username ?? "Test User",
    avatar_url: null,
    bio: null,
    fitness_goals: ["strength"],
    activities: ["running"],
    city: "Austin",
    visibility: "public",
    matching_enabled: true,
    gender: "male",
    match_preference: "any",
    is_premium: false,
    onboarding_complete: Boolean(row.onboarding_complete),
    created_at: now,
    updated_at: now,
  };
}

async function registerMocks(page, env, userId, profileRow) {
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();
    const method = route.request().method();
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...headers, "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "*" },
        body: "",
      });
    }
    if (url.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: `${profileRow.username}@test.local` },
        }),
      });
    }
    if (url.includes("/rest/v1/profiles")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(mockProfile(userId, profileRow)),
      });
    }
    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify([
          {
            id: "post-1",
            author_id: userId,
            content: "Local startup fix validation",
            post_type: "text",
            created_at: new Date().toISOString(),
            author: mockProfile(userId, profileRow),
          },
        ]),
      });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  return page.addInitScript(
    ({ storageKey, uid, profile }) => {
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: `${profile.username}@test.local` },
        })
      );
    },
    {
      storageKey: `sb-${ref}-auth-token`,
      uid: userId,
      profile: mockProfile(userId, profileRow),
    }
  );
}

async function readState(page) {
  return page.evaluate(() => {
    function rectVisible(id) {
      const el = document.getElementById(id);
      if (!el) return { present: false, visible: false, h: 0 };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) >= 0.05 &&
        rect.height >= 40 &&
        rect.width >= 20;
      return { present: true, visible, h: Math.round(rect.height) };
    }

    const boot = document.getElementById("frennix-boot-shell");
    const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();
    const trace = window.__FRENNIX_MOUNT_TRACE__ ?? [];

    const hasFeed =
      /Local startup fix validation|Share workout|STORIES/i.test(bodyText) &&
      (rectVisible("feed-root-container").visible || rectVisible("feed-tab-scene").visible);
    const hasDiagnostic =
      /Frennix could not finish loading|Account loading stalled|We're having trouble loading your account/i.test(
        bodyText
      ) &&
      (rectVisible("web-authenticated-startup-fallback").visible ||
        rectVisible("frennix-startup-failure-overlay").visible);
    const hasOnboarding = /Set up profile/i.test(bodyText) && rectVisible("onboarding-screen").visible;
    const hasLogin = /Welcome back|Sign in/i.test(bodyText) && rectVisible("auth-login-screen").visible;
    const hasRetry = rectVisible("startup-retry-screen").visible;

    const silentBlack =
      bodyText.length < 30 &&
      !hasFeed &&
      !hasDiagnostic &&
      !hasOnboarding &&
      !hasLogin &&
      !hasRetry &&
      (!boot || getComputedStyle(boot).display === "none");

    return {
      href: location.pathname,
      bodyText: bodyText.slice(0, 180),
      bootVisible: Boolean(boot && getComputedStyle(boot).display !== "none"),
      hasFeed,
      hasDiagnostic,
      hasOnboarding,
      hasLogin,
      hasRetry,
      silentBlack,
      feedRoot: rectVisible("feed-root-container"),
      feedTab: rectVisible("feed-tab-scene"),
      webFallback: rectVisible("web-authenticated-startup-fallback"),
      inlineOverlay: rectVisible("frennix-startup-failure-overlay"),
      traceTail: trace.slice(-10).map((e) => e.id),
      traceGap: (() => {
        const expected = [
          "entry:module-load",
          "entry:createRoot:before",
          "auth-provider:mounted",
          "stack:mounted",
          "feed-route:mounted",
        ];
        const seen = new Set(trace.map((e) => e.id));
        return expected.find((id) => !seen.has(id)) ?? null;
      })(),
    };
  });
}

async function launchBrowser(pw, name) {
  if (name === "webkit") {
    try {
      return await pw.webkit.launch({ headless: true });
    } catch {
      return null;
    }
  }
  try {
    return await pw.chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    try {
      return await pw.chromium.launch({ headless: true });
    } catch {
      return null;
    }
  }
}

const env = loadEnv();
const pw = await import(pathToFileURL(playwrightPath).href).then((m) => m.default ?? m);
const userId = "ae95ed3e-0000-4000-8000-000000000001";
const profileRow = { username: "jaimacneil", onboarding_complete: true, display_name: "Jai" };

let allPass = true;

for (const browserName of ["chromium", "webkit"]) {
  const browser = await launchBrowser(pw, browserName);
  if (!browser) {
    console.log(`SKIP ${browserName} — browser binary not available`);
    continue;
  }

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await registerMocks(page, env, userId, profileRow);
  await seedSession(page, env, userId, profileRow);

  await page.goto(baseUrl, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(12_000);

  const state = await readState(page);
  const ok = !state.silentBlack && (state.hasFeed || state.hasDiagnostic || state.hasOnboarding || state.hasLogin || state.hasRetry);

  console.log(`\n=== ${browserName.toUpperCase()} ===`);
  console.log(JSON.stringify(state, null, 2));
  if (errors.length) console.log("pageerrors:", errors.join(" | "));

  if (state.silentBlack) {
    console.log(`FAIL ${browserName} — SILENT BLACK SCREEN`);
    console.log(`First missing startup phase: ${state.traceGap ?? "unknown"}`);
    allPass = false;
  } else if (state.hasFeed) {
    console.log(`PASS ${browserName} — Feed rendered`);
  } else if (state.hasDiagnostic) {
    console.log(`PASS ${browserName} — Diagnostic screen visible (no silent black)`);
  } else if (state.hasOnboarding || state.hasLogin || state.hasRetry) {
    console.log(`PASS ${browserName} — Visible destination: ${state.hasOnboarding ? "onboarding" : state.hasLogin ? "login" : "retry"}`);
  } else {
    console.log(`FAIL ${browserName} — No visible destination`);
    allPass = false;
  }

  await browser.close();
}

console.log(`\n=== RESULT: ${allPass ? "PASS" : "FAIL"} ===`);
process.exit(allPass ? 0 : 1);
