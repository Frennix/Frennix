#!/usr/bin/env node
/**
 * Dev audit: find DOM nodes wider than the viewport (Feed, Discover, search overlay, profiles).
 * Usage: pnpm build:web && node scripts/audit-horizontal-overflow.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const require = createRequire(import.meta.url);

const OVERFLOW_AUDIT = `
(() => {
  const viewportWidth = document.documentElement.clientWidth;
  const offenders = [];

  document.querySelectorAll("*").forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (
      rect.right > viewportWidth + 1 ||
      rect.left < -1 ||
      element.scrollWidth > viewportWidth + 1
    ) {
      offenders.push({
        tag: element.tagName,
        id: element.id || null,
        className: typeof element.className === "string" ? element.className.slice(0, 80) : null,
        rect: {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        },
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      });
    }
  });

  return {
    viewportWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    offenderCount: offenders.length,
    offenders: offenders.slice(0, 40),
  };
})()
`;

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

async function auditViewport(page, label, width) {
  const result = await page.evaluate(OVERFLOW_AUDIT);
  const horizontalDrift =
    result.documentScrollWidth > result.documentClientWidth + 1 ||
    result.bodyScrollWidth > result.viewportWidth + 1;

  console.log(`\n[${label}] ${width}px`);
  console.log(
    `  document scrollWidth=${result.documentScrollWidth} clientWidth=${result.documentClientWidth} offenders=${result.offenderCount}`
  );

  if (horizontalDrift) {
    console.error(`  FAIL — page wider than viewport`);
  }

  if (result.offenderCount > 0) {
    for (const node of result.offenders.slice(0, 8)) {
      console.warn("  overflow:", node);
    }
  }

  return { horizontalDrift, offenderCount: result.offenderCount, ...result };
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("Build dist first: pnpm build:web");
    process.exit(1);
  }

  let playwrightPath = null;
  try {
    playwrightPath = require.resolve("playwright");
  } catch {
    console.log("Playwright unavailable — static audit only (no browser run).");
    process.exit(0);
  }

  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit } = pwModule.default ?? pwModule;
  const browser = await webkit.launch({ headless: true });
  const widths = [320, 375, 390, 430];
  const failures = [];

  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      const feed = await auditViewport(page, "feed-route", width);
      if (feed.horizontalDrift) failures.push(`feed ${width}px`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    console.error("\nHorizontal overflow audit failed:", failures.join(", "));
    process.exit(1);
  }

  console.log("\nHorizontal overflow audit passed (unauthenticated shell).");
}

main();
