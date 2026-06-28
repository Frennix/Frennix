#!/usr/bin/env node
/** Puppeteer repro using system Chrome + iPhone UA when Playwright WebKit unavailable. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.FRENNIX_ROOT ?? path.join(__dirname, "..");
const baseUrl = process.argv[2] ?? "https://frennix.vercel.app";
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_POST_ID = "22222222-2222-4222-8222-222222222222";

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
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
    username: "reprotest",
    display_name: "Repro Test",
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

function mockPost() {
  const now = new Date().toISOString();
  return {
    id: MOCK_POST_ID,
    author_id: MOCK_USER_ID,
    content: "Repro feed post — AnimatedFeedListItem entering animation.",
    media_urls: ["https://picsum.photos/seed/frennix-repro/900/1200"],
    thumbnail_url: null,
    post_type: "photo",
    workout_type: null,
    workout_types: [],
    group_id: null,
    challenge_id: null,
    event_id: null,
    shared_post_id: null,
    created_at: now,
    updated_at: now,
    author: mockProfile(),
    liked_by_me: false,
    like_count: 0,
    comment_count: 0,
    saved_by_me: false,
    reactions: [],
    preview_comments: [],
  };
}

async function main() {
  const env = loadEnv();
  const supabaseHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;
  const sessionPayload = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
  };

  console.log(`\n=== iPhone UA Chrome → ${baseUrl} ===`);

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
  const boundaryLogs = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[error-boundary:")) {
      boundaryLogs.push(text);
      console.log(`  boundary: ${text.slice(0, 500)}`);
    }
    if (msg.type() === "error") {
      console.log(`  console.error: ${text.slice(0, 400)}`);
    }
  });

  page.on("pageerror", (error) => {
    const line = `${error.message}\n${error.stack ?? ""}`;
    pageErrors.push(line);
    console.log(`  pageerror: ${error.message}`);
    console.log((error.stack ?? "").split("\n").slice(0, 12).join("\n"));
  });

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
        user: { id: MOCK_USER_ID, email: "repro@frennix.test" },
      });
    } else if (url.includes("/auth/v1/")) {
      body = JSON.stringify({ user: { id: MOCK_USER_ID, email: "repro@frennix.test" } });
    } else if (url.includes("/rest/v1/profiles")) {
      body = JSON.stringify(accept.includes("object") ? mockProfile() : [mockProfile()]);
    } else if (url.includes("/rest/v1/profiles_reader")) {
      body = JSON.stringify(accept.includes("object") ? mockProfile() : [mockProfile()]);
    } else if (url.includes("/rest/v1/posts")) {
      body = JSON.stringify(accept.includes("object") ? mockPost() : [mockPost()]);
    } else if (method === "HEAD") {
      req.respond({ status: 200, headers: { ...headers, "content-range": "*/0" }, body: "" });
      return;
    }

    req.respond({ status: 200, headers, body });
  });

  await page.evaluateOnNewDocument((key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, storageKey, sessionPayload);

  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 90_000 });
  await new Promise((r) => setTimeout(r, 6000));

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hitBoundary = /Something went wrong/i.test(bodyText);
  const feedVisible = /Repro feed post|Repro Test|Like|Comment/i.test(bodyText);
  console.log(`  feed content visible: ${feedVisible}`);
  console.log(`  body preview: ${bodyText.slice(0, 400).replace(/\s+/g, " ")}`);

  await browser.close();

  console.log("\n=== Summary ===");
  console.log(`boundary: ${hitBoundary}, page errors: ${pageErrors.length}, boundary logs: ${boundaryLogs.length}`);
  for (const err of pageErrors) console.log("\n---\n" + err);
  for (const log of boundaryLogs) console.log("\n--- boundary ---\n" + log);

  process.exit(hitBoundary || pageErrors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
