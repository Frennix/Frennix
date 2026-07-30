#!/usr/bin/env node
/**
 * Static + optional browser audit for Home Feed horizontal overflow.
 * Usage: node scripts/audit-feed-width.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function record(results, name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function runStaticChecks() {
  const results = [];
  const tokens = read("packages/ui/src/feed-layout/tokens.ts");
  const stories = read("packages/ui/src/FeedStoriesRow.tsx");
  const shortcuts = read("packages/ui/src/FeedQuickActionCards.tsx");
  const actions = read("packages/ui/src/feed-layout/FeedPostActionBar.tsx");
  const postCard = read("packages/ui/src/FeedPostCard.tsx");
  const header = read("components/FeedHeader.tsx");
  const webStyles = read("lib/web-document-styles.js");

  record(
    results,
    "Post root avoids width 100% + margin overflow",
    /alignSelf:\s*"stretch"/.test(tokens) &&
      !/root:[\s\S]*width:\s*"100%"[\s\S]*marginHorizontal/.test(tokens)
  );
  record(results, "Stories header uses safe row layout", stories.includes("viewAllButton") && stories.includes("flex: 1"));
  record(results, "Stories horizontal list is width-clamped", stories.includes("nativeList") && stories.includes('maxWidth: "100%"'));
  record(results, "Shortcuts use four flex columns", shortcuts.includes("flex: 1") && shortcuts.includes("paddingHorizontal: spacing.md"));
  record(results, "Post actions are four equal items", actions.includes("flex: 1") && !actions.includes("onMore"));
  record(results, "More menu moved to post header", postCard.includes("headerMoreButton") && !postCard.includes("onMore={handleMorePress}"));
  record(
    results,
    "Feed header uses section padding",
    header.includes("paddedSection") &&
      !/container:\s*\{[^}]*paddingHorizontal:\s*spacing\.md/s.test(header)
  );
  record(results, "Web document uses border-box", webStyles.includes("box-sizing: border-box"));
  record(results, "Web overlay uses fixed viewport positioning", webStyles.includes("#feed-search-overlay") && webStyles.includes("position: fixed"));
  record(results, "Feed screen mounts search overlay", read("app/(tabs)/index.tsx").includes("FeedSearchOverlay"));

  return results;
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

async function runBrowserChecks(viewportWidth) {
  let playwrightPath = null;
  try {
    playwrightPath = require.resolve("playwright");
  } catch {
    return { skipped: true, width: viewportWidth };
  }

  const { server, baseUrl } = await startStaticServer();
  const pwModule = await import(pathToFileURL(playwrightPath).href);
  const { webkit } = pwModule.default ?? pwModule;
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: 844 } });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const metrics = await page.evaluate(() => {
      const ids = [
        "feed-root-container",
        "feed-scroll-shell",
        "feed-scroll-list",
        "feed-search-section",
        "feed-search-overlay",
        "feed-shortcut-row",
      ];
      const viewport = window.innerWidth;
      const docScroll = document.documentElement.scrollWidth;
      const bodyScroll = document.body.scrollWidth;
      const nodes = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return { id, missing: true };
        const rect = el.getBoundingClientRect();
        return {
          id,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          right: rect.right,
          overflow: el.scrollWidth - el.clientWidth,
        };
      });
      const firstOverflow = nodes.find((node) => !node.missing && node.scrollWidth > viewport + 1);
      return { viewport, docScroll, bodyScroll, nodes, firstOverflowId: firstOverflow?.id ?? null };
    });

    return { skipped: false, width: viewportWidth, metrics };
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const staticResults = runStaticChecks();
  if (staticResults.some((result) => !result.ok)) {
    process.exit(1);
  }

  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.log("\nBrowser audit skipped — build dist first.");
    return;
  }

  const widths = [320, 375, 390, 430];
  for (const width of widths) {
    const result = await runBrowserChecks(width);
    if (result.skipped) {
      console.log(`\nBrowser audit skipped at ${width}px (Playwright unavailable).`);
      return;
    }
    const { metrics } = result;
    const pageOverflow = Math.max(metrics.docScroll, metrics.bodyScroll) > metrics.viewport + 1;
    console.log(`\nViewport ${width}px — document scrollWidth ${metrics.docScroll}, body ${metrics.bodyScroll}`);
    for (const node of metrics.nodes) {
      if (node.missing) continue;
      console.log(
        `  ${node.id}: client=${node.clientWidth} scroll=${node.scrollWidth} right=${Math.round(node.right)}`
      );
    }
    if (pageOverflow || metrics.firstOverflowId) {
      console.error(
        `FAIL  Page overflow at ${width}px` +
          (metrics.firstOverflowId ? ` — first node: ${metrics.firstOverflowId}` : "")
      );
      process.exit(1);
    }
    console.log(`PASS  No page overflow at ${width}px`);
  }

  console.log("\nAll feed width audits passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
