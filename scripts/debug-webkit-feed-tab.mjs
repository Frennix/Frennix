#!/usr/bin/env node
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
const browser = await webkit.launch({ headless: true });
const page = await browser.newContext({ ...devices["iPhone 13"] }).then((c) => c.newPage());

await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (!url.includes(host)) return route.continue();
  const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
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
    return route.fulfill({ status: 200, headers, body: JSON.stringify(profile) });
  }
  if (url.includes("/rest/v1/posts")) {
    return route.fulfill({ status: 200, headers, body: JSON.stringify(posts ?? []) });
  }
  return route.fulfill({ status: 200, headers, body: "[]" });
});

await page.addInitScript(
  ({ key, prof }) => {
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
  { key: storageKey, prof: profile }
);

await page.goto("http://127.0.0.1:3456", { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(20_000);

const dump = await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => ({
    text: (t.textContent || "").trim(),
    selected: t.getAttribute("aria-selected"),
    href: t.getAttribute("href"),
  }));
  const feedRoot = document.getElementById("feed-root-container");
  const feedScene = document.getElementById("feed-tab-scene");
  const trace = (window.__FRENNIX_MOUNT_TRACE__ || []).slice(-20).map((e) => e.id);

  const sceneNodes = Array.from(document.querySelectorAll("[data-testid], [id]"))
    .filter((el) => {
      const id = el.id;
      return (
        id === "feed-root-container" ||
        id === "feed-tab-scene" ||
        (id && id.includes("profile")) ||
        (id && id.includes("messages")) ||
        (id && id.includes("discover"))
      );
    })
    .map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        id: el.id || el.getAttribute("data-testid"),
        h: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex,
        position: style.position,
        pointerEvents: style.pointerEvents,
      };
    });

  const topElements = Array.from(document.body.querySelectorAll("*"))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 300 && rect.height > 400 && rect.top < 100;
    })
    .slice(0, 12)
    .map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id,
        class: String(el.className || "").slice(0, 40),
        h: Math.round(rect.height),
        z: style.zIndex,
        pos: style.position,
        opacity: style.opacity,
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      };
    });

  return {
    path: location.pathname + location.search,
    tabs,
    feedScene: !!feedScene,
    feedRootExists: !!feedRoot,
    feedRootH: feedRoot?.getBoundingClientRect().height ?? 0,
    feedRootDisplay: feedRoot ? getComputedStyle(feedRoot).display : null,
    feedTabSceneStyle: feedScene
      ? {
          height: getComputedStyle(feedScene).height,
          minHeight: getComputedStyle(feedScene).minHeight,
          flex: getComputedStyle(feedScene).flex,
        }
      : null,
    body: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 180),
    trace,
    sceneNodes,
    topElements,
  };
});

console.log(JSON.stringify(dump, null, 2));
await browser.close();
