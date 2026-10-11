#!/usr/bin/env node
/**
 * Reel comments composer: Instagram-style input + Send, no exploding avatar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function main() {
  console.log("verify-reel-comment-composer\n");
  let ok = true;
  const row = readSource("components/WebCommentComposerRow.tsx");
  const content = readSource("components/PostCommentsContent.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const diag = readSource("lib/comments-sheet-runtime-diagnostics.ts");

  ok =
    pass(
      "Reel composer is one dark row with Send inside the field",
      row.includes("hideAvatar") &&
        row.includes("data-frennix-reel-comment-composer") &&
        row.includes("data-frennix-comment-send") &&
        row.includes("colorScheme: \"dark\"") &&
        row.includes("WebkitAppearance: \"none\"") &&
        /hideAvatar \? \(\s*<button[\s\S]*Send[\s\S]*hideAvatar \? null :/.test(row) &&
        content.includes("hideAvatar={compactComposer}") &&
        /hideAvatar \? null :/.test(row)
    ) && ok;

  ok =
    pass(
      "In-sheet input cannot be display:none; images cannot expand in the host",
      styles.includes("[data-frennix-reel-comment-composer=\"true\"]") &&
        styles.includes("max-height: none !important") &&
        styles.includes("var(--comment-field-max-height, 156px)") &&
        /reel-comment-composer="true"\] img[\s\S]{0,80}display: none/.test(styles) &&
        !/comments-video-overlay="true"\][\s\S]{0,180}textarea[\s\S]{0,80}display: none/.test(styles) &&
        styles.includes("textarea[data-frennix-comment-input=\"true\"]") &&
        styles.includes("display: block !important") &&
        styles.includes("color-scheme: dark") &&
        styles.includes("appearance: none !important")
    ) && ok;

  ok =
    pass(
      "Composer grows to six visible lines using computed line height",
      row.includes("WEB_COMMENT_MAX_VISIBLE_LINES = 6") &&
        row.includes("computeWebCommentFieldMaxHeight") &&
        row.includes("measureWebCommentContentHeight") &&
        row.includes("releaseFieldWrapperClip") &&
        !row.includes("rows={2}") &&
        row.includes("event.stopPropagation()") &&
        !row.includes("event.preventDefault()")
    ) && ok;

  ok =
    pass(
      "Tap focuses the real textarea so iPhone Safari can open the keyboard",
        row.includes("textareaRef.current?.focus({ preventScroll: true })") &&
        row.includes("data-frennix-comment-input=\"true\"") &&
        row.includes("inputMode=\"text\"")
    ) && ok;

  ok =
    pass(
      "Diagnostics include composer row, avatar image, field, input, and Send",
      diag.includes("[data-frennix-reel-comment-composer") &&
        diag.includes("[data-web-comment-composer-row=\"true\"] img") &&
        diag.includes("[data-frennix-comment-send") &&
        diag.includes("textarea[data-frennix-comment-input")
    ) && ok;

  ok =
    pass(
      "Visible BODY OK debug label is removed",
      !content.includes("BODY OK") && !content.includes("data-frennix-comments-body-probe")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
