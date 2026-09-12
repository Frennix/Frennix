#!/usr/bin/env node
/**
 * TDZ regression: FullscreenVideoSlide must declare seek helpers before useImperativeHandle.
 * Also mounts the slide the way ImmersiveVideoViewer does (ref + immersiveMode).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SLIDE = "packages/ui/src/FullscreenVideoSlide.tsx";
const VIEWER = "components/ImmersiveVideoViewer.tsx";

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function lineOf(source, snippet) {
  const idx = source.indexOf(snippet);
  return idx < 0 ? -1 : source.slice(0, idx).split("\n").length;
}

function main() {
  console.log("verify-fullscreen-slide-seek-tdz\n");
  let ok = true;
  const slide = read(SLIDE);
  const viewer = read(VIEWER);

  const seekLine = lineOf(slide, "  const seekTo = useCallback(");
  const durationLine = lineOf(slide, "  const getDuration = useCallback(");
  const elementLine = lineOf(slide, "  const getVideoElement = useCallback(");
  const handleLine = lineOf(slide, "  useImperativeHandle(");

  ok =
    pass(
      "seekTo / getDuration / getVideoElement are declared before useImperativeHandle",
      seekLine > 0 &&
        durationLine > seekLine &&
        elementLine > durationLine &&
        handleLine > elementLine,
      `seekTo@${seekLine} getDuration@${durationLine} getVideoElement@${elementLine} handle@${handleLine}`
    ) && ok;

  ok =
    pass(
      "useImperativeHandle is not the first seekTo reference",
      slide.indexOf("  const seekTo = useCallback(") < slide.indexOf("      seekTo,")
    ) && ok;

  ok =
    pass(
      "Reel viewer mounts FullscreenVideoSlide with a ref in immersiveMode",
      viewer.includes("<FullscreenVideoSlide") &&
        viewer.includes("ref={videoRef}") &&
        viewer.includes("immersiveMode") &&
        viewer.includes("<ReelScrubBar") &&
        viewer.includes("videoRef={videoRef}")
    ) && ok;

  console.log("\nRunning Reel-path render mount…");
  const render = spawnSync(process.execPath, [path.join(__dirname, "verify-fullscreen-slide-seek-tdz.render.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (render.stdout) process.stdout.write(render.stdout);
  if (render.stderr) process.stderr.write(render.stderr);
  ok = pass("FullscreenVideoSlide Reel path mounts without seekTo TDZ", render.status === 0) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
