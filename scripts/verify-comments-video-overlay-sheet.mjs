#!/usr/bin/env node
/**
 * Video-overlay comments sheet must be one opaque flex column with a visible body.
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
  console.log("verify-comments-video-overlay-sheet\n");
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const content = readSource("components/PostCommentsContent.tsx");
  const postSheet = readSource("components/PostCommentsSheet.tsx");
  const styles = readSource("lib/web-document-styles.js");
  const diag = readSource("lib/comments-sheet-runtime-diagnostics.ts");

  ok =
    pass(
      "Overlay is a fixed flex column above the lightbox",
      sheet.includes("COMMENTS_VIDEO_OVERLAY_Z_INDEX") &&
        sheet.includes("videoOverlaySheetColumn") &&
        sheet.includes("videoOverlayRootHeight") &&
        sheet.includes("overlayViewport?.visualHeight") &&
        sheet.includes("getImmersiveSessionPeekHeight") &&
        !sheet.includes("keyboardBottomGap") &&
        !/videoOverlayRootHeight = overlayViewport\\?\\.keyboardOpen/.test(sheet) &&
        sheet.includes('data-frennix-comments-sheet-surface') &&
        styles.includes("z-index: 100001") &&
        styles.includes("position: fixed !important")
    ) && ok;

  ok =
    pass(
      "Body scrolls inside the sheet and is not a passthrough layer",
      sheet.includes("data-frennix-comments-sheet-body") &&
        sheet.includes("minHeight: 0") &&
        styles.includes("z-index: 100001 !important") &&
        styles.includes('[data-frennix-comments-video-overlay="true"]') &&
        !/WEB_MOBILE_VIDEO_OVERLAY_ROOT[\s\S]{0,220}pointerEvents: "none"/.test(sheet) &&
        !styles.includes('pointer-events: none !important;\n    z-index: 100001')
    ) && ok;

  ok =
    pass(
      "Composer stays in-sheet; portal is unused for Reels comments",
      postSheet.includes("useVideoOverlayWebComposer: false") &&
        !postSheet.includes("VideoOverlayWebComposerPortal") &&
        content.includes("const useVideoOverlayWebComposer = useVideoOverlayWebComposerOption") &&
        !content.includes("compactComposer && Platform.OS === \"web\"")
    ) && ok;

  ok =
    pass(
      "Empty, loading, and error states are explicit",
      content.includes("No comments yet") &&
        content.includes("Loading comments…") &&
        content.includes("Retry") &&
        !content.includes("BODY OK") &&
        content.includes("[frennix-comments-diag] comments-query")
    ) && ok;

  ok =
    pass(
      "Runtime diagnostics measure overlay, body, composer, and viewport",
      diag.includes("[data-frennix-comments-sheet-body") &&
        diag.includes("[data-frennix-comment-composer-host") &&
        diag.includes("visualHeight") &&
        diag.includes("safeArea") &&
        sheet.includes("logCommentsSheetRuntimeDiagnostics")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
