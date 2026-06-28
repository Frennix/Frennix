/**
 * Verify post interaction sheet against dist/ (mocked auth).
 *
 * Usage:
 *   node scripts/verify-post-interaction.mjs
 *   node scripts/verify-post-interaction.mjs --url https://frennix.vercel.app
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const productionUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : null;

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

const MOCK_POST = {
  id: "post-1",
  author_id: MOCK_USER_ID,
  content: "Safari feed fix verification post",
  media_urls: ["https://picsum.photos/800/600"],
  post_type: "photo",
  created_at: new Date().toISOString(),
  author: {
    id: MOCK_USER_ID,
    username: "feedfix",
    display_name: "Feed Fix Test",
    avatar_url: null,
  },
};

async function main() {
  const env = loadEnv();
  let server = null;
  let baseUrl = productionUrl;

  if (!baseUrl) {
    if (!fs.existsSync(path.join(DIST, "index.html"))) {
      throw new Error("Missing dist/ — run: npx expo export -p web && node scripts/patch-web-html.js");
    }
    ({ server, baseUrl } = await startStaticServer());
  }

  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const contexts = [
    { name: "desktop", viewport: { width: 1280, height: 800 }, isMobile: false },
    { name: "iphone-safari", viewport: { width: 390, height: 844 }, isMobile: true },
    { name: "android-chrome", viewport: { width: 412, height: 915 }, isMobile: true },
  ];

  let allPass = true;

  for (const ctx of contexts) {
    const page = await browser.newPage({
      viewport: ctx.viewport,
      isMobile: ctx.isMobile,
      hasTouch: ctx.isMobile,
      userAgent: ctx.name.includes("iphone")
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : ctx.name.includes("android")
          ? "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36"
          : undefined,
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
        if (url.includes("/rest/v1/posts")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([MOCK_POST]),
          });
        }
        if (url.includes("get_feed")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ posts: [MOCK_POST], next_cursor: null }),
          });
        }
        if (url.includes("get_feed_stories") || url.includes("feed_stories")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        }
        if (url.includes("suggested") || url.includes("get_suggested")) {
          return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (url.includes("picsum.photos")) {
        return route.fulfill({
          status: 200,
          contentType: "image/jpeg",
          body: Buffer.from("fake"),
        });
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
            user: { id: userId, email: "fix@test.local" },
          })
        );
      },
      { key: `sb-${ref}-auth-token`, userId: MOCK_USER_ID }
    );

    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("#feed-scroll-list", { timeout: 20_000 });
    await page.waitForTimeout(3500);

    const bodyText = await page.locator("body").innerText();
    if (!/Safari feed fix verification post|Post interaction verification/i.test(bodyText)) {
      console.log("body snippet:", bodyText.slice(0, 500));
      throw new Error("Feed post content not visible");
    }

    const emergencyBanner = await page.locator("#frennix-emergency-debug, #frennix-emergency-html").count();

    const openTarget = page.getByRole("button", { name: /Open post actions|Perform Like/i }).first();
    const caption = page.getByText(/Safari feed fix verification post/i);
    if (await openTarget.isVisible().catch(() => false)) {
      await openTarget.click();
    } else if (await caption.isVisible().catch(() => false)) {
      await caption.click();
    } else {
      await page.locator("#feed-scroll-list img, #feed-scroll-list [role='button']").first().click();
    }

    await page.waitForTimeout(600);

    const sheetChecks = await page.evaluate(() => {
      const scrollEl = document.getElementById("feed-scroll-list");
      const buttons = [...document.querySelectorAll('[role="button"],[accessibilityrole="button"]')];
      const likeBtn = buttons.find((el) => {
        const label = el.getAttribute("aria-label") ?? el.getAttribute("accessibilitylabel") ?? el.textContent ?? "";
        return /like/i.test(label);
      });
      const moreBtn = buttons.find((el) => {
        const label = el.getAttribute("aria-label") ?? el.getAttribute("accessibilitylabel") ?? el.textContent ?? "";
        return /more/i.test(label);
      });
      const handle = [...document.querySelectorAll("[aria-label],[accessibilitylabel]")].find(
        (el) => {
          const label =
            el.getAttribute("aria-label") ?? el.getAttribute("accessibilitylabel") ?? "";
          return /drag to dismiss/i.test(label);
        }
      );
      const captionVisible = /Safari feed fix verification post/i.test(document.body.innerText);
      const sheetText = document.body.innerText.includes("Strong Work") || document.body.innerText.includes("Reply");
      return {
        scrollOverflow: scrollEl ? getComputedStyle(scrollEl).overflowY : null,
        likePresent: Boolean(likeBtn),
        morePresent: Boolean(moreBtn),
        handlePresent: Boolean(handle),
        captionVisible,
        sheetText,
      };
    });

    const scrollLocked = await page.evaluate(() => {
      const el = document.getElementById("feed-scroll-list");
      if (!el) return false;
      const style = getComputedStyle(el);
      if (style.overflowY === "hidden" || style.pointerEvents === "none") return true;
      const before = el.scrollTop;
      el.scrollTop = before + 200;
      return el.scrollTop <= before + 2;
    });

    let dismissOk = false;
    const closeBtn = page.getByRole("button", { name: /^Close$/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(600);
      dismissOk = !(await page.getByRole("button", { name: /^Like$/i }).first().isVisible().catch(() => false));
    }

    const pass =
      emergencyBanner === 0 &&
      sheetChecks.likePresent &&
      sheetChecks.morePresent &&
      sheetChecks.sheetText &&
      sheetChecks.captionVisible &&
      scrollLocked &&
      dismissOk;

    console.log(`\n=== ${ctx.name} (${ctx.viewport.width}x${ctx.viewport.height}) ===`);
    console.log("emergency banners:", emergencyBanner);
    console.log("sheet:", sheetChecks);
    console.log("scroll locked:", scrollLocked);
    console.log("dismiss ok:", dismissOk);
    if (!pass) {
      const snippet = await page.locator("body").innerText();
      console.log("body snippet:", snippet.slice(0, 400));
    }
    console.log(pass ? "PASS" : "FAIL");

    if (!pass) allPass = false;
    await page.close();
  }

  await browser.close();
  server?.close();

  if (!allPass) {
    console.error("\n[verify-post-interaction] FAILED");
    process.exitCode = 1;
  } else {
    console.log("\n[verify-post-interaction] PASS (desktop + iPhone UA + Android UA)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
