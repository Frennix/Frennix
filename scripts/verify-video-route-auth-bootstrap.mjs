#!/usr/bin/env node
/**
 * Regression: dedicated /video/[postId] and /comments/[postId] routes count as
 * authenticated startup destinations (inline boot shell + React guards).
 *
 * Usage:
 *   node scripts/verify-video-route-auth-bootstrap.mjs
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
  console.log("verify-video-route-auth-bootstrap\n");
  let ok = true;

  const bootShell = readSource("lib/boot-shell-document.js");
  const startupReady = readSource("lib/authenticated-startup-ready.ts");
  const videoRoute = readSource("app/video/[postId].tsx");

  ok =
    pass(
      "Boot shell recognizes frennix-video-route destination",
      bootShell.includes('["frennix-video-route", 120]')
    ) && ok;
  ok =
    pass(
      "Boot shell recognizes frennix-comments-route destination",
      bootShell.includes('["frennix-comments-route", 120]')
    ) && ok;
  ok =
    pass(
      "React startup ready recognizes video route marker",
      startupReady.includes('"frennix-video-route"')
    ) && ok;
  ok =
    pass(
      "React startup ready recognizes comments route marker",
      startupReady.includes('"frennix-comments-route"')
    ) && ok;
  ok =
    pass(
      "Video route mounts shell marker before content loads",
      videoRoute.includes("VideoRouteShell") &&
        videoRoute.includes('nativeID: "frennix-video-route"')
    ) && ok;
  ok =
    pass(
      "Video route dismisses boot shell on web paint",
      videoRoute.includes("hideFrennixBootShell")
    ) && ok;
  ok =
    pass(
      "Video route reuses session userId (no second auth bootstrap)",
      videoRoute.includes("useAuth()") &&
        videoRoute.includes("session?.user.id") &&
        !videoRoute.includes("signOut")
    ) && ok;
  ok =
    pass(
      "Feed video links use client-side route navigation",
      readSource("packages/ui/src/FeedVideoPlayer.tsx").includes("feed-video-route-link") &&
        readSource("lib/mobile-web-video-route.ts").includes("navigateFromFeedVideoLink")
    ) && ok;

  console.log("");
  console.log(ok ? "All checks passed." : "Some checks failed.");
  process.exit(ok ? 0 : 1);
}

main();
