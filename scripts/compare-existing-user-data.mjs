#!/usr/bin/env node
/**
 * Compare existing-user account data and post-login behavior.
 * Fetches REAL profiles from Supabase, then tests production post-login per user.
 *
 * Usage: node scripts/compare-existing-user-data.mjs [baseUrl]
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
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i)] = line.slice(i + 1).trim();
    }
  }
  return env;
}

function auditProfile(p) {
  const issues = [];
  if (!p) return ["no_profile"];
  if (p.onboarding_complete !== true) issues.push(`onboarding=${p.onboarding_complete}`);
  if (!p.username) issues.push("null_username");
  if (!p.display_name) issues.push("null_display_name");
  if (p.fitness_goals == null) issues.push("null_goals");
  else if (!Array.isArray(p.fitness_goals)) issues.push(`goals_type=${typeof p.fitness_goals}`);
  else if (p.fitness_goals.length === 0) issues.push("empty_goals");
  if (p.activities == null) issues.push("null_activities");
  else if (!Array.isArray(p.activities)) issues.push(`activities_type=${typeof p.activities}`);
  else if (p.activities.length === 0) issues.push("empty_activities");
  if (p.avatar_url && !/^https?:\/\//i.test(p.avatar_url)) issues.push("bad_avatar_url");
  return issues;
}

function registerMocks(page, env, { userId, profileRow, corruptCache }) {
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();
    const method = route.request().method();
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...headers, "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS", "access-control-allow-headers": "*" },
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
      return route.fulfill({ status: 200, headers, body: JSON.stringify(profileRow) });
    }
    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({ status: 200, headers, body: "[]" });
    }
    if (method === "HEAD") {
      return route.fulfill({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });
}

function seedSession(page, env, userId, profileRow, { corruptCache } = {}) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const key = `sb-${ref}-auth-token`;
  const cacheProfile = corruptCache ? { ...profileRow, ...corruptCache } : profileRow;
  return page.addInitScript(
    ({ storageKey, uid, profile, corrupt }) => {
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
      if (corrupt) sessionStorage.setItem("frennix:corrupt-cache-test", "1");
    },
    { storageKey: key, uid: userId, profile: cacheProfile, corrupt: Boolean(corruptCache) }
  );
}

async function testLogin(page, label) {
  const state = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 180),
    hasFeed: /Share workout|STORIES/i.test(document.body.innerText),
    hasOnboarding: /Set up profile/i.test(document.body.innerText),
    hasFallback: /We're having trouble loading your account/i.test(document.body.innerText),
    blackOnly: document.body.innerText.replace(/\s+/g, "").length < 20,
    markers: {
      feedTab: Boolean(document.getElementById("feed-tab-scene")),
      onboarding: Boolean(document.getElementById("onboarding-screen")),
      fallback: Boolean(document.getElementById("authenticated-startup-fallback")),
    },
    errors: window.__FRENNIX_PAGE_ERRORS__ ?? [],
  }));
  const ok = !state.blackOnly && (state.hasFeed || state.hasOnboarding || state.hasFallback);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`       ${state.text.slice(0, 90)} | markers=${JSON.stringify(state.markers)}`);
  if (state.errors.length) console.log(`       errors: ${state.errors.slice(0, 2).join(" | ")}`);
  return ok;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const usernames = ["jaimacneil", "agabrielle", "bfitjourney", "sxm", "melissa", "nadiasgrind"];
  const { data: profiles } = await sb.from("profiles").select("*").in("username", usernames);
  const byName = Object.fromEntries((profiles ?? []).map((p) => [p.username, p]));

  console.log(`\n=== EXISTING USER DATA COMPARE ===`);
  console.log(`URL: ${baseUrl}\n`);

  for (const name of usernames) {
    const p = byName[name];
    const issues = auditProfile(p);
    console.log(`@${name}: ${p ? "found" : "MISSING"} ${issues.length ? `ISSUES=[${issues.join(", ")}]` : "ok"}`);
  }

  const pw = await import(pathToFileURL(playwrightPath).href);
  const browser = await (async () => {
    try {
      return pw.chromium.launch({ headless: true });
    } catch {
      return pw.chromium.launch({ channel: "chrome", headless: true });
    }
  })();

  const results = [];
  for (const name of usernames) {
    const profileRow = byName[name];
    if (!profileRow) continue;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (e) => console.log(`  pageerror @${name}: ${e.message}`));
    await registerMocks(page, env, { userId: profileRow.id, profileRow });
    await seedSession(page, env, profileRow.id, profileRow);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(6000);
    results.push(await testLogin(page, `Real profile @${name} → post-login`));
    await page.close();
  }

  // Corrupt cache scenarios (legacy client data)
  const corruptCases = [
    { name: "jaimacneil", corrupt: { fitness_goals: null, activities: null } },
    { name: "jaimacneil", corrupt: { onboarding_complete: true, fitness_goals: [], activities: [] } },
    { name: "agabrielle", corrupt: { fitness_goals: "strength", activities: "running" } },
  ];
  for (const { name, corrupt } of corruptCases) {
    const profileRow = byName[name];
    if (!profileRow) continue;
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await registerMocks(page, env, { userId: profileRow.id, profileRow });
    await seedSession(page, env, profileRow.id, profileRow, { corruptCache: corrupt });
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(6000);
    results.push(
      await testLogin(page, `Corrupt cache @${name} (${Object.keys(corrupt).join(",")}) → repair path`)
    );
    await page.close();
  }

  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n=== COMPARE: ${passed}/${results.length} post-login checks passed ===\n`);
  if (passed < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
