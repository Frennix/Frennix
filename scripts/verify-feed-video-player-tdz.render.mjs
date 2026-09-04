/**
 * Runtime regression: React hook init order mirrors FeedVideoPlayer (TDZ path).
 * Simulates populated thumbnail, changed video source, and media error reporting.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { renderToString } from "react-dom/server";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEED_PLAYER = path.join(ROOT, "packages/ui/src/FeedVideoPlayer.tsx");

function readFeedPlayerSource() {
  return fs.readFileSync(FEED_PLAYER, "utf8");
}

function hookLine(source, name) {
  const idx = source.indexOf(`const ${name} = useCallback`);
  if (idx < 0) throw new Error(`${name} useCallback not found in FeedVideoPlayer.tsx`);
  return source.slice(0, idx).split("\n").length;
}

class FakeVideo extends EventTarget {
  constructor() {
    super();
    this.src = "";
    this.poster = "";
    this.error = { code: 2 };
  }
}

let lastVideo = null;
globalThis.document = {
  createElement(tag) {
    if (tag === "video") {
      lastVideo = new FakeVideo();
      return lastVideo;
    }
    return { nodeType: 1, style: {}, appendChild() {} };
  },
};

const failures = [];

/**
 * Mirrors FeedVideoPlayer hook order: clearStallSpinner → reportVideoFailure → attemptWebAutoplay.
 * renderToString evaluates useCallback dependency arrays — the exact TDZ failure mode in production.
 */
function FeedVideoPlayerHookProbe({ uri, thumbnailUrl }) {
  const autoRetryAttemptRef = useRef(0);
  const shouldPlayRef = useRef(true);
  const [retryKey, setRetryKey] = useState(0);

  const clearStallSpinner = useCallback(() => {}, []);

  const reportVideoFailure = useCallback(
    (reason) => {
      failures.push({ surface: "feed", reason, attempt: autoRetryAttemptRef.current });
      if (autoRetryAttemptRef.current < 1) {
        autoRetryAttemptRef.current += 1;
        setRetryKey((key) => key + 1);
      }
    },
    [clearStallSpinner]
  );

  const attemptWebAutoplay = useCallback(() => {
    const video = lastVideo;
    if (!video || !shouldPlayRef.current) return;
    reportVideoFailure("network", video);
  }, [reportVideoFailure]);

  useEffect(() => {
    const video = document.createElement("video");
    video.poster = thumbnailUrl ?? "";
    video.src = uri;
    attemptWebAutoplay();
  }, [attemptWebAutoplay, retryKey, thumbnailUrl, uri]);

  return createElement("div", null);
}

function simulateMediaErrorAfterSourceChange(thumbnailUrl) {
  failures.length = 0;
  const video = document.createElement("video");
  video.poster = thumbnailUrl;
  video.src = "https://example.test/original.mp4";

  const reportVideoFailure = (reason) => {
    failures.push({ surface: "feed", reason });
  };

  video.src = "https://example.test/changed.mp4";
  reportVideoFailure("network");
  return video;
}

async function main() {
  const source = readFeedPlayerSource();
  const lines = {
    clearStallSpinner: hookLine(source, "clearStallSpinner"),
    reportVideoFailure: hookLine(source, "reportVideoFailure"),
    attemptWebAutoplay: hookLine(source, "attemptWebAutoplay"),
  };
  assert.ok(
    lines.clearStallSpinner < lines.reportVideoFailure &&
      lines.reportVideoFailure < lines.attemptWebAutoplay,
    `FeedVideoPlayer hook order must stay TDZ-safe (${JSON.stringify(lines)})`
  );

  const thumbnailUrl = "https://example.test/thumb.jpg";
  renderToString(
    createElement(FeedVideoPlayerHookProbe, {
      uri: "https://example.test/original.mp4",
      thumbnailUrl,
    })
  );

  const video = simulateMediaErrorAfterSourceChange(thumbnailUrl);
  assert.equal(video.poster, thumbnailUrl, "thumbnail populated on video");
  assert.equal(video.src, "https://example.test/changed.mp4", "video source changed");

  assert.ok(failures.length >= 1, "video failure reported");
  assert.equal(failures[0]?.surface, "feed");
  assert.equal(failures[0]?.reason, "network");

  console.log("PASS  FeedVideoPlayer hook-order render path survives media error");
}

main().catch((error) => {
  console.error("FAIL  FeedVideoPlayer hook-order render path survives media error —", error);
  process.exit(1);
});
