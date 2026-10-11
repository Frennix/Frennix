#!/usr/bin/env node
/**
 * Render six newline-separated comment lines and assert both the first and
 * sixth lines fit without scrolling. Uses headless Chrome when available.
 *
 * Usage:
 *   node scripts/verify-reel-composer-five-lines.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FIXTURE = path.join(__dirname, "fixtures/reel-composer-five-lines.html");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function findChrome() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
  ];
  for (const candidate of candidates) {
    if (candidate.startsWith("/") && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function main() {
  console.log("verify-reel-composer-five-lines\n");
  let ok = true;
  const row = readSource("components/WebCommentComposerRow.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const sheet = readSource("components/CommentsBottomSheet.tsx");

  ok =
    pass(
      "Measurement uses an unconstrained probe, not a 0px clipped textarea",
      row.includes("measureWebCommentContentHeight") &&
        row.includes("data-frennix-comment-measure-probe") &&
        row.includes('setTextareaBox(textarea, "auto", "hidden")') &&
        row.includes("releaseFieldWrapperClip") &&
        !row.includes('setTextareaBox(textarea, "0px"')
    ) && ok;

  ok =
    pass(
      "Reel field CSS no longer pins 48px / overflow:hidden / contain:paint",
      styles.includes("[data-frennix-reel-comment-composer=\"true\"] [data-video-comment-field=\"true\"]") &&
        styles.includes("Reel composer must beat the shared 48px field pin") &&
        /reel-comment-composer="true"\] \[data-video-comment-field="true"\][\s\S]{0,280}height: auto !important/.test(
          styles
        ) &&
        /reel-comment-composer="true"\] \[data-video-comment-field="true"\][\s\S]{0,280}overflow: visible !important/.test(
          styles
        ) &&
        /reel-comment-composer="true"\] \[data-video-comment-field="true"\][\s\S]{0,280}contain: none !important/.test(
          styles
        )
    ) && ok;

  ok =
    pass(
      "Comments list yields and the composer host cannot shrink",
      styles.includes("[data-frennix-comments-sheet-body=\"true\"]") &&
        styles.includes("flex: 1 1 auto !important") &&
        styles.includes("min-height: 0 !important") &&
        sheet.includes('data-frennix-comments-sheet-body="true"') &&
        sheet.includes("flex: 1") &&
        sheet.includes("minHeight: 0") &&
        sheet.includes("flexShrink: 0") &&
        sheet.includes('overflow: "visible"')
    ) && ok;

  const chrome = findChrome();
  if (!chrome) {
    ok =
      pass(
        "Rendered six-line fixture in headless Chrome",
        false,
        "Google Chrome is not installed in this environment"
      ) && ok;
  } else {
    const dumped = spawnSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=2000",
        "--dump-dom",
        `file://${FIXTURE}`,
      ],
      { encoding: "utf8", timeout: 20000 }
    );
    const html = `${dumped.stdout}\n${dumped.stderr}`;
    const match = html.match(/data-result="([^"]+)"/);
    let result = null;
    if (match) {
      try {
        result = JSON.parse(match[1].replaceAll("&quot;", '"'));
      } catch {
        result = null;
      }
    }
    ok =
      pass(
        "Rendered six newline-separated lines without internal scroll",
        Boolean(result?.ok && result.visibleLines >= 5.9),
        result
          ? `visibleLines=${result.visibleLines.toFixed(2)} client=${result.textareaClientHeight} max=${result.maxHeight}`
          : dumped.status !== 0
            ? dumped.stderr.slice(0, 180)
            : "no data-result from headless Chrome"
      ) && ok;
  }

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
