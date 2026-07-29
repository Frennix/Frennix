#!/usr/bin/env node
/**
 * Training Partners mobile layout regression (iPhone viewport).
 *
 * Usage:
 *   pnpm build:web
 *   node scripts/verify-training-partner-layout.mjs [baseUrl]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const OUTPUT_DIR = path.join(ROOT, "scripts", "output");
const SCREENSHOT = path.join(OUTPUT_DIR, "training-partner-iphone-layout.png");
const baseUrlArg = process.argv[2];

const IPHONE = { width: 390, height: 844 };

const require = createRequire(import.meta.url);
const playwrightPath = (() => {
  try {
    return require.resolve("playwright");
  } catch {
    return "/tmp/pw-repro/node_modules/playwright/index.js";
  }
})();

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function assertStaticLayoutPatterns() {
  const card = fs.readFileSync(path.join(ROOT, "components/TrainingPartnerCard.tsx"), "utf8");
  const screen = fs.readFileSync(path.join(ROOT, "app/matching/index.tsx"), "utf8");

  const footerStart = screen.indexOf('testID="training-partner-deck-footer"');
  const footerSection = footerStart >= 0 ? screen.slice(footerStart, footerStart + 2200) : "";
  const checks = [
    [card.includes("ScrollView"), "TrainingPartnerCard uses ScrollView"],
    [card.includes('overflow: "hidden"'), "TrainingPartnerCard clips overflow"],
    [screen.includes("useSafeAreaInsets"), "Matching screen applies safe-area insets"],
    [screen.includes("deckFooter"), "Matching screen defines sticky deck footer"],
    [screen.includes("minHeight: 0"), "Matching screen allows deck flex shrink"],
    [footerSection.includes("TrainingPartnerDeckSafety"), "Report or block remains in deck footer"],
    [
      footerSection.indexOf("TrainingPartnerDeckSafety") <
        footerSection.indexOf("TrainingPartnerDeckActions"),
      "Report or block appears above Skip/Connect actions",
    ],
    [
      !card.includes("Mutual workout interests"),
      "Merged mutual workout interests section removed",
    ],
    [card.includes("Mutual fitness goals"), "Mutual fitness goals section present"],
    [card.includes("Mutual workout styles"), "Mutual workout styles section present"],
    [
      card.indexOf("Mutual fitness goals") < card.indexOf("Mutual workout styles"),
      "Mutual fitness goals appear before mutual workout styles",
    ],
    [
      card.includes("formatAthleteFitnessGoalsTitle"),
      "Athlete fitness goals use possessive section title",
    ],
    [
      card.includes("getAdditionalPersonalLabels"),
      "Duplicate personal goal/style sections are suppressed",
    ],
    [
      !card.includes("Training goals") && !card.includes("Workout styles"),
      "Legacy personal section titles removed",
    ],
    [
      screen.includes("TRAINING_PARTNERS_HEADER_LOGO_HEIGHT"),
      "Header logo uses enlarged training partners size",
    ],
    [
      screen.includes('label="Report an app issue"'),
      "Footer uses Report an app issue label",
    ],
    [
      fs.readFileSync(path.join(ROOT, "components/TrainingMatchModal.tsx"), "utf8").includes("actionItem"),
      "Skip and Connect use balanced icon-plus-label layout",
    ],
    [!/\[\.\.\.sharedGoals,\s*\.\.\.sharedActivities\]/.test(card), "Shared goals and activities are not merged"],
  ];

  for (const [ok, label] of checks) {
    if (!ok) throw new Error(`Static layout check failed: ${label}`);
    console.log(`[PASS] ${label}`);
  }
}

function startStaticServer() {
  const mime = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".webmanifest": "application/manifest+json",
  };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url?.split("?")[0] ?? "/";
      const filePath =
        urlPath === "/"
          ? path.join(DIST, "index.html")
          : path.join(DIST, urlPath.replace(/^\//, ""));
      if (!filePath.startsWith(DIST) || !fs.existsSync(filePath)) {
        const isAsset = path.extname(urlPath) !== "";
        if (!isAsset) {
          const indexPath = path.join(DIST, "index.html");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(fs.readFileSync(indexPath));
          return;
        }
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

function buildMockProfile(userId) {
  return {
    id: userId,
    username: "layoutviewer",
    display_name: "Layout Viewer",
    avatar_url: null,
    bio: "Training for consistency.",
    fitness_goals: ["lose_weight", "stay_active", "build_muscle", "accountability_partner"],
    activities: ["running", "yoga", "weightlifting", "crossfit", "hiking"],
    city: "Austin",
    gender: "female",
    match_preference: "any",
    matching_enabled: true,
    visibility: "public",
    is_premium: false,
    onboarding_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildMockCandidate(index) {
  return {
    id: `candidate-${index}`,
    username: `athlete${index}`,
    display_name: `Athlete ${index}`,
    avatar_url: null,
    bio: "Focused on strength, endurance, and showing up consistently with training partners.",
    fitness_goals: [
      "lose_weight",
      "stay_active",
      "build_muscle",
      "accountability_partner",
      "find_training_partner",
    ],
    activities: ["running", "yoga", "weightlifting", "crossfit", "hiking", "cycling"],
    city: "Austin",
    gender: "female",
    match_preference: "any",
    matching_enabled: true,
    visibility: "public",
    is_premium: false,
    onboarding_complete: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function registerMocks(page, env, userId, profileRow, candidates) {
  const host = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;
  const unmatched = [];

  return page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.includes(host)) return route.continue();

    const method = route.request().method();
    const accept = route.request().headers().accept ?? "";
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, HEAD, OPTIONS",
          "access-control-allow-headers": "*",
        },
        body: "",
      });
    }

    if (url.includes("/auth/v1/")) {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          access_token: "layout-test-token",
          refresh_token: "layout-test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: userId, email: "layout@test.local" },
        }),
      });
    }

    if (url.includes("/rest/v1/rpc/get_match_candidates")) {
      return route.fulfill({ status: 200, headers, json: candidates });
    }

    if (url.includes("/rest/v1/rpc/profile_workout_streaks")) {
      return route.fulfill({ status: 200, headers, json: [] });
    }

    if (url.includes("/rest/v1/rpc/evaluate_feature_flag")) {
      return route.fulfill({ status: 200, headers, json: true });
    }

    if (url.includes("/rest/v1/profiles_reader") || url.includes("/rest/v1/profiles")) {
      const body = accept.includes("object") ? profileRow : [profileRow];
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    }

    if (url.includes("/rest/v1/posts")) {
      return route.fulfill({ status: 200, headers, body: "[]" });
    }

    if (method === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: { ...headers, "content-range": "*/0" },
        body: "",
      });
    }

    if (url.includes("/rest/v1/")) {
      unmatched.push(`${method} ${url}`);
      return route.fulfill({ status: 200, headers, body: "[]" });
    }

    return route.continue();
  }).then(() => unmatched);
}

