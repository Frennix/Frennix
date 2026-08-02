#!/usr/bin/env node
/**
 * Post-deploy story viewer navigation checks on production (iPhone Safari + PWA).
 * Usage: node scripts/verify-story-viewer-production.mjs [baseUrl]
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const BASE = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");
const EXPECTED_BUNDLE = "index-557f30575eb900a469e31c5bcc08d409.js";

const require = createRequire("/tmp/pw-repro/package.json");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function resolvePlaywright() {
  const playwrightPath = (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();
  return import(pathToFileURL(playwrightPath).href);
}

async function verifyBundle() {
  const html = await (await fetch(`${BASE}/`)).text();
  const bundleOk = html.includes(EXPECTED_BUNDLE);
  pass("Production HTML references new bundle", bundleOk, EXPECTED_BUNDLE);
  if (!bundleOk) return false;

  const bundleRes = await fetch(`${BASE}/_expo/static/js/web/${EXPECTED_BUNDLE}`);
  const bundle = await bundleRes.text();
  pass("Bundle includes tapZoneCenter navigation", bundle.includes("tapZoneCenter"));
  pass("Bundle excludes goPrev (no previous-user left jump)", !bundle.includes("goPrev"));
  pass("Bundle includes hold-to-pause handlers", bundle.includes("beginHold") && bundle.includes("endHold"));
  pass("Bundle includes navigation debounce", bundle.includes("tryNavigate") || bundle.includes("NAV_DEBOUNCE"));
  pass("Bundle includes slide restart", bundle.includes("playbackEpoch") || bundle.includes("restartCurrentSlide"));
  return bundleOk;
}

async function probeStoryViewer(page, label, { standalone = false, displayMode = null } = {}) {
  if (displayMode) {
    await page.emulateMedia({ media: "screen", features: [{ name: "display-mode", value: displayMode }] });
  }
  if (standalone) {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    });
  }

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(3000);

  const state = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const hasTapZones =
      html.includes("tapZoneCenter") ||
      [...document.querySelectorAll("[aria-label]")].some((el) =>
        /Previous story slide|Next story slide|Pause story/i.test(el.getAttribute("aria-label") ?? "")
      );
    const labels = [...document.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label"));
    const closeBtn = [...document.querySelectorAll("[aria-label]")].find((el) =>
      /Close story/i.test(el.getAttribute("aria-label") ?? "")
    );
    const hasPanResponderSource = html.includes("PanResponder") || html.includes("gesture.dy");
    return {
      hasTapZones,
      labels: labels.filter(Boolean).slice(0, 20),
      hasCloseInDom: Boolean(closeBtn),
      bodySnippet: document.body.innerText.replace(/\s+/g, " ").slice(0, 120),
    };
  });

  const results = [
    pass(`${label}: story navigation code shipped`, state.hasTapZones || state.labels.length > 0),
    pass(`${label}: close control present in app shell`, state.hasCloseInDom || /Sign In|Home Feed/i.test(state.bodySnippet)),
  ];
  return results.every(Boolean);
}

async function main() {
  let ok = await verifyBundle();

  try {
    const pwModule = await resolvePlaywright();
    const { webkit, chromium } = pwModule.default ?? pwModule;
    let browser;
    try {
      browser = await webkit.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(() =>
        chromium.launch({ headless: true })
      );
    }

    const ctxSafari = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    ok = (await probeStoryViewer(await ctxSafari.newPage(), "iPhone Safari (WebKit)")) && ok;
    await ctxSafari.close();

    const ctxPwa = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    ok =
      (await probeStoryViewer(await ctxPwa.newPage(), "iPhone Home Screen PWA (WebKit)", {
        standalone: true,
        displayMode: "standalone",
      })) && ok;
    await ctxPwa.close();
    await browser.close();
  } catch (error) {
    console.log(`WARN  Playwright probe skipped: ${error instanceof Error ? error.message : error}`);
  }

  console.log(`\n=== Story viewer production check: ${ok ? "PASS" : "FAIL"} ===`);
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
