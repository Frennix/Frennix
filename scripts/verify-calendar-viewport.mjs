/**
 * Verify Training Calendar viewport on iPhone Safari (local dist/).
 *
 * Usage:
 *   npm run build:web && node scripts/verify-calendar-viewport.mjs
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

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("Missing dist/ — run: npm run build:web");
  }

  const env = loadEnv();
  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const contexts = [
    { name: "iphone-toolbar-expanded", toolbarReserve: 50 },
    { name: "iphone-toolbar-collapsed", toolbarReserve: 0 },
  ];

  let pass = true;

  for (const ctx of contexts) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
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
              user: { id: MOCK_USER_ID, email: "cal@test.local" },
            }),
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: MOCK_USER_ID,
              username: "calfix",
              display_name: "Calendar Fix",
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
            user: { id: userId, email: "cal@test.local" },
          })
        );
      },
      { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
    );

    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(2000);

    const calendarTab = page.getByRole("tab", { name: /calendar/i });
    if (await calendarTab.isVisible().catch(() => false)) {
      await calendarTab.click();
    } else {
      await page.getByText(/^Calendar$/i).first().click();
    }
    await page.waitForTimeout(2500);

    const metrics = await page.evaluate((toolbarReserve) => {
      const vv = window.visualViewport;
      const visibleBottom = (vv ? vv.height + vv.offsetTop : window.innerHeight) - toolbarReserve;
      const scrollEl = document.querySelector('[data-testid="calendar-scroll"], [class*="ScrollView"]');

      const text = document.body.innerText;
      const hasStartWorkout = /Start Workout/i.test(text);
      const hasHeader = /Training Calendar/i.test(text);
      const hasToggle = /Month|Week/i.test(text);

      const findByText = (label) =>
        [...document.querySelectorAll("div,span,button,[role='button']")].find((el) =>
          new RegExp(`^${label}$`, "i").test((el.textContent ?? "").trim())
        );

      const startBtn = findByText("Start Workout");
      const monthBtn = [...document.querySelectorAll("*")].find((el) =>
        /^Month$/i.test((el.textContent ?? "").trim())
      );
      const weekBtn = [...document.querySelectorAll("*")].find((el) =>
        /^Week$/i.test((el.textContent ?? "").trim())
      );

      const rect = (el) => (el ? el.getBoundingClientRect() : null);
      const startRect = rect(startBtn);
      const monthRect = rect(monthBtn);
      const weekRect = rect(weekBtn);

      const inView = (r) => r && r.top >= 0 && r.bottom <= visibleBottom - 4 && r.height > 0;

      const scrollViews = [...document.querySelectorAll("div")].filter((el) => {
        const s = getComputedStyle(el);
        return s.overflowY === "auto" || s.overflowY === "scroll";
      });
      const mainScroll = scrollViews.find((el) => el.scrollHeight > el.clientHeight + 8) ?? scrollViews[0];
      const scrollClient = mainScroll?.clientHeight ?? 0;
      const scrollHeight = mainScroll?.scrollHeight ?? 0;
      const deadBandPx =
        mainScroll && scrollClient > 0
          ? Math.max(0, scrollClient - Math.min(scrollHeight, scrollClient))
          : 0;

      return {
        visibleBottom: Math.round(visibleBottom),
        innerHeight: window.innerHeight,
        vvHeight: vv ? Math.round(vv.height) : null,
        hasStartWorkout,
        hasHeader,
        hasToggle,
        startInView: inView(startRect),
        monthInView: inView(monthRect),
        weekInView: inView(weekRect),
        startBottom: startRect ? Math.round(startRect.bottom) : null,
        monthBottom: monthRect ? Math.round(monthRect.bottom) : null,
        scrollClient,
        scrollHeight,
        deadBandPx,
        needsScrollForStart: startRect ? startRect.bottom > visibleBottom : true,
      };
    }, ctx.toolbarReserve);

    const ok =
      metrics.hasStartWorkout &&
      metrics.hasHeader &&
      metrics.hasToggle &&
      metrics.startInView &&
      metrics.monthInView &&
      metrics.weekInView &&
      !metrics.needsScrollForStart &&
      metrics.deadBandPx < 80;

    console.log(`\n=== ${ctx.name} ===`);
    console.log(metrics);
    if (!ok) {
      const snippet = await page.locator("body").innerText();
      console.log("body snippet:", snippet.slice(0, 350));
    }
    console.log(ok ? "PASS" : "FAIL");
    if (!ok) pass = false;

    await page.close();
  }

  await browser.close();
  server.close();

  if (!pass) {
    console.error("\n[verify-calendar-viewport] FAILED");
    process.exitCode = 1;
  } else {
    console.log("\n[verify-calendar-viewport] PASS");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
