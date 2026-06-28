#!/usr/bin/env node
/**
 * Scroll isolation: ScrollView test mode vs FlatList feed on RN Web (iPhone UA).
 * Usage: node scripts/verify-feed-scroll-isolation.mjs [baseUrl]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrl = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "22222222-2222-4222-8222-222222222222";

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return {};
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

function mockProfile() {
  const now = new Date().toISOString();
  return {
    id: MOCK_USER_ID,
    username: "scrolltest",
    display_name: "Scroll Test",
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
    onboarding_complete: true,
    created_at: now,
    updated_at: now,
  };
}

function mockPosts(count = 8) {
  const profile = mockProfile();
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => ({
    id: `${MOCK_POST_ID.slice(0, -1)}${i}`,
    author_id: MOCK_USER_ID,
    content: `Isolation feed post ${i + 1} — scroll probe content.`,
    media_urls: [`https://picsum.photos/seed/frennix-scroll-${i}/900/1200`],
    thumbnail_url: null,
    post_type: "photo",
    workout_type: null,
    workout_types: [],
    group_id: null,
    challenge_id: null,
    event_id: null,
    shared_post_id: null,
    created_at: new Date(Date.now() - i * 60_000).toISOString(),
    updated_at: now,
    author: profile,
    liked_by_me: false,
    like_count: 0,
    comment_count: 0,
    saved_by_me: false,
    reactions: [],
    preview_comments: [],
  }));
}

async function measureScroll(page) {
  return page.evaluate(() => {
    function findScrollables() {
      const out = [];
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const oy = style.overflowY;
        if (oy !== "auto" && oy !== "scroll") continue;
        if (el.scrollHeight <= el.clientHeight + 8) continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop,
          touchAction: style.touchAction,
        });
      }
      return out;
    }

    const scrollables = findScrollables();
    if (!scrollables.length) {
      return { ok: false, reason: "no scrollable container", scrollables: [] };
    }

    const target = [...document.querySelectorAll("*")].find((el) => {
      const style = getComputedStyle(el);
      const oy = style.overflowY;
      return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 8;
    });

    if (!target) return { ok: false, reason: "target missing", scrollables };

    const before = target.scrollTop;
    target.scrollTop = before + 220;
    const afterProgrammatic = target.scrollTop;

    return {
      ok: afterProgrammatic > before + 5,
      before,
      afterProgrammatic,
      scrollables: scrollables.slice(0, 5),
      bodyText: document.body.innerText.slice(0, 500),
    };
  });
}

async function runScenario(label, query, env) {
  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;
  const sessionPayload = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: MOCK_USER_ID, email: "scroll@frennix.test" },
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes(supabaseHost)) {
      req.continue();
      return;
    }
    const accept = req.headers().accept || "";
    const method = req.method();

    if (method === "OPTIONS") {
      req.respond({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
      return;
    }

    let body = "[]";
    const headers = {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    };

    if (url.includes("/auth/v1/token") && method === "POST") {
      body = JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: { id: MOCK_USER_ID, email: "scroll@frennix.test" },
      });
    } else if (url.includes("/auth/v1/")) {
      body = JSON.stringify({ user: { id: MOCK_USER_ID, email: "scroll@frennix.test" } });
    } else if (url.includes("/rest/v1/profiles")) {
      body = JSON.stringify(accept.includes("object") ? mockProfile() : [mockProfile()]);
    } else if (url.includes("/rest/v1/profiles_reader")) {
      body = JSON.stringify(accept.includes("object") ? mockProfile() : [mockProfile()]);
    } else if (url.includes("/rest/v1/posts")) {
      body = JSON.stringify(accept.includes("object") ? mockPosts(1)[0] : mockPosts(8));
    } else if (url.includes("/rest/v1/follows") || url.includes("/rest/v1/group_members") || url.includes("/rest/v1/challenge_participants")) {
      body = "[]";
    } else if (url.includes("/rest/v1/rpc/") || url.includes("/rest/v1/notifications")) {
      body = "[]";
    } else if (method === "HEAD") {
      req.respond({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
      return;
    }

    req.respond({ status: 200, headers, body });
  });

  await page.evaluateOnNewDocument((key, value, debugUrl) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("frennix:feedDebug", "1");
    if (debugUrl.includes("feedScrollTest=0")) {
      sessionStorage.setItem("frennix:feedScrollTest", "0");
    }
  }, storageKey, sessionPayload, query);

  const url = `${baseUrl}${query}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 8000));

  const debugBanner = await page.evaluate(() =>
    document.body.innerText.includes("FEED DEBUG ACTIVE")
  );
  const scrollTestVisible = await page.evaluate(() =>
    document.body.innerText.includes("SCROLL TEST MODE")
  );
  const flatListProbe = await page.evaluate(() =>
    /Isolation feed post|Workout stories|Share workout/i.test(document.body.innerText)
  );

  const scroll = await measureScroll(page);

  await browser.close();

  return {
    label,
    url,
    debugBanner,
    scrollTestVisible,
    flatListProbe,
    scroll,
    pageErrors,
  };
}

async function main() {
  const env = loadEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL) {
    console.error("Missing .env with EXPO_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }

  console.log(`\n=== Feed scroll isolation @ ${baseUrl} ===\n`);

  const html = await fetch(`${baseUrl}/`).then((r) => r.text());
  const bundle = html.match(/entry-[a-f0-9]+\.js/)?.[0] ?? "unknown";
  console.log(`Production bundle: ${bundle}\n`);

  const scrollViewCase = await runScenario("ScrollView test", "?feedDebug=1", env);
  const flatListCase = await runScenario("FlatList feed", "?feedDebug=1&feedScrollTest=0", env);

  for (const result of [scrollViewCase, flatListCase]) {
    console.log(`--- ${result.label} ---`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Debug banner: ${result.debugBanner}`);
    console.log(`  Scroll test UI: ${result.scrollTestVisible}`);
    console.log(`  FlatList content: ${result.flatListProbe}`);
    console.log(`  Scrollable: ${result.scroll.ok}`);
    if (!result.scroll.ok) console.log(`  Scroll reason: ${result.scroll.reason ?? "programmatic scroll failed"}`);
    else
      console.log(
        `  ScrollTop ${result.scroll.before} → ${result.scroll.afterProgrammatic} (containers: ${result.scroll.scrollables?.length ?? 0})`
      );
    if (result.pageErrors.length) console.log(`  Page errors: ${result.pageErrors.join(" | ")}`);
    console.log("");
  }

  const scrollViewWorks = scrollViewCase.scroll.ok;
  const flatListWorks = flatListCase.scroll.ok;

  console.log("=== Verdict ===");
  if (scrollViewWorks && !flatListWorks) {
    console.log("ScrollView WORKS, FlatList FAILS → web-only ScrollView container is the fix.");
  } else if (!scrollViewWorks && !flatListWorks) {
    console.log("Both FAIL → investigate parent layout / overlay / gesture handler.");
  } else if (scrollViewWorks && flatListWorks) {
    console.log("Both WORK in automation — issue may be Safari-specific or auth-specific.");
  } else {
    console.log("FlatList works but ScrollView test failed — unexpected; review layout.");
  }

  process.exit(scrollViewCase.debugBanner ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
