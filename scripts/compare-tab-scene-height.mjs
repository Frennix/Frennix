#!/usr/bin/env node
/** Compare baseline vs tab-scene-height isolate on WebKit. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, ".env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data: profile } = await sb.from("profiles").select("*").eq("username", "bfitjourney").single();
const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const storageKey = `sb-${ref}-auth-token`;

const pwModule = await import(pathToFileURL(playwrightPath).href);
const { webkit, devices } = pwModule.default ?? pwModule;

async function run(flag) {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newContext({ ...devices["iPhone 13"] }).then((c) => c.newPage());
  const url =
    flag === "baseline" ? "http://127.0.0.1:3456" : "http://127.0.0.1:3456/?feedIsolate=tab-scene-height";

  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (!u.includes(host)) return route.continue();
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (u.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: "t",
          refresh_token: "r",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: profile.id, email: "b@t.local" },
        }),
      });
    }
    if (u.includes("/rest/v1/profiles")) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify(profile) });
    }
    return route.fulfill({ status: 200, headers, body: "[]" });
  });

  await page.addInitScript(
    ({ key, prof, iso }) => {
      if (iso) sessionStorage.setItem("frennix:feed-isolate", iso);
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: prof.id, profile: prof, cachedAt: Date.now() })
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "t",
          refresh_token: "r",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: prof.id, email: "b@t.local" },
        })
      );
    },
    { key: storageKey, prof: profile, iso: flag === "baseline" ? "" : "tab-scene-height" }
  );

  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(18_000);

  const state = await page.evaluate(() => {
    const scene = document.getElementById("feed-tab-scene");
    const feed = document.getElementById("feed-root-container");
    return {
      feedTabH: scene ? Math.round(scene.getBoundingClientRect().height) : -1,
      feedRootH: feed ? Math.round(feed.getBoundingClientRect().height) : -1,
      sceneHeightStyle: scene ? getComputedStyle(scene).height : null,
      body: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 100),
    };
  });
  await browser.close();
  return state;
}

for (const flag of ["baseline", "tab-scene-height"]) {
  const s = await run(flag);
  console.log(`${flag}: feedTabH=${s.feedTabH} feedRootH=${s.feedRootH} cssHeight=${s.sceneHeightStyle} text="${s.body}"`);
}
