#!/usr/bin/env node
/** Focused WebKit bisect — fresh context per flag, navigates to Feed tab. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3456").replace(/\/$/, "");
const FLAGS = ["baseline", "stories", "feed-list", "post-cards", "video", "bottom-tabs", "fab", "tab-scene-height"];

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
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const { data: profile } = await sb.from("profiles").select("*").eq("username", "bfitjourney").single();
  const { data: posts } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(*)")
    .eq("author_id", profile.id)
    .limit(20);

  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit, devices } = pwModule.default ?? pwModule;

  for (const flag of FLAGS) {
    const browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    const gotoUrl = flag === "baseline" ? baseUrl : `${baseUrl}/?feedIsolate=${flag}`;

    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (!url.includes(host)) return route.continue();
      const method = route.request().method();
      const accept = route.request().headers().accept ?? "";
      const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
      if (method === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: { ...headers, "access-control-allow-methods": "*" },
          body: "",
        });
      }
      if (url.includes("/auth/v1/")) {
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
      if (url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify(accept.includes("object") ? profile : [profile]),
        });
      }
      if (url.includes("/rest/v1/posts")) {
        return route.fulfill({ status: 200, headers, body: JSON.stringify(posts) });
      }
      if (method === "HEAD") {
        return route.fulfill({
          status: 200,
          headers: { ...headers, "content-range": "*/0" },
          body: "",
        });
      }
      return route.fulfill({ status: 200, headers, body: "[]" });
    });

    await page.addInitScript(
      ({ key, uid, prof }) => {
        sessionStorage.setItem(
          "frennix.auth.profile.v1",
          JSON.stringify({ userId: uid, profile: prof, cachedAt: Date.now() })
        );
        localStorage.setItem(
          key,
          JSON.stringify({
            access_token: "t",
            refresh_token: "r",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: uid, email: "b@t.local" },
          })
        );
      },
      { key: storageKey, uid: profile.id, prof: profile }
    );

    await page.goto(gotoUrl, { waitUntil: "networkidle", timeout: 90_000 });
    try {
      await page.waitForSelector("#feed-tab-scene", { timeout: 25_000 });
    } catch {
      /* may still be on login */
    }

    const feedLink = page.locator('[role="tab"][aria-selected="false"]:has-text("Feed")').first();
    if (await feedLink.count()) {
      await feedLink.click({ timeout: 5000 }).catch(() => undefined);
    } else {
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const feed = tabs.find((t) => /feed/i.test(t.textContent ?? ""));
        if (feed instanceof HTMLElement) feed.click();
      });
    }
    await page.waitForTimeout(10_000);

    const state = await page.evaluate(() => {
      const rect = (id) => document.getElementById(id)?.getBoundingClientRect().height ?? 0;
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
      const layout = window.__FRENNIX_FEED_LAYOUT__ ?? null;
      return {
        text: text.slice(0, 100),
        feedRoot: Math.round(rect("feed-root-container")),
        feedScroll: Math.round(rect("feed-scroll-list")),
        feedTab: Boolean(document.getElementById("feed-tab-scene")),
        login: /Welcome back|Sign in/i.test(text),
        layoutIssue: layout?.issue ?? null,
        layoutSummary: layout?.summary ?? null,
      };
    });

    const status =
      state.login
        ? "LOGIN"
        : state.feedRoot > 80
          ? "VISIBLE"
          : state.feedTab
            ? "BLACK-ZERO-HEIGHT"
            : "NO-TABS";

    console.log(
      `${flag}: ${status} feedH=${state.feedRoot}/${state.feedScroll} layout=${state.layoutIssue ?? "ok"} text="${state.text.slice(0, 60)}"`
    );
    if (state.layoutSummary) console.log(`  ${state.layoutSummary}`);

    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
