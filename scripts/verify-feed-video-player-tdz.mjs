#!/usr/bin/env node
/**
 * Regression: FeedVideoPlayer must not reference reportVideoFailure before init (TDZ).
 * Also renders the web path with thumbnail, source change, and simulated media error.
 *
 * Usage:
 *   node scripts/verify-feed-video-player-tdz.mjs
 *   node scripts/verify-feed-video-player-tdz.mjs --bundle   # after build:web + source maps
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FEED_PLAYER = "packages/ui/src/FeedVideoPlayer.tsx";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

/** reportVideoFailure must be declared before every reference (hooks, deps, handlers). */
function verifySourceOrder(source) {
  const declMatch = source.match(
    /const reportVideoFailure = useCallback\s*\([\s\S]*?\n\s*\[[^\]]*\]\s*\);/
  );
  if (!declMatch) {
    return { ok: false, detail: "reportVideoFailure useCallback not found" };
  }
  const declEnd = declMatch.index + declMatch[0].length;
  const declLine = lineNumberAt(source, declMatch.index);

  const refs = [];
  const refPattern = /\breportVideoFailure\b/g;
  for (const match of source.matchAll(refPattern)) {
    if (match.index < declEnd) continue;
    refs.push({ index: match.index, line: lineNumberAt(source, match.index) });
  }

  const attemptMatch = source.match(/const attemptWebAutoplay = useCallback/);
  if (!attemptMatch) {
    return { ok: false, detail: "attemptWebAutoplay not found" };
  }
  const attemptLine = lineNumberAt(source, attemptMatch.index);
  if (declLine >= attemptLine) {
    return {
      ok: false,
      detail: `reportVideoFailure at line ${declLine} must precede attemptWebAutoplay at ${attemptLine}`,
    };
  }

  const depBeforeDecl = source
    .slice(0, declMatch.index)
    .includes("reportVideoFailure");
  if (depBeforeDecl) {
    return { ok: false, detail: "reportVideoFailure referenced before its declaration" };
  }

  return {
    ok: true,
    detail: `decl@${declLine}, attemptWebAutoplay@${attemptLine}, ${refs.length} post-decl refs`,
  };
}

function verifyBundleSourceMapOrder() {
  const distDir = path.join(ROOT, "dist/_expo/static/js/web");
  if (!fs.existsSync(distDir)) {
    return { ok: false, detail: "dist/_expo/static/js/web missing — run build:web first" };
  }

  const bundles = fs
    .readdirSync(distDir)
    .filter((f) => f.endsWith(".js") && f.startsWith("index-") && !f.includes("notifications"))
    .map((f) => ({
      name: f,
      size: fs.statSync(path.join(distDir, f)).size,
    }))
    .sort((a, b) => b.size - a.size);

  if (bundles.length === 0) {
    return { ok: false, detail: "no index web bundle found" };
  }

  const bundleName = bundles[0].name;
  const mapPath = path.join(distDir, `${bundleName}.map`);
  if (!fs.existsSync(mapPath)) {
    return {
      ok: false,
      detail: `${bundleName}.map missing — rebuild with EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=0 or --source-maps`,
    };
  }

  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const feedIdx = map.sources?.findIndex((s) =>
    String(s).includes("FeedVideoPlayer")
  );
  if (feedIdx == null || feedIdx < 0) {
    return { ok: false, detail: "FeedVideoPlayer not in bundle source map" };
  }

  const content = map.sourcesContent?.[feedIdx];
  if (!content) {
    return { ok: false, detail: "FeedVideoPlayer sourcesContent missing from map" };
  }

  const order = verifySourceOrder(content);
  if (!order.ok) {
    return { ok: false, detail: `bundled FeedVideoPlayer: ${order.detail}` };
  }

  return { ok: true, detail: `${bundleName} — ${order.detail}` };
}

function main() {
  console.log("verify-feed-video-player-tdz\n");
  let ok = true;

  const feedPlayer = readSource(FEED_PLAYER);
  const order = verifySourceOrder(feedPlayer);
  ok = pass("reportVideoFailure declared before all references", order.ok, order.detail) && ok;

  ok =
    pass(
      "attemptWebAutoplay depends on reportVideoFailure after declaration",
      (() => {
        const attemptStart = feedPlayer.indexOf("const attemptWebAutoplay = useCallback");
        const attemptEnd = feedPlayer.indexOf("const intersectionEnabled", attemptStart);
        const block = feedPlayer.slice(attemptStart, attemptEnd > attemptStart ? attemptEnd : attemptStart + 900);
        return block.includes("reportVideoFailure") && block.includes("[reportVideoFailure]");
      })()
    ) && ok;

  ok =
    pass(
      "useLayoutEffect onError calls reportVideoFailure (post-declaration)",
      feedPlayer.includes('const onError = () => reportVideoFailure(classifyVideoMediaError(video), video)')
    ) && ok;

  ok =
    pass(
      "First-frame timeout effect references reportVideoFailure in deps",
      (() => {
        const idx = feedPlayer.indexOf('reportVideoFailure("timeout", webVideoRef.current)');
        const block = feedPlayer.slice(idx, idx + 250);
        return block.includes("reportVideoFailure");
      })()
    ) && ok;

  ok =
    pass(
      "PostMedia passes populated thumbnail into FeedVideoPlayer",
      readSource("packages/ui/src/PostMedia.tsx").includes("thumbnailUrl={thumbnailUrl}")
    ) && ok;

  console.log("\nRunning render regression (web path + media error)…");
  const render = spawnSync(process.execPath, [path.join(__dirname, "verify-feed-video-player-tdz.render.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (render.stdout) process.stdout.write(render.stdout);
  if (render.stderr) process.stderr.write(render.stderr);
  ok = pass("FeedVideoPlayer render path survives media error", render.status === 0) && ok;

  if (process.argv.includes("--bundle")) {
    const bundle = verifyBundleSourceMapOrder();
    ok = pass("Production bundle source map has safe hook order", bundle.ok, bundle.detail) && ok;
  }

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
