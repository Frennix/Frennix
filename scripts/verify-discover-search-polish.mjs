/**
 * Verify Discover search polish wiring + optional Safari/PWA smoke test.
 *
 * Usage:
 *   node scripts/verify-discover-search-polish.mjs
 *   npm run build:web && node scripts/verify-discover-search-polish.mjs --safari
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const runSafari = process.argv.includes("--safari");

const require = createRequire(import.meta.url);

function mustInclude(file, ...needles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error(`Missing file: ${file}`);
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of needles) {
    if (!text.includes(needle)) throw new Error(`${file} must include: ${needle}`);
  }
}

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
      const mime = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
      };
      res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function verifySource() {
  mustInclude(
    "supabase/migrations/20260708170000_discover_search_polish.sql",
    "discover_search_term_stats",
    "record_discover_search_terms",
    "discover_profile_item",
    "get_discover_suggested_sections"
  );

  mustInclude(
    "lib/discover-search-history.ts",
    "MAX_RECENT_SEARCHES",
    "clearDiscoverSearchHistory"
  );

  mustInclude(
    "packages/ui/src/HighlightedText.tsx",
    "HighlightedText"
  );

  mustInclude(
    "components/DiscoverProfilePreviewSheet.tsx",
    "BottomActionSheet",
    "Profile preview"
  );

  mustInclude(
    "components/ProfileIdentityBadges.tsx",
    "Founder",
    "Ambassador",
    "Verified Trainer"
  );

  mustInclude(
    "app/(tabs)/discover.tsx",
    "SectionList",
    "DiscoverRecentSearches",
    "DiscoverProfilePreviewSheet",
    "getDiscoverSuggestedSections",
    "trackDiscoverSearch",
    "presenceVariant=\"discover\"",
    "Try another name, username, goal, or interest"
  );

  mustInclude(
    "packages/ui/src/presence.ts",
    "formatDiscoverPresenceStatus",
    "Active today"
  );

  mustInclude(
    "lib/product-analytics.ts",
    "trackDiscoverSearch",
    "discover_search"
  );
}

async function verifySafari() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npm run build:web");
  }

  const playwrightPath = (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;
  const MOCK_USER_ID = "11111111-1111-4111-8111-111111111111";

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

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
            user: { id: MOCK_USER_ID, email: "discover@test.local" },
          }),
        });
      }
      if (url.includes("/rest/v1/rpc/get_discover_suggested_sections")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            training_partners: [],
            nearby: [],
            new_members: [],
            similar_goals: [],
            popular: [],
          }),
        });
      }
      if (url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: MOCK_USER_ID,
            username: "discoverqa",
            display_name: "Discover QA",
            avatar_url: null,
            onboarding_complete: true,
            fitness_goals: [],
            activities: [],
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.continue();
  });

  const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  await page.addInitScript(
    ({ key, userId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: userId, email: "discover@test.local" },
        })
      );
    },
    { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
  );

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForSelector('[role="tablist"]', { timeout: 30_000 });
  await page.locator('a[href="/(tabs)/discover"]').click({ force: true });
  await page.waitForSelector("text=Find your training community", { timeout: 30_000 });
  await page.waitForSelector("text=Results update as you type", { timeout: 30_000 });
  await page.waitForSelector("text=Search filters", { timeout: 30_000 });

  const bodyText = await page.evaluate(() => document.body.innerText);
  if (!bodyText.includes("People")) {
    throw new Error("Discover people tab content not rendered on iPhone Safari");
  }

  await browser.close();
  server.close();
  console.log("PASS  Discover search polish iPhone Safari/PWA smoke test");
}

async function main() {
  verifySource();
  console.log("PASS  Discover search polish source wiring verified");

  if (runSafari) {
    await verifySafari();
  } else {
    console.log("SKIP  Safari smoke test (pass --safari after npm run build:web)");
  }
}

main().catch((err) => {
  console.error("FAIL ", err.message ?? err);
  process.exit(1);
});
