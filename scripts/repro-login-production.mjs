#!/usr/bin/env node
/**
 * Production login black-screen repro — no mocks, real network.
 * Scenarios: fresh user, private browsing, PWA standalone, direct /login.
 * Usage: node scripts/repro-login-production.mjs [baseUrl]
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const baseUrl = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");
const require = createRequire(import.meta.url);

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function getPlaywright() {
  const playwrightPath = (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();
  const pw = await import(pathToFileURL(playwrightPath).href);
  return pw.default ?? pw;
}

function snapshot() {
  const shell = document.getElementById("frennix-boot-shell");
  const login = document.getElementById("auth-login-screen");
  const retry = document.getElementById("startup-retry-screen");
  const root = document.getElementById("root");
  const inputs = [...document.querySelectorAll("input")];
  const trace = window.__FRENNIX_MOUNT_TRACE__ ?? [];
  const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();

  const shellStyle = shell ? getComputedStyle(shell) : null;
  const loginStyle = login ? getComputedStyle(login) : null;
  const rootStyle = root ? getComputedStyle(root) : null;

  return {
    url: location.href,
    bodyText: bodyText.slice(0, 300),
    shell: shell
      ? {
          display: shell.style.display || shellStyle?.display,
          visibility: shellStyle?.visibility,
          opacity: shellStyle?.opacity,
          zIndex: shellStyle?.zIndex,
          hidden: shell.style.display === "none",
        }
      : null,
    login: login
      ? {
          rect: login.getBoundingClientRect(),
          display: loginStyle?.display,
          visibility: loginStyle?.visibility,
          opacity: loginStyle?.opacity,
          height: loginStyle?.height,
        }
      : null,
    retry: retry
      ? {
          rect: retry.getBoundingClientRect(),
          text: retry.innerText?.slice(0, 120),
        }
      : null,
    root: root
      ? {
          childCount: root.childElementCount,
          innerHTMLLen: root.innerHTML.length,
          display: rootStyle?.display,
          height: rootStyle?.height,
          rect: root.getBoundingClientRect(),
        }
      : null,
    inputs: inputs.map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        type: el.getAttribute("type"),
        placeholder: el.getAttribute("placeholder"),
        color: cs.color,
        bg: cs.backgroundColor,
        fill: cs.getPropertyValue("-webkit-text-fill-color"),
        opacity: cs.opacity,
        visibility: cs.visibility,
        display: cs.display,
        rect: { w: r.width, h: r.height, top: r.top },
      };
    }),
    trace: trace.map((e) => e.id),
    traceGap: (() => {
      const expected = [
        "entry:createRoot:render:end",
        "auth-provider:mounted",
        "index-route:mounted",
        "auth-login:mounted",
      ];
      for (const id of expected) {
        if (!trace.some((e) => e.id === id)) return id;
      }
      return null;
    })(),
    startupSnapshots: (window.__FRENNIX_STARTUP_SNAPSHOTS__ ?? []).slice(-2),
    hasWelcome: /Welcome back/i.test(bodyText),
    hasPasswordLabel: /Password/i.test(bodyText),
    hasEmailLabel: /Email/i.test(bodyText),
  };
}

async function runScenario(browser, name, options = {}) {
  const {
    path: route = "/",
    standalone = false,
    displayMode = null,
    storageState = undefined,
    blockServiceWorker = false,
  } = options;

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: IPHONE_UA,
    storageState,
    serviceWorkers: blockServiceWorker ? "block" : "allow",
  });

  if (displayMode && typeof context.emulateMedia === "function") {
    await context.emulateMedia({
      media: "screen",
      features: [{ name: "display-mode", value: displayMode }],
    });
  }
  if (standalone) {
    await context.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", {
        value: true,
        configurable: true,
      });
    });
  }

  const page = await context.newPage();
  const consoleLogs = [];
  const startupSnapshotLogs = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
    if (text.includes("[frennix-startup-snapshot]")) {
      startupSnapshotLogs.push(text);
    }
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("requestfailed", (req) => {
    requestFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  const timeline = [];
  const record = async (label) => {
    timeline.push({ at: label, ...(await page.evaluate(snapshot)) });
  };

  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await record("domcontentloaded");

    await page.waitForTimeout(1000);
    await record("t+1s");

    await page.waitForTimeout(2000);
    await record("t+3s");

    await page.waitForTimeout(3000);
    await record("t+6s");

    await page.waitForTimeout(4000);
    await record("t+10s");

    await page.waitForTimeout(5000);
    await record("t+15s");
  } catch (err) {
    timeline.push({ at: "ERROR", error: String(err) });
  }

  await context.close();

  const final = timeline[timeline.length - 1] ?? {};
  const blackScreen =
    final.shell?.hidden &&
    !final.hasWelcome &&
    !final.retry &&
    (final.root?.childCount === 0 || final.root?.innerHTMLLen < 50);

  const passwordMissing =
    final.hasWelcome && final.hasEmailLabel && !final.hasPasswordLabel;

  const passwordInvisible =
    final.inputs?.length >= 2 &&
    final.inputs.some(
      (i) =>
        i.type === "password" &&
        (i.rect.h < 5 ||
          i.opacity === "0" ||
          i.visibility === "hidden" ||
          i.fill === "rgb(10, 10, 11)" ||
          i.color === "rgb(10, 10, 11)")
    );

  return {
    name,
    blackScreen,
    passwordMissing,
    passwordInvisible,
    pageErrors,
    consoleLogs: consoleLogs.slice(0, 20),
    startupSnapshotLogs: startupSnapshotLogs.slice(-5),
    requestFailures: requestFailures.slice(0, 15),
    timeline,
  };
}

function printScenario(result) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`SCENARIO: ${result.name}`);
  console.log(`${"=".repeat(72)}`);

  if (result.pageErrors.length) {
    console.log("\nPAGE ERRORS:");
    result.pageErrors.forEach((e) => console.log(`  • ${e}`));
  } else {
    console.log("\nPAGE ERRORS: none");
  }

  if (result.consoleLogs.length) {
    console.log("\nCONSOLE (errors/warnings):");
    result.consoleLogs.forEach((e) => console.log(`  • ${e}`));
  }

  const startupSnapshots = result.timeline
    .flatMap((snap) => snap.startupSnapshots ?? [])
    .slice(-3);
  if (startupSnapshots.length) {
    console.log("\nSTARTUP SNAPSHOTS (last 3):");
    startupSnapshots.forEach((s) => console.log(`  • ${JSON.stringify(s).slice(0, 200)}`));
  }

  if (result.startupSnapshotLogs?.length) {
    console.log("\nSTARTUP SNAPSHOT LOGS:");
    result.startupSnapshotLogs.forEach((line) => console.log(`  • ${line.slice(0, 220)}`));
  }

  if (result.requestFailures.length) {
    console.log("\nNETWORK FAILURES:");
    result.requestFailures.forEach((e) => console.log(`  • ${e}`));
  }

  console.log("\nTIMELINE:");
  for (const snap of result.timeline) {
    if (snap.error) {
      console.log(`  [${snap.at}] ERROR: ${snap.error}`);
      continue;
    }
    console.log(
      `  [${snap.at}] url=${snap.url} shell=${snap.shell?.hidden ? "hidden" : "VISIBLE"} ` +
        `login=${snap.login ? "yes" : "no"} retry=${snap.retry ? "yes" : "no"} ` +
        `inputs=${snap.inputs?.length ?? 0} welcome=${snap.hasWelcome} pwdLabel=${snap.hasPasswordLabel} ` +
        `traceGap=${snap.traceGap ?? "none"}`
    );
    if (snap.bodyText) console.log(`         text: ${snap.bodyText.slice(0, 100)}`);
    if (snap.inputs?.length) {
      snap.inputs.forEach((i) =>
        console.log(
          `         input[${i.type}]: ${i.rect.w}x${i.rect.h} color=${i.color} fill=${i.fill} vis=${i.visibility}`
        )
      );
    }
    if (snap.trace?.length) {
      console.log(`         trace: ${snap.trace.slice(-8).join(" → ")}`);
    }
  }

  console.log("\nDIAGNOSIS:");
  if (result.blackScreen) console.log("  ✗ BLACK SCREEN — boot shell hidden, no login/retry UI");
  if (result.passwordMissing) console.log("  ✗ PASSWORD LABEL MISSING");
  if (result.passwordInvisible) console.log("  ✗ PASSWORD INPUT INVISIBLE");
  if (!result.blackScreen && !result.passwordMissing && !result.passwordInvisible) {
    console.log("  ✓ Login UI appears healthy in this scenario");
  }
}

async function main() {
  console.log(`Production login repro — ${baseUrl}\n`);

  const { chromium, webkit } = await getPlaywright();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }

  const scenarios = [
    { name: "Fresh user (/)", options: {} },
    { name: "Fresh user (/login)", options: { path: "/login" } },
    { name: "Private browsing simulation", options: { storageState: { cookies: [], origins: [] } } },
    { name: "Home Screen PWA", options: { standalone: true, displayMode: "standalone" } },
    { name: "No service worker", options: { blockServiceWorker: true } },
    { name: "PWA + no SW", options: { standalone: true, displayMode: "standalone", blockServiceWorker: true } },
  ];

  const results = [];
  for (const s of scenarios) {
    results.push(await runScenario(browser, s.name, s.options));
  }

  // WebKit Safari engine if available
  try {
    const safari = await webkit.launch({ headless: true });
    results.push(
      await runScenario(safari, "WebKit Safari engine (/)", {})
    );
    await safari.close();
  } catch (e) {
    console.log(`\nWebKit unavailable: ${e.message}`);
  }

  await browser.close();

  results.forEach(printScenario);

  const anyFail = results.some((r) => r.blackScreen || r.passwordMissing || r.passwordInvisible);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`OVERALL: ${anyFail ? "REPRODUCED ISSUE" : "NO ISSUE IN AUTOMATED SCENARIOS"}`);
  console.log(`${"=".repeat(72)}\n`);

  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
