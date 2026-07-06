/**
 * Verify Discover tab scrolls on iPhone Safari (filters + list in one surface).
 *
 * Usage:
 *   npm run build:web && node scripts/verify-discover-scroll.mjs
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
        ".png": "image/png",
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

function readSourceChecks() {
  const discover = fs.readFileSync(path.join(ROOT, "app/(tabs)/discover.tsx"), "utf8");
  if (!discover.includes("useTabScreenWebContainerStyle")) {
    throw new Error("Discover must use useTabScreenWebContainerStyle on outer shell");
  }
  if (discover.includes("[styles.container, webHeightStyle]")) {
    throw new Error("Discover outer shell must not pin webHeightStyle (clips non-scroll chrome)");
  }
  if (!discover.includes("ListHeaderComponent={peopleListHeader}")) {
    throw new Error("Discover filters must live in FlatList ListHeaderComponent");
  }
  if (!discover.includes('nativeID="discover-scroll"')) {
    throw new Error("Discover scroll surface must expose nativeID discover-scroll");
  }
}

async function main() {
  readSourceChecks();

  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npm run build:web");
  }

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;

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
  await page.getByRole("tab", { name: "Discover" }).click();
  await page.waitForSelector("text=Find your training community", { timeout: 30_000 });
  await page.waitForSelector("text=Children age", { timeout: 30_000 });
  await page.waitForTimeout(1500);

  const before = await page.evaluate(() => {
    const scrollables = [...document.querySelectorAll("*")].filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 8
      );
    });
    const scrollEl = scrollables.sort(
      (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
    )[0];
    if (!scrollEl) return null;
    return {
      scrollTop: scrollEl.scrollTop,
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
      hasDistanceLabel: document.body.innerText.includes("Distance"),
      hasGoalsLabel: document.body.innerText.includes("Goals"),
    };
  });

  if (!before) throw new Error("Discover scroll node not found");
  if (!before.hasGoalsLabel) throw new Error("Goals filter row not rendered in Discover header");

  const scrolled = await page.evaluate(() => {
    const scrollables = [...document.querySelectorAll("*")].filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 8
      );
    });
    const scrollEl = scrollables.sort(
      (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
    )[0];
    if (!scrollEl) return false;
    const max = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollEl.scrollTop = max;
    scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
    return scrollEl.scrollTop > 24;
  });

  if (!scrolled) {
    throw new Error(
      `Discover did not scroll (scrollHeight=${before.scrollHeight}, clientHeight=${before.clientHeight})`
    );
  }

  const after = await page.evaluate(() => ({
    hasDistanceLabel: document.body.innerText.includes("Distance"),
  }));

  if (!after.hasDistanceLabel) {
    throw new Error("Distance filter row not reachable after scroll");
  }

  await browser.close();
  server.close();
  console.log("PASS  Discover iPhone Safari scroll reaches filter rows below Children age");
}

main().catch((err) => {
  console.error("FAIL ", err.message ?? err);
  process.exit(1);
});
