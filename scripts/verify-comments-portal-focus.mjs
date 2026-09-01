#!/usr/bin/env node
/**
 * Regression: modal comments portal must stay mounted/visible when composer is focused.
 *
 * Usage:
 *   node scripts/verify-comments-portal-focus.mjs
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
  console.log("verify-comments-portal-focus\n");
  let ok = true;
  const sheet = readSource("components/CommentsBottomSheet.tsx");
  const post = readSource("components/PostCommentsSheet.tsx");
  const overlay = readSource("lib/comments-overlay-state.ts");
  const styles = readSource("lib/web-document-styles.js");
  const closeDiag = readSource("lib/comments-close-diagnostics.ts");
  const focusDiag = readSource("lib/comments-portal-focus-diagnostics.ts");
  const feedPreview = readSource("packages/ui/src/FeedCommentPreview.tsx");
  const feedItem = readSource("components/FeedListItem.tsx");
  const index = readSource("app/(tabs)/index.tsx");

  ok =
    pass(
      "Close diagnostics log reason and portal snapshot",
      closeDiag.includes("CommentsCloseReason") && closeDiag.includes("logCommentsCloseRequest")
    ) && ok;
  ok =
    pass(
      "Portal focus diagnostics classify modal vs feed input",
      focusDiag.includes("activeCommentInputLocation") && focusDiag.includes("feed-inline")
    ) && ok;
  ok =
    pass(
      "CommentsBottomSheet logs close reasons",
      sheet.includes("requestClose") && sheet.includes('"close-button"') && sheet.includes('"backdrop-click"')
    ) && ok;
  ok =
    pass(
      "CommentsBottomSheet does not close on focus/blur/resize handlers",
      !sheet.includes('finishClose("focus")') &&
        !sheet.includes('finishClose("blur")') &&
        !sheet.includes('finishClose("visual-viewport')
    ) && ok;
  ok =
    pass(
      "Sheet surface stops pointer/touch propagation",
      sheet.includes("stopPointerEventPropagation") && sheet.includes("pointerdown")
    ) && ok;
  ok =
    pass(
      "Backdrop closes only on target === currentTarget",
      sheet.includes("event.target !== event.currentTarget")
    ) && ok;
  ok =
    pass(
      "Modal composer uses keyboardShouldPersistTaps always",
      sheet.includes('keyboardShouldPersistTaps="always"')
    ) && ok;
  ok =
    pass(
      "Overlay state blocks feed pointer events via body attribute",
      overlay.includes('data-frennix-comments-open') && styles.includes("pointer-events: none")
    ) && ok;
  ok =
    pass(
      "Inline feed composer hidden while comments open",
      feedPreview.includes("inlineComposerEnabled") &&
        feedItem.includes("inlineComposerEnabled") &&
        index.includes("inlineComposerEnabled={!commentsVisible}")
    ) && ok;
  ok =
    pass(
      "16px modal input preserved",
      post.includes('Platform.OS === "web" ? 16 : 15')
    ) && ok;
  ok =
    pass(
      "Horizontal restore from f46f64d preserved",
      post.includes("restoreWebHorizontalScrollPosition")
    ) && ok;
  ok =
    pass(
      "Full-screen layout geometry unchanged",
      sheet.includes("readVisualViewportHeight") && !sheet.match(/mobileWebSurface[\s\S]*offsetTop/)
    ) && ok;
  ok =
    pass(
      "Comment options z-index preserved",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100000")
    ) && ok;
  ok =
    pass(
      "Feed scroll lock does not mutate feed scroll list",
      !readSource("lib/web-modal-scroll-lock.ts").includes('feed.style.touchAction = "none"')
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
