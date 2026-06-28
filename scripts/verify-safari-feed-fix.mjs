/**
 * Verify Safari feed fix locally against dist/ (mocked auth).
 *
 * Usage:
 *   node scripts/verify-safari-feed-fix.mjs
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
    return "/tmp/pw-repro/node_modules/playwright/index.js";
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
            user: { id: MOCK_USER_ID, email: "fix@test.local" },
          }),
        });
      }
      if (url.includes("/rest/v1/profiles")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: MOCK_USER_ID,
            username: "feedfix",
            display_name: "Feed Fix Test",
            avatar_url: null,
            onboarding_complete: true,
            fitness_goals: [],
            activities: [],
          }),
        });
      }
      if (url.includes("get_feed") || url.includes("/rest/v1/posts")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            posts: [
              {
                id: "post-1",
                author_id: MOCK_USER_ID,
                content: "Safari feed fix verification post",
                media_urls: [],
                post_type: "text",
                created_at: new Date().toISOString(),
                author: {
                  id: MOCK_USER_ID,
                  username: "feedfix",
                  display_name: "Feed Fix Test",
                },
              },
            ],
            next_cursor: null,
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.continue();
  });

  const ref = new URL(env.EXPO_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const storageKey = `sb-${ref}-auth-token`;
  await page.addInitScript(
    ({ key, userId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "mock",
          refresh_token: "mock",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: userId, email: "fix@test.local" },
        })
      );
    },
    { key: storageKey, userId: MOCK_USER_ID }
  );

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(3000);

  const layout = await page.evaluate(() => window.__FRENNIX_FEED_LAYOUT__ ?? null);
  const rootEl = await page.evaluate(() => {
    const el = document.getElementById("root");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { height: Math.round(rect.height) };
  });
  const feedEl = await page.evaluate(() => {
    const el = document.getElementById("feed-root-container");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      height: Math.round(rect.height),
      backgroundColor: style.backgroundColor,
    };
  });
  const modalCount = await page.evaluate(
    () => document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length
  );
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const bodyText = await page.locator("body").innerText();
  const scrollWorks = await page.evaluate(() => {
    const findScrollable = (root) => {
      if (!root) return null;
      const queue = [root];
      while (queue.length) {
        const el = queue.shift();
        const style = getComputedStyle(el);
        const canScroll =
          el.scrollHeight > el.clientHeight + 4 &&
          (style.overflowY === "auto" || style.overflowY === "scroll");
        if (canScroll) return el;
        for (const child of el.children) queue.push(child);
      }
      return root;
    };

    const root = document.getElementById("feed-scroll-list");
    const el = findScrollable(root);
    if (!el) return false;
    const before = el.scrollTop;
    el.scrollTop = before + 240;
    return el.scrollTop > before + 5;
  });

  const hasOverflow = layout?.scrollMetrics?.hasOverflow === true;

  console.log("\n=== Safari feed fix verification ===");
  console.log("#root:", rootEl);
  console.log("feed-root-container:", feedEl);
  console.log("body background:", bodyBg);
  console.log("hidden modal nodes:", modalCount);
  console.log("feed scroll works:", scrollWorks, hasOverflow ? "(overflow present)" : "(no overflow — skipped)");
  const feedVisible = /Safari feed fix verification post|Your feed is ready|Workouts, progress/i.test(
    bodyText
  );
  console.log("layout snapshot issue:", layout?.issue ?? "none");

  const rootHeightOk = (rootEl?.height ?? 0) > 80;
  const feedHeightOk = (feedEl?.height ?? 0) > 80;
  const modalsOk = modalCount === 0;
  const contentOk = feedVisible;
  const scrollOk = !hasOverflow || scrollWorks;
  const overlayOk = layout?.issue == null;

  if (!rootHeightOk || !feedHeightOk || !modalsOk || !contentOk || !overlayOk || !scrollOk) {
    console.error("\n[verify-safari-feed-fix] FAILED");
    if (!rootHeightOk) console.error("- #root height <= 80");
    if (!feedHeightOk) console.error("- feed-root-container height <= 80");
    if (!overlayOk) console.error(`- layout issue: ${layout?.issue}`);
    if (!scrollOk) console.error("- feed-scroll-list could not scroll");
    if (!modalsOk) console.error(`- unexpected modal nodes: ${modalCount}`);
    if (!contentOk) console.error("- feed text not visible in body");
    process.exitCode = 1;
  } else {
    console.log("\n[verify-safari-feed-fix] PASS");
  }

  await browser.close();
  server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
