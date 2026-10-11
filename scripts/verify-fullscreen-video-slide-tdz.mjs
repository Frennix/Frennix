#!/usr/bin/env node
/**
 * Regression: FullscreenVideoSlide must initialize seekTo before useImperativeHandle.
 * The Reels tab crash ("Cannot access 'seekTo' before initialization") was a TDZ in
 * this file — source maps can mis-attribute it to useMediaVisibility.ts.
 *
 * Usage:
 *   node scripts/verify-fullscreen-video-slide-tdz.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SLIDE = "packages/ui/src/FullscreenVideoSlide.tsx";
const VISIBILITY = "packages/ui/src/useMediaVisibility.ts";

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

function verifySlideDeclarationOrder(source) {
  const seekToMatch = source.match(/const seekTo = useCallback\s*\(/);
  const handleMatch = source.match(/useImperativeHandle\s*\(/);
  if (!seekToMatch || seekToMatch.index == null) {
    return { ok: false, detail: "seekTo useCallback not found" };
  }
  if (!handleMatch || handleMatch.index == null) {
    return { ok: false, detail: "useImperativeHandle not found" };
  }

  const seekToLine = lineNumberAt(source, seekToMatch.index);
  const handleLine = lineNumberAt(source, handleMatch.index);
  if (seekToLine >= handleLine) {
    return {
      ok: false,
      detail: `seekTo at line ${seekToLine} must precede useImperativeHandle at ${handleLine}`,
    };
  }

  const beforeSeekTo = source.slice(0, seekToMatch.index);
  if (/\bseekTo\b/.test(beforeSeekTo.replace(/seekTo:\s*\(time:/g, ""))) {
    const typeOnly = beforeSeekTo.includes("seekTo: (time: number) => void");
    const otherRefs = beforeSeekTo
      .replace(/seekTo:\s*\(time:\s*number\)\s*=>\s*void/g, "")
      .match(/\bseekTo\b/g);
    if (otherRefs && otherRefs.length > 0 && !typeOnly) {
      return { ok: false, detail: "seekTo referenced before its const declaration" };
    }
  }

  return { ok: true, detail: `seekTo@${seekToLine} before useImperativeHandle@${handleLine}` };
}

function verifyVisibilityHookHasNoSeekTo(source) {
  if (/\bseekTo\b/.test(source)) {
    return { ok: false, detail: "useMediaVisibility must not reference seekTo" };
  }
  const effectMatch = source.match(/useEffect\s*\(/);
  if (!effectMatch || effectMatch.index == null) {
    return { ok: false, detail: "useEffect not found" };
  }
  const effectLine = lineNumberAt(source, effectMatch.index);
  if (effectLine > 30) {
    return { ok: false, detail: `unexpected useEffect location at ${effectLine}` };
  }
  return { ok: true, detail: `visibility useEffect@${effectLine}, no seekTo` };
}

function main() {
  console.log("verify-fullscreen-video-slide-tdz\n");
  let ok = true;

  const slide = readSource(SLIDE);
  const visibility = readSource(VISIBILITY);

  const order = verifySlideDeclarationOrder(slide);
  ok = pass("seekTo is initialized before useImperativeHandle", order.ok, order.detail) && ok;

  ok =
    pass(
      "useImperativeHandle depends on seekTo after the callback exists",
      slide.includes("[currentTime, duration, isPaused, muted, seekTo, toggleMute]")
    ) && ok;

  const visibilityOrder = verifyVisibilityHookHasNoSeekTo(visibility);
  ok =
    pass(
      "useMediaVisibility keeps visibility/autoplay hooks and never mentions seekTo",
      visibilityOrder.ok,
      visibilityOrder.detail
    ) && ok;

  ok =
    pass(
      "Visibility threshold and IntersectionObserver autoplay gate are unchanged",
      visibility.includes("MEDIA_AUTOPLAY_VISIBILITY_THRESHOLD") &&
        visibility.includes("IntersectionObserver") &&
        visibility.includes("[externallyVisible]")
    ) && ok;

  console.log("\nRunning mount/TDZ render regression…");
  const render = spawnSync(process.execPath, [path.join(__dirname, "verify-fullscreen-video-slide-tdz.render.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (render.stdout) process.stdout.write(render.stdout);
  if (render.stderr) process.stderr.write(render.stderr);
  ok = pass("Hook mount survives TDZ initialization", render.status === 0) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
