#!/usr/bin/env node
/**
 * Regression: mobile web/PWA comments use a dedicated /comments/[postId] route
 * instead of a portal over the feed.
 *
 * Usage:
 *   node scripts/verify-comments-route.mjs
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
  console.log("verify-comments-route\n");
  let ok = true;

  const routePath = "app/comments/[postId].tsx";
  const screen = readSource("components/PostCommentsScreen.tsx");
  const content = readSource("components/PostCommentsContent.tsx");
  const hook = readSource("lib/useFeedCommentsSheet.tsx");
  const nav = readSource("lib/mobile-web-comments-route.ts");
  const restore = readSource("lib/web-feed-scroll-restore.ts");
  const layout = readSource("app/_layout.tsx");
  const styles = readSource("lib/web-document-styles.js");

  ok = pass("A: dedicated comments route exists", fs.existsSync(path.join(ROOT, routePath))) && ok;
  ok =
    pass(
      "A: mobile web navigates to /comments/[postId]",
      nav.includes("router.push") &&
        nav.includes("/comments/") &&
        hook.includes("navigateToPostComments")
    ) && ok;

  ok =
    pass(
      "B: feed sheet not rendered on mobile web route path",
      hook.includes("mobileWebRoute ? null") && hook.includes("usesMobileWebCommentsRoute")
    ) && ok;

  ok =
    pass(
      "C: opaque flex-column screen layout (header / list / composer)",
      screen.includes("flexShrink: 0") &&
        screen.includes("flex: 1") &&
        screen.includes("minHeight: 0") &&
        screen.includes("webScrollSurface") &&
        screen.includes("data-frennix-comments-route")
    ) && ok;

  ok =
    pass(
      "C: no portal/backdrop/scroll-lock on dedicated screen",
      !screen.includes("createPortal") &&
        !screen.includes("lockWebModalScroll") &&
        !screen.includes("translateY") &&
        !screen.includes("offsetTop")
    ) && ok;

  ok =
    pass(
      "D/E: shared comment content supports post/like/reply",
      content.includes("addComment") &&
        content.includes("toggleCommentLike") &&
        content.includes("CommentThread") &&
        content.includes("useCommentActions")
    ) && ok;

  ok =
    pass(
      "F: comment options use root portal on route screen",
      screen.includes("rootPortal: true") && content.includes("rootPortal")
    ) && ok;

  ok =
    pass(
      "G: feed scroll saved before navigate and restored on back",
      nav.includes("saveFeedScrollReturnState") &&
        restore.includes("resolveFeedScrollPort") &&
        restore.includes("applyPendingFeedScrollReturnIfNeeded") &&
        readSource(routePath).includes("requestFeedScrollReturnRestore")
    ) && ok;

  ok =
    pass(
      "G: back blurs input before navigate",
      screen.includes("blurActiveWebInput") && screen.includes("onBack")
    ) && ok;

  ok =
    pass(
      "H: 16px web comment input preserved",
      content.includes('Platform.OS === "web" ? 16 : 15')
    ) && ok;

  ok =
    pass(
      "I: direct URL loads post via getPost with unavailable fallback",
      readSource(routePath).includes("getPost") && readSource(routePath).includes("Comments unavailable")
    ) && ok;

  ok =
    pass(
      "Stack registers comments/[postId] outside tabs",
      layout.includes('name="comments/[postId]"') && layout.includes("headerShown: false")
    ) && ok;

  ok =
    pass(
      "Comment options z-index above comments route",
      readSource("lib/overlay-z-index.ts").includes("commentOptions: 100000")
    ) && ok;

  ok =
    pass(
      "Opaque comments route CSS guard",
      styles.includes("frennix-comments-route") && styles.includes("min-height: 100dvh")
    ) && ok;

  ok =
    pass(
      "No duplicate PostCommentsSheet on mobile web",
      !hook.includes("PostCommentsSheet") ||
        (hook.includes("mobileWebRoute ? null") && hook.includes("PostCommentsSheet"))
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
