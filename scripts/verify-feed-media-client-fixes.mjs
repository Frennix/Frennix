#!/usr/bin/env node
/**
 * Regression: feed video reveal, web native images, lightbox scroll safety.
 *
 * Usage:
 *   node scripts/verify-feed-media-client-fixes.mjs
 *   node scripts/verify-feed-media-client-fixes.mjs --moov   # read-only moov probe
 *   node scripts/verify-feed-media-client-fixes.mjs --webkit # after build:web
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function probeMoovReadOnly() {
  const { probeHttpMetadata, fetchHeadTail, analyzeBinarySample } = await import(
    "../scripts/video-repair/lib/probe-binary.mjs"
  );
  const { mergeProbeResults, probeWithFfprobe, resolveFfprobeCommand } = await import(
    "../scripts/video-repair/lib/ffprobe.mjs"
  );

  const HOST = "wkrwncovmpsveatlrqel.supabase.co";
  const AUTHOR = "5a92aa10-d8bd-4311-a6e3-30ec95881062";
  const hyroxOriginal = `https://${HOST}/storage/v1/object/public/posts/${AUTHOR}/1787799043122.mp4`;
  const repairedSample = `https://${HOST}/storage/v1/object/public/posts/${AUTHOR}/repaired/9d13b65e-b49d-4591-ba53-943e9ff0e9de/repaired.mp4`;

  async function probe(label, url) {
    const http = await probeHttpMetadata(url);
    const size = http.contentLength ?? 0;
    const { head, tail } = await fetchHeadTail(url, size);
    const binary = analyzeBinarySample({ head, tail, fileSize: size });
    const ff = resolveFfprobeCommand();
    const ffprobe = probeWithFfprobe(url, ff);
    const merged = mergeProbeResults(ffprobe, binary);
    return {
      label,
      pathKind: url.includes("/repaired/") ? "repaired" : "original",
      fastStart: merged.fastStart,
      videoCodec: merged.primaryVideoCodec,
    };
  }

  const results = [await probe("hyrox-failing-post", hyroxOriginal), await probe("migrated-sample", repairedSample)];
  console.log("\nRead-only moov / fast-start probe (unauthenticated):");
  for (const row of results) {
    console.log(
      `  ${row.label}: path=${row.pathKind} fastStart=${row.fastStart} codec=${row.videoCodec ?? "?"}`
    );
  }

  const hyrox = results[0];
  const repaired = results[1];
  return (
    pass("Hyrox post (ad71dfbe) still serves original non-fast-start file", hyrox.fastStart === false) &&
    pass("Migrated repaired sample is fast-start", repaired.fastStart === true) &&
    pass(
      "Moov mismatch explained: Hyrox was not in 7-post migration",
      hyrox.pathKind === "original" && repaired.pathKind === "repaired"
    )
  );
}

async function runWebkitProbe() {
  const script = path.join(ROOT, ".video-repair/diag-unauth-webkit.mjs");
  if (!fs.existsSync(script)) {
    return pass("WebKit diagnostic script present", false, "missing .video-repair/diag-unauth-webkit.mjs");
  }

  const distIndex = path.join(ROOT, "dist/index.html");
  if (!fs.existsSync(distIndex)) {
    return pass("Production web build exists before WebKit probe", false, "run build:web first");
  }

  const diagTmp = path.join("/tmp", `frennix-pw-client-fixes-${Date.now()}`);
  fs.mkdirSync(diagTmp, { recursive: true });
  const browserCache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const install = spawnSync("npm", ["install", "playwright@1.62.1", "--no-save", "--silent"], {
    cwd: diagTmp,
    encoding: "utf8",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserCache,
    },
  });
  if (install.status !== 0) {
    fs.rmSync(diagTmp, { recursive: true, force: true });
    return pass("Playwright available for WebKit probe", false, install.stderr?.slice(0, 120));
  }

  const outPath = path.join(ROOT, ".video-repair/diag-unauth-webkit-results.json");
  const copied = path.join(diagTmp, "diag-unauth-webkit.mjs");
  fs.copyFileSync(script, copied);
  const run = spawnSync("node", [copied], {
    cwd: diagTmp,
    encoding: "utf8",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserCache,
    },
  });
  fs.rmSync(diagTmp, { recursive: true, force: true });

  if (run.stdout) fs.writeFileSync(outPath, run.stdout);
  if (run.status !== 0) {
    return pass("WebKit probe on failing media URLs", false, run.stderr?.slice(0, 200));
  }

  let parsed;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return pass("WebKit probe JSON output", false);
  }

  const video = parsed.results?.video;
  const c0 = parsed.results?.carousel0;
  const c1 = parsed.results?.carousel1;

  let ok = true;
  ok = pass("WebKit video reaches readyState >= 2", video?.readyState >= 2, `readyState=${video?.readyState}`) && ok;
  ok = pass("WebKit video has no media error", video?.errorCode == null, `code=${video?.errorCode}`) && ok;
  ok = pass("WebKit carousel image 0 decodes", c0?.ok === true, `${c0?.w}x${c0?.h}`) && ok;
  ok = pass("WebKit carousel image 1 decodes", c1?.ok === true, `${c1?.w}x${c1?.h}`) && ok;
  return ok;
}

async function main() {
  console.log("verify-feed-media-client-fixes\n");
  let ok = true;

  const feedPlayer = read("packages/ui/src/FeedVideoPlayer.tsx");
  const progressive = read("packages/ui/src/ProgressiveImage.tsx");
  const postMedia = read("packages/ui/src/PostMedia.tsx");
  const lightbox = read("components/ImageLightbox.tsx");
  const policy = read("packages/ui/src/videoMediaDelivery.ts");

  ok =
    pass(
      "Video reveal policy exports readyState >= 2 helper",
      policy.includes("feedVideoReadyToReveal") && policy.includes("VIDEO_REVEAL_FALLBACK_MS")
    ) && ok;

  ok =
    pass(
      "FeedVideoPlayer reveals on loadeddata / canplay / timeupdate",
      feedPlayer.includes("revealVideoFrame") &&
        feedPlayer.includes("onLoadedData") &&
        feedPlayer.includes("onCanPlay") &&
        feedPlayer.includes("onTimeUpdate")
    ) && ok;

  ok =
    pass(
      "requestVideoFrameCallback is enhancement only",
      feedPlayer.includes("scheduleVideoFrameCallbackReveal") &&
        feedPlayer.includes('typeof rvfc !== "function"')
    ) && ok;

  ok =
    pass(
      "Bounded reveal fallback poll cannot leave opacity at 0 forever",
      feedPlayer.includes("VIDEO_REVEAL_FALLBACK_MS") && feedPlayer.includes("VIDEO_REVEAL_POLL_MS")
    ) && ok;

  ok =
    pass(
      "Null thumbnail skips poster layer helper",
      policy.includes("shouldShowFeedVideoPosterLayer") &&
        feedPlayer.includes("shouldShowFeedVideoPosterLayer")
    ) && ok;

  ok =
    pass(
      "Timeout checks readyState before failing",
      feedPlayer.includes("feedVideoReadyToReveal(video.readyState)") &&
        feedPlayer.includes('reportVideoFailure("timeout"')
    ) && ok;

  ok =
    pass(
      "Web feed images use WebNativeImage path",
      progressive.includes("WebNativeImage") && progressive.includes('Platform.OS === "web"')
    ) && ok;

  ok =
    pass(
      "expo-image failure can fall back to native web img",
      progressive.includes("setUseNativeWebFallback(true)")
    ) && ok;

  ok =
    pass(
      "Unloaded feed image cannot open lightbox",
      postMedia.includes("imageLoaded") && postMedia.includes("if (imageFailed || !imageLoaded) return")
    ) && ok;

  ok =
    pass(
      "Lightbox restores document scroll on close/unmount",
      lightbox.includes("restoreWebDocumentScrollLock") &&
        lightbox.includes("if (!visible)") &&
        !lightbox.includes("previousBodyOverflow")
    ) && ok;

  ok =
    pass(
      "Failed lightbox image shows error and dismisses",
      lightbox.includes("onMediaError={dismiss}") &&
        lightbox.includes('label="Photo unavailable"') &&
        lightbox.includes("return false")
    ) && ok;

  console.log("\nRunning render regression…");
  const render = spawnSync(process.execPath, [path.join(__dirname, "verify-feed-media-client-fixes.render.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (render.stdout) process.stdout.write(render.stdout);
  if (render.stderr) process.stderr.write(render.stderr);
  ok = pass("Pure-function render regression", render.status === 0) && ok;

  if (process.argv.includes("--moov")) {
    ok = (await probeMoovReadOnly()) && ok;
  }

  if (process.argv.includes("--webkit")) {
    ok = (await runWebkitProbe()) && ok;
  }

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
