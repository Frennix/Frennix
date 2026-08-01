#!/usr/bin/env node
/**
 * Login screen rendering — production Safari + PWA.
 * Usage: node scripts/verify-login-rendering.mjs [baseUrl]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const baseUrlArg = (process.argv[2] ?? "https://frennix.vercel.app").replace(/\/$/, "");
const useLocal = baseUrlArg.includes("127.0.0.1") || baseUrlArg.includes("localhost");
const DIST = path.join(ROOT, "dist");

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
      res.writeHead(200);
      res.end(fs.readFileSync(filePath));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}
const require = createRequire(import.meta.url);

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ channel: "chrome", headless: true });
  }
}

async function probe(browser, base, label, options = {}) {
  const { standalone = false, displayMode = null } = options;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  if (displayMode) {
    await page.emulateMedia({ media: "screen", features: [{ name: "display-mode", value: displayMode }] });
  }
  if (standalone) {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    });
  }

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(
    () => /CONNECT\.|Sign In|Sign in|Email/i.test(document.body.innerText),
    { timeout: 30_000 }
  ).catch(() => undefined);
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const shell = document.getElementById("frennix-boot-shell");
    const inputs = [...document.querySelectorAll("input")];
    const signInVisible = /Sign In|Sign in/i.test(document.body.innerText);
    const button = [...document.querySelectorAll("button, [role='button'], a, div")].find((el) =>
      /sign in/i.test(el.textContent ?? "")
    );
    const inputStyles = inputs.map((el) => {
      const cs = getComputedStyle(el);
      return {
        type: el.getAttribute("type"),
        color: cs.color,
        bg: cs.backgroundColor,
        fill: cs.getPropertyValue("-webkit-text-fill-color"),
        opacity: cs.opacity,
        rect: el.getBoundingClientRect(),
      };
    });
    return {
      text: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 200),
      shellHidden: !shell || shell.style.display === "none",
      hasWelcome: /CONNECT\./i.test(document.body.innerText),
      hasEmailLabel: /Email/i.test(document.body.innerText),
      hasPasswordLabel: /Password/i.test(document.body.innerText),
      inputCount: inputs.length,
      inputStyles,
      buttonVisible: signInVisible || Boolean(button && button.getBoundingClientRect().height > 0),
      traceHasAuthLogin: (window.__FRENNIX_MOUNT_TRACE__ ?? []).some((e) => e.id === "auth-login:mounted"),
    };
  });

  await context.close();

  const readableInputs = state.inputStyles.every(
    (s) => s.rect.height > 20 && s.rect.width > 40 && s.opacity !== "0"
  );

  const results = [
    pass(`${label}: boot shell hidden`, state.shellHidden),
    pass(`${label}: sign-in branding visible`, state.hasWelcome, state.text.slice(0, 60)),
    pass(`${label}: email + password labels`, state.hasEmailLabel && state.hasPasswordLabel),
    pass(`${label}: inputs rendered`, state.inputCount >= 2 && readableInputs),
    pass(`${label}: sign-in button visible`, state.buttonVisible),
    pass(`${label}: auth-login mounted`, state.traceHasAuthLogin),
    pass(`${label}: no page errors`, errors.length === 0, errors[0] ?? "none"),
  ];

  return results.every(Boolean);
}

async function main() {
  let server;
  let baseUrl = baseUrlArg;
  if (useLocal) {
    ({ server, baseUrl } = await startStaticServer());
  }

  const html = await (await fetch(`${baseUrl}/`)).text();
  const hasAuthCss = html.includes("-webkit-text-fill-color") || html.includes("auth-login-screen");
  pass("Production HTML includes auth input CSS", hasAuthCss);

  const playwrightPath = (() => {
    try {
      return require.resolve("playwright");
    } catch {
      return "/tmp/pw-repro/node_modules/playwright/index.js";
    }
  })();
  const pw = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pw.default ?? pw;
  const browser = await launchBrowser(chromium);

  const ok =
    (await probe(browser, baseUrl, "Safari")) &&
    (await probe(browser, baseUrl, "Home Screen PWA", { standalone: true, displayMode: "standalone" }));

  await browser.close();
  if (server) server.close();
  console.log(`\n=== Login rendering: ${ok ? "PASS" : "FAIL"} ===\n`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
