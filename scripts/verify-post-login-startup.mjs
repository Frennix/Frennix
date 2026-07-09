#!/usr/bin/env node
/**
 * Post-login startup validation — tests authenticated route, not login form.
 * Uses real profile shapes from production DB when service role is available.
 *
 * Usage: node scripts/verify-post-login-startup.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrl = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");

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

async function loadRealTestUsers(env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
  const { data } = await sb
    .from("profiles")
    .select("id,username,onboarding_complete,display_name")
    .order("created_at", { ascending: false })
    .limit(30);

  const complete = (data ?? []).find((p) => p.onboarding_complete && p.username !== "user_f7b6b7c3");
  const incomplete = (data ?? []).find((p) => !p.onboarding_complete);
  const jaimacneil = (data ?? []).find((p) => p.username === "jaimacneil");

  return {
    existing: complete ?? { id: "ae95ed3e-0000-4000-8000-000000000001", username: "jaimacneil", onboarding_complete: true },
    newUser: incomplete ?? { id: "f7b6b7c3-0000-4000-8000-000000000001", username: "user_f7b6b7c3", onboarding_complete: false },
    affected: jaimacneil ?? complete,
  };
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

function registerMocks(page, env, { userId, profileRow, profileMissing = false }) {
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
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: `${profileRow.username}@test.local` },
        }),
      });
    }

    if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
      if (profileMissing) {
        return route.fulfill({
          status: 406,
          headers,
          body: JSON.stringify({ code: "PGRST116", message: "no rows" }),
        });
      }
      const profile = mockProfile(userId, profileRow);
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify(accept.includes("object") ? profile : [profile]),
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
            content: "Post-login feed validation",
            post_type: "text",
            created_at: new Date().toISOString(),
            author: mockProfile(userId, profileRow),
          },
        ]),
      });
    }

    if (method === "HEAD") {
      return route.fulfill({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
    }

    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow, { cached = true, profileMissing = false } = {}) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const key = `sb-${ref}-auth-token`;
  return page.addInitScript(
    ({ storageKey, uid, profile, withCache, missing }) => {
      if (withCache && !missing) {
        sessionStorage.setItem(
          "frennix.auth.profile.v1",
          JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
        );
      }
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
      storageKey: key,
      uid: userId,
      profile: mockProfile(userId, profileRow),
      withCache: cached,
      missing: profileMissing,
    }
  );
}

async function readPostLogin(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").trim();
    const bootShell = document.getElementById("frennix-boot-shell");
    const bootVisible = bootShell && bootShell.style.display !== "none";
    return {
      text: text.slice(0, 200),
      href: location.pathname,
      bootVisible,
      hasFeed: /Post-login feed validation|Share workout|STORIES/i.test(text),
      hasOnboarding: /Set up profile/i.test(text),
      hasStallFallback: /We're having trouble loading your account/i.test(text),
      hasLogin: /Welcome back|Sign in/i.test(text),
      hasBlackOnly: text.length < 30 && bootVisible,
      markers: {
        feedTab: Boolean(document.getElementById("feed-tab-scene")),
        onboarding: Boolean(document.getElementById("onboarding-screen")),
        retry: Boolean(document.getElementById("startup-retry-screen")),
        fallback: Boolean(document.getElementById("authenticated-startup-fallback")),
      },
      pageErrors: window.__FRENNIX_PAGE_ERRORS__ ?? [],
    };
  });
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

async function runScenario(browser, env, label, userId, profileRow, options = {}) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await registerMocks(page, env, { userId, profileRow, profileMissing: options.profileMissing });
  await seedSession(page, env, userId, profileRow, {
    cached: options.cached ?? true,
    profileMissing: options.profileMissing,
  });

  const t0 = Date.now();
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(6000);

  const state = await readPostLogin(page);
  const ms = Date.now() - t0;
  const expectFeed = Boolean(profileRow.onboarding_complete) && !options.profileMissing;
  const expectOnboarding = !profileRow.onboarding_complete || options.profileMissing;

  const ok =
    !state.hasBlackOnly &&
    !state.bootVisible &&
    errors.length === 0 &&
    (expectFeed ? state.hasFeed : expectOnboarding ? state.hasOnboarding : state.hasFeed || state.hasOnboarding);

  pass(
    label,
    ok,
    `${ms}ms | ${state.text.slice(0, 60)} | markers=${JSON.stringify(state.markers)}`
  );
  if (errors.length) console.log(`  pageerrors: ${errors.slice(0, 2).join(" | ")}`);

  await page.close();
  return ok;
}

async function main() {
  const env = loadEnv();
  const users = await loadRealTestUsers(env);
  console.log(`\n=== POST-LOGIN STARTUP VALIDATION ===`);
  console.log(`URL: ${baseUrl}`);
  console.log(`Existing user: @${users.existing.username} (${users.existing.id.slice(0, 8)})`);
  console.log(`Incomplete onboarding: @${users.newUser.username} (${users.newUser.id.slice(0, 8)})`);
  console.log(`Affected-shape user: @${users.affected.username} (${users.affected.id.slice(0, 8)})\n`);

  const pw = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pw.default ?? pw;
  const browser = await launchBrowser(chromium);
  const results = [];

  results.push(
    await runScenario(
      browser,
      env,
      "Real complete user → Feed (not black)",
      users.existing.id,
      users.existing
    )
  );

  results.push(
    await runScenario(
      browser,
      env,
      "Real incomplete user → Onboarding (not black)",
      users.newUser.id,
      users.newUser,
      { cached: false }
    )
  );

  results.push(
    await runScenario(
      browser,
      env,
      "Affected user shape (@jaimacneil) → Feed",
      users.affected.id,
      users.affected
    )
  );

  results.push(
    await runScenario(
      browser,
      env,
      "Missing profile row → Onboarding (not login loop)",
      users.newUser.id,
      { ...users.newUser, onboarding_complete: false },
      { cached: false, profileMissing: true }
    )
  );

  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`\n=== POST-LOGIN: ${passed}/${results.length} checks passed ===\n`);
  if (passed < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