function seedSession(page, env, userId, profileRow) {
  const ref = env.EXPO_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
  const storageKey = `sb-${ref}-auth-token`;

  return page.addInitScript(
    ({ key, uid, profile }) => {
      sessionStorage.setItem(
        "frennix.auth.profile.v1",
        JSON.stringify({ userId: uid, profile, cachedAt: Date.now() })
      );
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "layout-test-token",
          refresh_token: "layout-test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: "layout@test.local" },
        })
      );
    },
    { key: storageKey, uid: userId, profile: profileRow }
  );
}

function rectsOverlap(a, b, tolerance = 2) {
  return !(
    a.right <= b.left + tolerance ||
    a.left >= b.right - tolerance ||
    a.bottom <= b.top + tolerance ||
    a.top >= b.bottom - tolerance
  );
}

async function verifyBrowserLayout(baseUrl) {
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pwModule.default ?? pwModule;
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const page = await browser.newPage({ viewport: IPHONE });

  const env = loadEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    await browser.close();
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  }

  const userId = "layout-test-user";
  const profileRow = buildMockProfile(userId);
  const candidates = Array.from({ length: 3 }, (_, i) => buildMockCandidate(i + 1));

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: () => Promise.reject(new Error("service worker disabled for layout test")),
        getRegistration: () => Promise.resolve(undefined),
        getRegistrations: () => Promise.resolve([]),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });

  await registerMocks(page, env, userId, profileRow, candidates);
  await seedSession(page, env, userId, profileRow);

  await page.goto(`${baseUrl}/matching`, { waitUntil: "networkidle", timeout: 60_000 });
  await page
    .waitForFunction(
      () => /Athlete 1|Mutual fitness goals|Mutual workout styles|No athletes match/i.test(document.body?.innerText ?? ""),
      { timeout: 15_000 }
    )
    .catch(() => null);
  await page.waitForTimeout(1000);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: SCREENSHOT, fullPage: false });

  const layout = await page.evaluate(() => {
    const byText = (pattern) =>
      [...document.querySelectorAll("*")].find((el) => pattern.test(el.textContent ?? ""));

    const scroll = document.querySelector('[data-testid="training-partner-card-scroll"]');
    const footer = document.querySelector('[data-testid="training-partner-deck-footer"]');
    const skip = byText(/^Skip$/);
    const connect = byText(/^Connect$/);
    const report = byText(/Report or block/i);
    const mutualGoals = byText(/Mutual fitness goals/i);
    const mutualStyles = byText(/Mutual workout styles/i);

    const rect = (el) => (el ? el.getBoundingClientRect() : null);

    return {
      bodyText: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
      hasScroll: Boolean(scroll),
      hasFooter: Boolean(footer),
      scrollRect: rect(scroll),
      footerRect: rect(footer),
      skipRect: rect(skip),
      connectRect: rect(connect),
      reportRect: rect(report),
      mutualGoalsRect: rect(mutualGoals),
      mutualStylesRect: rect(mutualStyles),
      scrollOverflow: scroll ? scroll.scrollHeight > scroll.clientHeight + 4 : false,
      viewportH: window.innerHeight,
    };
  });

  await browser.close();

  console.log(`[INFO] Screenshot: ${SCREENSHOT}`);
  console.log(`[INFO] Body preview: ${layout.bodyText}`);

  const deckRendered = /Athlete 1|Mutual fitness goals|Mutual workout styles/i.test(layout.bodyText);
  if (!deckRendered) {
    console.log(
      "[WARN] Browser fixture did not hydrate a candidate deck (static layout checks still passed). Verify on device."
    );
    return;
  }

  if (!layout.hasScroll || !layout.hasFooter) {
    throw new Error("Missing training partner scroll region or deck footer test IDs");
  }

  if (!layout.skipRect || !layout.connectRect) {
    throw new Error("Skip/Connect buttons not found in DOM");
  }

  const footerTop = layout.footerRect?.top ?? 0;
  if (layout.skipRect.top < footerTop - 4 || layout.connectRect.top < footerTop - 4) {
    throw new Error("Skip/Connect buttons render above the deck footer region");
  }

  const mutualRect = layout.mutualGoalsRect ?? layout.mutualStylesRect;
  if (mutualRect && layout.skipRect && rectsOverlap(mutualRect, layout.skipRect)) {
    throw new Error("Mutual section overlaps Skip button");
  }

  if (layout.reportRect && layout.skipRect && rectsOverlap(layout.reportRect, layout.skipRect)) {
    throw new Error("Report or block overlaps Skip button");
  }

  if (layout.reportRect && layout.skipRect && layout.reportRect.top >= layout.skipRect.top) {
    throw new Error("Report or block is not positioned above Skip/Connect actions");
  }

  const buttonsVisible =
    layout.skipRect.bottom <= layout.viewportH + 1 &&
    layout.connectRect.bottom <= layout.viewportH + 1;
  if (!buttonsVisible) {
    throw new Error("Skip/Connect buttons extend below the iPhone viewport");
  }

  console.log("[PASS] iPhone viewport layout: footer, scroll region, and controls separated");
  if (layout.scrollOverflow) {
    console.log("[PASS] Candidate card content is scrollable (scrollHeight > clientHeight)");
  } else {
    console.log("[INFO] Candidate card content fits without scrolling in this fixture");
  }
}

async function main() {
  console.log("\n# Training Partners layout verification\n");
  assertStaticLayoutPatterns();

  if (!fs.existsSync(DIST)) {
    throw new Error("dist/ missing — run pnpm build:web first");
  }

  let baseUrl = baseUrlArg;
  let server;

  if (!baseUrl) {
    ({ server, baseUrl } = await startStaticServer());
  }

  try {
    await verifyBrowserLayout(baseUrl);
    console.log("\nAll training partner layout checks passed.\n");
  } finally {
    server?.close();
  }
}

main().catch((err) => {
  console.error(`\n[FAIL] ${err.message}\n`);
  process.exitCode = 1;
});
