/**
 * Local feed layout probe — Chrome baseline before Safari iPhone test.
 * Serves dist/ with mocked Supabase and reads __FRENNIX_FEED_LAYOUT__.
 *
 * Usage:
 *   node scripts/probe-feed-layout-local.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return null;
  }
})();

const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";

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

function mockProfile() {
  const now = new Date().toISOString();
  return {
    id: MOCK_USER_ID,
    username: "layouttest",
    display_name: "Layout Test",
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

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npx expo export -p web && node scripts/patch-web-html.js");
  }
  if (!playwrightPath) {
    console.log("[probe-feed-layout] Playwright not installed — build OK, skip browser probe");
    return;
  }

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("supabase.co")) {
      if (url.includes("/auth/v1/token")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "mock",
            refresh_token: "mock",
            expires_in: 3600,
            token_type: "bearer",
            user: { id: MOCK_USER_ID, email: "layout@test.local" },
          }),
        });
      }
      if (url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProfile()),
        });
      }
      if (url.includes("/rest/v1/rpc/get_feed") || url.includes("get_feed")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ posts: [], next_cursor: null }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
    return route.continue();
  });

  await page.addInitScript(({ supabaseUrl, supabaseKey }) => {
    window.localStorage.setItem(
      `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
      JSON.stringify({
        access_token: "mock",
        refresh_token: "mock",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "11111111-1111-4111-8111-111111111111", email: "layout@test.local" },
      })
    );
    window.__FRENNIX_SUPABASE_URL__ = supabaseUrl;
    window.__FRENNIX_SUPABASE_KEY__ = supabaseKey;
  }, { supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL, supabaseKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2500);

  const layout = await page.evaluate(() => window.__FRENNIX_FEED_LAYOUT__ ?? null);
  const banner = await page.locator("#frennix-emergency-debug").textContent().catch(() => null);

  console.log("\n=== Chrome layout baseline ===");
  console.log(JSON.stringify(layout, null, 2));
  console.log("\n=== Banner layout lines ===");
  console.log(banner?.split("\n").filter((line) => line.includes("Layout") || line.includes("Surfaces") || line.includes("Overlay")).join("\n"));

  if (layout?.issue) {
    console.error("\n[probe-feed-layout] ISSUE detected in Chrome:", layout.issue);
    process.exitCode = 1;
  } else if (layout?.elements?.find((el) => el.id === "feed-root-container")?.rectH <= 1) {
    console.error("\n[probe-feed-layout] feed-root-container height is 0 in Chrome");
    process.exitCode = 1;
  } else {
    console.log("\n[probe-feed-layout] Chrome baseline OK — deploy for Safari iPhone readout");
  }

  await browser.close();
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
